import { useState, useEffect, useCallback, useRef, useContext } from "react";
import {
  useLocation,
  useNavigate,
  UNSAFE_NavigationContext,
  To,
} from "react-router-dom";

export const ACTIVE_DEBATE_SESSION_KEY = "adpp_active_debate_session";
export const ACTIVE_DEBATE_CHANGED_EVENT = "adpp:active-debate-changed";

export interface ActiveDebateSessionMeta {
  sessionId: string;
  url: string;
  mode: "ai" | "1v1" | "2v2" | "competition";
  topicTitle: string;
  updatedAt: number;
}

export const saveActiveDebateSession = (meta: ActiveDebateSessionMeta) => {
  try {
    sessionStorage.setItem(ACTIVE_DEBATE_SESSION_KEY, JSON.stringify(meta));
    window.dispatchEvent(new Event(ACTIVE_DEBATE_CHANGED_EVENT));
  } catch {
    // Ignore storage errors
  }
};

export const readActiveDebateSession = (): ActiveDebateSessionMeta | null => {
  try {
    const raw = sessionStorage.getItem(ACTIVE_DEBATE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveDebateSessionMeta;
    if (!parsed || !parsed.sessionId || !parsed.url) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const clearActiveDebateSession = (sessionId?: string) => {
  try {
    if (!sessionId) {
      sessionStorage.removeItem(ACTIVE_DEBATE_SESSION_KEY);
      return;
    }
    const existing = readActiveDebateSession();
    if (!existing || existing.sessionId === sessionId) {
      sessionStorage.removeItem(ACTIVE_DEBATE_SESSION_KEY);
    }
  } catch {
    // Ignore storage errors
  }
};

export interface UseDebateNavigationGuardOptions {
  /** Whether the debate is actively in progress and navigation should be protected */
  when: boolean;
  /** Default path to navigate to when user clicks the in-room Exit/Back button */
  defaultExitPath?: string;
  /** Optional lifecycle callback executed once when the user confirms leaving */
  onBeforeLeave?: () => Promise<void> | void;
}

export interface UseDebateNavigationGuardResult {
  isConfirmOpen: boolean;
  isLeaving: boolean;
  requestExit: (targetPath?: string) => void;
  confirmLeave: () => Promise<void>;
  cancelLeave: () => void;
}

/**
 * Protects active debate sessions (AI 1v1, P2P 1v1, P2P 2v2) from accidental navigation.
 * - Intercepts internal route transitions (Header Back button, Sidebar NavLinks, Header Links, navigate() calls).
 * - Intercepts browser Back/Forward (popstate) in the capture phase before React Router processes it.
 * - Registers native browser beforeunload confirmation for refresh, tab close, or external navigation.
 * - Automatically disables protection when `when` is false (e.g., waiting lobby or completed/canceled session).
 */
export function useDebateNavigationGuard({
  when,
  defaultExitPath = "/debater/dashboard",
  onBeforeLeave,
}: UseDebateNavigationGuardOptions): UseDebateNavigationGuardResult {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationContext = useContext(UNSAFE_NavigationContext);
  const navigator = navigationContext?.navigator;

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const shouldBlockRef = useRef<boolean>(when);
  shouldBlockRef.current = when;

  const currentPathnameRef = useRef<string>(location.pathname);
  currentPathnameRef.current = location.pathname;

  const currentHrefRef = useRef<string>(
    `${location.pathname}${location.search}${location.hash}`
  );
  currentHrefRef.current = `${location.pathname}${location.search}${location.hash}`;

  const defaultExitPathRef = useRef<string>(defaultExitPath);
  defaultExitPathRef.current = defaultExitPath;

  const onBeforeLeaveRef = useRef(onBeforeLeave);
  onBeforeLeaveRef.current = onBeforeLeave;

  const isConfirmedLeaveRef = useRef<boolean>(false);
  const isLeavingRef = useRef<boolean>(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  // Automatically close confirmation modal and clear pending action when protection is deactivated
  useEffect(() => {
    if (!when) {
      setIsConfirmOpen(false);
      setIsLeaving(false);
      isLeavingRef.current = false;
      pendingActionRef.current = null;
      isConfirmedLeaveRef.current = false;
    }
  }, [when]);

  // 1. Intercept React Router internal navigation (NavLink, Link, useNavigate)
  useEffect(() => {
    if (!when || !navigator) return;

    const origPush = navigator.push.bind(navigator);
    const origReplace = navigator.replace.bind(navigator);
    const origGo = navigator.go.bind(navigator);

    const resolveTargetPathname = (to: To): string => {
      if (typeof to === "string") {
        const clean = to.split("?")[0]?.split("#")[0] || "";
        return clean;
      }
      return to.pathname || currentPathnameRef.current;
    };

    navigator.push = (to: To, state?: unknown, opts?: unknown) => {
      if (!shouldBlockRef.current || isConfirmedLeaveRef.current) {
        (origPush as (to: To, state?: unknown, opts?: unknown) => void)(to, state, opts);
        return;
      }

      const targetPathname = resolveTargetPathname(to);
      if (targetPathname === currentPathnameRef.current) {
        (origPush as (to: To, state?: unknown, opts?: unknown) => void)(to, state, opts);
        return;
      }

      pendingActionRef.current = () => {
        (origPush as (to: To, state?: unknown, opts?: unknown) => void)(to, state, opts);
      };
      setIsConfirmOpen(true);
    };

    navigator.replace = (to: To, state?: unknown, opts?: unknown) => {
      if (!shouldBlockRef.current || isConfirmedLeaveRef.current) {
        (origReplace as (to: To, state?: unknown, opts?: unknown) => void)(to, state, opts);
        return;
      }

      const targetPathname = resolveTargetPathname(to);
      if (targetPathname === currentPathnameRef.current) {
        (origReplace as (to: To, state?: unknown, opts?: unknown) => void)(to, state, opts);
        return;
      }

      pendingActionRef.current = () => {
        (origReplace as (to: To, state?: unknown, opts?: unknown) => void)(to, state, opts);
      };
      setIsConfirmOpen(true);
    };

    navigator.go = (delta: number) => {
      if (!shouldBlockRef.current || isConfirmedLeaveRef.current || delta === 0) {
        origGo(delta);
        return;
      }

      pendingActionRef.current = () => {
        origGo(delta);
      };
      setIsConfirmOpen(true);
    };

    return () => {
      navigator.push = origPush;
      navigator.replace = origReplace;
      navigator.go = origGo;
    };
  }, [when, navigator]);

  // 2. Intercept Browser Back / Forward buttons (popstate in capture phase)
  useEffect(() => {
    if (!when) return;

    const handlePopStateCapture = (event: PopStateEvent) => {
      if (!shouldBlockRef.current || isConfirmedLeaveRef.current) {
        return;
      }

      // Stop React Router from handling this popstate and unmounting DebateRoom
      event.stopImmediatePropagation();

      // Restore the current URL in browser history so the address bar remains on the active room
      try {
        window.history.pushState(window.history.state, "", currentHrefRef.current);
      } catch {
        // Ignore history state errors in restricted test environments
      }

      pendingActionRef.current = () => {
        navigate(defaultExitPathRef.current);
      };
      setIsConfirmOpen(true);
    };

    window.addEventListener("popstate", handlePopStateCapture, true);
    return () => {
      window.removeEventListener("popstate", handlePopStateCapture, true);
    };
  }, [when, navigate]);

  // 3. Native browser beforeunload confirmation for refresh, tab close, or external navigation
  useEffect(() => {
    if (!when) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!shouldBlockRef.current || isConfirmedLeaveRef.current) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [when]);

  const requestExit = useCallback(
    (targetPath?: string) => {
      const destination = targetPath || defaultExitPathRef.current;
      if (!shouldBlockRef.current || isConfirmedLeaveRef.current) {
        navigate(destination);
        return;
      }

      pendingActionRef.current = () => {
        navigate(destination);
      };
      setIsConfirmOpen(true);
    },
    [navigate]
  );

  const cancelLeave = useCallback(() => {
    if (isLeavingRef.current) return;
    pendingActionRef.current = null;
    setIsConfirmOpen(false);
  }, []);

  const confirmLeave = useCallback(async () => {
    if (isConfirmedLeaveRef.current || isLeavingRef.current) return;
    isLeavingRef.current = true;
    setIsLeaving(true);

    try {
      if (onBeforeLeaveRef.current) {
        await onBeforeLeaveRef.current();
      }
    } finally {
      isConfirmedLeaveRef.current = true;
      isLeavingRef.current = false;
      setIsLeaving(false);
      setIsConfirmOpen(false);

      const action = pendingActionRef.current;
      pendingActionRef.current = null;

      if (action) {
        action();
      } else {
        navigate(defaultExitPathRef.current);
      }
    }
  }, [navigate]);

  return {
    isConfirmOpen,
    isLeaving,
    requestExit,
    confirmLeave,
    cancelLeave,
  };
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clampRect } from "./useDraggablePanel";

export const NOTES_KEY_PREFIX = "adpp.debateNotes.";
export const MAX_NOTE_TABS = 10;
export const MAX_NOTE_CHARS = 5000;
export const NOTE_CHARS_WARNING = 4500;
export const MAX_TAB_TITLE = 30;
export const NOTES_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const NOTES_SAVE_DELAY_MS = 300;
export const NOTE_FONT_SIZES = [13, 15, 17] as const;

export interface NoteTab {
  id: string;
  title: string;
  text: string;
}

export interface NoteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What is kept in localStorage under adpp.debateNotes.<sessionId>.<userId>. */
export interface StoredNotes {
  version: 1;
  updatedAt: number;
  open: boolean;
  collapsed: boolean;
  rect: NoteRect;
  activeTab: string;
  tabs: NoteTab[];
  fontSize?: number;
}

export const DEFAULT_NOTE_SIZE = { w: 340, h: 420 };

export const notesKey = (sessionId: string | number, userId: string | number | null | undefined) =>
  `${NOTES_KEY_PREFIX}${sessionId}.${userId ?? "anon"}`;

/** Where the card starts: the bottom right, above the bar with the record and send buttons. */
export function defaultNoteRect(vw: number = window.innerWidth, vh: number = window.innerHeight): NoteRect {
  const w = Math.min(DEFAULT_NOTE_SIZE.w, Math.max(260, vw - 16));
  const h = Math.min(DEFAULT_NOTE_SIZE.h, Math.max(200, vh - 96));
  return { x: Math.max(0, vw - w - 16), y: Math.max(72, vh - h - 150), w, h };
}

const safeStorage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/** Removes every notes key not touched for more than 24 hours (and the ones that cannot be read at all). */
export function cleanOldNotes(now: number = Date.now()): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    const stale: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key || !key.startsWith(NOTES_KEY_PREFIX)) continue;
      let updatedAt = Number.NaN;
      try {
        updatedAt = Number((JSON.parse(storage.getItem(key) ?? "null") as { updatedAt?: unknown } | null)?.updatedAt);
      } catch {
        // damaged: treated as old
      }
      if (!Number.isFinite(updatedAt) || now - updatedAt > NOTES_MAX_AGE_MS) stale.push(key);
    }
    stale.forEach((key) => storage.removeItem(key));
  } catch {
    // storage blocked: nothing to clean
  }
}

const newId = () => `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function sanitize(raw: unknown): StoredNotes | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<StoredNotes>;
  if (data.version !== 1 || !Array.isArray(data.tabs)) return null;
  const tabs = data.tabs
    .filter((t): t is NoteTab => Boolean(t) && typeof t.id === "string" && typeof t.title === "string" && typeof t.text === "string")
    .slice(0, MAX_NOTE_TABS)
    .map((t) => ({ id: t.id, title: t.title.slice(0, MAX_TAB_TITLE), text: t.text.slice(0, MAX_NOTE_CHARS) }));
  if (tabs.length === 0) return null;
  const rect = data.rect;
  const validRect =
    rect && [rect.x, rect.y, rect.w, rect.h].every((n) => typeof n === "number" && Number.isFinite(n)) ? rect : null;
  return {
    version: 1,
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : 0,
    open: Boolean(data.open),
    collapsed: Boolean(data.collapsed),
    // A card saved on a bigger screen must not open off this one
    rect: clampRect(validRect ?? defaultNoteRect(), window.innerWidth, window.innerHeight, Boolean(data.collapsed)),
    activeTab: tabs.some((t) => t.id === data.activeTab) ? (data.activeTab as string) : tabs[0].id,
    tabs,
    fontSize: typeof data.fontSize === "number" ? Math.min(2, Math.max(0, Math.round(data.fontSize))) : undefined,
  };
}

function readStored(key: string): StoredNotes | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    return raw ? sanitize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** The next "Trang N" not taken by a page. */
export function nextPageTitle(tabs: NoteTab[]): string {
  const taken = new Set(tabs.map((t) => t.title));
  for (let n = 1; n <= MAX_NOTE_TABS + 1; n += 1) {
    if (!taken.has(`Trang ${n}`)) return `Trang ${n}`;
  }
  return `Trang ${tabs.length + 1}`;
}

interface UseDebateNotesParams {
  sessionId: string | number;
  userId: string | number | null | undefined;
  /** Only a debater has notes: a judge or a spectator gets nothing (no button, no key). */
  enabled: boolean;
  /** The debate is over (completed or cancelled): leaving the room deletes the notes of this session. */
  ended: boolean;
  /** Name of the current round ("Mở đầu", "Phản biện", "Kết luận"): the first page is named after it. */
  roundLabel: string;
}

/** State, saving, reading, deleting and the limits of the notes card. Storage may fail: the notes then just are not kept. */
export function useDebateNotes({ sessionId, userId, enabled, ended, roundLabel }: UseDebateNotesParams) {
  const key = notesKey(sessionId, userId);
  const roundLabelRef = useRef(roundLabel);
  roundLabelRef.current = roundLabel;

  const freshNotes = (): StoredNotes => {
    const first: NoteTab = { id: newId(), title: roundLabelRef.current || "Trang 1", text: "" };
    return {
      version: 1,
      updatedAt: Date.now(),
      open: false,
      collapsed: false,
      rect: defaultNoteRect(),
      activeTab: first.id,
      tabs: [first],
    };
  };
  // The key whose stored notes are in the state: the role and the user arrive after the first render of the room, so
  // the notes are read when `enabled` turns on (or the key changes), not only at mount
  const loadedKeyRef = useRef<string | null>(null);
  const [state, setState] = useState<StoredNotes>(() => {
    if (!enabled) return freshNotes();
    cleanOldNotes();
    loadedKeyRef.current = key;
    return readStored(key) ?? freshNotes();
  });
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const dirtyRef = useRef(false);
  const removedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endedRef = useRef(ended);
  endedRef.current = ended;
  // Was the card opened with the keyboard: then the text box gets the focus (with the mouse it never takes it)
  const [focusRequest, setFocusRequest] = useState(0);

  const write = useCallback(() => {
    if (removedRef.current || !enabledRef.current || loadedKeyRef.current !== key) return;
    const storage = safeStorage();
    const snapshot: StoredNotes = { ...stateRef.current, updatedAt: Date.now() };
    dirtyRef.current = false;
    setDirty(false);
    if (!storage) return;
    try {
      storage.setItem(key, JSON.stringify(snapshot));
      setSavedAt(snapshot.updatedAt);
    } catch {
      // blocked or full: the notes keep working, they are just not saved
    }
  }, [key]);

  /** Every change goes through here: it saves 300 ms after the last one. */
  const update = useCallback(
    (change: (current: StoredNotes) => StoredNotes) => {
      setState((current) => {
        const next = change(current);
        stateRef.current = next;
        return next;
      });
      dirtyRef.current = true;
      setDirty(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        write();
      }, NOTES_SAVE_DELAY_MS);
    },
    [write]
  );

  useEffect(() => {
    if (!enabled || loadedKeyRef.current === key) return;
    cleanOldNotes();
    loadedKeyRef.current = key;
    removedRef.current = false;
    const stored = readStored(key);
    if (stored) {
      stateRef.current = stored;
      setState(stored);
    }
  }, [enabled, key]);

  // Leaving the room: after the end of the debate the notes of this session are deleted, otherwise the last edit is kept
  useEffect(() => {
    removedRef.current = false;
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const storage = safeStorage();
      if (endedRef.current) {
        removedRef.current = true;
        try {
          storage?.removeItem(key);
        } catch {
          // nothing to delete
        }
      } else if (dirtyRef.current) {
        write();
      }
    };
  }, [key, write]);

  const setOpen = useCallback((open: boolean) => update((s) => ({ ...s, open, collapsed: open ? false : s.collapsed })), [update]);
  const toggleOpen = useCallback(() => update((s) => ({ ...s, open: !s.open, collapsed: s.open ? s.collapsed : false })), [update]);
  const setCollapsed = useCallback((collapsed: boolean) => update((s) => ({ ...s, collapsed })), [update]);
  // Moving or resizing changes the place on every pointer move: saving waits for the end of the gesture (saveNow)
  const setRect = useCallback((rect: NoteRect) => {
    setState((current) => {
      const next = { ...current, rect };
      stateRef.current = next;
      return next;
    });
  }, []);
  const saveNow = useCallback(() => update((s) => s), [update]);
  const setActiveTab = useCallback((id: string) => update((s) => (s.tabs.some((t) => t.id === id) ? { ...s, activeTab: id } : s)), [update]);
  const setFontSize = useCallback((fontSize: number) => update((s) => ({ ...s, fontSize: Math.min(2, Math.max(0, fontSize)) })), [update]);

  const addTab = useCallback(
    (title?: string): boolean => {
      if (stateRef.current.tabs.length >= MAX_NOTE_TABS) return false;
      const tab: NoteTab = {
        id: newId(),
        title: (title ?? nextPageTitle(stateRef.current.tabs)).slice(0, MAX_TAB_TITLE),
        text: "",
      };
      update((s) => (s.tabs.length >= MAX_NOTE_TABS ? s : { ...s, tabs: [...s.tabs, tab], activeTab: tab.id }));
      return true;
    },
    [update]
  );

  const renameTab = useCallback(
    (id: string, title: string) => {
      const clean = title.trim().slice(0, MAX_TAB_TITLE);
      if (!clean) return;
      update((s) => ({ ...s, tabs: s.tabs.map((t) => (t.id === id ? { ...t, title: clean } : t)) }));
    },
    [update]
  );

  /** At least one page always stays. */
  const removeTab = useCallback(
    (id: string) => {
      update((s) => {
        if (s.tabs.length <= 1) return s;
        const index = s.tabs.findIndex((t) => t.id === id);
        if (index < 0) return s;
        const tabs = s.tabs.filter((t) => t.id !== id);
        const activeTab = s.activeTab === id ? tabs[Math.min(index, tabs.length - 1)].id : s.activeTab;
        return { ...s, tabs, activeTab };
      });
    },
    [update]
  );

  const moveTab = useCallback(
    (id: string, toIndex: number) => {
      update((s) => {
        const from = s.tabs.findIndex((t) => t.id === id);
        if (from < 0 || toIndex < 0 || toIndex >= s.tabs.length || from === toIndex) return s;
        const tabs = [...s.tabs];
        const [moved] = tabs.splice(from, 1);
        tabs.splice(toIndex, 0, moved);
        return { ...s, tabs };
      });
    },
    [update]
  );

  /** A page keeps at most 5,000 characters. */
  const setText = useCallback(
    (id: string, text: string) => {
      const clipped = text.slice(0, MAX_NOTE_CHARS);
      update((s) => ({ ...s, tabs: s.tabs.map((t) => (t.id === id ? { ...t, text: clipped } : t)) }));
    },
    [update]
  );

  // Alt+N shows or hides the card (it only toggles: a recording goes on). Not from inside the card: it handles it itself.
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.code !== "KeyN") return;
      event.preventDefault();
      if (!stateRef.current.open) setFocusRequest((n) => n + 1);
      toggleOpen();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, toggleOpen]);

  const hasNotes = useMemo(() => state.tabs.some((t) => t.text.trim().length > 0), [state.tabs]);
  const activeTabData = state.tabs.find((t) => t.id === state.activeTab) ?? state.tabs[0];

  return {
    enabled,
    open: state.open,
    collapsed: state.collapsed,
    rect: state.rect,
    tabs: state.tabs,
    activeTab: activeTabData.id,
    activeTabData,
    fontSize: state.fontSize ?? 1,
    hasNotes,
    /** "Đã lưu": something was saved and nothing has changed since. */
    isSaved: savedAt !== null && !dirty,
    focusRequest,
    roundLabel: roundLabelRef.current,
    setOpen,
    toggleOpen,
    setCollapsed,
    setRect,
    saveNow,
    setActiveTab,
    setFontSize,
    addTab,
    renameTab,
    removeTab,
    moveTab,
    setText,
    requestFocus: () => setFocusRequest((n) => n + 1),
  };
}

export type DebateNotes = ReturnType<typeof useDebateNotes>;

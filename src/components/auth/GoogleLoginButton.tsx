import React, { useEffect, useRef, useState } from "react";
import { getAuthErrorMessage } from "../../utils/authError";

interface GoogleLoginButtonProps {
  onSuccess: (idToken: string) => Promise<void> | void;
  onError?: (error: string) => void;
  disabled?: boolean;
  text?: string;
  className?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              logo_alignment?: "left" | "center";
              width?: string | number;
              locale?: string;
            }
          ) => void;
          prompt: (
            momentListener?: (notification: {
              isNotDisplayed: () => boolean;
              getNotDisplayedReason: () => string;
              isSkippedMoment: () => boolean;
              getSkippedReason: () => string;
              isDismissedMoment: () => boolean;
              getDismissedReason: () => string;
            }) => void
          ) => void;
        };
      };
    };
  }
}

// Module-level singletons to prevent multiple initialize() calls across re-renders/mounts
let isGsiGloballyInitialized = false;
let activeSuccessCallback: ((idToken: string) => Promise<void> | void) | null = null;
let activeErrorCallback: ((error: string) => void) | null = null;

const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({
  onSuccess,
  onError,
  disabled = false,
  text = "Đăng nhập với Google",
  className = "",
}) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [isGisReady, setIsGisReady] = useState(false);

  const envClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const clientId =
    envClientId ||
    "119895824683-gvfvnu766krikjofaj3fjtfvk6marg30.apps.googleusercontent.com";

  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Log origin configuration instructions for developers
  const logOriginWarning = () => {
    const origin = window.location.origin;
    console.warn(
      `%c[ADPP Google Auth - Origin Configuration]%c\n` +
      `If you receive "[GSI_LOGGER]: The given origin is not allowed for the given client ID (403)", please configure Authorized JavaScript origins:\n` +
      `  1. Go to Google Cloud Console: https://console.cloud.google.com/apis/credentials\n` +
      `  2. Select OAuth 2.0 Client ID: "${clientId}"\n` +
      `  3. Under "Authorized JavaScript origins", add: "${origin}"\n` +
      `  4. Save changes and wait a few minutes for propagation.`,
      "color: #f59e0b; font-weight: bold;",
      "color: inherit;"
    );
  };

  useEffect(() => {
    if (!envClientId) {
      console.warn(
        "[ADPP Google Auth] VITE_GOOGLE_CLIENT_ID is not configured in environment variables. Using fallback Client ID."
      );
    }

    // Attach active callbacks to current component instance
    activeSuccessCallback = async (credential: string) => {
      setLoading(true);
      try {
        await onSuccessRef.current(credential);
      } catch (err: unknown) {
        const errorMsg = getAuthErrorMessage(err, "Đăng nhập Google thất bại.");
        onErrorRef.current?.(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    activeErrorCallback = (err: string) => {
      onErrorRef.current?.(err);
    };

    return () => {
      activeSuccessCallback = null;
      activeErrorCallback = null;
    };
  }, [envClientId]);

  useEffect(() => {
    let checkInterval: ReturnType<typeof setInterval> | null = null;
    let isMounted = true;

    const setupGoogleSignIn = () => {
      if (!isMounted) return false;
      if (!window.google?.accounts?.id) return false;

      try {
        // Prevent calling google.accounts.id.initialize() multiple times
        if (!isGsiGloballyInitialized) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response) => {
              if (response?.credential) {
                if (activeSuccessCallback) {
                  await activeSuccessCallback(response.credential);
                }
              } else {
                activeErrorCallback?.("Không nhận được token xác thực từ Google.");
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          });
          isGsiGloballyInitialized = true;
        }

        if (buttonRef.current && isMounted) {
          buttonRef.current.innerHTML = "";
          window.google.accounts.id.renderButton(buttonRef.current, {
            theme: "outline",
            size: "large",
            type: "standard",
            text: "signin_with",
            shape: "rectangular",
            logo_alignment: "left",
            width: buttonRef.current.offsetWidth || 340,
            locale: "vi",
          });
        }

        if (isMounted) setIsGisReady(true);
        return true;
      } catch (err) {
        console.error("[ADPP Google Auth] Error setting up Google Sign-In:", err);
        logOriginWarning();
        return false;
      }
    };

    if (!setupGoogleSignIn()) {
      checkInterval = setInterval(() => {
        if (setupGoogleSignIn()) {
          if (checkInterval) clearInterval(checkInterval);
        }
      }, 300);
    }

    return () => {
      isMounted = false;
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [clientId]);

  const handleManualClick = () => {
    if (disabled || loading) return;

    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt((notification) => {
          if (notification?.isNotDisplayed?.()) {
            const reason = notification.getNotDisplayedReason();
            if (reason === "opt_out_or_no_session") {
              // Expected if user is not signed in to Google in browser
              console.info("[ADPP Google Auth] User not currently signed in to Google account.");
            } else {
              console.warn(`[ADPP Google Auth] Prompt not displayed. Reason: ${reason}`);
              if (reason?.includes("origin") || reason === "unregistered_origin") {
                logOriginWarning();
                onErrorRef.current?.(
                  "Tên miền hiện tại chưa được cấp phép đăng nhập Google (Origin not allowed). Vui lòng dùng Đăng nhập Email."
                );
              }
            }
          } else if (notification?.isSkippedMoment?.()) {
            console.warn(`[ADPP Google Auth] Prompt skipped: ${notification.getSkippedReason()}`);
          }
        });
      } catch (e) {
        console.warn("[ADPP Google Auth] Prompt failed:", e);
        logOriginWarning();
        onErrorRef.current?.("Dịch vụ Google chưa sẵn sàng hoặc bị chặn trên trình duyệt.");
      }
    } else {
      onErrorRef.current?.("Dịch vụ Đăng nhập Google chưa sẵn sàng. Vui lòng thử lại sau giây lát.");
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="relative w-full">
        {/* Render container for official Google button */}
        <div
          ref={buttonRef}
          className={`w-full flex items-center justify-center overflow-hidden rounded-xl ${
            isGisReady ? "min-h-[44px]" : "hidden"
          }`}
        />

        {/* Custom styled fallback button */}
        {!isGisReady && (
          <button
            type="button"
            onClick={handleManualClick}
            disabled={disabled || loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 dark:bg-[#0F1726] dark:hover:bg-[#131D30] dark:border-[rgba(148,163,184,0.20)] dark:text-[#F8FAFC] text-sm sm:text-base font-semibold rounded-xl shadow-xs transition-all duration-150 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>{text}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default GoogleLoginButton;

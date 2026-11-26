import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import GoogleLoginButton from "../../../components/auth/GoogleLoginButton";
import AppleAuthShell from "../../../components/auth/AppleAuthShell";
import PasswordInput from "../../../components/auth/PasswordInput";
import { useAuth } from "../../../hooks/useAuth";
import { ROLES } from "../../../utils/constants";
import { getAuthErrorMessage } from "../../../utils/authError";
import { CheckCircle2, AlertCircle } from "lucide-react";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, googleLogin } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(
    (location.state as { message?: string })?.message || null
  );

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleRoleRedirect = (role?: string) => {
    const userRole = String(role);
    if (userRole === "Administrator" || userRole === "Admin" || userRole === ROLES.ADMIN) {
      navigate("/admin/dashboard");
    } else if (userRole === "Organizer" || userRole === ROLES.ORGANIZER) {
      navigate("/organizer/dashboard");
    } else {
      navigate("/debater/dashboard");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || isSuccess) return;

    setError("");

    if (!email.trim() || !password) {
      setError("Vui lòng nhập đầy đủ Email và Mật khẩu.");
      return;
    }

    setLoading(true);

    try {
      const result = await login({ email: email.trim(), password });

      if (result.success && result.user) {
        setIsSuccess(true);
        setTimeout(() => {
          handleRoleRedirect(result.user?.role);
        }, 400);
      } else {
        setError(getAuthErrorMessage(result, "Email hoặc mật khẩu không chính xác."));
      }
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err, "Email hoặc mật khẩu không chính xác."));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (idToken: string) => {
    if (loading || isSuccess) return;
    setError("");
    setLoading(true);

    try {
      const result = await googleLogin(idToken);
      if (result.success && result.user) {
        setIsSuccess(true);
        setTimeout(() => {
          handleRoleRedirect(result.user?.role);
        }, 400);
      } else {
        setError(getAuthErrorMessage(result, "Xác thực tài khoản Google thất bại."));
      }
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err, "Lỗi đăng nhập Google."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppleAuthShell
      title="Chào mừng trở lại"
      subtitle="Đăng nhập để tiếp tục với AI Debate Platform"
      footer={
        <>
          Chưa có tài khoản?{" "}
          <Link to="/register" className="font-medium text-accent hover:underline focus-visible:outline-none focus-visible:underline">
            Đăng ký ngay
          </Link>
        </>
      }
    >
      {/* Logout Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="mb-(--s-4) flex items-center gap-(--s-3) rounded-ap-md bg-accent-soft p-(--s-3) text-(length:--text-callout) text-label animate-fade-in motion-reduce:animate-none"
        >
          <CheckCircle2 size={18} className="shrink-0 text-accent" aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Success Notification during redirect */}
      {isSuccess && (
        <div
          role="status"
          className="mb-(--s-4) flex items-center gap-(--s-3) rounded-ap-md bg-accent-soft p-(--s-3) text-(length:--text-callout) text-label animate-fade-in motion-reduce:animate-none"
        >
          <CheckCircle2 size={18} className="shrink-0 text-accent" aria-hidden="true" />
          <span>Đăng nhập thành công! Đang chuyển hướng...</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-(--s-4)">
        {/* Email Field */}
        <div className="flex flex-col gap-(--s-2)">
          <label htmlFor="login-email" className="text-(length:--text-caption) font-medium text-label-secondary">
            Địa chỉ Email<span className="sr-only"> (bắt buộc)</span>
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError("");
            }}
            placeholder="your.email@example.com"
            required
            autoFocus
            autoComplete="email"
            disabled={loading || isSuccess}
            className="h-12 w-full rounded-ap-md border border-transparent bg-canvas-secondary px-(--s-4) text-(length:--text-body) text-label placeholder:text-label-tertiary outline-none transition-[box-shadow,border-color] duration-(--t-fast) ease-ap focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        {/* Password Field */}
        <PasswordInput
          appearance="apple"
          id="login-password"
          label="Mật khẩu"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError("");
          }}
          placeholder="••••••••••••"
          autoComplete="current-password"
          required
          disabled={loading || isSuccess}
          labelAction={
            <Link
              to="/forgot-password"
              className="text-(length:--text-caption) font-medium text-accent hover:underline focus-visible:outline-none focus-visible:underline"
            >
              Quên mật khẩu?
            </Link>
          }
        />

        {/* Remember me */}
        <label className="flex min-h-(--touch-target) cursor-pointer select-none items-center gap-(--s-3) text-(length:--text-callout) text-label-secondary">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={loading || isSuccess}
            className="h-5 w-5 cursor-pointer rounded-ap-sm accent-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
          />
          <span>Ghi nhớ đăng nhập</span>
        </label>

        {/* Error Alert - directly above the button */}
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-(--s-3) rounded-ap-md bg-ap-danger/10 p-(--s-3) text-(length:--text-callout) leading-(--leading-snug) text-label animate-fade-in motion-reduce:animate-none"
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-ap-danger" aria-hidden="true" />
            <span className="break-words">{error}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || isSuccess}
          className="flex h-12 w-full cursor-pointer items-center justify-center gap-(--s-2) rounded-ap-pill bg-accent px-(--s-5) text-(length:--text-body) font-medium text-accent-contrast transition-[background-color,transform] duration-(--t-fast) ease-ap hover:bg-accent-hover active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
              <span>Đang đăng nhập...</span>
            </>
          ) : isSuccess ? (
            <>
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>Thành công</span>
            </>
          ) : (
            <span>Đăng nhập</span>
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="my-(--s-5) flex items-center gap-(--s-3)" role="separator" aria-label="hoặc">
        <span className="h-px flex-1 bg-separator" />
        <span className="text-(length:--text-caption) text-label-tertiary">hoặc</span>
        <span className="h-px flex-1 bg-separator" />
      </div>

      {/* Google Login Button */}
      <GoogleLoginButton
        onSuccess={handleGoogleSuccess}
        onError={(msg) => setError(getAuthErrorMessage(msg, "Đăng nhập Google thất bại."))}
        disabled={loading || isSuccess}
        text="Tiếp tục với Google"
      />
    </AppleAuthShell>
  );
};

export default Login;

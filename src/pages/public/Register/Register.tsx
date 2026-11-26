import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import GoogleLoginButton from "../../../components/auth/GoogleLoginButton";
import AppleAuthShell from "../../../components/auth/AppleAuthShell";
import PasswordInput from "../../../components/auth/PasswordInput";
import PasswordStrength from "../../../components/auth/PasswordStrength";
import PasswordRequirements from "../../../components/auth/PasswordRequirements";
import ConfirmPasswordInput from "../../../components/auth/ConfirmPasswordInput";
import authApi from "../../../api/authApi";
import { useAuth } from "../../../hooks/useAuth";
import { ROLES } from "../../../utils/constants";
import { getAuthErrorMessage } from "../../../utils/authError";
import { CheckCircle2, AlertCircle, RefreshCw, ShieldCheck, ArrowLeft } from "lucide-react";

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { googleLogin } = useAuth();

  const [step, setStep] = useState<"form" | "otp">("form");
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

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

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!formData.fullName.trim() || !formData.email.trim() || !formData.password) {
      setError("Vui lòng điền đầy đủ các trường thông tin.");
      return;
    }

    if (formData.password.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.register({
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        password: formData.password,
      });

      if (res && res.success) {
        setSuccessMsg(res.message || "Mã OTP đã được gửi về email của bạn.");
        setCountdown(60);
        setStep("otp");
      } else {
        setError(res?.message || "Đăng ký thất bại. Vui lòng thử lại.");
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj?.message || "Không thể kết nối đến máy chủ xác thực.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!otpCode.trim()) {
      setError("Vui lòng nhập mã OTP 6 chữ số.");
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.verifyRegisterOtp({
        email: formData.email.trim(),
        otpCode: otpCode.trim(),
      });

      if (res && res.success) {
        setSuccessMsg("Kích hoạt tài khoản thành công! Đang chuyển đến trang đăng nhập...");
        setTimeout(() => {
          navigate("/login");
        }, 1500);
      } else {
        setError(res?.message || "Mã OTP không chính xác hoặc đã hết hạn.");
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj?.message || "Mã OTP không hợp lệ.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError("");
    setResending(true);
    try {
      const res = await authApi.sendOtp({
        email: formData.email.trim(),
        type: "Registration",
      });
      if (res && res.success) {
        setSuccessMsg("Mã OTP mới đã được gửi lại vào email của bạn.");
        setCountdown(60);
      } else {
        setError(res?.message || "Không thể gửi lại mã OTP.");
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj?.message || "Gửi lại OTP thất bại.");
    } finally {
      setResending(false);
    }
  };

  const handleGoogleSuccess = async (idToken: string) => {
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const result = await googleLogin(idToken);
      if (result.success && result.user) {
        setSuccessMsg("Đăng nhập bằng Google thành công! Đang chuyển hướng...");
        setTimeout(() => {
          handleRoleRedirect(result.user?.role);
        }, 400);
      } else {
        setError(getAuthErrorMessage(result, "Xác thực tài khoản Google thất bại."));
      }
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err, "Lỗi xác thực Google."));
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    "h-12 w-full rounded-ap-md border border-transparent bg-canvas-secondary px-(--s-4) text-(length:--text-body) text-label placeholder:text-label-tertiary outline-none transition-[box-shadow,border-color] duration-(--t-fast) ease-ap focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-60";
  const labelClass = "text-(length:--text-caption) font-medium text-label-secondary";
  const primaryButton =
    "flex h-12 w-full cursor-pointer items-center justify-center gap-(--s-2) rounded-ap-pill bg-accent px-(--s-5) text-(length:--text-body) font-medium text-accent-contrast transition-[background-color,transform] duration-(--t-fast) ease-ap hover:bg-accent-hover active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60";
  const spinner = <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />;

  return (
    <AppleAuthShell
      title={step === "form" ? "Tạo tài khoản mới" : "Xác thực Email OTP"}
      subtitle={
        step === "form"
          ? "Gia nhập nền tảng rèn luyện tranh biện AI chuẩn Quốc tế"
          : `Nhập mã xác thực 6 chữ số vừa được gửi đến email: ${formData.email}`
      }
      footer={
        <>
          Đã có tài khoản?{" "}
          <Link to="/login" className="font-medium text-accent hover:underline focus-visible:outline-none focus-visible:underline">
            Đăng nhập ngay
          </Link>
        </>
      }
    >
      {/* Step indicator */}
      <ol aria-label="Các bước đăng ký" className="mb-(--s-5) flex items-center justify-center gap-(--s-3) text-(length:--text-caption)">
        {[
          { id: "form", label: "Thông tin" },
          { id: "otp", label: "Xác thực OTP" },
        ].map((item, index) => {
          const isCurrent = step === item.id;
          const isDone = step === "otp" && item.id === "form";
          return (
            <React.Fragment key={item.id}>
              {index > 0 && <li aria-hidden="true" className="h-px w-8 bg-separator" />}
              <li
                aria-current={isCurrent ? "step" : undefined}
                className={`inline-flex items-center gap-(--s-2) font-medium ${isCurrent ? "text-label" : "text-label-secondary"}`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] ${
                    isCurrent
                      ? "bg-accent text-accent-contrast"
                      : isDone
                      ? "bg-accent-soft text-accent"
                      : "bg-canvas-secondary text-label-tertiary"
                  }`}
                >
                  {isDone ? <CheckCircle2 size={14} aria-hidden="true" /> : index + 1}
                </span>
                <span>{item.label}</span>
              </li>
            </React.Fragment>
          );
        })}
      </ol>

      {/* Alert Messages */}
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-(--s-4) flex items-start gap-(--s-3) rounded-ap-md bg-ap-danger/10 p-(--s-3) text-(length:--text-callout) leading-(--leading-snug) text-label"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-ap-danger" aria-hidden="true" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {successMsg && (
        <div role="status" className="mb-(--s-4) flex items-center gap-(--s-3) rounded-ap-md bg-accent-soft p-(--s-3) text-(length:--text-callout) text-label">
          <CheckCircle2 size={18} className="shrink-0 text-accent" aria-hidden="true" />
          <span>{successMsg}</span>
        </div>
      )}

      {step === "form" ? (
        <div>
          <GoogleLoginButton
            onSuccess={handleGoogleSuccess}
            onError={(msg) => setError(getAuthErrorMessage(msg, "Đăng ký với Google thất bại."))}
            disabled={loading}
            text="Đăng ký với Google"
          />

          <div className="my-(--s-5) flex items-center gap-(--s-3)" role="separator" aria-label="hoặc dùng email">
            <span className="h-px flex-1 bg-separator" />
            <span className="text-(length:--text-caption) text-label-tertiary">hoặc dùng email</span>
            <span className="h-px flex-1 bg-separator" />
          </div>

          <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-(--s-4)">
            {/* Full Name */}
            <div className="flex flex-col gap-(--s-2)">
              <label htmlFor="reg-fullname" className={labelClass}>
                Họ và tên<span className="sr-only"> (bắt buộc)</span>
              </label>
              <input
                id="reg-fullname"
                name="fullName"
                type="text"
                placeholder="Ví dụ: Nguyễn Văn A"
                autoComplete="name"
                value={formData.fullName}
                onChange={handleChange}
                required
                autoFocus
                disabled={loading}
                className={fieldClass}
              />
            </div>

            {/* Email Address */}
            <div className="flex flex-col gap-(--s-2)">
              <label htmlFor="reg-email" className={labelClass}>
                Địa chỉ Email<span className="sr-only"> (bắt buộc)</span>
              </label>
              <input
                id="reg-email"
                name="email"
                type="email"
                placeholder="your.email@example.com"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={loading}
                className={fieldClass}
              />
            </div>

            {/* Password Field */}
            <div>
              <PasswordInput
                appearance="apple"
                id="reg-password"
                name="password"
                label="Mật khẩu"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••••••"
                autoComplete="new-password"
                required
                disabled={loading}
              />
              <PasswordStrength appearance="apple" password={formData.password} />
              <PasswordRequirements appearance="apple" password={formData.password} />
            </div>

            {/* Confirm Password Field */}
            <ConfirmPasswordInput
              appearance="apple"
              id="reg-confirm-password"
              name="confirmPassword"
              label="Xác nhận mật khẩu"
              value={formData.confirmPassword}
              originalPassword={formData.password}
              onChange={handleChange}
              autoComplete="new-password"
              required
              disabled={loading}
            />

            <button type="submit" disabled={loading} className={primaryButton}>
              {loading ? (
                <>
                  {spinner}
                  <span>Đang khởi tạo tài khoản...</span>
                </>
              ) : (
                <span>Tiếp tục & nhận mã OTP</span>
              )}
            </button>
          </form>
        </div>
      ) : (
        /* STEP 2: OTP VERIFICATION */
        <form onSubmit={handleVerifyOtpSubmit} className="flex flex-col gap-(--s-4)">
          <div className="flex flex-col gap-(--s-2)">
            <div className="flex items-baseline justify-between gap-(--s-3)">
              <label htmlFor="reg-otp" className={labelClass}>
                Mã xác thực OTP (6 chữ số)
              </label>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={countdown > 0 || resending}
                className={`inline-flex items-center gap-(--s-2) text-(length:--text-caption) font-medium transition-colors focus-visible:outline-none focus-visible:underline ${
                  countdown > 0 || resending ? "cursor-not-allowed text-label-tertiary" : "cursor-pointer text-accent hover:underline"
                }`}
              >
                <RefreshCw size={13} className={resending ? "animate-spin" : ""} aria-hidden="true" />
                <span>{countdown > 0 ? `Gửi lại sau (${countdown}s)` : "Gửi lại mã OTP"}</span>
              </button>
            </div>

            <input
              id="reg-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              required
              autoFocus
              className="h-14 w-full rounded-ap-md border border-transparent bg-canvas-secondary px-(--s-4) text-center font-mono text-2xl tracking-[0.3em] text-label placeholder:text-label-tertiary outline-none transition-[box-shadow,border-color] duration-(--t-fast) ease-ap focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/25"
            />
          </div>

          <button type="submit" disabled={loading} className={primaryButton}>
            {loading ? (
              <>
                {spinner}
                <span>Đang xác thực...</span>
              </>
            ) : (
              <>
                <ShieldCheck size={18} aria-hidden="true" />
                <span>Xác thực & hoàn tất đăng ký</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setStep("form")}
            className="mx-auto inline-flex min-h-(--touch-target) cursor-pointer items-center gap-(--s-2) text-(length:--text-callout) font-medium text-label-secondary transition-colors hover:text-label focus-visible:outline-none focus-visible:underline"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span>Chỉnh sửa lại thông tin đăng ký</span>
          </button>
        </form>
      )}
    </AppleAuthShell>
  );
};

export default Register;

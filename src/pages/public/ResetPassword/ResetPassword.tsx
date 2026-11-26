import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../../../components/auth/AuthLayout";
import PasswordInput from "../../../components/auth/PasswordInput";
import PasswordStrength from "../../../components/auth/PasswordStrength";
import PasswordRequirements from "../../../components/auth/PasswordRequirements";
import ConfirmPasswordInput from "../../../components/auth/ConfirmPasswordInput";
import authApi from "../../../api/authApi";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Mail,
  LockKeyhole,
} from "lucide-react";

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const passedState = location.state as { email?: string; otpCode?: string };
    if (passedState?.email) {
      setEmail(passedState.email);
    }
    if (passedState?.otpCode) {
      setOtpCode(passedState.otpCode);
    }
  }, [location.state]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!email.trim()) {
      setError("Vui lòng nhập địa chỉ email.");
      return;
    }

    if (!otpCode.trim()) {
      setError("Vui lòng nhập mã OTP 6 chữ số.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Mật khẩu mới phải có tối thiểu 8 ký tự.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.resetPassword({
        email: email.trim(),
        otpCode: otpCode.trim(),
        newPassword,
      });

      if (res && res.success) {
        setSuccessMsg(
          res.message || "Đặt lại mật khẩu thành công! Đang chuyển đến trang đăng nhập..."
        );
        setTimeout(() => {
          navigate("/login");
        }, 1800);
      } else {
        setError(res?.message || "Mã OTP không chính xác hoặc đã hết hạn.");
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj?.message || "Không thể đặt lại mật khẩu. Vui lòng kiểm tra lại mã OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!email.trim()) {
      setError("Vui lòng nhập email trước khi yêu cầu gửi lại OTP.");
      return;
    }

    setError("");
    setResending(true);

    try {
      const res = await authApi.forgotPassword(email.trim());
      if (res && res.success) {
        setSuccessMsg("Mã OTP mới đã được gửi đến email của bạn.");
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

  return (
    <AuthLayout
      title="Đặt lại mật khẩu"
      subtitle="Nhập mã OTP xác thực và mật khẩu mới để khôi phục quyền truy cập tài khoản."
      badge="Bước 2: Thiết lập mật khẩu mới"
      showVisualSidebar={false}
    >
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-3 mb-6 pb-2">
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-[rgba(59,130,246,0.12)] text-blue-700 dark:text-[#60A5FA] border border-blue-200 dark:border-[rgba(59,130,246,0.25)]">
          <span className="w-5 h-5 rounded-full bg-blue-200 dark:bg-[#3B82F6]/30 text-blue-800 dark:text-[#60A5FA] flex items-center justify-center text-[11px]">
            ✓
          </span>
          <span>Gửi yêu cầu OTP</span>
        </div>

        <div className="w-6 h-0.5 bg-slate-200 dark:bg-slate-700" />

        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#0B5ED7] dark:bg-[#3B82F6] text-white shadow-xs">
          <span className="w-5 h-5 rounded-full bg-white/25 flex items-center justify-center text-[11px]">
            2
          </span>
          <span>Đặt lại mật khẩu</span>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="p-3.5 mb-4 text-xs sm:text-sm rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300 font-medium animate-fade-in flex items-start gap-2.5">
          <AlertCircle size={17} className="text-rose-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 mb-4 text-xs sm:text-sm rounded-xl bg-blue-50 dark:bg-[rgba(59,130,246,0.12)] border border-blue-200 dark:border-[rgba(59,130,246,0.25)] text-blue-700 dark:text-[#60A5FA] font-medium animate-fade-in flex items-center gap-2.5">
          <CheckCircle2 size={18} className="text-blue-600 dark:text-[#60A5FA] shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleResetSubmit} className="space-y-4">
        {/* Email Address */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reset-email" className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-[#F8FAFC]">
            Địa chỉ Email <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Mail size={16} />
            </div>
            <input
              id="reset-email"
              type="email"
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="w-full py-2.5 sm:py-3 pl-10 pr-4 text-sm sm:text-base bg-white dark:bg-[#0F1726] border border-slate-200 hover:border-slate-300 dark:border-[rgba(148,163,184,0.20)] dark:hover:border-[rgba(148,163,184,0.30)] rounded-xl text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all duration-200 outline-none focus:border-[#0B5ED7] dark:focus:border-[#3B82F6] focus:ring-2 focus:ring-[#0B5ED7]/15 dark:focus:ring-[#3B82F6]/20 disabled:bg-slate-50 dark:disabled:bg-[#070c17]"
            />
          </div>
        </div>

        {/* OTP Code with Resend */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="reset-otp" className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-[#F8FAFC]">
              Mã xác thực OTP (6 chữ số) <span className="text-rose-500">*</span>
            </label>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={countdown > 0 || resending}
              className={`text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                countdown > 0 || resending
                  ? "text-slate-400 cursor-not-allowed"
                  : "text-[#0B5ED7] dark:text-[#60A5FA] hover:text-[#0a4fb4] dark:hover:text-blue-300 hover:underline"
              }`}
            >
              <RefreshCw size={13} className={resending ? "animate-spin" : ""} />
              <span>{countdown > 0 ? `Gửi lại sau (${countdown}s)` : "Gửi lại mã OTP"}</span>
            </button>
          </div>

          <input
            id="reset-otp"
            type="text"
            placeholder="123456"
            maxLength={6}
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            required
            disabled={loading}
            className="w-full py-2.5 sm:py-3 px-4 text-center tracking-[0.25em] font-mono text-lg bg-white dark:bg-[#0F1726] border border-slate-200 hover:border-slate-300 dark:border-[rgba(148,163,184,0.20)] dark:hover:border-[rgba(148,163,184,0.30)] rounded-xl text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-300 dark:placeholder-slate-600 focus:border-[#0B5ED7] dark:focus:border-[#3B82F6] focus:ring-2 focus:ring-[#0B5ED7]/15 dark:focus:ring-[#3B82F6]/20 outline-none transition-all"
          />
        </div>

        {/* New Password */}
        <div>
          <PasswordInput
            id="reset-new-password"
            label="Mật khẩu mới"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••••••"
            required
            disabled={loading}
          />

          <PasswordStrength password={newPassword} />
          <PasswordRequirements password={newPassword} />
        </div>

        {/* Confirm New Password */}
        <ConfirmPasswordInput
          id="reset-confirm-password"
          label="Xác nhận mật khẩu mới"
          value={confirmPassword}
          originalPassword={newPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={loading}
        />

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 sm:py-3.5 px-4 rounded-xl text-sm sm:text-base font-bold text-white bg-[#0B5ED7] dark:bg-[#3B82F6] hover:bg-[#0a4fb4] dark:hover:bg-[#60A5FA] active:bg-[#072f70] transition-all duration-200 shadow-md shadow-[#0B5ED7]/25 flex items-center justify-center gap-2 mt-3 cursor-pointer disabled:opacity-60"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Đang lưu mật khẩu mới...</span>
            </>
          ) : (
            <>
              <LockKeyhole size={17} />
              <span>Lưu mật khẩu mới & Đăng nhập</span>
            </>
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-100 dark:border-[rgba(148,163,184,0.18)] text-center">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 dark:text-[#94A3B8] hover:text-[#0B5ED7] dark:hover:text-[#60A5FA] transition-colors"
        >
          <ArrowLeft size={15} />
          <span>Quay lại Đăng nhập</span>
        </Link>
      </div>
    </AuthLayout>
  );
};

export default ResetPassword;

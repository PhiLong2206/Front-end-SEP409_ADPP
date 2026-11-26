import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../../../components/auth/AuthLayout";
import authApi from "../../../api/authApi";
import { ArrowLeft, Mail, CheckCircle2, AlertCircle, KeyRound } from "lucide-react";

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!email.trim()) {
      setError("Vui lòng nhập địa chỉ email của bạn.");
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.forgotPassword(email.trim());

      if (res && res.success) {
        setSuccessMsg(res.message || "Mã OTP đặt lại mật khẩu đã được gửi đến email của bạn.");
        setTimeout(() => {
          navigate("/reset-password", { state: { email: email.trim() } });
        }, 1500);
      } else {
        setError(res?.message || "Không thể gửi mã OTP. Vui lòng kiểm tra lại email.");
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj?.message || "Không thể kết nối đến máy chủ xác thực.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Quên mật khẩu?"
      subtitle="Nhập email đã đăng ký của bạn để nhận mã xác thực OTP khôi phục quyền truy cập."
      badge="Khôi phục tài khoản"
      showVisualSidebar={false}
    >
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-3 mb-6 pb-2">
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#0B5ED7] dark:bg-[#3B82F6] text-white shadow-xs">
          <span className="w-5 h-5 rounded-full bg-white/25 flex items-center justify-center text-[11px]">
            1
          </span>
          <span>Gửi yêu cầu OTP</span>
        </div>

        <div className="w-6 h-0.5 bg-slate-200 dark:bg-slate-700" />

        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-[#0F1726] text-slate-400 dark:text-[#94A3B8]">
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

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="forgot-email" className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-[#F8FAFC]">
            Địa chỉ Email đã đăng ký <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Mail size={16} />
            </div>
            <input
              id="forgot-email"
              type="email"
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              disabled={loading}
              className="w-full py-2.5 sm:py-3 pl-10 pr-4 text-sm sm:text-base bg-white dark:bg-[#0F1726] border border-slate-200 hover:border-slate-300 dark:border-[rgba(148,163,184,0.20)] dark:hover:border-[rgba(148,163,184,0.30)] rounded-xl text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all duration-200 outline-none focus:border-[#0B5ED7] dark:focus:border-[#3B82F6] focus:ring-2 focus:ring-[#0B5ED7]/15 dark:focus:ring-[#3B82F6]/20 disabled:bg-slate-50 dark:disabled:bg-[#070c17]"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 sm:py-3.5 px-4 rounded-xl text-sm sm:text-base font-bold text-white bg-[#0B5ED7] dark:bg-[#3B82F6] hover:bg-[#0a4fb4] dark:hover:bg-[#60A5FA] active:bg-[#072f70] transition-all duration-200 shadow-md shadow-[#0B5ED7]/25 flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-60"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Đang gửi mã xác thực...</span>
            </>
          ) : (
            <>
              <KeyRound size={17} />
              <span>Gửi mã OTP xác thực</span>
            </>
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-100 dark:border-[rgba(148,163,184,0.18)] flex items-center justify-between text-xs sm:text-sm text-slate-600 dark:text-[#94A3B8]">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 font-semibold text-slate-600 dark:text-[#94A3B8] hover:text-[#0B5ED7] dark:hover:text-[#60A5FA] transition-colors"
        >
          <ArrowLeft size={15} />
          <span>Quay lại Đăng nhập</span>
        </Link>

        <Link
          to="/reset-password"
          className="font-bold text-[#0B5ED7] dark:text-[#60A5FA] hover:text-[#0a4fb4] dark:hover:text-blue-300 hover:underline"
        >
          Đã có mã OTP?
        </Link>
      </div>
    </AuthLayout>
  );
};

export default ForgotPassword;

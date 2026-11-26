import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../../../components/auth/AuthLayout";
import authApi from "../../../api/authApi";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Mail,
} from "lucide-react";

const VerifyOtp: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("Registration");
  const [countdown, setCountdown] = useState(0);
  const [resending, setResending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const state = location.state as { email?: string; type?: string };
    if (state?.email) setEmail(state.email);
    if (state?.type) setType(state.type);
  }, [location.state]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!email.trim() || !code.trim()) {
      setError("Vui lòng điền đầy đủ email và mã OTP.");
      return;
    }

    setLoading(true);

    try {
      let res;
      if (type === "Registration") {
        res = await authApi.verifyRegisterOtp({
          email: email.trim(),
          otpCode: code.trim(),
        });
      } else {
        res = await authApi.verifyOtp({
          email: email.trim(),
          code: code.trim(),
          type,
        });
      }

      if (res && res.success) {
        setSuccessMsg(res.message || "Xác thực OTP thành công!");
        setTimeout(() => {
          if (type === "ForgotPassword") {
            navigate("/reset-password", { state: { email: email.trim(), otpCode: code.trim() } });
          } else {
            navigate("/login");
          }
        }, 1500);
      } else {
        setError(res?.message || "Mã OTP không hợp lệ hoặc đã hết hạn.");
      }
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setError(errorObj?.message || "Xác thực OTP thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) {
      setError("Vui lòng nhập email để gửi lại mã.");
      return;
    }

    setError("");
    setResending(true);

    try {
      const res = await authApi.sendOtp({
        email: email.trim(),
        type,
      });

      if (res && res.success) {
        setSuccessMsg("Mã OTP mới đã được gửi thành công.");
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
      title="Xác thực mã OTP"
      subtitle={`Nhập mã bảo mật 6 chữ số vừa được gửi tới hòm thư của bạn: ${email || ""}`}
      badge="Bảo mật tài khoản"
      showVisualSidebar={false}
    >
      {/* Alert Messages */}
      {error && (
        <div className="p-3.5 mb-4 text-xs sm:text-sm rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-medium animate-fade-in flex items-start gap-2.5">
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

      <form onSubmit={handleVerify} className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="verify-email" className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-[#F8FAFC]">
            Địa chỉ Email <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Mail size={16} />
            </div>
            <input
              id="verify-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@example.com"
              required
              disabled={loading}
              className="w-full py-2.5 sm:py-3 pl-10 pr-4 text-sm sm:text-base bg-white dark:bg-[#0F1726] border border-slate-200 hover:border-slate-300 dark:border-[rgba(148,163,184,0.20)] dark:hover:border-[rgba(148,163,184,0.30)] rounded-xl text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all duration-200 outline-none focus:border-[#0B5ED7] dark:focus:border-[#3B82F6] focus:ring-2 focus:ring-[#0B5ED7]/15 dark:focus:ring-[#3B82F6]/20 disabled:bg-slate-50 dark:disabled:bg-[#070c17]"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="verify-code" className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-[#F8FAFC]">
              Mã OTP (6 chữ số) <span className="text-rose-500">*</span>
            </label>
            <button
              type="button"
              onClick={handleResend}
              disabled={countdown > 0 || resending}
              className={`text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                countdown > 0 || resending
                  ? "text-slate-400 cursor-not-allowed"
                  : "text-[#0B5ED7] dark:text-[#60A5FA] hover:text-[#0a4fb4] dark:hover:text-blue-300 hover:underline"
              }`}
            >
              <RefreshCw size={13} className={resending ? "animate-spin" : ""} />
              <span>{countdown > 0 ? `Gửi lại sau (${countdown}s)` : "Gửi lại OTP"}</span>
            </button>
          </div>

          <input
            id="verify-code"
            type="text"
            placeholder="123456"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            autoFocus
            disabled={loading}
            className="w-full py-3 px-4 text-center tracking-[0.3em] font-mono text-xl sm:text-2xl bg-white dark:bg-[#0F1726] border border-slate-200 hover:border-slate-300 dark:border-[rgba(148,163,184,0.20)] dark:hover:border-[rgba(148,163,184,0.30)] rounded-xl text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-[#0B5ED7] dark:focus:border-[#3B82F6] focus:ring-2 focus:ring-[#0B5ED7]/15 dark:focus:ring-[#3B82F6]/20 outline-none transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 px-4 rounded-xl text-sm sm:text-base font-bold text-white bg-[#0B5ED7] dark:bg-[#3B82F6] hover:bg-[#0a4fb4] dark:hover:bg-[#60A5FA] active:bg-[#072f70] transition-all duration-200 shadow-md shadow-[#0B5ED7]/25 flex items-center justify-center gap-2 mt-4 cursor-pointer disabled:opacity-60"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Đang xác thực...</span>
            </>
          ) : (
            <>
              <ShieldCheck size={18} />
              <span>Xác thực ngay</span>
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

export default VerifyOtp;

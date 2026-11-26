import React, { ReactNode } from "react";
import { Link } from "react-router-dom";
import AppLogo from "../common/AppLogo";
import {
  Sparkles,
  Bot,
  BarChart3,
} from "lucide-react";

import natureBg from "../../assets/images/nature-bg.jpg";

export interface AuthLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  badge?: string;
  showVisualSidebar?: boolean;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  subtitle,
  badge = "Nền tảng tranh biện AI thế hệ mới",
  showVisualSidebar = true,
}) => {
  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#F4F7FC] dark:bg-[#050A13] text-[#101828] dark:text-[#F8FAFC] flex flex-col justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 relative selection:bg-[#0B5ED7] selection:text-white overflow-hidden transition-colors duration-200">
      {/* Crisp Nature Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{
          backgroundImage: `url(${natureBg})`,
        }}
      />
      {/* Local Gradient for Left Hero Readability (Light Mode) */}
      <div
        className="absolute inset-0 pointer-events-none dark:hidden"
        style={{
          background:
            "linear-gradient(90deg, rgba(250,249,244,0.88) 0%, rgba(250,249,244,0.60) 35%, rgba(250,249,244,0.15) 60%, rgba(250,249,244,0) 75%)",
        }}
      />
      {/* Very subtle overall white veil */}
      <div className="absolute inset-0 bg-white/[0.08] dark:hidden pointer-events-none" />

      {/* Dark Mode Overlay */}
      <div
        className="absolute inset-0 hidden dark:block pointer-events-none"
        style={{
          background: "linear-gradient(rgba(3, 8, 16, 0.65), rgba(3, 8, 16, 0.65))",
        }}
      />

      <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-8 lg:px-12 relative z-10">
        {showVisualSidebar ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* ================= LEFT VISUAL BRANDING ================= */}
            <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 flex-col justify-center p-4 lg:p-8 space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 dark:bg-[#0C131F]/95 backdrop-blur-sm border border-[#D6E4FA] dark:border-[rgba(148,163,184,0.18)] shadow-xs text-[#101828] dark:text-[#F8FAFC] w-fit">
                <Sparkles size={14} className="text-[#0B5ED7] dark:text-[#60A5FA]" />
                <span className="text-xs font-semibold text-[#475467] dark:text-[#F8FAFC]">{badge}</span>
              </div>

              <h1 className="text-4xl lg:text-5xl font-black text-[#101828] dark:text-[#F8FAFC] tracking-tight leading-[1.15]">
                Rèn tư duy. <br />
                <span className="text-[#0B5ED7] dark:text-[#60A5FA]">Khai mở góc nhìn.</span> <br />
                Tranh biện như chuyên gia.
              </h1>

              <p className="text-sm sm:text-base text-[#475467] dark:text-[#CBD5E1] leading-relaxed max-w-md">
                Cùng AI đối kháng thông minh, mô phỏng luật tranh biện WSDC & BP và hoàn thiện lập luận sắc bén mỗi ngày.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2 max-w-md">
                <div className="p-3.5 rounded-2xl bg-[#FFFFFF]/95 dark:bg-[#0C131F]/90 backdrop-blur-md border border-[#E5E7EB] dark:border-[rgba(148,163,184,0.18)] shadow-xs flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#0B5ED7] dark:bg-[#3B82F6] text-white flex items-center justify-center shrink-0">
                    <Bot size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#101828] dark:text-[#F8FAFC]">AI Đối kháng</h4>
                    <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">Phản biện đa chiều</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#FFFFFF]/95 dark:bg-[#0C131F]/90 backdrop-blur-md border border-[#E5E7EB] dark:border-[rgba(148,163,184,0.18)] shadow-xs flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#0B5ED7] dark:bg-[#3B82F6] text-white flex items-center justify-center shrink-0">
                    <BarChart3 size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#101828] dark:text-[#F8FAFC]">Chấm Rubric</h4>
                    <p className="text-[11px] text-[#667085] dark:text-[#94A3B8]">Chuẩn quốc tế</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ================= RIGHT FORM CARD (SÁT BÊN PHẢI) ================= */}
            <div className="lg:col-span-6 xl:col-span-5 flex justify-center lg:justify-end">
              <div className="w-full max-w-[440px] bg-[#FFFFFF]/97 dark:bg-[#0C131F] rounded-3xl border border-white/80 dark:border-[rgba(148,163,184,0.20)] p-6 sm:p-8 shadow-xl shadow-slate-900/5 dark:shadow-black/60 transition-all duration-200">
                {/* Logo Area */}
                <div className="flex flex-col items-center text-center mb-5">
                  <AppLogo size={46} className="mb-1" />
                  <div className="flex items-center gap-1.5 justify-center">
                    <span className="font-black text-xs tracking-tight text-[#101828] dark:text-[#F8FAFC]">ADPP</span>
                    <span className="text-[10px] font-bold text-[#0B5ED7] dark:text-[#60A5FA] uppercase tracking-wider">
                      • NỀN TẢNG TRANH BIỆN AI
                    </span>
                  </div>
                </div>

                {/* Form Header */}
                {(title || subtitle) && (
                  <div className="text-center mb-5">
                    {title && (
                      <h2 className="text-2xl font-black text-[#101828] dark:text-[#F8FAFC] tracking-tight">
                        {title}
                      </h2>
                    )}
                    {subtitle && (
                      <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1 leading-relaxed">
                        {subtitle}
                      </p>
                    )}
                  </div>
                )}

                {children}
              </div>
            </div>
          </div>
        ) : (
          /* Centered Form Layout for Forgot / Reset Password / OTP */
          <div className="flex justify-center">
            <div className="w-full max-w-[460px] bg-[#FFFFFF]/97 dark:bg-[#0C131F] rounded-3xl border border-white/80 dark:border-[rgba(148,163,184,0.20)] p-6 sm:p-9 shadow-xl shadow-slate-900/5 dark:shadow-black/60 transition-all duration-200">
              {/* Top Branding */}
              <div className="flex flex-col items-center text-center mb-5">
                <Link to="/" className="inline-flex flex-col items-center gap-1 group">
                  <AppLogo size={46} className="transition-transform group-hover:scale-105" />
                  <span className="font-black text-xs tracking-tight text-[#101828] dark:text-[#F8FAFC]">ADPP • NỀN TẢNG TRANH BIỆN AI</span>
                </Link>
              </div>

              {/* Form Header */}
              {(title || subtitle) && (
                <div className="text-center mb-6">
                  {title && (
                    <h1 className="text-2xl font-black text-[#101828] dark:text-[#F8FAFC] tracking-tight">
                      {title}
                    </h1>
                  )}
                  {subtitle && (
                    <p className="text-xs text-[#667085] dark:text-[#94A3B8] mt-1 max-w-sm mx-auto leading-relaxed">
                      {subtitle}
                    </p>
                  )}
                </div>
              )}

              {children}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthLayout;

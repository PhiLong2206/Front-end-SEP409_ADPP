import React from "react";
import AppLogo from "../common/AppLogo";
import { Link } from "react-router-dom";

const Footer: React.FC = () => {
  return (
    <footer className="bg-[#050d1b] text-slate-300 py-10 border-t border-[#08162f]">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2.5">
            <AppLogo size={24} />
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-white text-base tracking-tight">ADPP</span>
              <span className="text-[10px] font-bold text-[#3B82F6] uppercase tracking-wider">
                • TRANH BIỆN AI
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
            Nền tảng luyện tập tranh biện ứng dụng Trí tuệ nhân tạo thế hệ mới.
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-6 text-xs text-slate-400">
          <div className="flex items-center gap-5 font-medium">
            <Link to="/" className="hover:text-[#3B82F6] transition-colors">Trang chủ</Link>
            <Link to="/debater/topics" className="hover:text-[#3B82F6] transition-colors">Chủ đề</Link>
            <a href="#methods" className="hover:text-[#3B82F6] transition-colors">Phương pháp</a>
            <a href="#about" className="hover:text-[#3B82F6] transition-colors">Về chúng tôi</a>
          </div>
          <span className="text-[11px] text-slate-500 md:pl-6 md:border-l md:border-[#08162f]">
            © 2026 ADPP. Bảo lưu mọi quyền.
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

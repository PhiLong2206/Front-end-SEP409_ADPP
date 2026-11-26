import React from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import Footer from "./Footer";
import AppLogo from "../common/AppLogo";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../hooks/useTheme";
import { Moon, Sun } from "lucide-react";
import UserAvatarDropdown from "./UserAvatarDropdown";

const PublicLayout: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { resolvedTheme, toggleTheme } = useTheme();

  const navLinks = [
    { label: "Trang chủ", path: "/" },
    { label: "Phương pháp", path: "/#methods", hash: "methods" },
    { label: "Chủ đề nổi bật", path: "/#featured-topics", hash: "featured-topics" },
    { label: "Kho đề tài", path: "/debater/topics" },
    { label: "Bảng xếp hạng", path: "/#leaderboard", hash: "leaderboard" },
  ];

  const handleNavClick = (e: React.MouseEvent, item: typeof navLinks[0]) => {
    if (item.hash) {
      if (location.pathname === "/") {
        e.preventDefault();
        const targetEl = document.getElementById(item.hash);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: "smooth" });
        } else {
          window.scrollTo({ top: 600, behavior: "smooth" });
        }
      } else {
        navigate(`/#${item.hash}`);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-[#0B5ED7] selection:text-white bg-[#F4F7FC] dark:bg-[#050A13] text-[#101828] dark:text-[#F8FAFC] transition-colors duration-200">
      {/* Top Navigation Bar */}
      <header className="h-20 bg-white/94 dark:bg-[rgba(6,11,20,0.95)] backdrop-blur-md border-b border-[#E5E7EB] dark:border-[rgba(148,163,184,0.15)] px-6 sm:px-12 sticky top-0 z-50 shadow-xs transition-colors duration-200">
        <div className="max-w-[1440px] mx-auto h-full flex items-center justify-between">
          {/* Left Brand Area */}
          <Link to="/" className="flex items-center gap-3 group">
            <AppLogo size={34} className="transition-transform duration-300 group-hover:scale-105" />
            <div className="flex flex-col">
              <span className="tracking-tight font-extrabold text-lg text-[#101828] dark:text-[#F8FAFC] leading-tight group-hover:text-[#0B5ED7] dark:group-hover:text-[#60A5FA] transition-colors">
                ADPP
              </span>
              <span className="text-[10px] font-bold text-[#0B5ED7] dark:text-[#60A5FA] uppercase tracking-wider leading-none">
                NỀN TẢNG TRANH BIỆN AI
              </span>
            </div>
          </Link>

          {/* Center Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold">
            {navLinks.map((item) => {
              const isDirectActive = location.pathname === item.path;
              const isHashMatch = Boolean(item.hash && location.hash === `#${item.hash}`);
              const isActive = isDirectActive || isHashMatch;

              return (
                <Link
                  key={item.label}
                  to={item.path}
                  onClick={(e) => handleNavClick(e, item)}
                  className={`relative py-2 transition-all duration-200 group flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? "text-[#0B5ED7] dark:text-[#60A5FA] font-bold"
                      : "text-[#475467] dark:text-[#94A3B8] hover:text-[#0B5ED7] dark:hover:text-[#60A5FA]"
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0B5ED7] dark:bg-[#60A5FA] rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-3">
            {/* Sun / Moon Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="w-10 h-10 rounded-full bg-white dark:bg-[#0D1422] hover:bg-slate-50 dark:hover:bg-[#131D30] border border-[#E5E7EB] dark:border-[rgba(148,163,184,0.18)] flex items-center justify-center text-slate-700 dark:text-amber-400 hover:text-slate-900 transition-all duration-200 shadow-xs cursor-pointer active:scale-95 group"
              title={resolvedTheme === "dark" ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}
              aria-label={resolvedTheme === "dark" ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}
            >
              {resolvedTheme === "dark" ? (
                <Sun size={18} className="text-amber-400 transition-transform duration-200 group-hover:rotate-45" />
              ) : (
                <Moon size={18} className="text-[#475467] transition-transform duration-200 group-hover:-rotate-12" />
              )}
            </button>

            {isAuthenticated ? (
              <UserAvatarDropdown />
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="px-5 py-2 text-sm font-semibold text-[#101828] dark:text-[#F8FAFC] hover:text-[#0B5ED7] dark:hover:text-[#60A5FA] bg-white dark:bg-[#0D1422] hover:bg-slate-50 dark:hover:bg-[#131D30] border border-[#E5E7EB] dark:border-[rgba(148,163,184,0.20)] rounded-full transition-all shadow-xs active:scale-98"
                >
                  Đăng nhập
                </Link>

                <Link
                  to="/register"
                  className="px-5 py-2 text-sm font-bold bg-[#0B5ED7] hover:bg-[#0A4FB4] dark:bg-[#3B82F6] dark:hover:bg-[#60A5FA] active:bg-[#083f91] text-white rounded-full transition-all shadow-md shadow-[#0B5ED7]/20 hover:scale-102 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Bắt đầu ngay</span>
                  <span className="text-base font-bold leading-none">+</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
};

export default PublicLayout;




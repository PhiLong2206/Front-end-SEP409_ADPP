import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { ROLES } from "../../utils/constants";
import { User, Settings, LogOut, ChevronDown, ShieldCheck, Loader2, Coins } from "lucide-react";

export interface UserAvatarDropdownProps {
  className?: string;
}

const UserAvatarDropdown: React.FC<UserAvatarDropdownProps> = ({ className = "" }) => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getProfilePath = () => {
    const userRole = String(role);
    if (userRole === "Administrator" || userRole === "Admin" || userRole === ROLES.ADMIN) {
      return "/admin/profile";
    }
    if (userRole === "Organizer" || userRole === ROLES.ORGANIZER) {
      return "/organizer/profile";
    }
    return "/debater/profile";
  };

  const getSettingsPath = () => {
    const userRole = String(role);
    if (userRole === "Administrator" || userRole === "Admin" || userRole === ROLES.ADMIN) {
      return "/admin/settings";
    }
    if (userRole === "Organizer" || userRole === ROLES.ORGANIZER) {
      return "/organizer/settings";
    }
    return "/debater/settings";
  };

  const getRoleLabel = () => {
    const userRole = String(role);
    if (userRole === "Administrator" || userRole === "Admin" || userRole === ROLES.ADMIN) {
      return "Quản trị viên";
    }
    if (userRole === "Organizer" || userRole === ROLES.ORGANIZER) {
      return "Giảng viên";
    }
    return "Học viên";
  };

  const handleDirectLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      // Optional brief delay for smooth UI feedback
      await logout();
      setIsOpen(false);
      navigate("/login", { state: { message: "Đã đăng xuất thành công" }, replace: true });
    } catch (err) {
      console.error("Logout failed:", err);
      setLoggingOut(false);
    }
  };

  const displayName = user?.fullName || user?.email?.split("@")[0] || "Người dùng";
  const displayEmail = user?.email || "";
  const effectiveAvatar =
    (user?.avatarUrl && user.avatarUrl !== "string" ? user.avatarUrl : null) ||
    (user?.email ? localStorage.getItem(`adpp_user_avatar_${user.email}`) : null);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 cursor-pointer focus:outline-none"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="relative">
          {effectiveAvatar ? (
            <img
              src={effectiveAvatar}
              alt={displayName}
              className="w-8 h-8 rounded-full object-cover border border-[#008A64]/30 shadow-xs"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#008A64] text-white font-bold text-xs flex items-center justify-center shadow-xs">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#10B981] ring-2 ring-white dark:ring-slate-900" />
        </div>

        <div className="hidden sm:flex flex-col text-left">
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight max-w-[120px] truncate">
            {displayName}
          </span>
          <span className="text-[10px] text-[#008A64] dark:text-emerald-400 font-semibold leading-tight">
            {getRoleLabel()}
          </span>
        </div>

        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl bg-white dark:bg-[#0F1C17] border border-slate-200 dark:border-[rgba(148,163,184,0.18)] shadow-xl shadow-slate-900/10 dark:shadow-black/50 py-2 z-50 animate-fade-in divide-y divide-slate-100 dark:divide-[rgba(148,163,184,0.15)] transition-all duration-200">
          {/* Top User Info */}
          <div className="px-4 py-3 flex items-center gap-3">
            {effectiveAvatar ? (
              <img
                src={effectiveAvatar}
                alt={displayName}
                className="w-10 h-10 rounded-full object-cover border border-[#008A64]/40 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#008A64] text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-[#F8FAFC] truncate">
                {displayName}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] truncate">
                {displayEmail}
              </p>
              <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#ECFDF5] dark:bg-[rgba(16,185,129,0.12)] text-[10px] font-bold text-[#008A64] dark:text-[#34D399] border border-[#008A64]/20 dark:border-[rgba(16,185,129,0.25)]">
                <ShieldCheck size={11} />
                <span>{getRoleLabel()}</span>
              </div>
            </div>
          </div>

          {/* Nav Items */}
          <div className="py-1">
            {(String(role) === "Administrator" || user?.roles?.some((r) => r.toLowerCase() === "admin")) && (
              <Link
                to="/admin/dashboard"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2.5 text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
              >
                <ShieldCheck size={16} className="text-[#008A64]" />
                <span>Cổng Quản trị (Admin)</span>
              </Link>
            )}

            <Link
              to="/debater/payments"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-[#F8FAFC] hover:bg-slate-50 dark:hover:bg-[#172C23] hover:text-[#008A64] dark:hover:text-[#34D399] transition-colors"
            >
              <Coins size={16} className="text-amber-500" />
              <span>Nạp điểm tín chỉ</span>
            </Link>

            <Link
              to={getProfilePath()}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-[#F8FAFC] hover:bg-slate-50 dark:hover:bg-[#172C23] hover:text-[#008A64] dark:hover:text-[#34D399] transition-colors"
            >
              <User size={16} className="text-slate-400" />
              <span>Hồ sơ cá nhân</span>
            </Link>

            <Link
              to={getSettingsPath()}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-[#F8FAFC] hover:bg-slate-50 dark:hover:bg-[#172C23] hover:text-[#008A64] dark:hover:text-[#34D399] transition-colors"
            >
              <Settings size={16} className="text-slate-400" />
              <span>Cài đặt & Tùy chọn</span>
            </Link>
          </div>

          {/* Logout Action */}
          <div className="py-1">
            <button
              type="button"
              onClick={handleDirectLogout}
              disabled={loggingOut}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-[#F8FAFC] hover:bg-slate-50 dark:hover:bg-[#172C23] hover:text-[#008A64] dark:hover:text-[#34D399] transition-colors cursor-pointer text-left disabled:opacity-50"
            >
              {loggingOut ? (
                <>
                  <Loader2 size={16} className="text-slate-400 animate-spin" />
                  <span className="text-slate-500">Đang đăng xuất...</span>
                </>
              ) : (
                <>
                  <LogOut size={16} className="text-slate-400" />
                  <span>Đăng xuất</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default UserAvatarDropdown;

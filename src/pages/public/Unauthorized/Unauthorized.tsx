import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import { ROLES } from "../../../utils/constants";
import { ShieldAlert, LogOut, Home } from "lucide-react";

const Unauthorized: React.FC = () => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  const getFallbackPath = () => {
    if (role === ROLES.ADMIN) return "/admin/dashboard";
    if (role === ROLES.ORGANIZER) return "/organizer/dashboard";
    if (role === ROLES.DEBATER) return "/debater/dashboard";
    return "/";
  };

  const getRoleLabel = () => {
    if (role === ROLES.ADMIN) return "Quản trị viên (Administrator)";
    if (role === ROLES.ORGANIZER) return "Giảng viên (Organizer)";
    if (role === ROLES.DEBATER) return "Học viên (Debater)";
    return "Chưa xác định";
  };

  const handleLogoutAndSwitch = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white dark:bg-[#0F1726] rounded-3xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] p-7 sm:p-8 text-center shadow-lg shadow-slate-200/50 dark:shadow-black/40 animate-fade-in">
        {/* Shield Icon */}
        <div className="w-18 h-18 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-5 shadow-xs">
          <ShieldAlert size={36} />
        </div>

        {/* 403 Badge */}
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-rose-600 dark:text-rose-400 mb-3">
          Mã lỗi 403 • Truy cập bị từ chối
        </span>

        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          Không đủ quyền truy cập
        </h1>

        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
          Trang bạn đang cố gắng truy cập yêu cầu quyền hạn quản trị hệ thống. Tài khoản của bạn không có vai trò phù hợp để xem nội dung này.
        </p>

        {/* User Role Diagnostic Box */}
        {user && (
          <div className="mt-5 p-3.5 rounded-2xl bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-[rgba(148,163,184,0.12)] text-left text-xs space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Tài khoản:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                {user.email}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Vai trò hiện tại:</span>
              <span className="font-bold text-[#0B5ED7] dark:text-blue-400">
                {getRoleLabel()}
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 space-y-2.5">
          <Link
            to={getFallbackPath()}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#0B5ED7] hover:bg-[#0a4fb4] text-white text-xs font-bold transition-all shadow-md shadow-[#0B5ED7]/20 cursor-pointer"
          >
            <Home size={15} />
            <span>Quay về trang bảng điều khiển của tôi</span>
          </Link>

          <button
            type="button"
            onClick={handleLogoutAndSwitch}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-[#162032] text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all cursor-pointer"
          >
            <LogOut size={14} />
            <span>Đăng xuất & đổi tài khoản Admin</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;

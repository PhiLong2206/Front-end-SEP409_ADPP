import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  BookOpen,
  CreditCard,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Database,
  LucideIcon,
} from "lucide-react";

export interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  badge?: string;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({
  isOpen = false,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { user } = useAuth();

  // Tinh gọn danh mục Sidebar Admin theo yêu cầu:
  // GIỮ: Bảng điều khiển, Quản lý người dùng, Phân quyền vai trò, Quản lý chủ đề, Quản lý gói Credit.
  // ẨN: Quản lý tranh biện, Báo cáo & Khiếu nại, Quản lý sự kiện, Quản lý cuộc thi, Cấu hình hệ thống.
  const sections: NavSection[] = [
    {
      title: "TỔNG QUAN",
      items: [
        { label: "Bảng điều khiển", path: "/admin/dashboard", icon: LayoutDashboard },
      ],
    },
    {
      title: "NGƯỜI DÙNG & VAI TRÒ",
      items: [
        { label: "Quản lý người dùng", path: "/admin/users", icon: Users },
        { label: "Phân quyền vai trò", path: "/admin/roles", icon: ShieldCheck },
      ],
    },
    {
      title: "CHỦ ĐỀ & TÀI CHÍNH",
      items: [
        { label: "Quản lý chủ đề", path: "/admin/topics", icon: BookOpen },
        { label: "Kho tri thức & Dẫn chứng", path: "/admin/knowledge-base", icon: Database },
        { label: "Quản lý gói Credit", path: "/admin/payments", icon: CreditCard },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden animate-fade-in"
          onClick={onClose}
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 bg-white dark:bg-[#0F1C17] border-r border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] z-50 flex flex-col justify-between select-none shadow-sm dark:shadow-black/30 transition-all duration-300 ease-in-out ${
          isOpen ? "translate-x-0 w-[260px]" : "-translate-x-full lg:translate-x-0"
        } ${isCollapsed ? "lg:w-[76px]" : "lg:w-[260px]"}`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Brand Header */}
          <div
            className={`h-20 flex items-center border-b border-slate-100 dark:border-[rgba(148,163,184,0.12)] shrink-0 transition-all duration-300 ${
              isCollapsed ? "justify-center px-2" : "justify-between px-5"
            }`}
          >
            {isCollapsed ? (
              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  className="w-10 h-10 rounded-xl bg-[#008A64] flex items-center justify-center text-white shadow-md shadow-[#008A64]/20 hover:scale-105 transition-all group relative cursor-pointer font-black text-base"
                  title="Mở rộng thanh bên"
                >
                  <span className="group-hover:hidden">A</span>
                  <PanelLeftOpen size={18} className="hidden group-hover:block text-white" />
                  <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50">
                    Mở rộng thanh bên
                  </div>
                </button>
              </div>
            ) : (
              <>
                <NavLink to="/admin/dashboard" className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#008A64] flex items-center justify-center text-white shadow-sm font-black text-base shrink-0">
                    A
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-[15px] tracking-tight text-slate-900 dark:text-[#F8FAFC] leading-tight">
                        ADPP
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/80 text-[#008A64] dark:text-emerald-300 border border-[#008A64]/30">
                        ADMIN
                      </span>
                    </div>
                    <span className="text-[9px] font-bold text-[#008A64] dark:text-emerald-400 uppercase tracking-wider leading-none mt-0.5">
                      CỔNG QUẢN TRỊ HỆ THỐNG
                    </span>
                  </div>
                </NavLink>

                <div className="flex items-center gap-1">
                  {onToggleCollapse && (
                    <button
                      type="button"
                      onClick={onToggleCollapse}
                      className="hidden lg:flex p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-[#172C23] transition-colors cursor-pointer"
                      title="Thu gọn thanh bên"
                    >
                      <PanelLeftClose size={17} />
                    </button>
                  )}

                  {onClose && (
                    <button
                      type="button"
                      onClick={onClose}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg lg:hidden cursor-pointer"
                      title="Đóng menu"
                    >
                      <X size={17} />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Navigation Area */}
          <div
            className={`flex-1 sidebar-scroll py-4 space-y-5 transition-all duration-300 overflow-y-auto ${
              isCollapsed ? "px-2" : "px-3.5"
            }`}
          >
            {sections.map((sec, secIdx) => (
              <div key={secIdx} className="space-y-1">
                {!isCollapsed && sec.title && (
                  <div className="px-3 pb-1 text-[10.5px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                    {sec.title}
                  </div>
                )}

                {sec.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      title={item.label}
                      onClick={() => onClose?.()}
                      className={({ isActive }) =>
                        `group relative flex items-center h-[42px] rounded-xl transition-all duration-150 cursor-pointer ${
                          isCollapsed
                            ? `justify-center w-full ${
                                isActive
                                  ? "bg-[#008A64] text-white shadow-sm shadow-[#008A64]/20 font-semibold"
                                  : "text-slate-600 dark:text-slate-300 hover:text-[#008A64] dark:hover:text-[#34D399] hover:bg-emerald-50/60 dark:hover:bg-emerald-500/15"
                              }`
                            : `px-3 ${
                                isActive
                                  ? "bg-[#008A64] text-white font-semibold shadow-sm shadow-[#008A64]/20"
                                  : "text-slate-600 dark:text-slate-300 hover:text-[#008A64] dark:hover:text-[#34D399] hover:bg-emerald-50/60 dark:hover:bg-emerald-500/15 font-medium"
                              }`
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                              isActive
                                ? "text-white"
                                : "text-slate-500 dark:text-slate-400 group-hover:text-[#008A64] dark:group-hover:text-[#34D399]"
                            }`}
                          >
                            <Icon size={18} />
                          </div>

                          {!isCollapsed && (
                            <span className="text-[13px] truncate ml-2.5">
                              {item.label}
                            </span>
                          )}

                          {/* Floating Tooltip when Collapsed */}
                          {isCollapsed && (
                            <div className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 flex items-center">
                              {item.label}
                              <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-y-4 border-y-transparent border-r-4 border-r-slate-900" />
                            </div>
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Area: Administrator Identity Card (Links to /admin/profile) */}
        <div
          className={`border-t border-slate-100 dark:border-[rgba(148,163,184,0.12)] bg-slate-50/60 dark:bg-[#0B1713] shrink-0 transition-all duration-300 ${
            isCollapsed ? "p-2" : "p-3"
          }`}
        >
          {(() => {
            const effectiveAvatar =
              (user?.avatarUrl && user.avatarUrl !== "string" ? user.avatarUrl : null) ||
              (user?.email ? localStorage.getItem(`adpp_user_avatar_${user.email}`) : null);

            return (
              <NavLink
                to="/admin/profile"
                className={`rounded-xl bg-white dark:bg-[#12231C] border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] hover:border-[#008A64]/50 hover:shadow-xs transition-all flex items-center relative group cursor-pointer ${
                  isCollapsed ? "justify-center p-2" : "p-2.5 gap-2.5"
                }`}
                title={user?.fullName || user?.email || "Quản trị viên"}
              >
                <div className="relative shrink-0">
                  {effectiveAvatar ? (
                    <img
                      src={effectiveAvatar}
                      alt={user?.fullName || "Admin"}
                      className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#008A64] text-white font-bold text-xs flex items-center justify-center shadow-xs">
                      {(user?.fullName || user?.email || "A").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-1.5 ring-white dark:ring-slate-900" />
                </div>

                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate leading-tight group-hover:text-[#008A64] transition-colors">
                        {user?.fullName || user?.email?.split("@")[0] || "Quản trị viên"}
                      </p>
                    </div>
                    <span className="inline-block mt-0.5 text-[9.5px] font-bold text-[#008A64] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-200/60 dark:border-emerald-800/40 uppercase">
                      Admin
                    </span>
                  </div>
                )}
              </NavLink>
            );
          })()}
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;

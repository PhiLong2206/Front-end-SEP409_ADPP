import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { ROLES } from "../../utils/constants";
import {
  LayoutDashboard,
  BookOpen,
  Bot,
  Swords,
  User as UserIcon,
  Settings,
  Calendar,
  Trophy,
  Users,
  CreditCard,
  Sliders,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Database,
  LucideIcon,
} from "lucide-react";

export interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen = false,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { user, role } = useAuth();

  const getSections = (): NavSection[] => {
    if (role === ROLES.ADMIN) {
      return [
        {
          title: "TỔNG QUAN & QUẢN TRỊ",
          items: [
            { label: "Bảng điều khiển", path: "/admin/dashboard", icon: LayoutDashboard },
            { label: "Quản lý người dùng", path: "/admin/users", icon: Users },
            { label: "Quản lý chủ đề", path: "/admin/topics", icon: BookOpen },
            { label: "Kho tri thức & Dẫn chứng", path: "/admin/knowledge-base", icon: Database },
          ],
        },
        {
          title: "HOẠT ĐỘNG & TÀI CHÍNH",
          items: [
            { label: "Quản lý sự kiện", path: "/admin/events", icon: Calendar },
            { label: "Quản lý cuộc thi", path: "/admin/competitions", icon: Trophy },
            { label: "Quản lý giao dịch", path: "/admin/payments", icon: CreditCard },
            { label: "Cấu hình hệ thống", path: "/admin/system", icon: Sliders },
          ],
        },
      ];
    }

    if (role === ROLES.ORGANIZER) {
      return [
        {
          title: "GIẢNG DẠY & HUẤN LUYỆN",
          items: [
            { label: "Bảng điều khiển", path: "/organizer/dashboard", icon: LayoutDashboard },
            { label: "Quản lý chủ đề", path: "/organizer/topics", icon: BookOpen },
            { label: "Kho tri thức & Dẫn chứng", path: "/organizer/knowledge-base", icon: Database },
            { label: "Sự kiện & Hội thảo", path: "/organizer/events", icon: Calendar },
            { label: "Cuộc thi & Giải đấu", path: "/organizer/competitions", icon: Trophy },
          ],
        },
      ];
    }

    // Default Debater
    return [
      {
        title: "LUYỆN TẬP & THI ĐẤU",
        items: [
          { label: "Bảng điều khiển", path: "/debater/dashboard", icon: LayoutDashboard },
          { label: "Chủ đề tranh biện", path: "/debater/topics", icon: BookOpen },
          { label: "Tranh biện với AI", path: "/debater/debate", icon: Bot },
          { label: "Tranh biện 1 vs 1", path: "/debater/debate-1v1", icon: Swords },
          { label: "Tranh biện 2 vs 2", path: "/debater/debate-2v2", icon: Users },
          { label: "Giải đấu & Cuộc thi", path: "/debater/competitions", icon: Trophy },
          { label: "Sự kiện học tập", path: "/debater/events", icon: Calendar },
        ],
      },
      {
        title: "TÀI CHÍNH & CÁ NHÂN",
        items: [
          { label: "Nạp điểm tín chỉ", path: "/debater/payments", icon: CreditCard },
          { label: "Hồ sơ cá nhân", path: "/debater/profile", icon: UserIcon },
          { label: "Cài đặt & Tùy chọn", path: "/debater/settings", icon: Settings },
        ],
      },
    ];
  };

  const sections = getSections();

  const getProfilePath = () => {
    if (role === ROLES.ADMIN) return "/admin/profile";
    if (role === ROLES.ORGANIZER) return "/organizer/profile";
    return "/debater/profile";
  };

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
                <NavLink to="/" className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#008A64] flex items-center justify-center text-white shadow-sm font-black text-base shrink-0">
                    A
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-extrabold text-[15px] tracking-tight text-slate-900 dark:text-[#F8FAFC] leading-tight">
                        ADPP
                      </span>
                    </div>
                    <span className="text-[9px] font-bold text-[#008A64] uppercase tracking-wider leading-none mt-0.5">
                      NỀN TẢNG TRANH BIỆN AI
                    </span>
                  </div>
                </NavLink>

                <div className="flex items-center gap-1">
                  {/* Desktop Collapse Button */}
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

                  {/* Mobile Close Drawer Button */}
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
            className={`flex-1 sidebar-scroll py-4 space-y-6 transition-all duration-300 ${
              isCollapsed ? "px-2" : "px-3.5"
            }`}
          >
            {sections.map((sec, secIdx) => (
              <div key={secIdx} className="space-y-1">
                {!isCollapsed && sec.title && (
                  <div className="px-3 pb-1.5 text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
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
                        `group relative flex items-center h-[44px] rounded-xl transition-all duration-150 cursor-pointer ${
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
                            <span className="text-[13.5px] truncate ml-2.5">
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

        {/* Bottom Area: Account Navigation & User Card */}
        <div
          className={`border-t border-slate-100 dark:border-[rgba(148,163,184,0.12)] bg-slate-50/60 dark:bg-[#0B1713] space-y-2 shrink-0 transition-all duration-300 ${
            isCollapsed ? "p-2" : "p-3"
          }`}
        >
          {/* User Profile Card */}
          {(() => {
            const effectiveAvatar =
              (user?.avatarUrl && user.avatarUrl !== "string" ? user.avatarUrl : null) ||
              (user?.email ? localStorage.getItem(`adpp_user_avatar_${user.email}`) : null);

            return (
              <NavLink
                to={getProfilePath()}
                className={`rounded-xl bg-white dark:bg-[#12231C] border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] flex items-center hover:border-[#008A64]/40 hover:shadow-xs transition-all relative group cursor-pointer ${
                  isCollapsed ? "justify-center p-2" : "p-2 gap-2.5"
                }`}
                title={user?.fullName || user?.email || "Người dùng"}
              >
                <div className="relative shrink-0">
                  {effectiveAvatar ? (
                    <img
                      src={effectiveAvatar}
                      alt={user?.fullName || "Avatar"}
                      className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#008A64] text-white font-bold text-xs flex items-center justify-center shadow-xs">
                      {(user?.fullName || user?.email || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-[#1DB881] ring-1.5 ring-white" />
                </div>

                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">
                      {user?.fullName || user?.email?.split("@")[0] || "Người dùng"}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-400 truncate mt-0.5">
                      {user?.email || ""}
                    </p>
                  </div>
                )}

                {isCollapsed && (
                  <div className="absolute left-full ml-3 px-3 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50">
                    <div className="font-bold">{user?.fullName || user?.email?.split("@")[0] || "Người dùng"}</div>
                    <div className="text-[10px] text-slate-400 font-normal">{user?.email || ""}</div>
                    <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-y-4 border-y-transparent border-r-4 border-r-slate-900" />
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

export default Sidebar;





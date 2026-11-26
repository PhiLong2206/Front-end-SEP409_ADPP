import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import AppLogo from "../common/AppLogo";
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
          className="fixed inset-0 z-40 bg-(--scrim) backdrop-blur-xs lg:hidden animate-fade-in motion-reduce:animate-none"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar */}
      <aside
        aria-label="Điều hướng chính"
        className={`fixed top-0 bottom-0 left-0 z-50 flex select-none flex-col justify-between border-r border-separator bg-elevated transition-[transform,width] duration-(--t-slow) ease-ap ${
          isOpen ? "translate-x-0 w-[264px]" : "-translate-x-full lg:translate-x-0"
        } ${isCollapsed ? "lg:w-[76px]" : "lg:w-[264px]"}`}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Brand header */}
          <div
            className={`flex h-16 shrink-0 items-center ${isCollapsed ? "justify-center px-2" : "justify-between px-(--s-5)"}`}
          >
            {isCollapsed ? (
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Mở rộng thanh bên"
                className="group relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-ap-md transition-transform duration-(--t-fast) hover:scale-105 hover:bg-canvas-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40"
              >
                <AppLogo size={22} className="group-hover:hidden" />
                <PanelLeftOpen size={18} className="hidden text-label-secondary group-hover:block" aria-hidden="true" />
                <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-ap-sm bg-slate-900 px-2.5 py-1.5 text-(length:--text-caption) font-medium text-white opacity-0 shadow-ap-md transition-opacity duration-(--t-fast) group-hover:opacity-100">
                  Mở rộng thanh bên
                </span>
              </button>
            ) : (
              <>
                <NavLink
                  to="/"
                  className="flex min-w-0 items-center gap-(--s-3) rounded-ap-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
                >
                  <AppLogo size={28} className="shrink-0" />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-(length:--text-callout) font-semibold leading-tight tracking-tight">ADPP</span>
                    <span className="text-[11px] leading-none text-label-tertiary">Tranh biện AI</span>
                  </div>
                </NavLink>

                <div className="flex items-center gap-1">
                  {onToggleCollapse && (
                    <button
                      type="button"
                      onClick={onToggleCollapse}
                      aria-label="Thu gọn thanh bên"
                      title="Thu gọn thanh bên"
                      className="hidden h-9 w-9 cursor-pointer items-center justify-center rounded-full text-label-tertiary transition-colors hover:bg-canvas-secondary hover:text-label focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 lg:flex"
                    >
                      <PanelLeftClose size={17} aria-hidden="true" />
                    </button>
                  )}
                  {onClose && (
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label="Đóng menu"
                      title="Đóng menu"
                      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-label-tertiary hover:bg-canvas-secondary hover:text-label focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 lg:hidden"
                    >
                      <X size={18} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Navigation: each entry is a tab of the app */}
          <nav className={`sidebar-scroll flex-1 space-y-(--s-5) py-(--s-3) ${isCollapsed ? "px-2" : "px-(--s-3)"}`}>
            {sections.map((sec, secIdx) => (
              <div key={secIdx} className="space-y-1">
                {!isCollapsed && sec.title && (
                  <div className="px-(--s-3) pb-(--s-2) text-[11px] font-medium uppercase tracking-wider text-label-tertiary">
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
                        `group relative flex h-11 cursor-pointer items-center rounded-ap-md transition-colors duration-(--t-fast) ease-ap focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 ${
                          isCollapsed ? "w-full justify-center" : "px-(--s-3)"
                        } ${
                          isActive
                            ? "bg-accent-soft font-medium text-accent"
                            : "text-label-secondary hover:bg-canvas-secondary hover:text-label"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {/* The mark of the open tab */}
                          {isActive && !isCollapsed && (
                            <span aria-hidden="true" className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full bg-accent" />
                          )}
                          <Icon size={19} className="shrink-0" aria-hidden="true" />
                          {!isCollapsed && <span className="ml-(--s-3) truncate text-(length:--text-callout)">{item.label}</span>}

                          {isCollapsed && (
                            <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-ap-sm bg-slate-900 px-3 py-1.5 text-(length:--text-caption) font-medium text-white opacity-0 shadow-ap-md transition-opacity duration-(--t-fast) group-hover:opacity-100">
                              {item.label}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Bottom: the user */}
        <div className={`shrink-0 border-t border-separator ${isCollapsed ? "p-2" : "p-(--s-3)"}`}>
          {(() => {
            const effectiveAvatar =
              (user?.avatarUrl && user.avatarUrl !== "string" ? user.avatarUrl : null) ||
              (user?.email ? localStorage.getItem(`adpp_user_avatar_${user.email}`) : null);
            const displayName = user?.fullName || user?.email?.split("@")[0] || "Người dùng";

            return (
              <NavLink
                to={getProfilePath()}
                title={displayName}
                className={`group relative flex min-h-11 cursor-pointer items-center rounded-ap-md bg-canvas-secondary transition-colors duration-(--t-fast) hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 ${
                  isCollapsed ? "justify-center p-1.5" : "gap-(--s-3) p-(--s-2)"
                }`}
              >
                {effectiveAvatar ? (
                  <img src={effectiveAvatar} alt={displayName} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-(--accent) to-(--accent-2) text-(length:--text-callout) font-semibold text-accent-contrast">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}

                {!isCollapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-(length:--text-callout) font-medium leading-tight">{displayName}</p>
                    <p className="truncate text-(length:--text-caption) text-label-secondary">{user?.email || ""}</p>
                  </div>
                )}

                {isCollapsed && (
                  <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-ap-sm bg-slate-900 px-3 py-2 text-(length:--text-caption) text-white opacity-0 shadow-ap-md transition-opacity duration-(--t-fast) group-hover:opacity-100">
                    <span className="block font-medium">{displayName}</span>
                    <span className="block text-slate-300">{user?.email || ""}</span>
                  </span>
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

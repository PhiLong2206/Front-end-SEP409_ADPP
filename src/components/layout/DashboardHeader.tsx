import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Menu, Sun, Moon, Coins } from "lucide-react";
import UserAvatarDropdown from "./UserAvatarDropdown";
import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../hooks/useAuth";
import paymentApi from "../../api/paymentApi";

export interface DashboardHeaderProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  onMenuClick?: () => void;
}

const iconButton =
  "relative flex h-11 w-11 sm:h-10 sm:w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-label-secondary transition-[background-color,color,transform] duration-(--t-fast) ease-ap hover:bg-canvas-secondary hover:text-label active:scale-95 motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30";

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ title, subtitle, action, onMenuClick }) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    paymentApi
      .getMyWallet()
      .then((res) => {
        if (isMounted && res && res.success && res.data) {
          setWalletBalance(res.data.balance);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [user]);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-(--s-3) border-b border-separator bg-(--glass-bg) px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-(--s-3)">
        {onMenuClick && (
          <button type="button" onClick={onMenuClick} className={`${iconButton} lg:hidden`} aria-label="Mở menu" title="Mở menu">
            <Menu size={20} aria-hidden="true" />
          </button>
        )}

        {title ? (
          <div className="min-w-0">
            <h1 className="truncate text-(length:--text-headline) font-semibold leading-(--leading-snug) tracking-(--tracking-display)">
              {title}
            </h1>
            {subtitle && <p className="truncate text-(length:--text-caption) text-label-secondary">{subtitle}</p>}
          </div>
        ) : (
          <p className="hidden truncate text-(length:--text-callout) text-label-secondary sm:block">
            Nền tảng luyện tập tranh biện AI
          </p>
        )}
      </div>

      <div className="flex items-center gap-(--s-2) sm:gap-(--s-3)">
        {action && <div>{action}</div>}

        {/* Credit wallet */}
        {user && (
          <Link
            to="/debater/payments"
            className="group inline-flex h-10 items-center gap-(--s-2) rounded-ap-pill bg-canvas-secondary pl-(--s-3) pr-1.5 text-(length:--text-callout) font-medium transition-colors duration-(--t-fast) hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
            title="Số dư điểm tín chỉ trong ví của bạn. Nhấn để nạp thêm."
          >
            <Coins size={16} className="text-ap-warning transition-transform duration-(--t-base) group-hover:rotate-12 motion-reduce:transform-none" aria-hidden="true" />
            <span>{walletBalance !== null ? `${walletBalance.toLocaleString()} Credit` : "Ví điểm"}</span>
            <span className="hidden rounded-ap-pill bg-accent px-2.5 py-1 text-(length:--text-caption) font-medium text-accent-contrast sm:inline-block">
              Nạp
            </span>
          </Link>
        )}

        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className={iconButton}
          title={resolvedTheme === "dark" ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}
          aria-label={resolvedTheme === "dark" ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}
        >
          {resolvedTheme === "dark" ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
        </button>

        {/* Notifications */}
        <button type="button" className={iconButton} title="Thông báo" aria-label="Thông báo">
          <Bell size={18} aria-hidden="true" />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-accent ring-2 ring-[color:var(--bg)]" />
        </button>

        {/* User avatar & logout dropdown */}
        <div className="pl-(--s-2)">
          <UserAvatarDropdown />
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;

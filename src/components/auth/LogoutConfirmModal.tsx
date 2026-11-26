import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { LogOut } from "lucide-react";

interface LogoutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  loading?: boolean;
}

const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-dialog-title"
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#0F1726] rounded-3xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] shadow-2xl p-6 relative z-10 transition-all duration-200 scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/15 border border-blue-100 dark:border-blue-500/30 text-[#0B5ED7] dark:text-blue-400 flex items-center justify-center shrink-0 shadow-xs">
            <LogOut size={22} />
          </div>

          <div className="flex-1">
            <h3 id="logout-dialog-title" className="text-lg font-bold text-slate-900 dark:text-[#F8FAFC] leading-tight">
              Xác nhận đăng xuất
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              Bạn có chắc chắn muốn đăng xuất khỏi tài khoản không? Mọi phiên làm việc hiện tại sẽ được lưu lại.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-[rgba(148,163,184,0.14)]">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition-all cursor-pointer disabled:opacity-50"
          >
            Hủy
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-[#0B5ED7] hover:bg-[#0a4fb4] active:bg-[#072f70] text-white text-sm font-bold transition-all shadow-sm shadow-[#0B5ED7]/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Đang đăng xuất...</span>
              </>
            ) : (
              <>
                <LogOut size={16} />
                <span>Đăng xuất</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default LogoutConfirmModal;

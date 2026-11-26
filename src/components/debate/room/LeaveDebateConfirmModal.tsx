import React, { useEffect, useRef } from "react";
import { AlertTriangle, ShieldCheck, LogOut, Loader2, X } from "lucide-react";

export interface LeaveDebateConfirmModalProps {
  isOpen: boolean;
  isLeaving?: boolean;
  onStay: () => void;
  onConfirmLeave: () => void;
  title?: string;
  description?: string;
}

const LeaveDebateConfirmModal: React.FC<LeaveDebateConfirmModalProps> = ({
  isOpen,
  isLeaving = false,
  onStay,
  onConfirmLeave,
  title = "Bạn có chắc muốn rời trận tranh biện?",
  description = "Trận tranh biện của bạn vẫn đang diễn ra. Nếu rời phòng, bạn có thể bị tính là bỏ cuộc theo quy định của trận đấu.",
}) => {
  const stayButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus the safe "Ở lại trận đấu" action by default for accessible keyboard navigation
    const timer = setTimeout(() => {
      stayButtonRef.current?.focus();
    }, 10);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isLeaving) {
        event.preventDefault();
        onStay();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isLeaving, onStay]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-debate-modal-title"
      aria-describedby="leave-debate-modal-description"
      data-testid="leave-debate-confirm-modal"
      onClick={() => {
        if (!isLeaving) onStay();
      }}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#0F1726] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#0B5ED7] via-amber-500 to-rose-500" />

        <div className="p-6 space-y-4">
          {/* Header with clear warning icon */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 shadow-2xs">
                <AlertTriangle size={22} />
              </div>
              <h3
                id="leave-debate-modal-title"
                className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-[#F8FAFC] leading-snug"
              >
                {title}
              </h3>
            </div>

            <button
              type="button"
              onClick={onStay}
              disabled={isLeaving}
              aria-label="Đóng hộp thoại"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              <X size={16} />
            </button>
          </div>

          {/* Description */}
          <p
            id="leave-debate-modal-description"
            className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed"
          >
            {description}
          </p>

          {/* Actions */}
          <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onConfirmLeave}
              disabled={isLeaving}
              data-testid="confirm-leave-debate-btn"
              className="px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-800/70 bg-rose-50/80 hover:bg-rose-600 text-rose-700 hover:text-white dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-600 dark:hover:text-white text-xs sm:text-sm font-bold transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLeaving ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
              <span>Rời trận</span>
            </button>

            <button
              ref={stayButtonRef}
              type="button"
              onClick={onStay}
              disabled={isLeaving}
              data-testid="stay-in-debate-btn"
              className="px-5 py-2.5 rounded-xl bg-[#0B5ED7] hover:bg-[#0a4fb4] text-white text-xs sm:text-sm font-bold shadow-sm shadow-[#0B5ED7]/20 transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/40 disabled:opacity-50"
            >
              <ShieldCheck size={15} />
              <span>Ở lại trận đấu</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaveDebateConfirmModal;

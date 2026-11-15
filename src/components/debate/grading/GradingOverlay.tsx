import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/** After this long without a result we tell the user that grading can take a while. */
export const GRADING_SLOW_HINT_AFTER_MS = 15_000;

export interface GradingOverlayProps {
  /** What is running now, e.g. "Đang tổng hợp kết quả...". */
  message: string;
}

/** Full-screen "grading in progress" overlay shown while the final evaluation requests run. */
const GradingOverlay: React.FC<GradingOverlayProps> = ({ message }) => {
  const [showSlowHint, setShowSlowHint] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowSlowHint(true), GRADING_SLOW_HINT_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Đang chấm điểm phiên tranh biện"
      data-testid="grading-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#10231C] border border-slate-200 dark:border-slate-800 shadow-xl px-6 py-7 text-center space-y-3">
        <Loader2 size={32} className="mx-auto animate-spin text-[#008A64] dark:text-[#34D399]" />
        <h2 className="text-base font-black text-slate-900 dark:text-[#F8FAFC]">
          Đang chấm điểm phiên tranh biện...
        </h2>
        <p
          data-testid="grading-progress"
          aria-live="polite"
          className="text-sm font-semibold text-[#008A64] dark:text-[#34D399]"
        >
          {message}
        </p>
        {showSlowHint && (
          <p data-testid="grading-slow-hint" className="text-xs text-slate-500 dark:text-[#94A3B8]">
            Quá trình chấm có thể mất đến 1 phút. Bạn có thể đóng trang, kết quả vẫn được lưu.
          </p>
        )}
      </div>
    </div>
  );
};

export default GradingOverlay;

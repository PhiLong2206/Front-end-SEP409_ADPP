import React from "react";
import { Hourglass, Loader2, Play } from "lucide-react";
import { formatMinutesSeconds, roundLabelOf } from "../../../utils/debatePreparation";

interface PreparationPanelProps {
  secondsLeft: number;
  /** The countdown reached 00:00 and the room is loading the session before Round 1 starts. */
  isStarting: boolean;
  motion: string;
  /** The side of the learner; null for someone who only watches (judge, spectator). */
  side: "pro" | "con" | null;
  canSkip: boolean;
  isSkipping: boolean;
  onSkip: () => void;
}

/** The minute before Round 1: what the learner debates and on which side, and a way to start at once (AI practice). */
const PreparationPanel: React.FC<PreparationPanelProps> = ({
  secondsLeft,
  isStarting,
  motion,
  side,
  canSkip,
  isSkipping,
  onSkip,
}) => (
  <section
    data-testid="preparation-panel"
    aria-label="Thời gian chuẩn bị"
    className="mx-4 mt-3 rounded-2xl border border-[#008A64]/30 bg-[#ECFDF5] dark:bg-emerald-950/30 dark:border-emerald-700/40 px-5 py-4 text-slate-800 dark:text-slate-100 shadow-xs"
  >
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="min-w-0 space-y-1.5">
        <p className="text-xs font-bold uppercase tracking-wide text-[#008A64] dark:text-emerald-400 flex items-center gap-1.5">
          <Hourglass size={13} aria-hidden="true" />
          <span>Thời gian chuẩn bị</span>
        </p>
        {motion && (
          <p data-testid="preparation-motion" className="text-sm font-bold leading-snug">
            {motion}
          </p>
        )}
        {side && (
          <p data-testid="preparation-side" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Bạn tranh biện phía:{" "}
            <span className={side === "pro" ? "text-[#008A64] dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
              {side === "pro" ? "Ủng hộ (PRO)" : "Phản đối (CON)"}
            </span>
          </p>
        )}
        <p className="text-xs text-slate-600 dark:text-slate-300">Vòng 1 – {roundLabelOf(1)} sắp bắt đầu</p>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div
          data-testid="preparation-countdown"
          role="timer"
          aria-label="Thời gian chuẩn bị còn lại"
          className="text-3xl sm:text-4xl font-black tabular-nums text-[#0F172A] dark:text-[#F8FAFC]"
        >
          {isStarting ? <Loader2 size={30} className="animate-spin" aria-hidden="true" /> : formatMinutesSeconds(secondsLeft)}
        </div>
        {canSkip && (
          <button
            type="button"
            data-testid="skip-preparation-btn"
            disabled={isSkipping || isStarting}
            onClick={onSkip}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#008A64] hover:bg-[#007457] disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            {isSkipping ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
            <span>Bắt đầu ngay</span>
          </button>
        )}
      </div>
    </div>
  </section>
);

export default PreparationPanel;

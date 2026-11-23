import React from "react";
import { Lightbulb } from "lucide-react";
import { roundLabelOf } from "../../../utils/debatePreparation";

interface PreparationPanelProps {
  motion: string;
  /** The side of the learner; null for someone who only watches (judge, spectator). */
  side: "pro" | "con" | null;
}

/** A small hint card while the learner prepares: what is debated and on which side (the clock is in RoundStatusBar). */
const PreparationPanel: React.FC<PreparationPanelProps> = ({ motion, side }) => (
  <section
    data-testid="preparation-panel"
    aria-label="Gợi ý chuẩn bị"
    className="mx-4 mt-3 rounded-2xl border border-[#008A64]/30 bg-[#ECFDF5] dark:bg-emerald-950/30 dark:border-emerald-700/40 px-4 py-3 text-slate-800 dark:text-slate-100 shadow-xs"
  >
    <div className="min-w-0 space-y-1">
      <p className="text-xs font-bold uppercase tracking-wide text-[#008A64] dark:text-emerald-400 flex items-center gap-1.5">
        <Lightbulb size={13} aria-hidden="true" />
        <span>Kiến nghị và phe của bạn</span>
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
  </section>
);

export default PreparationPanel;

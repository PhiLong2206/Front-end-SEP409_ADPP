import React, { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import AiVoicePicker from "../AiVoicePicker";
import type { PracticeSide } from "../../../utils/debateTopicHistory";

export type AIDifficultyLevel = "Dễ" | "Trung bình" | "Khó";

const DIFFICULTIES: AIDifficultyLevel[] = ["Dễ", "Trung bình", "Khó"];

interface PracticeStartPanelProps {
  /** Makes the radio group names unique when several panels exist on the page. */
  idPrefix: string;
  /** The side picked at first (the side of the last time, when there is one). */
  defaultSide?: PracticeSide | null;
  submitting: boolean;
  error: string | null;
  onStart: (side: PracticeSide, difficulty: AIDifficultyLevel) => void;
}

/** Side + difficulty of the AI, and the button that starts the session. */
const PracticeStartPanel: React.FC<PracticeStartPanelProps> = ({ idPrefix, defaultSide, submitting, error, onStart }) => {
  const [side, setSide] = useState<PracticeSide>(defaultSide ?? "PRO");
  const [difficulty, setDifficulty] = useState<AIDifficultyLevel>("Trung bình");

  return (
    <div data-testid="start-panel" className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <fieldset className="space-y-2">
          <legend className="text-xs font-bold text-slate-800 dark:text-[#F8FAFC] mb-2">Phe của bạn</legend>
          {(["PRO", "CON"] as const).map((value) => (
            <label
              key={value}
              className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer text-xs sm:text-sm font-semibold transition-all ${
                side === value
                  ? value === "PRO"
                    ? "bg-[#ECFDF5] border-[#008A64] text-[#008A64]"
                    : "bg-rose-50 border-rose-400 text-rose-700"
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name={`side-${idPrefix}`}
                checked={side === value}
                onChange={() => setSide(value)}
                className={value === "PRO" ? "accent-[#008A64]" : "accent-rose-600"}
              />
              <span>{value === "PRO" ? "Ủng hộ (Pro)" : "Phản đối (Con)"}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-xs font-bold text-slate-800 dark:text-[#F8FAFC] mb-2">Độ khó của AI</legend>
          {DIFFICULTIES.map((level) => (
            <label
              key={level}
              className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer text-xs sm:text-sm font-semibold transition-all ${
                difficulty === level
                  ? "bg-[#ECFDF5] border-[#008A64] text-[#008A64]"
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name={`difficulty-${idPrefix}`}
                checked={difficulty === level}
                onChange={() => setDifficulty(level)}
                className="accent-[#008A64]"
              />
              <span>{level}</span>
            </label>
          ))}
        </fieldset>
      </div>

      <AiVoicePicker variant="compact" />

      {error && (
        <p role="alert" className="text-xs font-semibold text-rose-600">
          {error}
        </p>
      )}

      <button
        type="button"
        data-testid="start-practice-btn"
        disabled={submitting}
        onClick={() => onStart(side, difficulty)}
        className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#008A64] hover:bg-[#007457] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-bold shadow-xs transition-colors cursor-pointer"
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
        <span>{submitting ? "Đang tạo phiên..." : "Bắt đầu tranh biện"}</span>
      </button>
    </div>
  );
};

export default PracticeStartPanel;

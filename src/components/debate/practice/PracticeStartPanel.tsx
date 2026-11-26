import React, { useState } from "react";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
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
  onStart: (side: PracticeSide, difficulty: AIDifficultyLevel, enableRag: boolean) => void;
  initialEnableRag?: boolean;
}

/** Side + difficulty of the AI, RAG toggle, and the button that starts the session. */
const PracticeStartPanel: React.FC<PracticeStartPanelProps> = ({
  idPrefix,
  defaultSide,
  submitting,
  error,
  onStart,
  initialEnableRag = true,
}) => {
  const [side, setSide] = useState<PracticeSide>(defaultSide ?? "PRO");
  const [difficulty, setDifficulty] = useState<AIDifficultyLevel>("Trung bình");
  const [enableRag, setEnableRag] = useState<boolean>(initialEnableRag);

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

      {/* RAG Knowledge Retrieval Toggle */}
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#091713] border border-slate-200/80 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <label
              htmlFor={`rag-toggle-${idPrefix}`}
              className="text-xs font-bold text-slate-800 dark:text-[#F8FAFC] flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles size={14} className="text-[#008A64]" />
              <span>Kiểm chứng dữ liệu RAG</span>
            </label>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {enableRag
                ? "Bật đối chiếu dẫn chứng và tài liệu tham khảo chuyên sâu (150 Credit)"
                : "Tắt tìm kiếm tài liệu — tranh biện phản hồi nhanh từ AI (110 Credit)"}
            </p>
          </div>
          <button
            id={`rag-toggle-${idPrefix}`}
            type="button"
            role="switch"
            aria-checked={enableRag}
            onClick={() => setEnableRag(!enableRag)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
              enableRag ? "bg-[#008A64]" : "bg-slate-300 dark:bg-slate-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                enableRag ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-200/60 dark:border-slate-800 font-bold">
          <span className="text-slate-600 dark:text-slate-400">Phí trừ điểm phiên luyện tập:</span>
          <span className="text-[#008A64] font-mono text-xs">
            {enableRag ? "150 Credit" : "110 Credit"}
          </span>
        </div>
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
        onClick={() => onStart(side, difficulty, enableRag)}
        className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#008A64] hover:bg-[#007457] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-bold shadow-xs transition-colors cursor-pointer"
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
        <span>{submitting ? "Đang tạo phiên..." : `Bắt đầu tranh biện (${enableRag ? "150" : "110"} Credit)`}</span>
      </button>
    </div>
  );
};

export default PracticeStartPanel;

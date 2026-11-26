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

  const option = (checked: boolean, tone: "accent" | "danger" = "accent") =>
    `flex min-h-11 cursor-pointer items-center gap-(--s-3) rounded-ap-md border px-(--s-3) text-(length:--text-callout) font-medium transition-[background-color,border-color] duration-(--t-fast) has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-accent/30 ${
      checked
        ? tone === "danger"
          ? "border-ap-danger bg-ap-danger/10 text-label"
          : "border-accent bg-accent-soft text-accent"
        : "border-transparent bg-canvas-secondary text-label-secondary hover:text-label"
    }`;

  return (
    <div data-testid="start-panel" className="space-y-(--s-4) border-t border-separator pt-(--s-4)">
      <div className="grid grid-cols-1 gap-(--s-5) sm:grid-cols-2">
        <fieldset className="space-y-(--s-2)">
          <legend className="mb-(--s-2) text-(length:--text-caption) font-medium text-label-secondary">Phe của bạn</legend>
          {(["PRO", "CON"] as const).map((value) => (
            <label key={value} className={option(side === value, value === "CON" ? "danger" : "accent")}>
              <input
                type="radio"
                name={`side-${idPrefix}`}
                checked={side === value}
                onChange={() => setSide(value)}
                className={value === "PRO" ? "h-4 w-4 accent-accent" : "h-4 w-4 accent-ap-danger"}
              />
              <span>{value === "PRO" ? "Ủng hộ (Pro)" : "Phản đối (Con)"}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className="space-y-(--s-2)">
          <legend className="mb-(--s-2) text-(length:--text-caption) font-medium text-label-secondary">Độ khó của AI</legend>
          {DIFFICULTIES.map((level) => (
            <label key={level} className={option(difficulty === level)}>
              <input
                type="radio"
                name={`difficulty-${idPrefix}`}
                checked={difficulty === level}
                onChange={() => setDifficulty(level)}
                className="h-4 w-4 accent-accent"
              />
              <span>{level}</span>
            </label>
          ))}
        </fieldset>
      </div>

      <AiVoicePicker variant="compact" />

      {error && (
        <p role="alert" className="rounded-ap-md bg-ap-danger/10 p-(--s-3) text-(length:--text-callout) text-label">
          {error}
        </p>
      )}

      <button
        type="button"
        data-testid="start-practice-btn"
        disabled={submitting}
        onClick={() => onStart(side, difficulty)}
        className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-(--s-2) rounded-ap-pill bg-accent px-(--s-5) text-(length:--text-body) font-medium text-accent-contrast transition-[background-color,transform] duration-(--t-fast) ease-ap hover:bg-accent-hover active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
        <span>{submitting ? "Đang tạo phiên..." : "Bắt đầu tranh biện"}</span>
      </button>
    </div>
  );
};

export default PracticeStartPanel;

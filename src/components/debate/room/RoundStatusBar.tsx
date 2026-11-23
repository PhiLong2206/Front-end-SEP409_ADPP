import React, { useEffect, useState } from "react";
import { Bot, Hourglass, Loader2, Mic, Play, SkipForward } from "lucide-react";
import { formatMinutesSeconds } from "../../../utils/debatePreparation";

export type RoundClockMode = "prep" | "turn" | "ai";
export type RoundClockTone = "prep" | "ok" | "warn" | "danger" | "idle";

/** Which clock is shown (there is only one) and the colour of the learner's turn clock. Pure, for tests. */
export function roundClockTone(mode: RoundClockMode, secondsRemaining: number, expired: boolean): RoundClockTone {
  if (mode === "prep") return "prep";
  if (mode === "ai") return "idle";
  if (expired || secondsRemaining < 10) return "danger";
  if (secondsRemaining < 30) return "warn";
  return "ok";
}

const TONE_CLASS: Record<RoundClockTone, string> = {
  prep: "text-blue-600 dark:text-blue-400",
  ok: "text-[#008A64] dark:text-[#34D399]",
  warn: "text-amber-600 dark:text-amber-400",
  danger: "text-rose-600 dark:text-rose-400",
  idle: "text-slate-400 dark:text-slate-500",
};

interface RoundStatusBarProps {
  round: number;
  totalRounds: number;
  roundLabel: string;
  /** The preparation minute is running (before Round 1 or between rounds). */
  isPreparing: boolean;
  /** The preparation clock reached 00:00 and the room loads the next round. */
  isPrepStarting: boolean;
  prepSecondsLeft: number;
  secondsRemaining: number;
  /** The AI is writing a speech (its turn, or its opening being recorded). */
  isAiWriting: boolean;
  /** The AI is reading its speech aloud, or the room waits for it to finish before the minute starts. */
  isAiPresenting: boolean;
  canSpeak: boolean;
  isExpired: boolean;
  isCompleted: boolean;
  isWaitingForOpponent: boolean;
  canSkipPreparation: boolean;
  isSkippingPreparation: boolean;
  onSkipPreparation: () => void;
  /** The part the AI is reading right now (null: nothing is being read): the skip button names it. */
  readingPartName: string | null;
  onSkipReading: () => void;
  /** The round whose start was just announced: the bar glows for a second. */
  announcedRound: { round: number; label: string } | null;
}

/**
 * One place for the state of the debate: the round and its steps on the left, a single big clock on the right (the
 * preparation minute, the learner's turn, or "—" while the AI writes or reads) and the button that fits the moment.
 */
const RoundStatusBar: React.FC<RoundStatusBarProps> = ({
  round,
  totalRounds,
  roundLabel,
  isPreparing,
  isPrepStarting,
  prepSecondsLeft,
  secondsRemaining,
  isAiWriting,
  isAiPresenting,
  canSpeak,
  isExpired,
  isCompleted,
  isWaitingForOpponent,
  canSkipPreparation,
  isSkippingPreparation,
  onSkipPreparation,
  readingPartName,
  onSkipReading,
  announcedRound,
}) => {
  // A new round was announced: glow for about a second (the text itself is read out through the live region)
  const [glow, setGlow] = useState(false);
  const announcedKey = announcedRound ? announcedRound.round : null;
  useEffect(() => {
    if (announcedKey === null) return;
    setGlow(true);
    const timer = setTimeout(() => setGlow(false), 1000);
    return () => clearTimeout(timer);
  }, [announcedKey]);

  const aiBusy = isAiWriting || isAiPresenting || readingPartName !== null;
  const mode: RoundClockMode = aiBusy && !isCompleted ? "ai" : isPreparing ? "prep" : "turn";
  const tone = roundClockTone(mode, secondsRemaining, isExpired);

  const statusText = isCompleted
    ? "Đã hoàn thành 3 vòng"
    : isAiWriting
    ? "Đối thủ AI đang soạn…"
    : aiBusy
    ? "Đối thủ AI đang trình bày"
    : isPreparing
    ? "Thời gian chuẩn bị"
    : isExpired
    ? "Đã hết thời gian phát biểu"
    : canSpeak
    ? "Lượt của bạn"
    : isWaitingForOpponent
    ? "Đang chờ lượt đối thủ"
    : "Đang diễn ra";

  const clockLabel = mode === "prep" ? "Chuẩn bị" : mode === "turn" ? "Lượt nói" : "AI";
  const clockTestId = mode === "prep" ? "preparation-countdown" : mode === "turn" ? "debate-countdown-timer" : "ai-waiting-clock";
  const showSkipPreparation = isPreparing && canSkipPreparation && !aiBusy;

  return (
    <div
      data-testid="round-status-bar"
      data-glow={glow ? "true" : "false"}
      className={`shrink-0 mx-3 sm:mx-5 mt-2 rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-500 ${
        glow
          ? "border-[#008A64] bg-emerald-50 dark:bg-emerald-950/40 shadow-lg ring-4 ring-[#008A64]/30"
          : "border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0E1D17]"
      }`}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-3 flex-wrap">
          <span data-testid="round-label" className="text-sm font-bold text-slate-800 dark:text-slate-100">
            Vòng {round}/{totalRounds} · {roundLabel}
          </span>
          <ol aria-label="Các vòng" className="flex items-center gap-1" data-testid="round-steps">
            {Array.from({ length: totalRounds }, (_, i) => i + 1).map((step) => (
              <li
                key={step}
                aria-current={step === round ? "step" : undefined}
                className={`h-5 w-5 rounded-full text-[11px] font-bold flex items-center justify-center ${
                  step === round
                    ? "bg-[#008A64] text-white"
                    : step < round
                    ? "bg-emerald-100 text-[#008A64] dark:bg-emerald-900/50 dark:text-emerald-300"
                    : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                }`}
              >
                {step}
              </li>
            ))}
          </ol>
        </div>
        <p
          aria-live="polite"
          data-testid="round-status-text"
          className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5"
        >
          {isAiWriting ? (
            <Loader2 size={12} className="animate-spin text-[#008A64]" aria-hidden="true" />
          ) : aiBusy ? (
            <Bot size={12} aria-hidden="true" />
          ) : isPreparing ? (
            <Hourglass size={12} aria-hidden="true" />
          ) : canSpeak ? (
            <Mic size={12} aria-hidden="true" />
          ) : null}
          <span data-testid={isPreparing && aiBusy ? "preparation-ai-presenting" : undefined}>{statusText}</span>
        </p>
        {/* The announcement of a new round, for screen readers and for tests; it has no box of its own */}
        <span aria-live="polite" className="sr-only">
          {announcedRound ? (
            <span data-testid="round-banner">{`Vòng ${announcedRound.round} – ${announcedRound.label}`}</span>
          ) : null}
        </span>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 flex-wrap sm:flex-nowrap shrink-0">
        {readingPartName && (
          <button
            type="button"
            onClick={onSkipReading}
            data-testid="skip-ai-reading-btn"
            title="Bạn đã đọc xong phần này: bỏ qua phần đọc to"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#008A64] bg-[#ECFDF5] hover:bg-[#D1FAE5] dark:bg-emerald-950/30 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-[#008A64]/30"
          >
            <SkipForward size={14} aria-hidden="true" />
            {`Bỏ qua phần ${readingPartName}`}
          </button>
        )}
        {showSkipPreparation && (
          <button
            type="button"
            data-testid="skip-preparation-btn"
            disabled={isSkippingPreparation || isPrepStarting}
            onClick={onSkipPreparation}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#008A64] hover:bg-[#007457] disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            {isSkippingPreparation ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <Play size={14} aria-hidden="true" />
            )}
            <span>Bắt đầu ngay</span>
          </button>
        )}

        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{clockLabel}</p>
          <div
            data-testid={clockTestId}
            data-tone={tone}
            role="timer"
            aria-label={
              mode === "prep" ? "Thời gian chuẩn bị còn lại" : mode === "turn" ? "Thời gian còn lại của lượt phát biểu" : "Đồng hồ tạm dừng: AI đang trình bày"
            }
            className={`font-mono font-black tabular-nums text-3xl sm:text-4xl leading-none ${TONE_CLASS[tone]} ${
              tone === "warn" ? "animate-pulse" : ""
            }`}
          >
            {mode === "ai" ? (
              <span className="inline-flex items-center gap-2">
                <Bot size={26} aria-hidden="true" />
                <span>—</span>
              </span>
            ) : mode === "prep" ? (
              isPrepStarting ? (
                <Loader2 size={30} className="animate-spin" aria-hidden="true" />
              ) : (
                formatMinutesSeconds(prepSecondsLeft)
              )
            ) : (
              formatMinutesSeconds(Math.max(0, secondsRemaining))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoundStatusBar;

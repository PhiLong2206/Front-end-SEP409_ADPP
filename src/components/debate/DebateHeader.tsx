import React from "react";
import { ArrowLeft, Clock, Loader2, AlertTriangle, CheckCircle2, Mic } from "lucide-react";
import { DebateRoomMode, DebateRoleInRoom } from "../../types";

export interface DebateHeaderProps {
  motionText: string;
  mode: DebateRoomMode;
  userRoleInRoom?: DebateRoleInRoom;
  debaterSide: "pro" | "con";
  currentRound: number;
  secondsRemaining: number;
  canSpeak?: boolean;
  isTurnExpired?: boolean;
  isAiGenerating?: boolean;
  isSubmitting?: boolean;
  isWaitingForOpponent?: boolean;
  isEvaluating?: boolean;
  isDebateCompleted?: boolean;
  canSubmitDebate?: boolean;
  onExit: () => void;
  onSubmitDebate: () => void;
}

const DebateHeader: React.FC<DebateHeaderProps> = ({
  motionText,
  mode,
  userRoleInRoom = "Debater",
  debaterSide,
  currentRound,
  secondsRemaining,
  canSpeak = false,
  isTurnExpired = false,
  isAiGenerating = false,
  isSubmitting = false,
  isWaitingForOpponent = false,
  isEvaluating = false,
  isDebateCompleted = false,
  canSubmitDebate = false,
  onExit,
  onSubmitDebate,
}) => {
  const formatTimer = (seconds: number) => {
    const safeSeconds = Math.max(0, seconds);
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getRoundShortName = (round: number) => {
    if (round === 1) return "Mở đầu";
    if (round === 2) return "Phản biện";
    return "Kết luận";
  };

  const userSideLabel = debaterSide === "pro" ? "Ủng hộ (PRO)" : "Phản đối (CON)";
  const opponentSideLabel = debaterSide === "pro" ? "Phản đối (CON)" : "Ủng hộ (PRO)";
  const opponentLabel = mode === "ai" ? "AI" : "Đối thủ";

  const isOpponentActive = isAiGenerating || isSubmitting || isWaitingForOpponent;
  const isLowTime =
    !isDebateCompleted &&
    !isTurnExpired &&
    !isOpponentActive &&
    secondsRemaining > 0 &&
    secondsRemaining <= 30;
  const isZeroOrExpired =
    !isDebateCompleted &&
    (isTurnExpired || (secondsRemaining <= 0 && !isOpponentActive));

  const renderTurnStatusBadge = () => {
    if (isDebateCompleted) {
      return (
        <span
          data-testid="turn-status-indicator"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-[#008A64] dark:text-[#34D399] border border-[#008A64]/25"
        >
          <CheckCircle2 size={11} />
          <span>Đã hoàn thành 3 vòng</span>
        </span>
      );
    }

    if (isAiGenerating) {
      return (
        <span
          data-testid="turn-status-indicator"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
        >
          <Loader2 size={11} className="animate-spin text-[#008A64]" />
          <span>Đối thủ AI đang phản hồi...</span>
        </span>
      );
    }

    if (isSubmitting) {
      return (
        <span
          data-testid="turn-status-indicator"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
        >
          <Loader2 size={11} className="animate-spin text-[#008A64]" />
          <span>Đang gửi lập luận...</span>
        </span>
      );
    }

    if (isWaitingForOpponent) {
      return (
        <span
          data-testid="turn-status-indicator"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/50"
        >
          <span>Đang chờ lượt đối thủ</span>
        </span>
      );
    }

    if (isZeroOrExpired) {
      return (
        <span
          data-testid="turn-status-indicator"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60"
        >
          <AlertTriangle size={11} />
          <span>Đã hết thời gian phát biểu</span>
        </span>
      );
    }

    if (canSpeak) {
      return (
        <span
          data-testid="turn-status-indicator"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#ECFDF5] dark:bg-emerald-950/60 text-[#008A64] dark:text-[#34D399] border border-[#A7F3D0] dark:border-emerald-800/60"
        >
          <Mic size={11} />
          <span>Đến lượt bạn phát biểu</span>
        </span>
      );
    }

    return null;
  };

  return (
    <header className="sticky top-0 z-20 bg-white/95 dark:bg-[#0E1D17]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-3 sm:px-5 py-2.5 shrink-0">
      <div className="max-w-[920px] mx-auto flex items-center justify-between gap-3">
        {/* Left: Back Button + Topic + Side vs Side + Active Turn Status */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={onExit}
            aria-label="Rời phòng tranh biện"
            title="Rời phòng tranh biện"
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-[#008A64]/30"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="min-w-0 flex-1">
            <h1
              className="font-semibold text-sm sm:text-[15px] text-slate-900 dark:text-[#F8FAFC] truncate leading-tight"
              title={motionText}
            >
              {motionText}
            </h1>

            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
              <span className="font-medium text-[#008A64] dark:text-[#34D399]">
                Bạn: {userSideLabel}
              </span>
              <span className="text-slate-300 dark:text-slate-600">vs</span>
              <span>
                {opponentLabel}: {opponentSideLabel}
              </span>

              <span className="hidden sm:inline text-slate-300 dark:text-slate-600">•</span>
              {renderTurnStatusBadge()}
            </div>
          </div>
        </div>

        {/* Right: Current Round + Remaining Time + Submit Action (only when debate completion conditions are satisfied) */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <div
            className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs transition-colors ${
              isZeroOrExpired
                ? "bg-rose-50/90 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/70"
                : isLowTime
                ? "bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/70"
                : "bg-slate-100/90 dark:bg-[#13261E] border-slate-200/70 dark:border-slate-800"
            }`}
          >
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Vòng {currentRound}/3
              <span className="hidden md:inline font-normal text-slate-500 dark:text-slate-400">
                {" "}
                · {getRoundShortName(currentRound)}
              </span>
            </span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span
              data-testid="debate-countdown-timer"
              className={`inline-flex items-center gap-1 font-mono font-semibold ${
                isZeroOrExpired
                  ? "text-rose-600 dark:text-rose-400"
                  : isLowTime
                  ? "text-amber-600 dark:text-amber-400 animate-pulse"
                  : "text-[#008A64] dark:text-[#34D399]"
              }`}
              title={
                isZeroOrExpired
                  ? "Đã hết thời gian phát biểu"
                  : "Thời gian còn lại của lượt phát biểu"
              }
            >
              <Clock size={13} />
              <span>{formatTimer(secondsRemaining)}</span>
            </span>
          </div>

          {(isDebateCompleted || userRoleInRoom === "Judge") && (
            <button
              type="button"
              data-testid="header-submit-debate-btn"
              onClick={onSubmitDebate}
              disabled={
                isEvaluating ||
                isAiGenerating ||
                isSubmitting ||
                (!canSubmitDebate && userRoleInRoom !== "Judge")
              }
              className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-[#008A64]/40 disabled:opacity-50 disabled:cursor-not-allowed ${
                isDebateCompleted && canSubmitDebate
                  ? "bg-[#008A64] hover:bg-[#007457] text-white shadow-xs"
                  : "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 text-[#008A64] dark:text-[#34D399] border border-[#008A64]/25"
              }`}
            >
              {isEvaluating && <Loader2 size={13} className="animate-spin" />}
              <span>
                {isEvaluating
                  ? "Đang chấm..."
                  : userRoleInRoom === "Judge"
                  ? "Chấm điểm"
                  : "Nộp bài"}
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default DebateHeader;

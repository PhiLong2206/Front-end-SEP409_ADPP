import React from "react";
import { Check, Mic, User as UserIcon, Bot, AlertCircle, Clock } from "lucide-react";
import { SystemDebateSide } from "../../../types";

export interface DebateTurnIndicatorProps {
  currentRound: number;
  currentTurnSide?: SystemDebateSide | number;
  currentSpeakerName?: string;
  isMyTurn?: boolean;
  isTurnExpired?: boolean;
  isDebateCompleted?: boolean;
  waitingForOpponent?: boolean;
}

const DebateTurnIndicator: React.FC<DebateTurnIndicatorProps> = ({
  currentRound,
  currentTurnSide,
  currentSpeakerName,
  isMyTurn = false,
  isTurnExpired = false,
  isDebateCompleted = false,
  waitingForOpponent = false,
}) => {
  const rounds = [
    { round: 1, label: "Mở đầu", en: "Opening" },
    { round: 2, label: "Phản biện", en: "Rebuttal" },
    { round: 3, label: "Kết luận", en: "Closing" },
  ];

  const isProTurn = currentTurnSide === SystemDebateSide.PRO || String(currentTurnSide) === "1";

  return (
    <div className="bg-white dark:bg-[#0F1726] px-4 sm:px-6 py-2 border-b border-slate-100 dark:border-slate-800/70 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
      {/* Left: 3-round progress line */}
      <div className="flex items-center gap-2 sm:gap-4 max-w-xl w-full sm:w-auto">
        {rounds.map((item, idx) => {
          const isPast = currentRound > item.round || isDebateCompleted;
          const isCurrent = currentRound === item.round && !isDebateCompleted;

          return (
            <React.Fragment key={item.round}>
              <div className="flex items-center gap-1.5 shrink-0">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                    isPast
                      ? "bg-[#0B5ED7] text-white"
                      : isCurrent
                      ? "bg-[#0B5ED7] text-white ring-2 ring-[#EAF2FF] dark:ring-blue-950/80 shadow-xs"
                      : "bg-slate-100 dark:bg-[#060d1a] text-slate-400 dark:text-[#64748B]"
                  }`}
                >
                  {isPast ? <Check size={11} strokeWidth={3} /> : item.round}
                </div>

                <span
                  className={`text-xs font-semibold ${
                    isCurrent
                      ? "text-[#0B5ED7] dark:text-[#60A5FA]"
                      : isPast
                      ? "text-slate-700 dark:text-[#CBD5E1]"
                      : "text-slate-400 dark:text-[#64748B]"
                  }`}
                >
                  {item.label}
                </span>
              </div>

              {idx < rounds.length - 1 && (
                <div
                  className={`flex-1 sm:w-8 h-0.5 rounded-full transition-colors ${
                    item.round < currentRound || isDebateCompleted
                      ? "bg-[#0B5ED7]"
                      : "bg-slate-200 dark:bg-slate-800"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Right: Active Speaker Banner */}
      <div className="flex items-center gap-2 text-xs">
        {isDebateCompleted ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#0B5ED7] dark:text-[#60A5FA] border border-blue-300 dark:border-blue-700 font-bold">
            <Check size={13} />
            <span>Đã hoàn thành 3 vòng tranh biện</span>
          </span>
        ) : isTurnExpired ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-700 font-bold">
            <Clock size={13} />
            <span>Đã hết thời gian phát biểu</span>
          </span>
        ) : waitingForOpponent ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 font-medium">
            <AlertCircle size={13} className="animate-pulse" />
            <span>Đang chờ đối thủ tham gia phòng đấu...</span>
          </span>
        ) : isMyTurn ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#0B5ED7] dark:text-[#60A5FA] border border-blue-300 dark:border-blue-700 font-bold animate-pulse">
            <Mic size={13} />
            <span>Đến lượt bạn phát biểu ({isProTurn ? "Ủng hộ" : "Phản đối"})</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-[#060d1a] text-slate-700 dark:text-[#CBD5E1] border border-slate-200 dark:border-slate-800 font-medium">
            {currentSpeakerName?.includes("AI") ? <Bot size={13} /> : <UserIcon size={13} />}
            <span>
              Lượt phát biểu:{" "}
              <strong className={isProTurn ? "text-[#0B5ED7] dark:text-[#60A5FA]" : "text-amber-600 dark:text-amber-400"}>
                {currentSpeakerName || (isProTurn ? "Bên Ủng hộ (PRO)" : "Bên Phản đối (CON)")}
              </strong>
            </span>
          </span>
        )}
      </div>
    </div>
  );
};

export default DebateTurnIndicator;

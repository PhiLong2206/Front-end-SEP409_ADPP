import React, { useRef, useEffect, useState, useCallback } from "react";
import { Bot, ArrowDown, Clock, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import DebateMessageItem, { DebateMessageData } from "./DebateMessageItem";
import { DebateRoomMode } from "../../types";

export interface DebateChatProps {
  messages: DebateMessageData[];
  mode: DebateRoomMode;
  debaterSide: "pro" | "con";
  currentRound: number;
  isAiGenerating?: boolean;
  aiSide?: "pro" | "con";
  timedOutRounds?: number[];
  isTurnExpired?: boolean;
  isDebateCompleted?: boolean;
  canSubmitDebate?: boolean;
  /** Id of the learner message whose turn evaluation is running: shows a small, non-blocking indicator. */
  evaluatingMessageId?: string | null;
  isP2pOr2v2?: boolean;
  onAdvanceTimedOutRound?: () => void;
  onSubmitDebate?: () => void;
}

const DebateChat: React.FC<DebateChatProps> = ({
  messages,
  mode,
  debaterSide,
  currentRound,
  isAiGenerating = false,
  aiSide = "con",
  timedOutRounds = [],
  isTurnExpired = false,
  isDebateCompleted = false,
  canSubmitDebate = false,
  evaluatingMessageId = null,
  isP2pOr2v2 = false,
  onAdvanceTimedOutRound,
  onSubmitDebate,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // "Near the bottom" = within this many pixels of the end: only then new messages scroll the chat
  const NEAR_BOTTOM_PX = 120;

  const [isNearBottom, setIsNearBottom] = useState(true);
  const [hasUnreadBelow, setHasUnreadBelow] = useState(false);
  // Read by the effects below without being a dependency (scrolling must never re-trigger auto-scroll)
  const isNearBottomRef = useRef(true);
  const prevMsgCountRef = useRef(messages.length);
  const prevLastMsgIdRef = useRef(messages[messages.length - 1]?.id);
  const prevCompletedRef = useRef(isDebateCompleted);

  const checkIfNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distanceFromBottom <= NEAR_BOTTOM_PX;
  }, []);

  const handleScroll = useCallback(() => {
    const nearBottom = checkIfNearBottom();
    isNearBottomRef.current = nearBottom;
    setIsNearBottom(nearBottom);
    if (nearBottom) {
      setHasUnreadBelow(false);
    }
  }, [checkIfNearBottom]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    isNearBottomRef.current = true;
    setHasUnreadBelow(false);
    setIsNearBottom(true);
  }, []);

  // On entering the page, show the end of the conversation once (also for a finished debate)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, []);

  // Auto-scroll ONLY when a new message arrived (count grew or the last id changed), and only if the user
  // is near the bottom. Re-renders, polling, the clock and scrolling itself never move the view.
  useEffect(() => {
    const count = messages.length;
    const lastId = messages[count - 1]?.id;
    const isNewMessage = count > prevMsgCountRef.current || (count > 0 && lastId !== prevLastMsgIdRef.current);
    prevMsgCountRef.current = count;
    prevLastMsgIdRef.current = lastId;

    const wasCompleted = prevCompletedRef.current;
    prevCompletedRef.current = isDebateCompleted;

    // The debate just ended: bring the completion card into view if the user is following along
    if (!wasCompleted && isDebateCompleted && isNearBottomRef.current) {
      scrollToBottom("smooth");
      return;
    }
    if (!isNewMessage) return;
    // A finished debate is only read: never pull the user down again
    if (wasCompleted && isDebateCompleted) return;

    const latestMsg = messages[count - 1];
    const sentByDebater =
      latestMsg &&
      (latestMsg.isCurrentUser ??
        (latestMsg.speaker === "Debater" || latestMsg.speaker === "Learner"));

    if (isNearBottomRef.current || sentByDebater) {
      scrollToBottom("smooth");
    } else {
      setHasUnreadBelow(true);
    }
  }, [messages, isDebateCompleted, scrollToBottom]);

  // The typing indicator appears at the bottom: follow it only if the user is following the conversation
  useEffect(() => {
    if (isAiGenerating && !isDebateCompleted && isNearBottomRef.current) {
      scrollToBottom("smooth");
    }
  }, [isAiGenerating, isDebateCompleted, scrollToBottom]);

  const round1Messages = messages.filter((m) => m.roundNumber === 1);
  const round2Messages = messages.filter((m) => m.roundNumber === 2);
  const round3Messages = messages.filter((m) => m.roundNumber === 3);

  const renderRoundSection = (
    roundNum: number,
    roundMsgs: DebateMessageData[],
    label: string
  ) => {
    const isRoundTimedOut = timedOutRounds.includes(roundNum);
    if (roundMsgs.length === 0 && currentRound < roundNum && !isRoundTimedOut) {
      return null;
    }

    const showWelcomeInRound1 =
      roundNum === 1 && roundMsgs.length === 0 && !isAiGenerating;

    const nextRoundLabel = roundNum === 1 ? "Phản biện" : "Kết luận";

    return (
      <div key={roundNum} className="space-y-4">
        {/* Compact System Round Transition */}
        <div
          className="flex items-center justify-center gap-3 py-1"
          role="separator"
          aria-label={`Vòng ${roundNum}: ${label}`}
        >
          <div className="w-12 sm:w-20 h-px bg-slate-200 dark:bg-slate-800" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Vòng {roundNum} · {label}
          </span>
          <div className="w-12 sm:w-20 h-px bg-slate-200 dark:bg-slate-800" />
        </div>

        {/* Minimal AI Welcome Message in Round 1 when no messages exist yet */}
        {showWelcomeInRound1 && (
          <div className="flex items-start gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-[#008A64] text-white flex items-center justify-center shrink-0 mt-0.5">
              <Bot size={16} />
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-tl-xs bg-white dark:bg-[#12231C] border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-sm leading-relaxed max-w-[85%] sm:max-w-[75%] shadow-2xs">
              {mode === "ai" ? (
                <p>
                  Chào bạn! Bạn đang ở phe{" "}
                  <strong className="text-[#008A64] dark:text-[#34D399]">
                    {debaterSide === "pro" ? "Ủng hộ (PRO)" : "Phản đối (CON)"}
                  </strong>
                  . Hãy trình bày lập luận mở đầu của bạn ở khung nhập bên dưới để bắt đầu Vòng 1.
                </p>
              ) : (
                <p>
                  Phiên tranh biện đã sẵn sàng. Hãy nhập lập luận mở đầu khi đến lượt phát biểu của bạn.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Messages in this round */}
        {roundMsgs.map((msg) => (
          <React.Fragment key={msg.id}>
            <DebateMessageItem message={msg} />
            {msg.id === evaluatingMessageId && (
              <div
                data-testid="turn-evaluating-indicator"
                role="status"
                className="flex items-center justify-end gap-1.5 pr-1 text-[11px] text-slate-400 dark:text-slate-500"
              >
                <Loader2 size={11} className="animate-spin" />
                <span>Đang chấm lượt này...</span>
              </div>
            )}
          </React.Fragment>
        ))}

        {/* System Timeout Notice for this Round */}
        {isRoundTimedOut && (
          <div
            data-testid={`round-${roundNum}-timeout-notice`}
            className="mx-auto max-w-xl rounded-2xl bg-rose-50/90 dark:bg-rose-950/35 border border-rose-200/90 dark:border-rose-800/60 px-4 py-3 text-xs sm:text-sm text-rose-800 dark:text-rose-200 shadow-2xs animate-fade-in"
            role="status"
            aria-live="assertive"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Clock size={16} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-rose-900 dark:text-rose-100">
                    Đã hết thời gian phát biểu — Vòng {roundNum} ({label})
                  </p>
                  <p className="text-xs text-rose-700/90 dark:text-rose-300/90 mt-0.5">
                    {isP2pOr2v2
                      ? "Thời gian của lượt hiện tại đã kết thúc (00:00). Đang chờ máy chủ đồng bộ trạng thái lượt tiếp theo."
                      : roundNum < 3
                      ? "Lượt phát biểu của bạn ở vòng này đã kết thúc khi đồng hồ về 00:00."
                      : "Thời gian phát biểu Vòng 3 (Kết luận) đã kết thúc. Phiên tranh biện đã hoàn tất."}
                  </p>
                </div>
              </div>

              {!isP2pOr2v2 &&
                roundNum === currentRound &&
                roundNum < 3 &&
                isTurnExpired &&
                !isDebateCompleted &&
                onAdvanceTimedOutRound && (
                  <button
                    type="button"
                    data-testid="advance-round-after-timeout-btn"
                    onClick={onAdvanceTimedOutRound}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-2xs"
                  >
                    <span>
                      Sang Vòng {roundNum + 1} ({nextRoundLabel})
                    </span>
                    <ArrowRight size={14} />
                  </button>
                )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={scrollContainerRef}
      data-testid="debate-chat-scroll"
      onScroll={handleScroll}
      className="relative flex-1 overflow-y-auto px-3 sm:px-6 py-4 scroll-smooth bg-slate-50/40 dark:bg-[#091511]"
    >
      <div className="max-w-[880px] mx-auto w-full space-y-4 pb-2">
        {/* Conversation Rounds (1: Opening, 2: Rebuttal, 3: Conclusion) */}
        {renderRoundSection(1, round1Messages, "Mở đầu")}
        {renderRoundSection(2, round2Messages, "Phản biện")}
        {renderRoundSection(3, round3Messages, "Kết luận")}

        {/* Typing Indicator while AI Responds */}
        {isAiGenerating && (
          <div
            data-testid="ai-typing-indicator"
            className="flex items-start gap-3 justify-start animate-fade-in"
            aria-live="polite"
          >
            <div className="w-8 h-8 rounded-full bg-[#008A64] text-white flex items-center justify-center shrink-0 mt-0.5">
              <Bot size={16} />
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-tl-xs bg-white dark:bg-[#12231C] border border-slate-200/80 dark:border-slate-800 shadow-2xs inline-flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Đối thủ AI ({aiSide === "pro" ? "PRO" : "CON"})
              </span>
              <span className="flex items-center gap-1 ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#008A64] animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#008A64] animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-[#008A64] animate-bounce" />
              </span>
            </div>
          </div>
        )}

        {/* Final Debate Completion Card */}
        {isDebateCompleted && (
          <div
            data-testid="debate-completed-banner"
            className="mx-auto max-w-xl rounded-2xl bg-[#ECFDF5]/90 dark:bg-emerald-950/40 border border-[#A7F3D0] dark:border-emerald-800/70 px-4 py-3.5 text-xs sm:text-sm text-slate-800 dark:text-slate-100 shadow-2xs animate-fade-in"
            role="status"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={17} className="text-[#008A64] dark:text-[#34D399] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Đã hoàn thành 3 vòng tranh biện
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    Phiên tranh biện đã khép lại. Bạn có thể nộp bài để xem báo cáo đánh giá tổng hợp.
                  </p>
                </div>
              </div>

              {onSubmitDebate && (
                <button
                  type="button"
                  data-testid="submit-and-view-result-btn"
                  disabled={!canSubmitDebate || isAiGenerating}
                  onClick={onSubmitDebate}
                  className="px-4 py-2 rounded-xl bg-[#008A64] hover:bg-[#007457] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Nộp bài & Xem kết quả</span>
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* Floating Scroll-to-Bottom Pill when reading earlier messages */}
      {(!isNearBottom || hasUnreadBelow) && messages.length > 0 && (
        <div className="sticky bottom-2 flex justify-center pointer-events-none z-10">
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/85 dark:bg-[#008A64] text-white text-xs font-medium shadow-md hover:bg-slate-800 transition-all cursor-pointer"
          >
            <ArrowDown size={13} />
            <span>{hasUnreadBelow ? "Tin nhắn mới" : "Cuộn xuống"}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default DebateChat;

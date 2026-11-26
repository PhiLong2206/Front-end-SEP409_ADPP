import React from "react";
import { Bot, User as UserIcon } from "lucide-react";
import type { DeliveryAnalytics } from "../../../types";
import ReadAlongText from "./ReadAlongText";
import { emotionLabelVi } from "../../../utils/emotionLabels";

export interface DebateMessageData {
  id: string;
  argumentId?: number;
  speaker: "Debater" | "Learner" | "AI" | "OpponentDebater" | "OpponentLearner" | "Teammate";
  speakerName: string;
  side: "Ủng hộ" | "Phản đối" | "PRO" | "CON";
  teamRole?: string;
  stage: "Mở đầu" | "Phản biện" | "Kết luận";
  roundNumber: number;
  timestamp: string;
  content: string;
  isCurrentUser?: boolean;
  wordCount?: number | null;
  durationSeconds?: number | null;
  deliveryAnalytics?: DeliveryAnalytics | null;
  /** The AI speech is on screen but the server has not recorded it: a small label says why (set by the room). */
  pending?: boolean;
  pendingLabel?: string;
}

export interface DebateMessageItemProps {
  message: DebateMessageData;
  /** The AI is reading this message aloud: the characters read so far (null: not being read, all in the main colour). */
  spokenChars?: number | null;
}

const DebateMessageItem: React.FC<DebateMessageItemProps> = ({ message, spokenChars = null }) => {
  const isUser =
    message.isCurrentUser ??
    (message.speaker === "Debater" || message.speaker === "Learner");
  const isAI = message.speaker === "AI";
  const isPro = message.side === "Ủng hộ";

  const da = message.deliveryAnalytics;
  const dominantEmotion = da?.dominantEmotion ?? da?.dominant_emotion;
  const composureScore = da?.composureScore ?? da?.composure_score;
  const wpm = da?.wpm;
  const overallDemeanorScore = da?.overallDemeanorScore ?? da?.overall_demeanor_score;
  const hasDeliveryBadges =
    (message.wordCount !== undefined && message.wordCount !== null && message.wordCount > 0) ||
    (message.durationSeconds !== undefined && message.durationSeconds !== null && message.durationSeconds > 0) ||
    Boolean(da);

  return (
    <div
      data-testid="message-item"
      data-speaker={isAI ? "AI" : "user"}
      className={`flex items-start gap-3 w-full ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {/* Left Avatar for AI Opponent or Other Participant */}
      {!isUser && (
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
            isAI
              ? "bg-[#0B5ED7] text-white"
              : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          }`}
        >
          {isAI ? <Bot size={16} /> : <UserIcon size={15} />}
        </div>
      )}

      {/* Message Bubble */}
      <div
        className={`px-4 py-3 rounded-2xl transition-all ${
          isUser
            ? "bg-[#EAF2FF] dark:bg-[#0C182F] border border-[#0B5ED7]/20 dark:border-[#0B5ED7]/35 rounded-tr-xs max-w-[82%] sm:max-w-[75%] text-slate-900 dark:text-[#F8FAFC]"
            : "bg-white dark:bg-[#0F1726] border border-slate-200/80 dark:border-slate-800 rounded-tl-xs max-w-[88%] sm:max-w-[80%] text-slate-800 dark:text-[#E2E8F0] shadow-2xs"
        }`}
      >
        {/* Compact Metadata Line */}
        <div className="flex items-center justify-between gap-3 mb-1 text-xs">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-semibold ${
                isUser
                  ? "text-[#0B5ED7] dark:text-[#60A5FA]"
                  : "text-slate-900 dark:text-slate-100"
              }`}
            >
              {isUser ? "Bạn" : message.speakerName}
            </span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded font-medium ${
                isPro
                  ? "bg-blue-100/80 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                  : "bg-rose-100/80 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
              }`}
            >
              {isPro ? "PRO" : "CON"}
              {message.teamRole ? ` · ${message.teamRole}` : ""}
            </span>
          </div>

          {message.timestamp && (
            <span className="text-slate-400 dark:text-slate-500 text-[11px] font-mono shrink-0">
              {message.timestamp}
            </span>
          )}
        </div>

        {/* Message Body */}
        <p className="text-[15px] leading-[1.65] whitespace-pre-line break-words">
          {isAI && spokenChars !== null ? <ReadAlongText text={message.content} spokenChars={spokenChars} /> : message.content}
        </p>

        {message.pendingLabel && (
          <p data-testid="message-pending-label" role="status" className="mt-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
            {message.pendingLabel}
          </p>
        )}

        {/* Multimodal Delivery Analytics & Speech Metrics Badges */}
        {hasDeliveryBadges && (
          <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
            {message.wordCount != null && message.wordCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
                📝 {message.wordCount} từ
              </span>
            )}
            {message.durationSeconds != null && message.durationSeconds > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
                ⏱ {message.durationSeconds}s
              </span>
            )}
            {wpm != null && wpm > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/50 font-medium">
                🎙 {wpm} WPM
              </span>
            )}
            {dominantEmotion && dominantEmotion !== "none" && (
              <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/50 font-medium">
                😊 {emotionLabelVi(dominantEmotion)}
                {composureScore != null ? ` (${composureScore}%)` : ""}
              </span>
            )}
            {overallDemeanorScore != null && overallDemeanorScore > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#0B5ED7] dark:text-[#60A5FA] border border-blue-200/70 dark:border-blue-800/50 font-semibold">
                ✨ Phong thái: {overallDemeanorScore}/100
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right Avatar for Debater */}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-slate-800 dark:bg-[#11203B] text-white flex items-center justify-center shrink-0 mt-0.5">
          <UserIcon size={15} />
        </div>
      )}
    </div>
  );
};

export default DebateMessageItem;

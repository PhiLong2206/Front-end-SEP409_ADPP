import React from "react";
import { Shield, Flame, User as UserIcon, Bot, CheckCircle2, Mic } from "lucide-react";
import { DebateTeamGroup, DebateRoomMode } from "../../../types";

export interface DebateTeamPanelProps {
  mode: DebateRoomMode;
  proTeam: DebateTeamGroup;
  conTeam: DebateTeamGroup;
  activeSpeakerName?: string;
  isCompact?: boolean;
}

const DebateTeamPanel: React.FC<DebateTeamPanelProps> = ({
  mode,
  proTeam,
  conTeam,
  activeSpeakerName,
  isCompact = false,
}) => {
  const is2v2OrComp = mode === "2v2" || (mode === "competition" && (proTeam.members.length > 1 || conTeam.members.length > 1));

  return (
    <div
      className={`bg-slate-50 dark:bg-[#070E1A] border-b border-slate-200 dark:border-[rgba(148,163,184,0.14)] px-4 sm:px-6 py-2.5 transition-all ${
        isCompact ? "py-1.5" : "py-2.5"
      }`}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-4xl mx-auto w-full">
        {/* PRO TEAM / PRO DEBATER */}
        <div className="p-2 sm:p-2.5 rounded-xl bg-blue-50/60 dark:bg-[rgba(59,130,246,0.08)] border border-blue-200/60 dark:border-[rgba(59,130,246,0.22)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#0B5ED7] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Shield size={14} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#0B5ED7] dark:text-[#60A5FA] truncate">
                {proTeam.teamName || "Đội Ủng hộ (Team PRO)"}
              </p>
              {/* Member list */}
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {proTeam.members.map((m, idx) => {
                  const isSpeaking = activeSpeakerName === m.speakerName || m.isSpeakingNow;
                  return (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                        isSpeaking
                          ? "bg-[#0B5ED7] text-white font-bold ring-2 ring-blue-300 dark:ring-blue-600 animate-pulse"
                          : m.hasSpokenInCurrentRound
                          ? "bg-blue-100/70 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 line-through opacity-75"
                          : "bg-white dark:bg-[#0F1726] text-slate-700 dark:text-[#CBD5E1] border border-blue-200/50"
                      }`}
                    >
                      {isSpeaking ? <Mic size={10} /> : m.hasSpokenInCurrentRound ? <CheckCircle2 size={10} /> : <UserIcon size={10} />}
                      <span className="truncate max-w-[110px]">{m.speakerName}</span>
                      {is2v2OrComp && <span className="opacity-70 text-[9px]">({m.roleTag || `PRO ${idx + 1}`})</span>}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* CON TEAM / CON DEBATER */}
        <div className="p-2 sm:p-2.5 rounded-xl bg-rose-50/60 dark:bg-[rgba(244,63,94,0.08)] border border-rose-200/60 dark:border-[rgba(244,63,94,0.22)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Flame size={14} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-rose-700 dark:text-rose-400 truncate">
                {conTeam.teamName || "Đội Phản đối (Team CON)"}
              </p>
              {/* Member list */}
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {conTeam.members.map((m, idx) => {
                  const isSpeaking = activeSpeakerName === m.speakerName || m.isSpeakingNow;
                  return (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                        isSpeaking
                          ? "bg-rose-600 text-white font-bold ring-2 ring-rose-300 dark:ring-rose-600 animate-pulse"
                          : m.hasSpokenInCurrentRound
                          ? "bg-rose-100/70 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 line-through opacity-75"
                          : "bg-white dark:bg-[#0F1726] text-slate-700 dark:text-[#CBD5E1] border border-rose-200/50"
                      }`}
                    >
                      {m.isAI ? (
                        <Bot size={10} />
                      ) : isSpeaking ? (
                        <Mic size={10} />
                      ) : m.hasSpokenInCurrentRound ? (
                        <CheckCircle2 size={10} />
                      ) : (
                        <UserIcon size={10} />
                      )}
                      <span className="truncate max-w-[110px]">{m.speakerName}</span>
                      {is2v2OrComp && <span className="opacity-70 text-[9px]">({m.roleTag || `CON ${idx + 1}`})</span>}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebateTeamPanel;

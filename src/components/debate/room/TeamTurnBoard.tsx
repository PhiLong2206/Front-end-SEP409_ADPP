import React, { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Clock, Mic, Users, X } from "lucide-react";
import { isSameUserId } from "../../../utils/debateSpeaker";

export interface TeamTurnParticipant {
  userId?: number | null;
  speakerName?: string | null;
  side: number | string;
}

export interface TeamTurnMessage {
  roundNumber: number;
  speakerUserId?: string | number;
  speakerName?: string;
  side: string;
}

export interface TeamTurnBoardProps {
  currentRound: number;
  currentTurnSide?: number | string | null;
  proParticipants: TeamTurnParticipant[];
  conParticipants: TeamTurnParticipant[];
  messages: TeamTurnMessage[];
  currentUserId?: string | number | null;
  remoteSpeakingUser?: { userId: number; fullName: string } | null;
  isCurrentUserRecording?: boolean;
}

const isSidePro = (side?: number | string | null) =>
  side === 1 || String(side).toUpperCase() === "PRO";

const formatNames = (
  members: TeamTurnParticipant[],
  currentUserId?: string | number | null
): string => {
  if (members.length === 0) return "Đang cập nhật...";
  return members
    .map((m, idx) => {
      const base = m.speakerName?.trim() || `Thí sinh ${idx + 1}`;
      return isSameUserId(m.userId, currentUserId) ? `${base} (Bạn)` : base;
    })
    .join(" / ");
};

const TeamTurnBoard: React.FC<TeamTurnBoardProps> = ({
  currentRound,
  currentTurnSide,
  proParticipants,
  conParticipants,
  messages,
  currentUserId,
  remoteSpeakingUser,
  isCurrentUserRecording = false,
}) => {
  const [showOrderModal, setShowOrderModal] = useState(false);

  const turnInfo = useMemo(() => {
    const roundMsgs = messages.filter((m) => m.roundNumber === currentRound);

    const hasSpoken = (p: TeamTurnParticipant) =>
      roundMsgs.some(
        (m) =>
          (p.userId != null && m.speakerUserId != null && isSameUserId(p.userId, m.speakerUserId)) ||
          (p.speakerName && m.speakerName && m.speakerName.trim() === p.speakerName.trim())
      );

    const proSpoken = proParticipants.filter(hasSpoken);
    const proRemaining = proParticipants.filter((p) => !hasSpoken(p));
    const conSpoken = conParticipants.filter(hasSpoken);
    const conRemaining = conParticipants.filter((p) => !hasSpoken(p));

    const currentIsPro = isSidePro(currentTurnSide);
    const currentPool = currentIsPro ? proRemaining : conRemaining;
    const nextSideIsPro = !currentIsPro;
    const nextPool = nextSideIsPro ? proRemaining : conRemaining;

    // Active presenter label (prioritize whoever is currently recording live)
    const activeRecorder =
      remoteSpeakingUser &&
      currentPool.find((p) => isSameUserId(p.userId, remoteSpeakingUser.userId));
    const selfInCurrent = currentPool.find((p) => isSameUserId(p.userId, currentUserId));

    const currentLabel = activeRecorder
      ? `${activeRecorder.speakerName || remoteSpeakingUser.fullName}`
      : isCurrentUserRecording && selfInCurrent
      ? `${selfInCurrent.speakerName || "Bạn"} (Bạn)`
      : formatNames(currentPool, currentUserId);

    const isMyTurnNow = Boolean(selfInCurrent);

    // Next presenter label
    const totalSpokenInRound = roundMsgs.length;
    const isLastTurnOfRound = totalSpokenInRound >= 3;
    const isLastTurnOfDebate = currentRound >= 3 && isLastTurnOfRound;

    let nextLabel: string;
    let nextSideTag: "PRO" | "CON" | "END";
    let isMeUpNext = false;

    if (isLastTurnOfDebate) {
      nextLabel = "Kết thúc & Chấm điểm";
      nextSideTag = "END";
    } else if (isLastTurnOfRound) {
      nextLabel = `Vòng ${currentRound + 1} · ${formatNames(proParticipants, currentUserId)}`;
      nextSideTag = "PRO";
      isMeUpNext = proParticipants.some((p) => isSameUserId(p.userId, currentUserId));
    } else {
      nextLabel = formatNames(nextPool, currentUserId);
      nextSideTag = nextSideIsPro ? "PRO" : "CON";
      isMeUpNext = nextPool.some((p) => isSameUserId(p.userId, currentUserId));
    }

    // Build 4-turn schedule for the current round modal
    const slots = [
      {
        order: 1,
        side: "PRO" as const,
        speaker: proSpoken[0]
          ? formatNames([proSpoken[0]], currentUserId)
          : formatNames(proRemaining, currentUserId),
        done: proSpoken.length >= 1,
      },
      {
        order: 2,
        side: "CON" as const,
        speaker: conSpoken[0]
          ? formatNames([conSpoken[0]], currentUserId)
          : formatNames(conRemaining, currentUserId),
        done: conSpoken.length >= 1,
      },
      {
        order: 3,
        side: "PRO" as const,
        speaker: proSpoken[1]
          ? formatNames([proSpoken[1]], currentUserId)
          : proRemaining.length === 1
          ? formatNames([proRemaining[0]], currentUserId)
          : formatNames(proRemaining, currentUserId),
        done: proSpoken.length >= 2,
      },
      {
        order: 4,
        side: "CON" as const,
        speaker: conSpoken[1]
          ? formatNames([conSpoken[1]], currentUserId)
          : conRemaining.length === 1
          ? formatNames([conRemaining[0]], currentUserId)
          : formatNames(conRemaining, currentUserId),
        done: conSpoken.length >= 2,
      },
    ];

    const activeSlotOrder = slots.find((s) => !s.done)?.order ?? 4;

    return {
      currentIsPro,
      currentLabel,
      isMyTurnNow,
      isLiveSpeaking: Boolean(activeRecorder || (isCurrentUserRecording && selfInCurrent)),
      nextLabel,
      nextSideTag,
      isMeUpNext,
      slots,
      activeSlotOrder,
      roundLabel:
        currentRound === 1 ? "Mở đầu" : currentRound === 2 ? "Phản biện" : "Kết luận",
    };
  }, [
    currentRound,
    currentTurnSide,
    proParticipants,
    conParticipants,
    messages,
    currentUserId,
    remoteSpeakingUser,
    isCurrentUserRecording,
  ]);

  return (
    <>
      <div
        data-testid="team-2v2-turn-board"
        className="mx-3 mt-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0F1726]/95 px-3.5 py-2.5 shadow-xs shrink-0"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {/* Current Presenter */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                turnInfo.currentIsPro
                  ? "bg-blue-50 text-[#0B5ED7] dark:bg-blue-950/60 dark:text-blue-400"
                  : "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
              }`}
            >
              <Mic size={15} className={turnInfo.isLiveSpeaking ? "animate-pulse" : ""} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Đang trình bày
                </span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    turnInfo.currentIsPro
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                  }`}
                >
                  {turnInfo.currentIsPro ? "PRO" : "CON"}
                </span>
                {turnInfo.isMyTurnNow && (
                  <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                    Lượt của bạn
                  </span>
                )}
              </div>
              <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                {turnInfo.currentLabel}
              </p>
            </div>
          </div>

          <ArrowRight size={14} className="hidden sm:block text-slate-300 dark:text-slate-600 shrink-0" />

          {/* Up Next */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1 sm:border-l sm:border-slate-100 sm:dark:border-slate-800 sm:pl-3">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
              <Clock size={15} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Chuẩn bị tiếp theo
                </span>
                {turnInfo.nextSideTag !== "END" && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      turnInfo.nextSideTag === "PRO"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                        : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                    }`}
                  >
                    {turnInfo.nextSideTag}
                  </span>
                )}
                {turnInfo.isMeUpNext && (
                  <span className="rounded-full bg-amber-100 dark:bg-amber-950 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                    Sắp tới lượt bạn
                  </span>
                )}
              </div>
              <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-300">
                {turnInfo.nextLabel}
              </p>
            </div>
          </div>

          {/* Open full turn order popup */}
          <button
            type="button"
            onClick={() => setShowOrderModal(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <Users size={13} />
            <span>Thứ tự lượt</span>
          </button>
        </div>
      </div>

      {/* Turn Order Popup Modal */}
      {showOrderModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => setShowOrderModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1726] p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Thứ tự trình bày 2 vs 2 — Vòng {currentRound} ({turnInfo.roundLabel})
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Luân phiên PRO → CON → PRO → CON (mỗi thí sinh phát biểu 1 lượt/vòng)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowOrderModal(false)}
                aria-label="Đóng"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2">
              {turnInfo.slots.map((slot) => {
                const isActive = !slot.done && slot.order === turnInfo.activeSlotOrder;
                const isUpNext = !slot.done && slot.order === turnInfo.activeSlotOrder + 1;
                return (
                  <div
                    key={slot.order}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-xs ${
                      isActive
                        ? "border-[#0B5ED7] bg-blue-50/70 dark:border-blue-500/60 dark:bg-blue-950/30"
                        : isUpNext
                        ? "border-amber-300 bg-amber-50/60 dark:border-amber-700/60 dark:bg-amber-950/20"
                        : slot.done
                        ? "border-slate-100 bg-slate-50/60 dark:border-slate-800/60 dark:bg-slate-900/30 opacity-75"
                        : "border-slate-200/80 dark:border-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200/80 dark:bg-slate-800 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {slot.done ? <CheckCircle2 size={14} className="text-emerald-600" /> : slot.order}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                              slot.side === "PRO"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                            }`}
                          >
                            {slot.side === "PRO" ? "Ủng hộ (PRO)" : "Phản đối (CON)"}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate font-semibold text-slate-800 dark:text-slate-200">
                          {slot.speaker}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        slot.done
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : isActive
                          ? "bg-[#0B5ED7] text-white"
                          : isUpNext
                          ? "bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {slot.done
                        ? "Đã xong"
                        : isActive
                        ? "Đang trình bày"
                        : isUpNext
                        ? "Chuẩn bị"
                        : "Chờ lượt"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TeamTurnBoard;

import React, { useEffect, useState } from "react";
import {
  X,
  Swords,
  Shield,
  Eye,
  Scale,
  Play,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  UserCheck,
  BookOpen,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import competitionApi from "../../api/competitionApi";
import topicApi from "../../api/topicApi";
import {
  TournamentMatch,
  CompetitionJudge,
  Topic,
  PrepareDebateRequest,
} from "../../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  competitionId: number;
  match: TournamentMatch | null;
  judges: CompetitionJudge[];
  isOrganizer: boolean;
  currentUserId?: number;
  onRefreshMatch: () => void;
  onOpenMonitor: (match: TournamentMatch) => void;
  onOpenEvaluation: (match: TournamentMatch) => void;
}

const MatchDetailModal: React.FC<Props> = ({
  isOpen,
  onClose,
  competitionId,
  match,
  judges,
  isOrganizer,
  currentUserId,
  onRefreshMatch,
  onOpenMonitor,
  onOpenEvaluation,
}) => {
  const navigate = useNavigate();

  // Assign Judge state
  const [selectedJudgeId, setSelectedJudgeId] = useState<number | "">("");
  const [assigningJudge, setAssigningJudge] = useState<boolean>(false);

  // Prepare Debate state
  const [availableTopics, setAvailableTopics] = useState<Topic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<number | "">("");
  const [preparingDebate, setPreparingDebate] = useState<boolean>(false);
  const [loadingTopics, setLoadingTopics] = useState<boolean>(false);

  // Status messages
  const [actionMsg, setActionMsg] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    if (!isOpen || !match) return;
    setActionMsg(null);
    setSelectedJudgeId(match.assignedJudgeUserId || "");

    // Load topics catalog for prepare debate if needed
    if (!match.debateSessionId) {
      setLoadingTopics(true);
      topicApi
        .getAll({ isActive: true, pageSize: 50 })
        .then((res) => {
          if (res?.success && res?.data?.items) {
            setAvailableTopics(res.data.items);
            if (res.data.items.length > 0) {
              const first = res.data.items[0];
              const topicId = first.topicId ?? (typeof first.id === "number" ? first.id : undefined);
              if (topicId !== undefined) {
                setSelectedTopicId(topicId);
              }
            }
          }
        })
        .catch(() => {})
        .finally(() => setLoadingTopics(false));
    }
  }, [isOpen, match]);

  if (!isOpen || !match) return null;

  const pro = match.proParticipant;
  const con = match.conParticipant;
  const isProUser = Boolean(currentUserId && pro?.userId === currentUserId);
  const isConUser = Boolean(currentUserId && con?.userId === currentUserId);
  const isDebaterInMatch = isProUser || isConUser;
  const isAssignedJudge = Boolean(currentUserId && match.assignedJudgeUserId === currentUserId);

  // Handle assign judge
  const handleAssignJudge = async () => {
    if (!selectedJudgeId) {
      setActionMsg({ text: "Vui lòng chọn một giám khảo từ danh sách.", isError: true });
      return;
    }
    setAssigningJudge(true);
    setActionMsg(null);
    try {
      const res = await competitionApi.assignMatchJudge(competitionId, match.matchId, {
        judgeUserId: Number(selectedJudgeId),
      });
      if (res && res.success) {
        setActionMsg({ text: "Phân công giám khảo thành công!", isError: false });
        onRefreshMatch();
      } else {
        setActionMsg({ text: res?.message || "Phân công giám khảo thất bại.", isError: true });
      }
    } catch (err: unknown) {
      const e = err as { message?: string; status?: number };
      if (e.status === 404 || String(e.message).includes("404")) {
        setActionMsg({
          text: "Chức năng phân công giám khảo đang chờ Backend triển khai endpoint `PUT .../judge`.",
          isError: true,
        });
      } else {
        setActionMsg({ text: e.message || "Lỗi khi phân công giám khảo.", isError: true });
      }
    } finally {
      setAssigningJudge(false);
    }
  };

  // Handle prepare debate session
  const handlePrepareDebate = async () => {
    if (!selectedTopicId) {
      setActionMsg({ text: "Vui lòng chọn một chủ đề từ ngân hàng đề.", isError: true });
      return;
    }
    setPreparingDebate(true);
    setActionMsg(null);
    const req: PrepareDebateRequest = { topicId: Number(selectedTopicId) };
    try {
      const res = await competitionApi.prepareDebate(match.matchId, req);
      if (res && res.success && (res.data?.sessionId || res.data?.debateSessionId)) {
        setActionMsg({ text: "Khởi tạo phiên tranh biện thành công!", isError: false });
        onRefreshMatch();
      } else {
        setActionMsg({ text: res?.message || "Khởi tạo phiên tranh biện thất bại.", isError: true });
      }
    } catch (err: unknown) {
      const e = err as { message?: string; status?: number };
      if (e.status === 404 || String(e.message).includes("404")) {
        setActionMsg({
          text: "Chức năng khởi tạo phiên tranh biện đang chờ Backend triển khai endpoint `POST /api/Competitions/matches/{id}/prepare-debate`.",
          isError: true,
        });
      } else {
        setActionMsg({ text: e.message || "Lỗi khi khởi tạo phiên tranh biện.", isError: true });
      }
    } finally {
      setPreparingDebate(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-[#12231C] w-full max-w-2xl max-h-[92vh] rounded-3xl border border-slate-200 dark:border-[rgba(148,163,184,0.18)] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-[rgba(148,163,184,0.12)] bg-slate-50 dark:bg-[#0B1713] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#008A64]/10 text-[#008A64] flex items-center justify-center">
              <Swords size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-[#008A64] text-white">
                  TRẬN #{match.matchNumber || match.matchId}
                </span>
                <span className="text-xs font-bold text-slate-500">
                  {match.roundName || `Vòng ${match.roundNumber || 1}`}
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {match.status}
                </span>
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight mt-0.5">
                Chi tiết trận đấu & Điều phối
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Message Banner */}
        {actionMsg && (
          <div
            className={`m-4 mb-0 p-3 rounded-xl text-xs flex items-center gap-2 ${
              actionMsg.isError
                ? "bg-rose-50 border border-rose-200 text-rose-700"
                : "bg-emerald-50 border border-emerald-200 text-emerald-700"
            }`}
          >
            {actionMsg.isError ? <AlertCircle size={14} className="shrink-0" /> : <CheckCircle2 size={14} className="shrink-0" />}
            <span>{actionMsg.text}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs">
          {/* Pair Versus Card */}
          <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 dark:bg-[#0B1713] rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="p-3 bg-white dark:bg-[#12231C] rounded-xl border border-emerald-200 dark:border-emerald-800/40">
              <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                Phe PRO (Ủng hộ)
              </span>
              <p className="text-sm font-black text-slate-900 dark:text-slate-100 truncate mt-1">
                {pro?.userName || pro?.teamName || "Chưa xác định (Chờ vòng trước)"}
              </p>
              {pro?.isWinner && (
                <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Thắng trận
                </span>
              )}
            </div>

            <div className="p-3 bg-white dark:bg-[#12231C] rounded-xl border border-rose-200 dark:border-rose-800/40 text-right">
              <span className="text-[10px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-wider block">
                Phe CON (Phản đối)
              </span>
              <p className="text-sm font-black text-slate-900 dark:text-slate-100 truncate mt-1">
                {con?.userName || con?.teamName || "Chưa xác định (Chờ vòng trước)"}
              </p>
              {con?.isWinner && (
                <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-black text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full">
                  Thắng trận
                </span>
              )}
            </div>
          </div>

          {/* Section 1: Assigned Judge */}
          <div className="p-4 bg-white dark:bg-[#12231C] rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Shield size={14} className="text-purple-600" />
                Giám khảo phụ trách trận đấu:
              </span>
              <span className="font-mono font-bold text-slate-600 dark:text-slate-300">
                {match.assignedJudgeName ? match.assignedJudgeName : "Chưa phân công"}
              </span>
            </div>

            {isOrganizer && !match.debateSessionId && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <select
                  value={selectedJudgeId}
                  onChange={(e) => setSelectedJudgeId(e.target.value ? Number(e.target.value) : "")}
                  className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1713] text-xs font-semibold focus:ring-2 focus:ring-[#008A64] focus:outline-hidden"
                >
                  <option value="">-- Chọn Giám khảo từ Ban giám khảo giải --</option>
                  {judges.map((j) => (
                    <option key={j.userId} value={j.userId}>
                      {j.fullName} ({j.email})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleAssignJudge}
                  disabled={assigningJudge || !selectedJudgeId}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer shrink-0"
                >
                  {assigningJudge ? <RefreshCw size={12} className="animate-spin" /> : <UserCheck size={12} />}
                  <span>Lưu Giám khảo</span>
                </button>
              </div>
            )}
          </div>

          {/* Section 2: Debate Session & Topic */}
          <div className="p-4 bg-white dark:bg-[#12231C] rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <BookOpen size={14} className="text-[#008A64]" />
                Phiên tranh biện (DebateSession):
              </span>
              <span className="font-mono font-bold text-[#008A64]">
                {match.debateSessionId ? `#${match.debateSessionId}` : "Chưa khởi tạo"}
              </span>
            </div>

            {!match.debateSessionId && (isOrganizer || isAssignedJudge) && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <p className="text-[11px] text-slate-400">
                  Chọn chủ đề tranh biện từ ngân hàng đề thi để kích hoạt phòng đấu:
                </p>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedTopicId}
                    onChange={(e) => setSelectedTopicId(e.target.value ? Number(e.target.value) : "")}
                    disabled={loadingTopics}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1713] text-xs font-semibold focus:ring-2 focus:ring-[#008A64] focus:outline-hidden"
                  >
                    {loadingTopics ? (
                      <option>Đang tải danh mục chủ đề...</option>
                    ) : availableTopics.length === 0 ? (
                      <option>Không có chủ đề khả dụng</option>
                    ) : (
                      availableTopics.map((t) => {
                        const val = t.topicId ?? t.id;
                        return (
                          <option key={val} value={val}>
                            [{t.category || "General"}] {t.title}
                          </option>
                        );
                      })
                    )}
                  </select>

                  <button
                    type="button"
                    onClick={handlePrepareDebate}
                    disabled={preparingDebate || !selectedTopicId}
                    className="px-3 py-1.5 bg-[#008A64] hover:bg-[#007454] disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {preparingDebate ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                    <span>Chuẩn bị phòng</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#0B1713] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            {/* Monitor Button (Organizer / Spectators) */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenMonitor(match);
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Eye size={14} className="text-slate-500" />
              <span>Giám sát trận đấu</span>
            </button>

            {/* Evaluate Button (Judge) */}
            {(isAssignedJudge || isOrganizer) && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenEvaluation(match);
                }}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Scale size={14} />
                <span>Chấm điểm trận</span>
              </button>
            )}
          </div>

          {/* Enter Debate Button (Debater) */}
          {match.debateSessionId ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                // Real numeric debateSessionId!
                navigate(`/debater/debate/${match.debateSessionId}`);
              }}
              className="px-4 py-2 bg-[#008A64] hover:bg-[#007454] text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Swords size={14} />
              <span>{isDebaterInMatch ? "Vào phòng thi đấu ngay" : "Xem phòng tranh biện"}</span>
            </button>
          ) : (
            <span className="text-[11px] text-slate-400 italic">
              Trận đấu chưa có phòng thi trực tiếp.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchDetailModal;


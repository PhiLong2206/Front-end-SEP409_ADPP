import React, { useEffect, useState, useCallback } from "react";
import {
  GitBranch,
  RefreshCw,
  Eye,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import competitionApi from "../../api/competitionApi";
import {
  CompetitionDetail,
  TournamentBracketResponse,
  TournamentRound,
  TournamentMatch,
  CompetitionJudge,
} from "../../types";
import MatchDetailModal from "./MatchDetailModal";
import MatchMonitorModal from "./MatchMonitorModal";
import JudgeEvaluationModal from "./JudgeEvaluationModal";
import CompetitionChampionBanner from "./CompetitionChampionBanner";

interface Props {
  competition: CompetitionDetail;
  isOrganizer: boolean;
  currentUserId?: number;
  judges: CompetitionJudge[];
  onCompetitionUpdated?: () => void;
}

const CompetitionBracketView: React.FC<Props> = ({
  competition,
  isOrganizer,
  currentUserId,
  judges,
  onCompetitionUpdated,
}) => {
  const [bracketData, setBracketData] = useState<TournamentBracketResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [apiNotice, setApiNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Selected match for modals
  const [selectedMatch, setSelectedMatch] = useState<TournamentMatch | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [isMonitorOpen, setIsMonitorOpen] = useState<boolean>(false);
  const [isEvaluationOpen, setIsEvaluationOpen] = useState<boolean>(false);

  const competitionId = competition.competitionId;

  const loadBracket = useCallback(async () => {
    setLoading(true);
    setApiNotice(null);
    try {
      const res = await competitionApi.getBracket(competitionId);
      if (res && res.success && res.data) {
        const rawBracket = res.data;
        // Enrich matches from MatchReviewResponse when proParticipant/conParticipant are not embedded in BracketResponse
        const enrichedRounds: TournamentRound[] = await Promise.all(
          (rawBracket.rounds || []).map(async (round) => {
            const enrichedMatches = await Promise.all(
              (round.matches || []).map(async (m) => {
                if (m.proParticipant && m.conParticipant && m.debateSessionId !== undefined) {
                  return m;
                }
                try {
                  const revRes = await competitionApi.getMatchReview(competitionId, m.matchId);
                  if (revRes?.success && revRes.data) {
                    const rev = revRes.data;
                    const revPro = rev.participants?.find(
                      (p) => String(p.side).toUpperCase() === "PRO" || String(p.side) === "1"
                    );
                    const revCon = rev.participants?.find(
                      (p) => String(p.side).toUpperCase() === "CON" || String(p.side) === "2"
                    );
                    const judgeObj = judges.find((j) => j.userId === rev.assignedJudgeUserId);
                    return {
                      ...m,
                      matchNumber: m.matchNumber ?? m.bracketPosition ?? m.matchId,
                      debateSessionId: rev.debateSessionId ?? m.debateSessionId ?? null,
                      assignedJudgeUserId: rev.assignedJudgeUserId ?? m.assignedJudgeUserId ?? null,
                      assignedJudgeName: judgeObj?.fullName ?? m.assignedJudgeName ?? null,
                      proParticipant:
                        m.proParticipant ??
                        (revPro
                          ? {
                            matchParticipantId: revPro.matchParticipantId,
                            matchId: m.matchId,
                            userId: revPro.userId ?? m.proUserId,
                            userName: revPro.displayName || revPro.userName,
                            teamId: revPro.teamId ?? m.proTeamId,
                            teamName: revPro.displayName || revPro.teamName,
                            side: "PRO",
                            isWinner:
                              Boolean(m.winnerUserId && m.winnerUserId === (revPro.userId ?? m.proUserId)) ||
                              Boolean(m.winnerTeamId && m.winnerTeamId === (revPro.teamId ?? m.proTeamId)),
                          }
                          : m.proUserId || m.proTeamId
                            ? {
                              matchParticipantId: 0,
                              matchId: m.matchId,
                              userId: m.proUserId,
                              userName: m.proUserId ? `Thí sinh #${m.proUserId}` : null,
                              teamId: m.proTeamId,
                              teamName: m.proTeamId ? `Đội #${m.proTeamId}` : null,
                              side: "PRO",
                              isWinner:
                                Boolean(m.winnerUserId && m.winnerUserId === m.proUserId) ||
                                Boolean(m.winnerTeamId && m.winnerTeamId === m.proTeamId),
                            }
                            : null),
                      conParticipant:
                        m.conParticipant ??
                        (revCon
                          ? {
                            matchParticipantId: revCon.matchParticipantId,
                            matchId: m.matchId,
                            userId: revCon.userId ?? m.conUserId,
                            userName: revCon.displayName || revCon.userName,
                            teamId: revCon.teamId ?? m.conTeamId,
                            teamName: revCon.displayName || revCon.teamName,
                            side: "CON",
                            isWinner:
                              Boolean(m.winnerUserId && m.winnerUserId === (revCon.userId ?? m.conUserId)) ||
                              Boolean(m.winnerTeamId && m.winnerTeamId === (revCon.teamId ?? m.conTeamId)),
                          }
                          : m.conUserId || m.conTeamId
                            ? {
                              matchParticipantId: 0,
                              matchId: m.matchId,
                              userId: m.conUserId,
                              userName: m.conUserId ? `Thí sinh #${m.conUserId}` : null,
                              teamId: m.conTeamId,
                              teamName: m.conTeamId ? `Đội #${m.conTeamId}` : null,
                              side: "CON",
                              isWinner:
                                Boolean(m.winnerUserId && m.winnerUserId === m.conUserId) ||
                                Boolean(m.winnerTeamId && m.winnerTeamId === m.conTeamId),
                            }
                            : null),
                    };
                  }
                } catch {
                  // Ignore review lookup errors and fall back to IDs on match
                }
                return m;
              })
            );
            return {
              ...round,
              matches: enrichedMatches,
            };
          })
        );
        setBracketData({
          ...rawBracket,
          rounds: enrichedRounds,
        });
      } else {
        setBracketData(null);
      }
    } catch (err: unknown) {
      const e = err as { message?: string; status?: number };
      if (e.status === 404 || String(e.message).includes("404")) {
        setApiNotice(
          "Cây thi đấu chưa được khởi tạo hoặc API lấy nhánh đấu (`GET /api/competitions/{id}/bracket`) đang chờ Backend triển khai."
        );
      } else {
        setErrorMsg(e.message || "Không thể tải sơ đồ thi đấu.");
      }
      setBracketData(null);
    } finally {
      setLoading(false);
    }
  }, [competitionId, judges]);

  useEffect(() => {
    loadBracket();
  }, [loadBracket]);

  // Handle Generate Bracket
  const handleGenerateBracket = async () => {
    setGenerating(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setApiNotice(null);

    try {
      const res = await competitionApi.generateBracket(competitionId);
      if (res && res.success) {
        setSuccessMsg("Đã sinh cây nhánh đấu thành công!");
        await loadBracket();
        if (onCompetitionUpdated) onCompetitionUpdated();
      } else {
        setErrorMsg(res?.message || "Sinh nhánh đấu thất bại.");
      }
    } catch (err: unknown) {
      const e = err as { message?: string; status?: number };
      if (e.status === 404 || String(e.message).includes("404")) {
        setApiNotice(
          "Chức năng sinh nhánh đấu tự động đang chờ Backend cập nhật API (`POST /api/competitions/{id}/bracket`). Vui lòng liên hệ quản trị viên Backend để kích hoạt."
        );
      } else {
        setErrorMsg(e.message || "Lỗi khi sinh nhánh đấu.");
      }
    } finally {
      setGenerating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Ready":
        return <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 font-bold text-[10px]">Sẵn sàng</span>;
      case "Ongoing":
        return <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-[#008A64] dark:text-emerald-300 font-bold text-[10px] animate-pulse">Đang thi đấu</span>;
      case "Evaluating":
        return <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 font-bold text-[10px]">Đang chấm điểm</span>;
      case "Completed":
        return <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 font-bold text-[10px]">Hoàn thành</span>;
      case "Bye":
        return <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold text-[10px]">Đặc cách (BYE)</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-[10px]">{status || "Chờ lịch"}</span>;
    }
  };

  const canGenerate = isOrganizer && (competition.status === "RegistrationClosed" || competition.status === "Draft" || competition.status === "Ongoing");

  return (
    <div className="space-y-6 animate-fade-in text-xs">
      {/* Champion Banner (If completed and champion is determined) */}
      {competition.status === "Completed" && (
        <CompetitionChampionBanner
          championName={bracketData?.championName}
          championUserId={bracketData?.championUserId}
          championTeamId={bracketData?.championTeamId}
          competitionTitle={competition.title}
          competitionType={competition.competitionType}
        />
      )}

      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-[#0B1713] rounded-2xl border border-slate-200/80 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <GitBranch size={16} className="text-[#008A64]" />
            <span>Sơ đồ thi đấu đối kháng (Single Elimination)</span>
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {competition.competitionType === "TEAM" ? "Giải đấu đồng đội 2v2" : "Giải đấu cá nhân đối kháng 1v1"}
            {" · "}Trạng thái: <strong>{competition.status}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadBracket}
            disabled={loading}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#12231C] text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-[#008A64]" : ""} />
            <span>Làm mới</span>
          </button>

          {canGenerate && (
            <button
              type="button"
              onClick={handleGenerateBracket}
              disabled={generating}
              className="px-4 py-2 rounded-xl bg-[#008A64] hover:bg-[#007454] disabled:opacity-50 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              {generating ? <RefreshCw size={13} className="animate-spin" /> : <GitBranch size={13} />}
              <span>Sinh cây nhánh đấu</span>
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {apiNotice && (
        <div className="p-4 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-2xl text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
          <AlertCircle size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Thông báo hệ thống</p>
            <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">{apiNotice}</p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-2">
          <CheckCircle2 size={14} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Bracket Content */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 bg-white dark:bg-[#12231C] rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-3">
          <RefreshCw size={28} className="animate-spin text-[#008A64] mx-auto" />
          <p className="font-bold">Đang tải sơ đồ các vòng đấu...</p>
        </div>
      ) : !bracketData || !bracketData.rounds || bracketData.rounds.length === 0 ? (
        <div className="p-16 text-center text-slate-400 bg-white dark:bg-[#12231C] rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-3">
          <GitBranch size={40} className="mx-auto text-slate-300 dark:text-slate-700" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Chưa có sơ đồ nhánh đấu cho giải này
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {isOrganizer
              ? "Sau khi kết thúc đăng ký và duyệt danh sách thí sinh/đội, ban tổ chức có thể bấm 'Sinh cây nhánh đấu' ở trên để tự động xếp cặp hạt giống."
              : "Sơ đồ thi đấu sẽ hiển thị tại đây khi ban tổ chức hoàn tất bốc thăm chia bảng."}
          </p>
        </div>
      ) : (
        /* Horizontal Tree Bracket Rendering */
        <div className="overflow-x-auto pb-4">
          <div className="flex items-start gap-8 min-w-max p-2">
            {bracketData.rounds.map((round: TournamentRound, roundIdx: number) => (
              <div key={round.roundId || roundIdx} className="w-72 flex flex-col space-y-4">
                {/* Round Header */}
                <div className="p-3 rounded-2xl bg-slate-100 dark:bg-[#0B1713] border border-slate-200 dark:border-slate-800 text-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Giai đoạn {roundIdx + 1}
                  </span>
                  <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 mt-0.5">
                    {round.roundName || `Vòng ${round.roundNumber}`}
                  </h4>
                </div>

                {/* Match Cards */}
                <div className="space-y-4">
                  {round.matches.map((match: TournamentMatch) => {
                    const pro = match.proParticipant;
                    const con = match.conParticipant;

                    return (
                      <div
                        key={match.matchId}
                        className="bg-white dark:bg-[#12231C] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-[#008A64] hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                      >
                        {/* Top bar of match */}
                        <div className="px-3.5 py-2 bg-slate-50/80 dark:bg-[#0B1713]/80 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                          <span className="font-mono font-bold text-slate-500">
                            #{match.matchNumber || match.matchId}
                          </span>
                          {getStatusBadge(match.status)}
                        </div>

                        {/* Participants Versus */}
                        <div className="p-3 space-y-2">
                          {/* PRO Side */}
                          <div
                            className={`p-2 rounded-xl border flex items-center justify-between ${pro?.isWinner
                                ? "bg-emerald-50/70 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800"
                                : "bg-slate-50/60 border-slate-100 dark:bg-[#0B1713]/40 dark:border-slate-800"
                              }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 pr-2">
                              <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-sm shrink-0">
                                PRO
                              </span>
                              <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                                {pro?.userName || pro?.teamName || "TBD"}
                              </span>
                            </div>
                            {pro?.isWinner && (
                              <span className="text-[10px] font-black text-[#008A64] shrink-0">
                                THẮNG
                              </span>
                            )}
                          </div>

                          {/* CON Side */}
                          <div
                            className={`p-2 rounded-xl border flex items-center justify-between ${con?.isWinner
                                ? "bg-emerald-50/70 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800"
                                : "bg-slate-50/60 border-slate-100 dark:bg-[#0B1713]/40 dark:border-slate-800"
                              }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 pr-2">
                              <span className="text-[10px] font-black text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded-sm shrink-0">
                                CON
                              </span>
                              <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                                {con?.userName || con?.teamName || "TBD"}
                              </span>
                            </div>
                            {con?.isWinner && (
                              <span className="text-[10px] font-black text-[#008A64] shrink-0">
                                THẮNG
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Match Footer & Actions */}
                        <div className="px-3 py-2 bg-slate-50/50 dark:bg-[#0B1713]/50 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                            {match.assignedJudgeName ? `Judge: ${match.assignedJudgeName}` : "Chưa có Judge"}
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMatch(match);
                              setIsDetailOpen(true);
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-[#008A64] hover:text-white dark:bg-slate-800 text-[#008A64] dark:text-emerald-300 font-bold text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                          >
                            <Eye size={12} />
                            <span>Chi tiết</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {selectedMatch && (
        <>
          <MatchDetailModal
            isOpen={isDetailOpen}
            onClose={() => setIsDetailOpen(false)}
            competitionId={competitionId}
            match={selectedMatch}
            judges={judges}
            isOrganizer={isOrganizer}
            currentUserId={currentUserId}
            onRefreshMatch={loadBracket}
            onOpenMonitor={(m) => {
              setSelectedMatch(m);
              setIsMonitorOpen(true);
            }}
            onOpenEvaluation={(m) => {
              setSelectedMatch(m);
              setIsEvaluationOpen(true);
            }}
          />

          <MatchMonitorModal
            isOpen={isMonitorOpen}
            onClose={() => setIsMonitorOpen(false)}
            match={selectedMatch}
            competitionTitle={competition.title}
          />

          <JudgeEvaluationModal
            isOpen={isEvaluationOpen}
            onClose={() => setIsEvaluationOpen(false)}
            competitionId={competitionId}
            match={selectedMatch}
            onSuccess={loadBracket}
          />
        </>
      )}
    </div>
  );
};

export default CompetitionBracketView;


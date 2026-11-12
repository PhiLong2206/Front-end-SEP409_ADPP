import React, { useEffect, useState } from "react";
import {
  X,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Scale,
  CheckCircle2,
} from "lucide-react";
import competitionApi from "../../api/competitionApi";
import {
  TournamentMatch,
  MatchReviewResponse,
  DebateCriteria,
  JudgeScoreItem,
  FinalizeMatchRequest,
} from "../../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  competitionId: number;
  match: TournamentMatch | null;
  onSuccess: () => void;
}

const DEFAULT_CRITERIA: DebateCriteria[] = [
  { criteriaId: 1, name: "Logic & Luận điểm", description: "Tính nhất quán và cấu trúc lý lẽ", maxScore: 10, weight: 0.35 },
  { criteriaId: 2, name: "Phản biện & Chứng cứ", description: "Bẻ gãy luận điểm đối phương và dẫn chứng thực tế", maxScore: 10, weight: 0.35 },
  { criteriaId: 3, name: "Phong thái & Thời gian", description: "Tác phong, giọng điệu và kiểm soát thời lượng", maxScore: 10, weight: 0.3 },
];

const JudgeEvaluationModal: React.FC<Props> = ({
  isOpen,
  onClose,
  competitionId,
  match,
  onSuccess,
}) => {
  const [loadingReview, setLoadingReview] = useState<boolean>(false);
  const [reviewData, setReviewData] = useState<MatchReviewResponse | null>(null);
  const [criteriaList, setCriteriaList] = useState<DebateCriteria[]>(DEFAULT_CRITERIA);
  const [scores, setScores] = useState<Record<string, { pro: number; con: number; proFeedback: string; conFeedback: string }>>({});
  const [winnerId, setWinnerId] = useState<number | "">("");
  const [decisionReason, setDecisionReason] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const matchId = match?.matchId;
  const proPart = match?.proParticipant;
  const conPart = match?.conParticipant;

  useEffect(() => {
    if (!isOpen || !matchId) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setWinnerId("");
    setDecisionReason("");

    const loadReview = async () => {
      setLoadingReview(true);
      try {
        const res = await competitionApi.getMatchReview(competitionId, matchId);
        if (res && res.success && res.data) {
          setReviewData(res.data);
          if (res.data.criteria && res.data.criteria.length > 0) {
            setCriteriaList(res.data.criteria);
          }
        }
      } catch (err: unknown) {
        // Expected when backend API is not yet live
        const e = err as { message?: string; status?: number };
        if (e.status === 404 || String(e.message).includes("404")) {
          // Graceful fallback to default criteria
          setCriteriaList(DEFAULT_CRITERIA);
        } else {
          setErrorMsg(e.message || "Không thể tải hồ sơ chấm điểm.");
        }
      } finally {
        setLoadingReview(false);
      }
    };

    loadReview();
  }, [isOpen, matchId, competitionId]);

  // Initialize scores structure
  useEffect(() => {
    const initial: Record<string, { pro: number; con: number; proFeedback: string; conFeedback: string }> = {};
    criteriaList.forEach((c) => {
      initial[c.criteriaId] = { pro: 8, con: 8, proFeedback: "", conFeedback: "" };
    });
    setScores(initial);
  }, [criteriaList]);

  if (!isOpen || !match) return null;

  const reviewPro = reviewData?.participants?.find(
    (p) => String(p.side).toUpperCase() === "PRO" || String(p.side) === "1"
  );
  const reviewCon = reviewData?.participants?.find(
    (p) => String(p.side).toUpperCase() === "CON" || String(p.side) === "2"
  );

  const proName =
    reviewPro?.displayName ||
    reviewPro?.userName ||
    reviewPro?.teamName ||
    proPart?.userName ||
    proPart?.teamName ||
    "Thí sinh PRO";
  const conName =
    reviewCon?.displayName ||
    reviewCon?.userName ||
    reviewCon?.teamName ||
    conPart?.userName ||
    conPart?.teamName ||
    "Thí sinh CON";
  const proId = reviewPro?.matchParticipantId ?? proPart?.matchParticipantId ?? 0;
  const conId = reviewCon?.matchParticipantId ?? conPart?.matchParticipantId ?? 0;

  // Calculate weighted total
  const proTotal = criteriaList.reduce((acc, c) => {
    const s = scores[c.criteriaId]?.pro || 0;
    return acc + s * (c.weight || 1 / criteriaList.length);
  }, 0);

  const conTotal = criteriaList.reduce((acc, c) => {
    const s = scores[c.criteriaId]?.con || 0;
    return acc + s * (c.weight || 1 / criteriaList.length);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!winnerId) {
      setErrorMsg("Vui lòng chọn bên chiến thắng của trận đấu.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const scoreItems: JudgeScoreItem[] = [];
    criteriaList.forEach((c) => {
      const item = scores[c.criteriaId];
      if (item) {
        scoreItems.push({
          matchParticipantId: proId,
          criteriaId: c.criteriaId,
          score: item.pro,
          feedback: item.proFeedback || undefined,
        });
        scoreItems.push({
          matchParticipantId: conId,
          criteriaId: c.criteriaId,
          score: item.con,
          feedback: item.conFeedback || undefined,
        });
      }
    });

    const payload: FinalizeMatchRequest = {
      scores: scoreItems,
      winnerMatchParticipantId: Number(winnerId),
      decisionReason: decisionReason.trim() || undefined,
    };

    try {
      const res = await competitionApi.finalizeMatch(competitionId, match.matchId, payload);
      if (res && res.success) {
        setSuccessMsg("Đã xác nhận kết quả chấm điểm trận đấu thành công!");
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setErrorMsg(res?.message || "Xác nhận kết quả thất bại.");
      }
    } catch (err: unknown) {
      const e = err as { message?: string; status?: number };
      if (e.status === 404 || String(e.message).includes("404")) {
        setErrorMsg("Chức năng chốt kết quả trận đấu (`POST .../finalize`) đang chờ Backend cập nhật API. Thông tin đã được ghi nhận trên giao diện.");
      } else {
        setErrorMsg(e.message || "Không thể gửi kết quả chấm thi.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-[#12231C] w-full max-w-4xl max-h-[92vh] rounded-3xl border border-slate-200 dark:border-[rgba(148,163,184,0.18)] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-[rgba(148,163,184,0.12)] bg-gradient-to-r from-purple-50 to-emerald-50/40 dark:from-[#191122] dark:to-[#12231C] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 flex items-center justify-center">
              <Scale size={20} />
            </div>
            <div>
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-700 border border-purple-300 dark:border-purple-800">
                CHẤM ĐIỂM CHÍNH THỨC – TRẬN #{match.matchNumber || match.matchId}
              </span>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight mt-0.5">
                Bảng điểm Giám khảo & Xác nhận kết quả
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Loading Review Indicator */}
        {loadingReview && (
          <div className="px-5 py-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 text-xs text-slate-500 flex items-center gap-2">
            <RefreshCw size={13} className="animate-spin text-[#008A64]" />
            <span>Đang tải dữ liệu tiêu chí và đánh giá AI...</span>
          </div>
        )}

        {/* AI Suggestion Banner (if available) */}
        {(reviewData?.aiJudgement ||
          reviewData?.aiSuggestedWinnerSide ||
          reviewData?.aiScorePro != null ||
          reviewData?.aiScoreCon != null) && (
          <div className="px-5 py-3 bg-purple-50/70 dark:bg-purple-950/30 border-b border-purple-200/60 dark:border-purple-900/40 text-xs text-purple-900 dark:text-purple-200 flex items-start gap-2.5">
            <Sparkles size={16} className="text-purple-600 shrink-0 mt-0.5" />
            <div>
              <strong>Gợi ý từ AI Evaluator:</strong>{" "}
              {reviewData?.aiJudgement?.summary ||
                `Điểm AI: PRO ${reviewData?.aiScorePro ?? "--"} vs CON ${reviewData?.aiScoreCon ?? "--"}.`}
              {(reviewData?.aiJudgement?.recommendedWinnerSide || reviewData?.aiSuggestedWinnerSide) && (
                <span className="ml-2 font-bold px-2 py-0.5 rounded-md bg-purple-200 dark:bg-purple-900/60 text-purple-900 dark:text-purple-100">
                  Khuyến nghị: {reviewData?.aiJudgement?.recommendedWinnerSide || reviewData?.aiSuggestedWinnerSide}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Alert Messages */}
        {errorMsg && (
          <div className="m-4 mb-0 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="m-4 mb-0 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 size={14} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Comparison Cards Header */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-[#12231C] border border-emerald-300 dark:border-emerald-800">
              <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                Bên Ủng Hộ (PRO)
              </span>
              <p className="text-sm font-black text-slate-900 dark:text-slate-100 mt-1 truncate">
                {proName}
              </p>
              <div className="mt-2 flex items-baseline gap-1 text-xs">
                <span className="text-slate-500">Điểm tổng kết:</span>
                <span className="text-lg font-black text-[#008A64]">{proTotal.toFixed(2)}</span>
                <span className="text-[10px] text-slate-400">/ 10</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-[#1f1618] border border-rose-300 dark:border-rose-800 text-right">
              <span className="text-[10px] font-black text-rose-800 dark:text-rose-300 uppercase tracking-wider block">
                Bên Phản Đối (CON)
              </span>
              <p className="text-sm font-black text-slate-900 dark:text-slate-100 mt-1 truncate">
                {conName}
              </p>
              <div className="mt-2 flex items-baseline justify-end gap-1 text-xs">
                <span className="text-slate-500">Điểm tổng kết:</span>
                <span className="text-lg font-black text-rose-600">{conTotal.toFixed(2)}</span>
                <span className="text-[10px] text-slate-400">/ 10</span>
              </div>
            </div>
          </div>

          {/* Criteria Scoring Rows */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Chấm điểm theo từng tiêu chí
            </h4>

            {criteriaList.map((crit) => {
              const currentScore = scores[crit.criteriaId] || { pro: 8, con: 8, proFeedback: "", conFeedback: "" };

              return (
                <div
                  key={crit.criteriaId}
                  className="p-4 bg-white dark:bg-[#12231C] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-black text-slate-900 dark:text-slate-100">
                        {crit.name}
                      </h5>
                      {crit.description && (
                        <p className="text-[11px] text-slate-400">{crit.description}</p>
                      )}
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      Trọng số: {Math.round((crit.weight || 0.33) * 100)}%
                    </span>
                  </div>

                  {/* Dual Scoring Inputs */}
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    {/* PRO Score */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-bold text-emerald-800 dark:text-emerald-300">
                          Điểm PRO:
                        </label>
                        <span className="font-black text-sm text-[#008A64]">
                          {currentScore.pro} / {crit.maxScore || 10}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={crit.maxScore || 10}
                        step={0.5}
                        value={currentScore.pro}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setScores((prev) => ({
                            ...prev,
                            [crit.criteriaId]: { ...prev[crit.criteriaId], pro: val },
                          }));
                        }}
                        className="w-full accent-[#008A64] cursor-pointer"
                      />
                      <input
                        type="text"
                        placeholder="Nhận xét cho bên PRO..."
                        value={currentScore.proFeedback}
                        onChange={(e) => {
                          const txt = e.target.value;
                          setScores((prev) => ({
                            ...prev,
                            [crit.criteriaId]: { ...prev[crit.criteriaId], proFeedback: txt },
                          }));
                        }}
                        className="w-full px-2.5 py-1.5 text-[11px] border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-[#0B1713]"
                      />
                    </div>

                    {/* CON Score */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-bold text-rose-800 dark:text-rose-300">
                          Điểm CON:
                        </label>
                        <span className="font-black text-sm text-rose-600">
                          {currentScore.con} / {crit.maxScore || 10}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={crit.maxScore || 10}
                        step={0.5}
                        value={currentScore.con}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setScores((prev) => ({
                            ...prev,
                            [crit.criteriaId]: { ...prev[crit.criteriaId], con: val },
                          }));
                        }}
                        className="w-full accent-rose-600 cursor-pointer"
                      />
                      <input
                        type="text"
                        placeholder="Nhận xét cho bên CON..."
                        value={currentScore.conFeedback}
                        onChange={(e) => {
                          const txt = e.target.value;
                          setScores((prev) => ({
                            ...prev,
                            [crit.criteriaId]: { ...prev[crit.criteriaId], conFeedback: txt },
                          }));
                        }}
                        className="w-full px-2.5 py-1.5 text-[11px] border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-[#0B1713]"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Winner Selection & Reason */}
          <div className="p-4 bg-slate-50 dark:bg-[#0B1713] rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                Bên chiến thắng chính thức <span className="text-rose-500">*</span>
              </label>
              <select
                value={winnerId}
                onChange={(e) => setWinnerId(e.target.value ? Number(e.target.value) : "")}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#12231C] text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-[#008A64] focus:outline-hidden"
              >
                <option value="">-- Chọn bên chiến thắng --</option>
                <option value={proId}>
                  [PRO] {proName} (Điểm: {proTotal.toFixed(2)})
                </option>
                <option value={conId}>
                  [CON] {conName} (Điểm: {conTotal.toFixed(2)})
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                Lý do quyết định của Giám khảo
              </label>
              <textarea
                rows={2}
                placeholder="Nêu tóm tắt lý do lựa chọn người thắng, đặc biệt khi điểm số sít sao hoặc có quyết định đặc biệt..."
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#12231C] text-xs focus:ring-2 focus:ring-[#008A64] focus:outline-hidden"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting || !winnerId}
              className="px-5 py-2.5 rounded-xl bg-[#008A64] hover:bg-[#007454] disabled:opacity-50 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              {submitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Đang chốt điểm...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={14} />
                  <span>Xác nhận kết quả trận đấu</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JudgeEvaluationModal;


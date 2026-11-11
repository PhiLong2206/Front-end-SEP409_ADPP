import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation, useParams } from "react-router-dom";
import ScoreBreakdown from "../../../components/debate/ScoreBreakdown";
import EvidenceCheckPanel from "../../../components/debate/EvidenceCheckPanel";
import { CheckCircle2, AlertCircle, RotateCcw, ArrowRight, FileText, Loader2 } from "lucide-react";
import { debateApi } from "../../../api";
import { useAuth } from "../../../hooks/useAuth";
import { isSameUserId } from "../../../utils/debateSpeaker";
import {
  DebateResultData,
  PERCENT_MAX,
  buildDebateResultFromEvaluation,
  getErrorMessage,
} from "../../../utils/debateScoring";

const LOAD_ERROR = "Không tải được kết quả tranh biện.";

/**
 * The result of the debate the user took part in, from the official result (GET /evaluation) when the page is
 * opened without the room's navigation state: F5 in a new tab, the history page, a shared link.
 */
async function loadOfficialResult(sessionId: number, userId: number | string | null): Promise<DebateResultData> {
  const [sessionRes, evaluationRes] = await Promise.all([
    debateApi.getSessionDetails(sessionId),
    debateApi.getEvaluation(sessionId),
  ]);
  if (!sessionRes?.success || !sessionRes.data) throw new Error(sessionRes?.message || "không tải được phiên tranh biện");
  if (!evaluationRes?.success || !evaluationRes.data) throw new Error(evaluationRes?.message || "chưa có kết quả chấm");

  const session = sessionRes.data;
  const me = session.participants.find((p) => !p.isAI && isSameUserId(p.userId, userId));
  const side = me?.side === 1 || String(me?.side) === "PRO" ? "pro" : me?.side === 2 || String(me?.side) === "CON" ? "con" : null;
  if (!side) throw new Error("bạn không tham gia phiên tranh biện này");

  const result = buildDebateResultFromEvaluation(evaluationRes.data, side, session.topic || session.title);
  if (!result) throw new Error("AI Evaluator không trả về điểm tổng kết");
  return result;
}

const DebateResult: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId } = useParams();
  const { user } = useAuth();
  const currentUserId = user?.userId ?? user?.id ?? null;
  const stateResult: DebateResultData | null = (location.state as { result?: DebateResultData })?.result || null;
  const numSessionId = Number(sessionId);
  const canLoad = !stateResult && Number.isInteger(numSessionId) && numSessionId > 0;

  const [loadedResult, setLoadedResult] = useState<DebateResultData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(canLoad);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Number of the latest load; 0 once the page is gone. An answer of an older load (or after leaving) is ignored.
  const latestLoadRef = useRef(0);
  useEffect(() => () => {
    latestLoadRef.current = 0;
  }, []);

  // State is only set once the requests answer (the initial loading state comes from useState)
  const fetchResult = useCallback(async () => {
    const load = ++latestLoadRef.current;
    try {
      const loaded = await loadOfficialResult(numSessionId, currentUserId);
      if (load !== latestLoadRef.current) return;
      setLoadedResult(loaded);
      setLoadError(null);
    } catch (err) {
      if (load !== latestLoadRef.current) return;
      console.error("Error loading the debate result:", err);
      setLoadError(`${LOAD_ERROR} (${getErrorMessage(err, "lỗi không xác định")})`);
    }
    setIsLoading(false);
  }, [numSessionId, currentUserId]);

  const retry = () => {
    setIsLoading(true);
    setLoadError(null);
    void fetchResult();
  };

  useEffect(() => {
    if (canLoad) void fetchResult();
  }, [canLoad, fetchResult]);

  const result = stateResult ?? loadedResult;

  if (!result && isLoading) {
    return (
      <div data-testid="result-loading" className="space-y-3 max-w-4xl mx-auto py-16 text-center">
        <Loader2 size={32} className="mx-auto text-[#008A64] animate-spin" />
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Đang tải kết quả tranh biện...</p>
        <p className="text-xs text-slate-500 dark:text-[#94A3B8]">
          Nếu phiên vừa kết thúc, AI có thể đang chấm điểm, vui lòng chờ trong giây lát.
        </p>
      </div>
    );
  }

  if (!result && loadError) {
    return (
      <div data-testid="result-load-error" className="space-y-3 max-w-4xl mx-auto py-16 text-center">
        <AlertCircle size={36} className="mx-auto text-amber-500" />
        <p className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC]">{loadError}</p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            data-testid="result-retry-btn"
            onClick={retry}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#008A64] hover:bg-[#007457] text-white text-xs font-bold rounded-2xl"
          >
            <RotateCcw size={14} />
            <span>Thử lại</span>
          </button>
          <Link
            to="/debater/history"
            className="px-5 py-2.5 border border-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-2xl"
          >
            Lịch sử tranh biện
          </Link>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-16 text-center">
        <FileText size={40} className="mx-auto text-slate-300" />
        <h2 className="text-lg font-black text-slate-900 dark:text-[#F8FAFC]">Không tìm thấy kết quả đánh giá</h2>
        <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-1">
          Phiên tranh biện này chưa có dữ liệu chấm điểm từ AI hoặc phiên chưa kết thúc.
        </p>
        <Link
          to="/debater/debate"
          className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-[#008A64] hover:bg-[#007457] text-white text-xs font-bold rounded-2xl shadow-xs transition-colors"
        >
          <span>Luyện tập phiên mới</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    );
  }

  const scoredCriteriaCount = result.criteria.filter((c) => c.score !== null).length;
  const explainedCriteria = result.criteria.filter((c) => c.score !== null);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* 3 Main Columns */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
        {/* LEFT COLUMN: Kết quả tranh biện & Circular Score (~30%) */}
        <div className="md:col-span-4 bg-white dark:bg-[#10231C] p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="space-y-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-[#F8FAFC] tracking-tight">
              Kết quả tranh biện
            </h2>
            <p className="text-xs text-slate-600 dark:text-[#94A3B8] line-clamp-2">
              Chủ đề: <span className="font-semibold text-[#008A64] dark:text-[#34D399]">&ldquo;{result.topicTitle}&rdquo;</span>
            </p>
          </div>

          {/* Circular Score Badge Center */}
          <div className="my-6 flex flex-col items-center justify-center">
            <div className="w-32 h-32 rounded-full border-4 border-[#008A64] flex flex-col items-center justify-center bg-[#ECFDF5]/50 dark:bg-[rgba(16,185,129,0.1)] shadow-sm shadow-[#008A64]/10">
              <span data-testid="result-overall-score" className="text-4xl font-black text-slate-900 dark:text-[#F8FAFC] font-mono leading-none">
                {result.overallScore}
              </span>
              <span className="text-[11px] font-bold text-slate-500 dark:text-[#94A3B8] mt-1">/ {PERCENT_MAX}</span>
            </div>
            <span className="mt-4 px-3.5 py-1 rounded-full text-xs font-bold bg-[#ECFDF5] text-[#008A64] dark:bg-[rgba(16,185,129,0.15)] dark:text-[#34D399] border border-[#008A64]/30">
              {result.ratingText}
            </span>
            <p className="mt-3 max-w-[220px] text-center text-[11px] leading-snug text-slate-500 dark:text-[#94A3B8]">
              Điểm tổng được đánh giá toàn diện, không phải trung bình các tiêu chí.
            </p>
          </div>

          {/* Stage breakdown if available */}
          {result.stageBreakdown && result.stageBreakdown.length > 0 && (
            <div className="p-3 bg-slate-50 dark:bg-[#091713] rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs space-y-2 mb-3">
              <p className="font-bold text-slate-700 dark:text-slate-300">Điểm theo giai đoạn:</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {result.stageBreakdown.map((s) => (
                  <div key={s.stage} className="p-1.5 bg-white dark:bg-[#123326] rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 block text-[10px]">{s.label}</span>
                    {s.score === null ? (
                      <span className="font-semibold text-slate-500 dark:text-slate-400 text-[10px]">
                        Không phát biểu
                      </span>
                    ) : (
                      <span className="font-bold text-[#008A64] dark:text-[#34D399] text-xs">
                        {s.score}/{s.maxScore}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 text-xs text-slate-500 dark:text-[#94A3B8] text-center">
            Đánh giá tự động bởi AI Evaluator Service
            {scoredCriteriaCount > 0 && ` • Rubric ${scoredCriteriaCount} tiêu chí`}
          </div>
        </div>

        {/* CENTER COLUMN: Điểm theo tiêu chí (~35%) */}
        <div className="md:col-span-4 bg-white dark:bg-[#10231C] p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-[#F8FAFC] tracking-tight">
            Điểm theo tiêu chí
          </h2>
          <div className="pt-2">
            <ScoreBreakdown criteria={result.criteria} />
          </div>

          {explainedCriteria.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <p className="font-bold text-slate-700 dark:text-slate-300">Giải trình tiêu chí:</p>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {explainedCriteria.map((c) => (
                  <div key={c.key} className="p-2 bg-slate-50 dark:bg-[#091713] rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-0.5">
                    <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                      <span>{c.label}</span>
                      <span className="text-[#008A64] dark:text-[#34D399]">{c.score}/{c.maxScore}</span>
                    </div>
                    {c.reasoning && (
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">{c.reasoning}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Nhận xét chi tiết (~35%) */}
        <div className="md:col-span-4 bg-white dark:bg-[#10231C] p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-[#F8FAFC] tracking-tight">
              Nhận xét chi tiết
            </h2>

            {/* Tiến trình & Xu hướng */}
            {result.progressTrend && (
              <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/40 text-xs space-y-1">
                <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 size={13} className="text-[#008A64]" />
                  Tổng quan chất lượng
                </span>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{result.progressTrend}</p>
              </div>
            )}

            {/* Điểm mạnh */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                <CheckCircle2 size={14} className="text-[#008A64]" />
                Điểm mạnh
              </span>
              <ul className="space-y-1.5 pl-1">
                {result.strengths.length === 0 && (
                  <li className="text-xs text-slate-400">Chưa có dữ liệu.</li>
                )}
                {result.strengths.map((str, idx) => (
                  <li key={idx} className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed flex items-start gap-1.5">
                    <span className="text-[#008A64] font-bold mt-0.5">•</span>
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Cần cải thiện */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                <AlertCircle size={14} className="text-amber-500" />
                Cần cải thiện
              </span>
              <ul className="space-y-1.5 pl-1">
                {result.improvements.length === 0 && (
                  <li className="text-xs text-slate-400">Chưa có dữ liệu.</li>
                )}
                {result.improvements.map((imp, idx) => (
                  <li key={idx} className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed flex items-start gap-1.5">
                    <span className="text-amber-500 font-bold mt-0.5">•</span>
                    <span>{imp}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Evidence check of the debater's figures (RAG); only the debater's own side is graded */}
      <EvidenceCheckPanel rounds={result.evidenceRounds} />

      {/* BOTTOM ACTIONS BAR */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link
          to={`/debater/debate/${result.sessionId}`}
          className="text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <FileText size={15} />
          <span>Xem lại toàn bộ transcript</span>
        </Link>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => navigate("/debater/debate")}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-xl transition-all inline-flex items-center justify-center gap-1.5 shadow-xs"
          >
            <RotateCcw size={14} />
            <span>Luyện lại chủ đề này</span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/debater/topics")}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-[#008A64] hover:bg-[#007457] text-white text-xs sm:text-sm font-bold rounded-xl transition-all inline-flex items-center justify-center gap-1.5 shadow-sm shadow-[#008A64]/20 hover:scale-102"
          >
            <span>Chọn chủ đề mới</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DebateResult;

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Award, ArrowRight, Swords } from "lucide-react";
import { debateApi } from "../../../api";
import { countCompletedDebates } from "../../../utils/debateStats";

const Progress: React.FC = () => {
  // null until the history has loaded, or when it could not be: nothing is shown rather than a made-up 0
  const [completedDebates, setCompletedDebates] = useState<number | null>(null);
  const [avgScore, setAvgScore] = useState<number>(0);
  const [topSkill, setTopSkill] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    debateApi
      .getUserHistory()
      .then(async (res) => {
        if (!cancelled && res?.success && Array.isArray(res.data)) {
          const completedCount = countCompletedDebates(res.data);
          setCompletedDebates(completedCount);

          const completedItems = res.data
            .filter((item) => item.status === 3 || String(item.status) === "Completed")
            .slice(0, 5);

          if (completedItems.length > 0) {
            const evalResults = await Promise.allSettled(
              completedItems.map((item) => debateApi.getEvaluation(item.sessionId))
            );
            if (cancelled) return;

            const scores: number[] = [];
            const criteriaTotals: Record<string, { sum: number; count: number }> = {};

            evalResults.forEach((evRes, idx) => {
              if (evRes.status === "fulfilled" && evRes.value?.success && evRes.value.data) {
                const ev = evRes.value.data;
                const item = completedItems[idx];
                const isPro = item.userSide === 1 || String(item.userSide) === "PRO";
                const myScore = isPro
                  ? ev.overallScorePro ?? ev.proEvaluation?.overallScore ?? ev.overallScore
                  : ev.overallScoreCon ?? ev.conEvaluation?.overallScore ?? ev.overallScore;
                if (typeof myScore === "number" && myScore > 0) {
                  scores.push(myScore);
                }

                const myEval = isPro ? ev.proEvaluation : ev.conEvaluation;
                myEval?.roundEvaluations?.forEach((r) => {
                  r.criteria?.forEach((c) => {
                    if (!criteriaTotals[c.name]) {
                      criteriaTotals[c.name] = { sum: 0, count: 0 };
                    }
                    criteriaTotals[c.name].sum += Number(c.score || 0);
                    criteriaTotals[c.name].count += 1;
                  });
                });
              }
            });

            if (scores.length > 0) {
              setAvgScore(scores.reduce((a, b) => a + b, 0) / scores.length);
            }

            let bestCriterion = "";
            let bestAvg = -1;
            Object.entries(criteriaTotals).forEach(([name, stats]) => {
              const avg = stats.sum / stats.count;
              if (avg > bestAvg) {
                bestAvg = avg;
                bestCriterion = name;
              }
            });
            if (bestCriterion) {
              setTopSkill(bestCriterion);
            }
          }
        }
      })
      .catch(() => {
        // The metric stays hidden
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-8">
      {/* Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-[#F8FAFC] tracking-tight">
          Tiến độ học tập
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Theo dõi sự tiến bộ và phân tích kỹ năng tranh biện của bạn theo thời gian từ dữ liệu hệ thống.
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-[#12231C] p-6 rounded-3xl border border-slate-200 dark:border-[rgba(148,163,184,0.18)] shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Điểm trung bình
          </span>
          <div className="my-4">
            <div className="text-4xl font-black text-[#008A64] dark:text-emerald-400">
              {avgScore > 0 ? avgScore.toFixed(1) : "--"}
            </div>
            <span className="text-xs text-slate-400 mt-1 inline-block">
              {avgScore > 0 ? "Thang điểm 10.0 (AI Evaluator)" : "Chưa có dữ liệu chấm điểm"}
            </span>
          </div>
        </div>

        {completedDebates !== null && (
          <div
            data-testid="progress-total-debates"
            className="bg-white dark:bg-[#12231C] p-6 rounded-3xl border border-slate-200 dark:border-[rgba(148,163,184,0.18)] shadow-xs"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Tổng số phiên tranh biện
            </span>
            <div className="my-4">
              <div className="text-4xl font-black text-slate-900 dark:text-[#F8FAFC]">
                {completedDebates}
              </div>
              <span className="text-xs text-slate-400 mt-1 inline-block">
                Chỉ tính các trận đã hoàn thành
              </span>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-[#12231C] p-6 rounded-3xl border border-slate-200 dark:border-[rgba(148,163,184,0.18)] shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Kỹ năng nổi bật
          </span>
          <div className="my-4">
            <div className="text-xl font-bold text-slate-700 dark:text-slate-300">
              {topSkill || "Đang phân tích"}
            </div>
            <span className="text-xs text-slate-400 mt-1 inline-block">
              {topSkill ? "Tiêu chí đạt điểm cao nhất" : "Hoàn thành phiên tranh biện để đánh giá"}
            </span>
          </div>
        </div>
      </div>

      {/* Empty State Banner */}
      {completedDebates === 0 && (
        <div
          data-testid="progress-empty-state"
          className="bg-white dark:bg-[#12231C] rounded-3xl border border-slate-200 dark:border-[rgba(148,163,184,0.18)] p-12 text-center shadow-xs"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-100 dark:border-emerald-500/30 text-[#008A64] dark:text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-xs">
            <Award size={32} />
          </div>
          <h3 className="text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC] mb-2">
            Chưa có phiên tranh biện nào được ghi nhận
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
            Dữ liệu tiến độ, biểu đồ radar 5 tiêu chí kỹ năng và lịch sử điểm số sẽ được cập nhật tự động khi bạn hoàn thành các trận thi đấu hoặc luyện tập thực tế trên hệ thống.
          </p>
          <Link
            to="/debater/competitions"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#008A64] hover:bg-[#007457] text-white text-sm font-bold rounded-xl shadow-sm shadow-[#008A64]/20 transition-all cursor-pointer"
          >
            <Swords size={16} />
            <span>Tham gia giải đấu ngay</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
};

export default Progress;

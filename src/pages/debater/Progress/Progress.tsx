import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Award, ArrowRight, Swords } from "lucide-react";
import { debateApi } from "../../../api";
import { countCompletedDebates } from "../../../utils/debateStats";

const Progress: React.FC = () => {
  // null until the history has loaded, or when it could not be: nothing is shown rather than a made-up 0
  const [completedDebates, setCompletedDebates] = useState<number | null>(null);
  const avgScore = 0;

  useEffect(() => {
    let cancelled = false;
    debateApi
      .getUserHistory()
      .then((res) => {
        if (!cancelled && res?.success && Array.isArray(res.data)) {
          setCompletedDebates(countCompletedDebates(res.data));
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
              Chưa có dữ liệu chấm điểm
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
              Đang phân tích
            </div>
            <span className="text-xs text-slate-400 mt-1 inline-block">
              Cần tối thiểu 3 phiên để đánh giá
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

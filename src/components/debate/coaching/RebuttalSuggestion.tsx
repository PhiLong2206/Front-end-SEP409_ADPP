import React from "react";
import { Lightbulb, Target, Compass, HelpCircle } from "lucide-react";

export interface RebuttalTips {
  mainPoint: string;
  vulnerabilities: string[];
  directions: string[];
  sampleQuestions: string[];
}

export interface RebuttalSuggestionProps {
  tips?: RebuttalTips | null;
}

const RebuttalSuggestion: React.FC<RebuttalSuggestionProps> = ({ tips }) => {
  if (!tips) {
    return (
      <div className="bg-white debate-panel-secondary rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3 text-center">
        <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto">
          <Lightbulb size={20} />
        </div>
        <h3 className="font-bold text-slate-800 text-sm">Gợi ý phản biện AI</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          AI sẽ phân tích lập luận của đối thủ và đề xuất hướng phản biện tại đây sau mỗi lượt nói.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white debate-panel-secondary rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4.5">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3.5 border-b border-slate-100 dark:border-slate-800/60">
        <div className="p-2 rounded-xl bg-[#ECFDF5] dark:bg-[rgba(16,185,129,0.12)] text-[#008A64] dark:text-[#34D399]">
          <Lightbulb size={20} />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 dark:text-[#F8FAFC] text-[17px]">Gợi ý phản biện AI</h3>
          <p className="text-[14px] text-slate-500 dark:text-[#94A3B8]">Phân tích hỗ trợ chiến thuật lập luận</p>
        </div>
      </div>

      {/* 1. Luận điểm chính của đối phương */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-slate-900 dark:text-[#F8FAFC]">
          <span className="w-2 h-2 rounded-full bg-[#008A64] dark:bg-[#34D399]" />
          <span>Luận điểm chính của đối phương</span>
        </div>
        <p className="text-[15px] leading-[1.65] text-slate-700 bg-slate-50 dark:bg-[#091713] debate-card-neutral debate-card-neutral-text p-3.5 rounded-xl border border-slate-200/70 dark:border-[rgba(148,163,184,0.16)]">
          {tips.mainPoint}
        </p>
      </div>

      {/* 2. Điểm có thể khai thác */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-rose-600 dark:text-[#FB7185] debate-card-vuln-title">
          <Target size={15} className="text-rose-500 dark:text-[#FB7185]" />
          <span>Điểm có thể khai thác</span>
        </div>
        <ul className="space-y-2">
          {tips.vulnerabilities.map((v, i) => (
            <li
              key={i}
              className="text-[14px] text-rose-700 dark:text-[#FDA4AF] bg-rose-50 dark:bg-[rgba(244,63,94,0.10)] debate-card-vuln p-3 rounded-xl border border-rose-200/70 dark:border-[rgba(244,63,94,0.22)] flex items-start gap-2"
            >
              <span className="font-bold shrink-0 mt-0.5">•</span>
              <span className="leading-snug">{v}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 3. Hướng phản hồi gợi ý */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-[#008A64] dark:text-[#34D399]">
          <Compass size={15} />
          <span>Hướng phản hồi gợi ý</span>
        </div>
        <ul className="space-y-2">
          {tips.directions.map((d, i) => (
            <li
              key={i}
              className="text-[14px] text-slate-700 dark:text-[#D1FAE5] bg-emerald-50/60 dark:bg-[rgba(16,185,129,0.10)] p-3 rounded-xl border border-emerald-200/60 dark:border-[rgba(16,185,129,0.22)] flex items-start gap-2"
            >
              <span className="font-bold text-[#008A64] dark:text-[#34D399] shrink-0 mt-0.5">
                {i + 1}.
              </span>
              <span className="leading-snug">{d}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 4. Câu hỏi chất vấn mẫu */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-amber-600 dark:text-[#FBBF24]">
          <HelpCircle size={15} />
          <span>Câu hỏi chất vấn mẫu</span>
        </div>
        <ul className="space-y-2">
          {tips.sampleQuestions.map((q, i) => (
            <li
              key={i}
              className="text-[14px] italic text-slate-700 dark:text-[#FEF3C7] bg-amber-50/60 dark:bg-[rgba(245,158,11,0.10)] p-3 rounded-xl border border-amber-200/60 dark:border-[rgba(245,158,11,0.22)]"
            >
              &ldquo;{q}&rdquo;
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default RebuttalSuggestion;

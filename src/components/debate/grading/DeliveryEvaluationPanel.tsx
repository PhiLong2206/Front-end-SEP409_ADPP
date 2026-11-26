import React from "react";
import { Activity, Eye, Gauge, Mic, Smile, Sparkles } from "lucide-react";
import type { SessionDeliverySummary } from "../../../utils/deliverySummary";
import { emotionLabelVi } from "../../../utils/emotionLabels";

interface DeliveryEvaluationPanelProps {
  summary: SessionDeliverySummary | null;
}

const DeliveryEvaluationPanel: React.FC<DeliveryEvaluationPanelProps> = ({ summary }) => {
  if (!summary) {
    return (
      <section
        data-testid="delivery-evaluation-empty"
        className="bg-white dark:bg-[#0C1627] p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center shrink-0">
            <Mic size={18} />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-[#F8FAFC]">
              Đánh giá giọng nói &amp; Phong thái
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Phiên tranh biện này chưa có dữ liệu ghi âm giọng nói hoặc camera.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      data-testid="delivery-evaluation-panel"
      aria-labelledby="delivery-eval-heading"
      className="bg-white dark:bg-[#0C1627] p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#0B5ED7] dark:text-[#60A5FA] flex items-center justify-center">
            <Mic size={18} />
          </div>
          <div>
            <h2
              id="delivery-eval-heading"
              className="text-base sm:text-lg font-black text-slate-900 dark:text-[#F8FAFC] tracking-tight"
            >
              Đánh giá giọng nói &amp; Phong thái
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tổng hợp từ phân tích âm thanh (Whisper) &amp; biểu cảm khuôn mặt (DeepFace)
            </p>
          </div>
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/50 text-[#0B5ED7] dark:text-[#60A5FA] border border-blue-200/70 dark:border-blue-800/50">
          {summary.turns.length} lượt ghi âm
        </span>
      </div>

      {/* 5 Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-800/40 space-y-1">
          <span className="text-[11px] font-bold text-[#0B5ED7] dark:text-[#60A5FA] flex items-center gap-1">
            <Sparkles size={12} />
            Phong thái
          </span>
          <p className="text-xl font-black text-slate-900 dark:text-white">
            {summary.overallDemeanorScore}
            <span className="text-xs font-semibold text-slate-400"> /100</span>
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#060d1a] border border-slate-200/80 dark:border-slate-800 space-y-1">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Gauge size={12} />
            Tốc độ nói
          </span>
          <p className="text-xl font-black text-slate-900 dark:text-white">
            {summary.avgWpm}
            <span className="text-xs font-semibold text-slate-400"> WPM</span>
          </p>
          {summary.paceEvaluation && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{summary.paceEvaluation}</p>
          )}
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#060d1a] border border-slate-200/80 dark:border-slate-800 space-y-1">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Activity size={12} />
            Độ trôi chảy
          </span>
          <p className="text-xl font-black text-slate-900 dark:text-white">
            {summary.avgFluency}
            <span className="text-xs font-semibold text-slate-400"> /100</span>
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{summary.totalFillers} từ đệm</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#060d1a] border border-slate-200/80 dark:border-slate-800 space-y-1">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Smile size={12} />
            Điềm tĩnh &amp; Cảm xúc
          </span>
          <p className="text-xl font-black text-slate-900 dark:text-white">
            {summary.avgComposure}
            <span className="text-xs font-semibold text-slate-400">%</span>
          </p>
          <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
            {emotionLabelVi(summary.dominantEmotion)}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#060d1a] border border-slate-200/80 dark:border-slate-800 space-y-1">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Eye size={12} />
            Tương tác mắt
          </span>
          <p className="text-xl font-black text-slate-900 dark:text-white">
            {summary.avgEyeContact}
            <span className="text-xs font-semibold text-slate-400">%</span>
          </p>
        </div>
      </div>

      {/* Per-turn breakdown */}
      {summary.turns.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Chi tiết theo từng lượt nói
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {summary.turns.map((turn, idx) => (
              <div
                key={turn.argumentId || idx}
                className="p-3 rounded-2xl bg-slate-50/80 dark:bg-[#060d1a] border border-slate-200/70 dark:border-slate-800 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-100">
                  <span>{turn.stageLabel}</span>
                  <span className="text-[#0B5ED7] dark:text-[#60A5FA]">{turn.overallDemeanorScore}/100</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                  <span>🎙 {turn.wpm} WPM</span>
                  <span>💧 {turn.fluencyScore}/100 ({turn.fillerCount} đệm)</span>
                  <span>😊 {emotionLabelVi(turn.dominantEmotion)} ({turn.composureScore}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default DeliveryEvaluationPanel;


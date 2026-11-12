import React, { useState } from "react";
import { Bot, ChevronDown, ChevronUp, Lightbulb, Target, AlertTriangle, Zap, RefreshCw, Coins } from "lucide-react";

export interface CoachingAdvice {
  type: "weakness" | "strategy" | "evidence" | "logic_error";
  label: string;
  content: string;
}


const TYPE_CONFIG = {
  weakness: {
    icon: Target,
    color: "text-rose-600 dark:text-[#FB7185]",
    bg: "bg-rose-50/70 dark:bg-[rgba(239,68,68,0.08)] border-rose-200/80 dark:border-[rgba(239,68,68,0.30)]",
    textColor: "text-slate-700 dark:text-[#F1D5D8]",
  },
  strategy: {
    icon: Zap,
    color: "text-[#008A64] dark:text-[#34D399]",
    bg: "bg-[#ECFDF5]/60 dark:bg-[rgba(16,185,129,0.08)] border-[#008A64]/20 dark:border-[rgba(16,185,129,0.25)]",
    textColor: "text-slate-700 dark:text-[#DCE7E3]",
  },
  evidence: {
    icon: Lightbulb,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50/70 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-800/40",
    textColor: "text-slate-700 dark:text-amber-100",
  },
  logic_error: {
    icon: AlertTriangle,
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50/70 dark:bg-violet-950/20 border-violet-200/80 dark:border-violet-800/40",
    textColor: "text-slate-700 dark:text-violet-100",
  },
};

interface AICoachingPanelProps {
  usageCount?: number;
  costPerUse?: number;
  advice?: CoachingAdvice[];
  onUsed?: () => void;
  onRequestCoaching?: () => void;
  isLoading?: boolean;
}

const AICoachingPanel: React.FC<AICoachingPanelProps> = ({
  usageCount = 0,
  costPerUse = 0,
  advice,
  onUsed,
  onRequestCoaching,
  isLoading = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localUsageCount, setLocalUsageCount] = useState(usageCount);

  return (
    <div className="bg-white debate-panel-secondary rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-[#123326]/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200/80 dark:border-violet-800/40">
            <Bot size={18} className="text-violet-600 dark:text-violet-400" />
          </div>
          <div className="text-left">
            <p className="text-[15px] font-bold text-slate-900 dark:text-[#F8FAFC]">AI Coaching</p>
            <p className="text-[14px] text-slate-500 dark:text-[#94A3B8]">Phân tích & gợi ý chiến lược theo lượt</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {costPerUse > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-[13px] font-bold text-amber-700 dark:text-amber-300">
              <Coins size={12} />
              <span>{costPerUse.toLocaleString()}đ/lần</span>
            </div>
          )}
          {isExpanded ? <ChevronUp size={18} className="text-slate-400 dark:text-[#94A3B8]" /> : <ChevronDown size={18} className="text-slate-400 dark:text-[#94A3B8]" />}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-slate-100 dark:border-slate-800/60 p-5 space-y-4">
          {/* Usage counter */}
          {localUsageCount > 0 && (
            <div className="flex items-center justify-between text-[14px]">
              <span className="text-slate-500 dark:text-[#94A3B8]">Đã sử dụng trong phiên này</span>
              <span className="font-bold text-slate-700 dark:text-[#CBD5E1]">
                {localUsageCount} lần
                {costPerUse > 0 ? ` · ${(localUsageCount * costPerUse).toLocaleString("vi-VN")}đ` : ""}
              </span>
            </div>
          )}

          {!advice || advice.length === 0 ? (
            <div className="space-y-3">
              <div className="py-6 text-center text-slate-400 space-y-1.5">
                <Bot size={28} className="mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Chưa có phân tích cho lượt này</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Gửi lập luận để nhận phản hồi và gợi ý chiến lược từ AI.</p>
              </div>

              {onRequestCoaching && (
                <button
                  type="button"
                  onClick={() => {
                    setLocalUsageCount((c) => c + 1);
                    onRequestCoaching();
                    onUsed?.();
                  }}
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[15px] font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-60 shadow-xs"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      <span>AI đang phân tích...</span>
                    </>
                  ) : (
                    <>
                      <Bot size={16} />
                      <span>
                        Yêu cầu phân tích AI{costPerUse > 0 ? ` (tính phí ${costPerUse.toLocaleString()}đ)` : ""}
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Advice cards */}
              {advice.map((item, i) => {
                const cfg = TYPE_CONFIG[item.type];
                const Icon = cfg.icon;
                return (
                  <div key={i} className={`p-4 rounded-xl border ${cfg.bg} space-y-2`}>
                    <div className="flex items-center gap-2">
                      <Icon size={14} className={cfg.color} />
                      <span className={`text-[14px] font-bold ${cfg.color}`}>{item.label}</span>
                    </div>
                    <p className={`text-[15px] leading-[1.65] ${cfg.textColor}`}>{item.content}</p>
                  </div>
                );
              })}

              {/* Refresh button */}
              {onRequestCoaching && (
                <button
                  type="button"
                  onClick={() => {
                    setLocalUsageCount((c) => c + 1);
                    onRequestCoaching();
                    onUsed?.();
                  }}
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-[rgba(148,163,184,0.20)] text-slate-700 dark:text-[#CBD5E1] bg-slate-50 dark:bg-[#091713] text-[15px] font-semibold flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-[#123326] transition-colors disabled:opacity-60"
                >
                  <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
                  <span>Phân tích lại{costPerUse > 0 ? ` (${costPerUse.toLocaleString()}đ)` : ""}</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AICoachingPanel;

import React, { useState } from "react";
import { Bot, ChevronDown, ChevronUp, Lightbulb, Target, AlertTriangle, Zap, RefreshCw, Coins } from "lucide-react";

export interface CoachingAdvice {
  type: "weakness" | "strategy" | "evidence" | "logic_error";
  label: string;
  content: string | unknown;
}

export class AICoachingErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("AICoachingPanel error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 space-y-2">
          <div className="flex items-center gap-2 font-bold text-[14px]">
            <AlertTriangle size={16} />
            <span>Không thể hiển thị gợi ý AI</span>
          </div>
          <p className="text-[13px] leading-relaxed">
            Đã có sự cố khi kết xuất nội dung gợi ý. Vui lòng thử yêu cầu lại hoặc tiếp tục tranh biện.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-3 py-1 bg-white dark:bg-slate-800 rounded-md text-xs font-semibold border border-rose-300 hover:bg-rose-100 dark:hover:bg-slate-700 transition-colors"
          >
            Thử lại
          </button>
        </div>
      );
    }
    return this.props.children;
  }
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
    color: "text-[#0B5ED7] dark:text-[#60A5FA]",
    bg: "bg-[#EAF2FF]/60 dark:bg-[rgba(59,130,246,0.08)] border-[#0B5ED7]/20 dark:border-[rgba(59,130,246,0.25)]",
    textColor: "text-slate-700 dark:text-[#DDE7F5]",
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
  onRequestHint?: () => void;
  isLoading?: boolean;
  isHintLoading?: boolean;
}

const AICoachingPanel: React.FC<AICoachingPanelProps> = ({
  usageCount = 0,
  costPerUse = 0,
  advice,
  onUsed,
  onRequestCoaching,
  onRequestHint,
  isLoading = false,
  isHintLoading = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localUsageCount, setLocalUsageCount] = useState(usageCount);

  return (
    <div className="bg-white debate-panel-secondary rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-[#0b1c3a]/40 transition-colors"
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
          {/* AI Hint Action Box (5 Credit) */}
          {onRequestHint && (
            <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <Lightbulb size={14} className="text-amber-600" />
                  Gợi ý lập luận lượt này (AI Hint)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-bold text-[10px]">
                  <Coins size={10} /> 5 Credit
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-amber-100/80">
                AI sẽ đối chiếu chủ đề và nội dung nháp của bạn để gợi ý luận điểm sắc bén.
              </p>
              <button
                type="button"
                onClick={onRequestHint}
                disabled={isHintLoading}
                className="w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isHintLoading ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>AI đang soạn gợi ý...</span>
                  </>
                ) : (
                  <>
                    <Lightbulb size={13} />
                    <span>Lấy gợi ý AI Hint (5 Credit)</span>
                  </>
                )}
              </button>
            </div>
          )}

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
                    <p className={`text-[15px] leading-[1.65] whitespace-pre-line ${cfg.textColor}`}>
                      {typeof item.content === "string" ? item.content : JSON.stringify(item.content, null, 2)}
                    </p>
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
                  className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-[rgba(148,163,184,0.20)] text-slate-700 dark:text-[#CBD5E1] bg-slate-50 dark:bg-[#060d1a] text-[15px] font-semibold flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-[#0b1c3a] transition-colors disabled:opacity-60"
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

const SafeAICoachingPanel: React.FC<AICoachingPanelProps> = (props) => (
  <AICoachingErrorBoundary>
    <AICoachingPanel {...props} />
  </AICoachingErrorBoundary>
);

export default SafeAICoachingPanel;

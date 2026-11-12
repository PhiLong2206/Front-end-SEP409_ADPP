import React, { useRef, useEffect } from "react";
import { Mic, Send, Lightbulb, Award, BookOpen, Loader2, Video, Sparkles } from "lucide-react";
import { DebateRoleInRoom, FrameAnalysisResult } from "../../types";

export interface DebateComposerProps {
  argumentText: string;
  isAiGenerating?: boolean;
  isSubmitting?: boolean;
  isRecording?: boolean;
  isAnalyzingMultimodal?: boolean;
  liveFrameAnalysis?: FrameAnalysisResult | null;
  videoPreviewRef?: React.RefObject<HTMLVideoElement | null>;
  overlayCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  hasActiveCamera?: boolean;
  isTurnExpired?: boolean;
  isDebateCompleted?: boolean;
  canSpeak: boolean;
  cannotSpeakReason?: string;
  userRoleInRoom?: DebateRoleInRoom;
  activeSidebarTab?: string | null;
  hasNewEvaluation?: boolean;
  latestScore?: number | null;
  onArgumentChange: (text: string) => void;
  onSend: () => void;
  onToggleRecording: () => void;
  onRunSampleMultimodal?: () => void;
  onToggleAssistantTab: (tab: "coach" | "caseplan" | "evaluator") => void;
}

const DebateComposer: React.FC<DebateComposerProps> = ({
  argumentText,
  isAiGenerating = false,
  isSubmitting = false,
  isRecording = false,
  isAnalyzingMultimodal = false,
  liveFrameAnalysis = null,
  videoPreviewRef,
  overlayCanvasRef,
  hasActiveCamera = false,
  isTurnExpired = false,
  isDebateCompleted = false,
  canSpeak = true,
  cannotSpeakReason,
  activeSidebarTab = null,
  hasNewEvaluation = false,
  latestScore = null,
  onArgumentChange,
  onSend,
  onToggleRecording,
  onRunSampleMultimodal,
  onToggleAssistantTab,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-resize textarea smoothly up to 140px
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      const nextHeight = Math.min(Math.max(el.scrollHeight, 36), 140);
      el.style.height = `${nextHeight}px`;
    }
  }, [argumentText]);

  const isLocked = !canSpeak || isTurnExpired || isDebateCompleted || isAiGenerating || isSubmitting;
  const showCharCount = argumentText.length >= 1600;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLocked && argumentText.trim()) {
        onSend();
      }
    }
  };

  return (
    <div className="sticky bottom-0 z-20 px-3 sm:px-6 py-2.5 bg-white/95 dark:bg-[#0D1D17]/95 backdrop-blur-md border-t border-slate-200/70 dark:border-slate-800 shrink-0">
      <div className="max-w-[880px] mx-auto w-full space-y-2">
        {/* Live Multimodal Webcam + Audio Recording Banner */}
        {(isRecording || isAnalyzingMultimodal) && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-900/95 text-white border border-emerald-500/30 shadow-md">
            <div className="flex items-center gap-3">
              {/* Live Webcam Feed + Bounding Box Overlay */}
              <div
                className={`relative w-28 h-20 rounded-lg overflow-hidden bg-slate-800 border border-slate-700 shrink-0 ${
                  hasActiveCamera ? "block" : "hidden"
                }`}
              >
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <canvas
                  ref={overlayCanvasRef}
                  width={320}
                  height={240}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                />
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2 font-bold text-emerald-400">
                  {isAnalyzingMultimodal ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Đang phân tích giọng nói (Faster-Whisper) & biểu cảm (DeepFace)...</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      <span>Đang ghi âm & phân tích biểu cảm trực tiếp (DeepFace YuNet + Whisper)</span>
                    </>
                  )}
                </div>
                {liveFrameAnalysis && liveFrameAnalysis.face_detected ? (
                  <p className="text-[11px] text-slate-300">
                    Biểu cảm:{" "}
                    <span className="font-semibold text-emerald-300">
                      {liveFrameAnalysis.dominant_emotion.toUpperCase()} ({liveFrameAnalysis.dominant_score}%)
                    </span>{" "}
                    · Điềm tĩnh (Composure):{" "}
                    <span className="font-semibold text-amber-300">
                      {liveFrameAnalysis.composure_instant}%
                    </span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    {hasActiveCamera
                      ? "Hãy nhìn thẳng vào camera và trình bày lập luận rõ ràng..."
                      : "Đang thu âm giọng nói từ microphone. Nhấn nút Mic lần nữa để hoàn tất."}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onRunSampleMultimodal && !isAnalyzingMultimodal && (
                <button
                  type="button"
                  onClick={onRunSampleMultimodal}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-400/40 text-emerald-200 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Chạy mẫu âm thanh & biểu cảm thử nghiệm (debate_audio.wav)"
                >
                  <Sparkles size={12} />
                  <span>Thử mẫu AI</span>
                </button>
              )}
              {isRecording && (
                <button
                  type="button"
                  onClick={onToggleRecording}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Dừng & Phân tích
                </button>
              )}
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!isLocked && argumentText.trim()) {
              onSend();
            }
          }}
          className={`flex items-end gap-1.5 sm:gap-2 rounded-2xl border px-2.5 py-1.5 transition-all ${
            isLocked
              ? "bg-slate-100/70 dark:bg-[#0F1E18] border-slate-200/80 dark:border-slate-800"
              : "bg-slate-50/90 dark:bg-[#12231C] border-slate-200/90 dark:border-slate-700/80 hover:border-slate-300 focus-within:bg-white dark:focus-within:bg-[#12231C] focus-within:border-[#008A64] focus-within:ring-2 focus-within:ring-[#008A64]/15 shadow-2xs"
          }`}
        >
          {/* Left Icon Actions: 1 Icon each for AI Hints, Case Plan, and Evaluation */}
          <div className="flex items-center gap-0.5 shrink-0 pb-0.5">
            {/* AI Hints */}
            <button
              type="button"
              onClick={() => onToggleAssistantTab("coach")}
              aria-label="Gợi ý phản biện (AI Hints)"
              title="Gợi ý phản biện (AI Hints)"
              className={`p-2 rounded-xl transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#008A64]/30 ${
                activeSidebarTab === "coach"
                  ? "bg-[#ECFDF5] dark:bg-emerald-950/60 text-[#008A64] dark:text-[#34D399]"
                  : "text-slate-500 hover:text-[#008A64] dark:text-slate-400 dark:hover:text-[#34D399] hover:bg-slate-200/60 dark:hover:bg-slate-800"
              }`}
            >
              <Lightbulb size={17} />
            </button>

            {/* Case Plan */}
            <button
              type="button"
              onClick={() => onToggleAssistantTab("caseplan")}
              aria-label="Hồ sơ lập luận (Case Plan)"
              title="Hồ sơ lập luận (Case Plan)"
              className={`p-2 rounded-xl transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#008A64]/30 ${
                activeSidebarTab === "caseplan"
                  ? "bg-[#ECFDF5] dark:bg-emerald-950/60 text-[#008A64] dark:text-[#34D399]"
                  : "text-slate-500 hover:text-[#008A64] dark:text-slate-400 dark:hover:text-[#34D399] hover:bg-slate-200/60 dark:hover:bg-slate-800"
              }`}
            >
              <BookOpen size={17} />
            </button>

            {/* Evaluation */}
            <button
              type="button"
              onClick={() => onToggleAssistantTab("evaluator")}
              aria-label="Đánh giá lượt nói (AI Evaluator)"
              title={
                latestScore !== null
                  ? `Đánh giá lượt nói (Điểm gần nhất: ${latestScore}/10)`
                  : "Đánh giá lượt nói (AI Evaluator)"
              }
              className={`relative p-2 rounded-xl transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#008A64]/30 ${
                activeSidebarTab === "evaluator"
                  ? "bg-[#ECFDF5] dark:bg-emerald-950/60 text-[#008A64] dark:text-[#34D399]"
                  : "text-slate-500 hover:text-[#008A64] dark:text-slate-400 dark:hover:text-[#34D399] hover:bg-slate-200/60 dark:hover:bg-slate-800"
              }`}
            >
              <Award size={17} />
              {hasNewEvaluation && activeSidebarTab !== "evaluator" && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#008A64] ring-2 ring-white dark:ring-[#12231C]" />
              )}
            </button>
          </div>

          {/* Auto-expanding Multiline Input */}
          <label htmlFor="debate-argument-textarea" className="sr-only">
            Lập luận của bạn
          </label>
          <textarea
            id="debate-argument-textarea"
            ref={textareaRef}
            value={argumentText}
            onChange={(e) => {
              if (!isLocked) {
                onArgumentChange(e.target.value.slice(0, 2000));
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              isLocked
                ? cannotSpeakReason ||
                  (isTurnExpired
                    ? "Đã hết thời gian phát biểu (00:00)."
                    : "Đang chờ lượt phát biểu...")
                : "Nhập lập luận của bạn... (Enter để gửi, Shift+Enter xuống dòng)"
            }
            disabled={isLocked}
            rows={1}
            className="flex-1 text-sm sm:text-[15px] leading-[1.5] bg-transparent outline-none resize-none text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 dark:placeholder:text-slate-500 max-h-[140px] min-h-[36px] py-1.5 px-1.5 disabled:cursor-not-allowed"
          />

          {/* Right Controls: Character Count (only near limit) + Mic + Emphasized Send Button */}
          <div className="flex items-center gap-1.5 shrink-0 pb-0.5">
            {showCharCount && (
              <span
                className={`text-[11px] font-mono px-1 ${
                  argumentText.length >= 1900
                    ? "text-rose-500 font-semibold"
                    : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {argumentText.length}/2000
              </span>
            )}

            {/* Microphone & Camera Multimodal Recording */}
            <button
              type="button"
              onClick={onToggleRecording}
              disabled={isLocked || isAnalyzingMultimodal}
              aria-label={isRecording ? "Dừng ghi âm" : "Ghi âm giọng nói & phân tích biểu cảm"}
              title={
                isRecording
                  ? "Dừng ghi âm & phân tích giọng nói/biểu cảm"
                  : "Ghi âm giọng nói (Faster-Whisper) & phân tích biểu cảm (DeepFace)"
              }
              className={`p-2 rounded-xl transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#008A64]/30 flex items-center gap-1 ${
                isRecording
                  ? "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 animate-pulse"
                  : isAnalyzingMultimodal
                  ? "bg-emerald-50 text-[#008A64] dark:bg-emerald-950/50 dark:text-[#34D399]"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800"
              }`}
            >
              {isAnalyzingMultimodal ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <>
                  <Mic size={17} />
                  <Video size={14} className="hidden sm:inline opacity-70" />
                </>
              )}
            </button>

            {/* Visually Emphasized Send Button */}
            <button
              type="submit"
              disabled={isLocked || !argumentText.trim()}
              aria-label="Gửi lập luận"
              title="Gửi lập luận (Enter)"
              className="w-9 h-9 rounded-xl bg-[#008A64] hover:bg-[#007457] text-white inline-flex items-center justify-center transition-all shadow-xs disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#008A64]/40"
            >
              {isAiGenerating || isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DebateComposer;

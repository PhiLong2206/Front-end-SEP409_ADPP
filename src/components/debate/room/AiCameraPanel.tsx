import React from "react";
import { Camera, Loader2, Mic, MicOff, Video } from "lucide-react";
import type { FrameAnalysisResult } from "../../../types";
import { emotionLabelVi } from "../../../utils/emotionLabels";

export interface AiCameraPanelProps {
  isRecording: boolean;
  isAnalyzingMultimodal: boolean;
  hasActiveCamera: boolean;
  canSpeak: boolean;
  isAiGenerating: boolean;
  isTurnExpired: boolean;
  isDebateCompleted: boolean;
  liveFrameAnalysis: FrameAnalysisResult | null;
  liveInterimTranscript: string;
  liveSttStatus: "idle" | "connecting" | "connected" | "closed" | "error";
  micLevel: number;
  micLabel: string;
  videoPreviewRef: React.RefObject<HTMLVideoElement | null>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  onToggleRecording: () => void;
}

/**
 * Left-hand camera & live delivery studio for AI practice debates.
 * Keeps the <video> and overlay <canvas> mounted at all times so DebateRoom's refs stay valid when recording starts.
 */
const AiCameraPanel: React.FC<AiCameraPanelProps> = ({
  isRecording,
  isAnalyzingMultimodal,
  hasActiveCamera,
  canSpeak,
  isAiGenerating,
  isTurnExpired,
  isDebateCompleted,
  liveFrameAnalysis,
  liveInterimTranscript,
  liveSttStatus,
  micLevel,
  micLabel,
  videoPreviewRef,
  overlayCanvasRef,
  onToggleRecording,
}) => {
  const canStartRecording = canSpeak && !isAiGenerating && !isTurnExpired && !isDebateCompleted && !isAnalyzingMultimodal;
  const showVideo = isRecording && hasActiveCamera;

  return (
    <aside
      data-testid="ai-camera-panel"
      className="w-full lg:w-[44%] lg:max-w-[540px] lg:min-w-[340px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0A1712] p-3 sm:p-4 flex flex-col gap-3 lg:h-full overflow-y-auto"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-[#008A64] dark:text-[#34D399] flex items-center justify-center">
            <Video size={15} />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-[#F8FAFC] leading-tight">
              Khung Camera & Trình bày
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Phân tích biểu cảm & giọng nói trực tiếp
            </p>
          </div>
        </div>

        {isAnalyzingMultimodal ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <Loader2 size={12} className="animate-spin" />
            Đang phân tích
          </span>
        ) : isRecording ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            Đang ghi hình
          </span>
        ) : isAiGenerating ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            AI đang nói
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100/80 text-[#008A64] dark:bg-emerald-950/50 dark:text-emerald-300">
            {canStartRecording ? "Sẵn sàng" : "Chờ lượt"}
          </span>
        )}
      </div>

      {/* Main Camera Viewport */}
      <div className="relative w-full aspect-video lg:aspect-auto lg:flex-1 lg:min-h-[240px] rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner flex items-center justify-center">
        {/* Live video + YuNet bounding-box overlay (kept mounted so refs are never null) */}
        <video
          ref={videoPreviewRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${showVideo ? "block" : "hidden"}`}
        />
        <canvas
          ref={overlayCanvasRef}
          width={320}
          height={240}
          className={`absolute inset-0 w-full h-full pointer-events-none ${showVideo ? "block" : "hidden"}`}
        />

        {/* Video Overlay Badges */}
        {showVideo && (
          <>
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/75 backdrop-blur-xs text-[11px] font-bold text-white border border-white/10">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span>LIVE</span>
            </div>

            {liveFrameAnalysis && liveFrameAnalysis.face_detected ? (
              <div className="absolute bottom-3 left-3 right-3 px-3 py-2 rounded-xl bg-slate-900/80 backdrop-blur-xs border border-white/10 text-xs text-white flex flex-wrap items-center justify-between gap-2">
                <span>
                  Biểu cảm:{" "}
                  <strong className="text-emerald-300">
                    {emotionLabelVi(liveFrameAnalysis.dominant_emotion)} ({liveFrameAnalysis.dominant_score}%)
                  </strong>
                </span>
                <span>
                  Điềm tĩnh:{" "}
                  <strong className="text-amber-300">{liveFrameAnalysis.composure_instant}%</strong>
                </span>
              </div>
            ) : liveFrameAnalysis && !liveFrameAnalysis.face_detected ? (
              <div
                role="status"
                className="absolute bottom-3 left-3 right-3 px-3 py-1.5 rounded-xl bg-amber-950/90 border border-amber-400/50 backdrop-blur-xs text-[11px] font-medium text-amber-200 text-center"
              >
                Không nhận diện được khuôn mặt — vui lòng di chuyển vào giữa khung hình.
              </div>
            ) : (
              <div className="absolute bottom-3 left-3 right-3 px-3 py-1.5 rounded-xl bg-slate-900/75 backdrop-blur-xs text-[11px] text-slate-300 text-center">
                Hãy nhìn thẳng vào camera và trình bày lập luận rõ ràng...
              </div>
            )}
          </>
        )}

        {/* Audio-only Recording State */}
        {isRecording && !hasActiveCamera && !isAnalyzingMultimodal && (
          <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-rose-500/15 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <Mic size={28} className="animate-pulse" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-white">Đang thu âm qua Microphone</p>
              <p className="text-xs text-slate-400 max-w-xs">
                Không phát hiện camera hoặc camera đang tắt. Giọng nói của bạn vẫn được chuyển thành văn bản trực tiếp.
              </p>
            </div>
          </div>
        )}

        {/* Analyzing Multimodal State */}
        {isAnalyzingMultimodal && (
          <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
            <Loader2 size={32} className="animate-spin text-emerald-400" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-white">Đang phân tích giọng nói & biểu cảm</p>
              <p className="text-xs text-slate-400">Hoàn tất sẽ tự động gửi lượt nói của bạn...</p>
            </div>
          </div>
        )}

        {/* Idle Camera Placeholder */}
        {!isRecording && !isAnalyzingMultimodal && (
          <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
              {canStartRecording ? <Camera size={26} className="text-emerald-400" /> : <MicOff size={24} />}
            </div>
            <div className="space-y-1 max-w-xs">
              <p className="text-sm font-bold text-slate-100">
                {isDebateCompleted
                  ? "Phiên tranh biện đã hoàn thành"
                  : isTurnExpired
                    ? "Đã hết thời gian lượt nói"
                    : isAiGenerating
                      ? "Đối thủ AI đang phản hồi..."
                      : "Camera đang ở chế độ chờ"}
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                {canStartRecording
                  ? "Bấm nút Bắt đầu nói bên dưới hoặc nút Micro ở khung chat để bật camera và thu âm."
                  : "Camera sẽ tự bật khi bạn bắt đầu ghi âm ở lượt phát biểu của mình."}
              </p>
            </div>
            {canStartRecording && (
              <button
                type="button"
                onClick={onToggleRecording}
                className="mt-1 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#008A64] hover:bg-[#007457] text-white text-xs font-bold shadow-md shadow-emerald-950/40 transition-colors cursor-pointer"
              >
                <Mic size={14} />
                <span>Bắt đầu nói (Bật Camera)</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Live STT & Mic Meter Card */}
      {isRecording && (
        <div className="rounded-xl bg-slate-900 text-slate-200 border border-slate-800 p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-emerald-400 font-semibold">
              {liveSttStatus === "connecting" ? "Đang kết nối STT..." : "Live STT:"}
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400" title={micLabel || "Microphone"}>
              <span>Mic</span>
              <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-75"
                  style={{ width: `${Math.min(100, Math.max(0, micLevel))}%` }}
                />
              </div>
            </div>
          </div>
          <p className="text-xs leading-relaxed min-h-[20px]">
            {liveInterimTranscript ? (
              <span className="italic text-slate-200">{liveInterimTranscript}</span>
            ) : (
              <span className="text-slate-400">
                {micLevel > 2
                  ? "Đang nhận tín hiệu giọng nói..."
                  : `Đang lắng nghe (${micLabel || "Mic mặc định"})...`}
              </span>
            )}
          </p>
        </div>
      )}
    </aside>
  );
};

export default AiCameraPanel;


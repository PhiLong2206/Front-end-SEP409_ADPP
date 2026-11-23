import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, CameraOff, Check, Circle, Loader2, Mic, MicOff, RefreshCw } from "lucide-react";
import type { DevicePhase } from "../../../pages/debater/DebatePractice/useSharedDeviceStream";

export type RoomItemState = "waiting" | "loading" | "done" | "error";

interface RoomLoadingPanelProps {
  phase: DevicePhase;
  stream: MediaStream | null;
  hasVideo: boolean;
  micError: string | null;
  cameraError: string | null;
  softTimedOut: boolean;
  onRetryDevices: () => void;
  onContinueWithoutMic: () => void;
  /** The AI opponent planning its case */
  opponentState: RoomItemState;
  /** The AI writing its opening (only when the AI speaks first); null: not part of this room */
  openingState: RoomItemState | null;
  onRetryOpponent: () => void;
}

/** Level 0-100 of the microphone track of `stream`, refreshed while mounted. */
function useMicLevel(stream: MediaStream | null): number {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) return;
    const Ctor =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    let ctx: AudioContext | null = null;
    let timer: number | undefined;
    try {
      ctx = new Ctor();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(new MediaStream(stream.getAudioTracks())).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      timer = window.setInterval(() => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        setLevel(Math.min(100, Math.round(Math.sqrt(sum / data.length) * 350)));
      }, 100);
    } catch {
      // No meter: the device still works
    }
    return () => {
      if (timer) window.clearInterval(timer);
      void ctx?.close().catch(() => {});
    };
  }, [stream]);
  return level;
}

const StateIcon: React.FC<{ state: RoomItemState | "warn" }> = ({ state }) => {
  if (state === "loading") return <Loader2 size={15} className="animate-spin text-[#008A64]" aria-hidden="true" />;
  if (state === "done") return <Check size={15} className="text-[#008A64]" aria-hidden="true" />;
  if (state === "error") return <AlertTriangle size={15} className="text-rose-600" aria-hidden="true" />;
  if (state === "warn") return <AlertTriangle size={15} className="text-amber-600" aria-hidden="true" />;
  return <Circle size={15} className="text-slate-400" aria-hidden="true" />;
};

const RetryButton: React.FC<{ testId: string; onClick: () => void }> = ({ testId, onClick }) => (
  <button
    type="button"
    data-testid={testId}
    onClick={onClick}
    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-[#008A64] hover:bg-[#007556] focus:outline-none focus:ring-2 focus:ring-[#008A64]/40"
  >
    <RefreshCw size={12} aria-hidden="true" />
    Thử lại
  </button>
);

/**
 * The one screen before an AI practice starts: a checklist of everything the room needs (microphone, camera, the AI
 * opponent's plan and, when the AI speaks first, its opening). The debate starts when all of it is ready.
 */
const RoomLoadingPanel: React.FC<RoomLoadingPanelProps> = ({
  phase,
  stream,
  hasVideo,
  micError,
  cameraError,
  softTimedOut,
  onRetryDevices,
  onContinueWithoutMic,
  opponentState,
  openingState,
  onRetryOpponent,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const level = useMicLevel(stream);

  useEffect(() => {
    const el = videoRef.current;
    if (el && stream && hasVideo) {
      el.srcObject = stream;
      void el.play?.().catch(() => {});
    }
  }, [stream, hasVideo]);

  const connecting = phase === "connecting";
  const micState: RoomItemState = connecting ? "loading" : phase === "failed" ? "error" : "done";
  // The camera is optional: not working is a warning, never a blocker
  const cameraState: RoomItemState | "warn" = connecting ? "loading" : hasVideo ? "done" : "warn";
  const micMissing = phase === "skipped";

  const states: RoomItemState[] = [micState, connecting ? "loading" : "done", opponentState];
  if (openingState) states.push(openingState);
  const done = states.filter((s) => s === "done").length;
  const percent = Math.round((done / states.length) * 100);
  const showDeviceActions = phase === "failed" || (connecting && softTimedOut);

  return (
    <section
      data-testid="room-loading-panel"
      aria-label="Đang chuẩn bị phòng"
      className="mx-4 mt-3 rounded-2xl border border-[#008A64]/30 bg-[#ECFDF5] dark:bg-emerald-950/30 dark:border-emerald-700/40 px-5 py-4 text-slate-800 dark:text-slate-100 shadow-xs"
    >
      <div className="flex flex-col sm:flex-row gap-4">
        {hasVideo && stream && (
          <video
            ref={videoRef}
            data-testid="device-camera-preview"
            muted
            playsInline
            className="w-40 h-30 rounded-xl bg-black object-cover shrink-0"
          />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <p role="status" data-testid="room-loading-title" className="text-sm font-bold text-[#008A64] dark:text-emerald-400">
            Đang chuẩn bị phòng
          </p>
          <div
            role="progressbar"
            aria-label="Tiến độ chuẩn bị phòng"
            aria-valuemin={0}
            aria-valuemax={states.length}
            aria-valuenow={done}
            data-testid="room-loading-progress"
            className="h-1.5 w-full rounded-full bg-white/70 dark:bg-slate-700 overflow-hidden"
          >
            <div className="h-full bg-[#008A64] transition-[width]" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400" data-testid="room-loading-count">
            {done}/{states.length} mục đã xong
          </p>

          <ul className="space-y-1.5 pt-1">
            <li data-testid="room-item-mic" data-state={micState} className="flex items-start gap-2 text-xs">
              <StateIcon state={micState} />
              <div className="min-w-0">
                <p data-testid="device-mic-status" className="flex items-center gap-1.5">
                  {phase === "failed" ? <MicOff size={13} aria-hidden="true" /> : <Mic size={13} aria-hidden="true" />}
                  <span>
                    Micro: {phase === "failed" ? "không dùng được" : connecting ? "đang kết nối…" : micMissing ? "bỏ qua" : "sẵn sàng"}
                  </span>
                </p>
                {!connecting && phase !== "failed" && !micMissing && (
                  <div
                    role="meter"
                    aria-label="Mức âm micro"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={level}
                    data-testid="device-mic-level"
                    className="mt-1 h-1.5 w-40 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"
                  >
                    <div className="h-full bg-[#008A64] transition-[width]" style={{ width: `${level}%` }} />
                  </div>
                )}
                {phase === "failed" && micError && (
                  <p data-testid="device-error" role="alert" className="mt-1 text-rose-600 dark:text-rose-400">
                    {micError}
                  </p>
                )}
                {connecting && softTimedOut && (
                  <p className="mt-1 text-slate-600 dark:text-slate-300">
                    Trình duyệt chưa trả lời. Hãy cho phép dùng micro, hoặc tiếp tục mà không dùng micro.
                  </p>
                )}
                {showDeviceActions && (
                  <div className="flex flex-wrap gap-2 pt-1.5">
                    <RetryButton testId="device-retry-btn" onClick={onRetryDevices} />
                    <button
                      type="button"
                      data-testid="device-continue-without-mic-btn"
                      onClick={onContinueWithoutMic}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-white/60 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#008A64]/30"
                    >
                      Tiếp tục không dùng micro
                    </button>
                  </div>
                )}
              </div>
            </li>

            <li data-testid="room-item-camera" data-state={cameraState} className="flex items-start gap-2 text-xs">
              <StateIcon state={cameraState} />
              <div className="min-w-0">
                <p data-testid="device-camera-status" className="flex items-center gap-1.5">
                  {hasVideo ? <Camera size={13} aria-hidden="true" /> : <CameraOff size={13} aria-hidden="true" />}
                  <span>Camera: {hasVideo ? "sẵn sàng" : connecting ? "đang kết nối…" : "không dùng được (không bắt buộc)"}</span>
                </p>
                {cameraError && !hasVideo && !connecting && (
                  <p className="mt-1 text-amber-700 dark:text-amber-400">{cameraError}</p>
                )}
              </div>
            </li>

            <li data-testid="room-item-opponent" data-state={opponentState} className="flex items-start gap-2 text-xs">
              <StateIcon state={opponentState} />
              <div className="min-w-0">
                <p>
                  Đối thủ AI lập kế hoạch:{" "}
                  {opponentState === "done"
                    ? "xong"
                    : opponentState === "error"
                    ? "chưa lập được"
                    : opponentState === "loading"
                    ? "đang lập…"
                    : "đang chờ"}
                </p>
                {opponentState === "error" && (
                  <div className="pt-1.5">
                    <RetryButton testId="opponent-retry-btn" onClick={onRetryOpponent} />
                  </div>
                )}
              </div>
            </li>

            {openingState && (
              <li data-testid="room-item-opening" data-state={openingState} className="flex items-start gap-2 text-xs">
                <StateIcon state={openingState} />
                <div className="min-w-0">
                  <p>
                    AI soạn bài Mở đầu:{" "}
                    {openingState === "done"
                      ? "xong"
                      : openingState === "error"
                      ? "chưa soạn được"
                      : openingState === "loading"
                      ? "đang soạn…"
                      : "đang chờ"}
                  </p>
                  {openingState === "error" && (
                    <div className="pt-1.5">
                      <RetryButton testId="opening-retry-btn" onClick={onRetryOpponent} />
                    </div>
                  )}
                </div>
              </li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default RoomLoadingPanel;

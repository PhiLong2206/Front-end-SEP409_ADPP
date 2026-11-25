import React, { useEffect, useState } from "react";
import { Headphones, Loader2, Mic, MicOff, PhoneCall, RefreshCw, Volume2 } from "lucide-react";
import type { TeamCallStatus } from "../../../pages/debater/DebatePractice/useTeamCall";

interface TeamCallPanelProps {
  teammateName: string;
  status: TeamCallStatus;
  muted: boolean;
  audioBlocked: boolean;
  remoteStream: MediaStream | null;
  onToggleMute: () => void;
  onRetry: () => void;
  onEnableAudio: () => void;
}

/** True while the teammate's voice is loud enough (an AnalyserNode on the remote stream). Silent where there is no AudioContext. */
function useRemoteSpeaking(stream: MediaStream | null): boolean {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    setSpeaking(false);
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
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      timer = window.setInterval(() => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        setSpeaking(Math.sqrt(sum / data.length) > 0.02);
      }, 150);
    } catch {
      // No indicator: the call itself still works
    }
    return () => {
      if (timer) window.clearInterval(timer);
      void ctx?.close().catch(() => {});
    };
  }, [stream]);
  return speaking;
}

const STATUS_TEXT: Record<TeamCallStatus, string> = {
  idle: "",
  connecting: "Đang kết nối",
  connected: "Đã nối",
  failed: "Không nối được",
};

/** The voice call with the teammate, shown during the preparation minute. A failure here never blocks the preparing. */
const TeamCallPanel: React.FC<TeamCallPanelProps> = ({
  teammateName,
  status,
  muted,
  audioBlocked,
  remoteStream,
  onToggleMute,
  onRetry,
  onEnableAudio,
}) => {
  const speaking = useRemoteSpeaking(remoteStream);

  return (
    <section
      data-testid="team-call-panel"
      aria-label="Gọi tiếng với đồng đội"
      className="mx-4 mt-3 rounded-2xl border border-blue-200/80 dark:border-blue-800/50 bg-blue-50/70 dark:bg-blue-950/20 px-4 py-3 text-slate-800 dark:text-slate-100"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-bold flex items-center gap-1.5">
            <PhoneCall size={14} aria-hidden="true" />
            <span>Đang gọi đồng đội{teammateName ? ` ${teammateName}` : ""}</span>
          </p>
          <p
            role="status"
            aria-live="polite"
            data-testid="team-call-status"
            data-status={status}
            className={`text-xs font-semibold flex items-center gap-1.5 ${
              status === "failed" ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-300"
            }`}
          >
            {status === "connecting" && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
            <span>{STATUS_TEXT[status]}</span>
            {status === "connected" && speaking && (
              <span data-testid="team-call-speaking" className="inline-flex items-center gap-1 text-[#008A64] dark:text-emerald-400">
                <Volume2 size={12} aria-hidden="true" />
                {teammateName || "Đồng đội"} đang nói
              </span>
            )}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Headphones size={11} aria-hidden="true" />
            Nên đeo tai nghe để không bị vọng tiếng.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {audioBlocked && (
            <button
              type="button"
              data-testid="team-call-enable-audio-btn"
              onClick={onEnableAudio}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#008A64] hover:bg-[#007457] focus:outline-none focus:ring-2 focus:ring-[#008A64]/40"
            >
              <Volume2 size={13} aria-hidden="true" />
              Bật âm thanh
            </button>
          )}
          {status === "failed" ? (
            <button
              type="button"
              data-testid="team-call-retry-btn"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#008A64] hover:bg-[#007457] focus:outline-none focus:ring-2 focus:ring-[#008A64]/40"
            >
              <RefreshCw size={13} aria-hidden="true" />
              Thử lại
            </button>
          ) : (
            <button
              type="button"
              data-testid="team-call-mute-btn"
              aria-pressed={muted}
              onClick={onToggleMute}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-white/60 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#008A64]/30"
            >
              {muted ? <MicOff size={13} aria-hidden="true" /> : <Mic size={13} aria-hidden="true" />}
              {muted ? "Bật mic" : "Tắt mic"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

export default TeamCallPanel;

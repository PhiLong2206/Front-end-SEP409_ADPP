import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, CheckCircle2, Mic, MicOff, RefreshCw, TriangleAlert } from "lucide-react";
import {
  cameraConstraints,
  mediaErrorMessage,
  micConstraints,
  readStoredMediaChoice,
  storeMediaChoice,
  type StoredMediaChoice,
} from "../../services/mediaDevices";

/** Level (0..1) above which the learner's voice counts as heard. */
const HEARD_LEVEL = 0.08;

type DeviceState = "idle" | "starting" | "ready" | "error" | "off";

export interface DeviceCheckProps {
  /** The learner enters the room with these devices (already remembered in the browser). */
  onJoin: (choice: StoredMediaChoice) => void;
  /** Back to the previous page without entering. */
  onCancel?: () => void;
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

/**
 * Pre-join check, like the green room of a video call: camera preview, a live microphone level, device pickers and a
 * camera on / off switch. Nothing here blocks entering: without a microphone the learner can still type the speech.
 * Every stream opened here is stopped when the check closes; the room opens its own when recording starts.
 */
const DeviceCheck: React.FC<DeviceCheckProps> = ({ onJoin, onCancel }) => {
  const stored = useRef(readStoredMediaChoice()).current;
  const supported = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  const [micId, setMicId] = useState<string | null>(stored.micDeviceId);
  const [camId, setCamId] = useState<string | null>(stored.cameraDeviceId);
  const [cameraEnabled, setCameraEnabled] = useState(stored.cameraEnabled);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [micState, setMicState] = useState<DeviceState>(supported ? "idle" : "error");
  const [camState, setCamState] = useState<DeviceState>(supported ? "idle" : "error");
  const [micError, setMicError] = useState<string | null>(supported ? null : "Trình duyệt này không hỗ trợ micro.");
  const [camError, setCamError] = useState<string | null>(supported ? null : "Trình duyệt này không hỗ trợ camera.");
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState(false);
  // No Web Audio: the microphone opened but its level cannot be shown
  const [noMeter, setNoMeter] = useState(false);
  const [retry, setRetry] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setMics(all.filter((d) => d.kind === "audioinput"));
      setCams(all.filter((d) => d.kind === "videoinput"));
    } catch {
      /* the pickers stay empty: the default devices are used */
    }
  }, []);

  // Microphone: open it and measure its level
  useEffect(() => {
    if (!supported) return;
    let alive = true;
    let ctx: AudioContext | null = null;
    let raf = 0;
    setMicState("starting");
    setMicError(null);
    setHeard(false);
    setNoMeter(false);
    setLevel(0);
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: micConstraints(micId) });
        if (!alive) return stopStream(stream);
        micStreamRef.current = stream;
        setMicState("ready");
        void refreshDevices();
        const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) {
          setNoMeter(true);
          return;
        }
        ctx = new AudioCtx();
        // Chrome may create it suspended (no user gesture yet): the level would stay at 0
        void ctx.resume?.().catch(() => {});
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (const v of data) sum += ((v - 128) / 128) ** 2;
          const rms = Math.min(1, Math.sqrt(sum / data.length) * 3);
          setLevel(rms);
          if (rms > HEARD_LEVEL) setHeard(true);
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch (err) {
        if (!alive) return;
        setMicState("error");
        setMicError(mediaErrorMessage(err, "mic"));
      }
    })();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      void ctx?.close().catch(() => {});
      stopStream(micStreamRef.current);
      micStreamRef.current = null;
    };
  }, [micId, supported, retry, refreshDevices]);

  // Camera: preview it (or nothing when switched off)
  useEffect(() => {
    if (!supported) return;
    if (!cameraEnabled) {
      setCamState("off");
      setCamError(null);
      return;
    }
    let alive = true;
    setCamState("starting");
    setCamError(null);
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: cameraConstraints(camId, false) });
        if (!alive) return stopStream(stream);
        camStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play?.()?.catch?.(() => {});
        }
        setCamState("ready");
        void refreshDevices();
      } catch (err) {
        if (!alive) return;
        setCamState("error");
        setCamError(mediaErrorMessage(err, "camera"));
      }
    })();
    return () => {
      alive = false;
      stopStream(camStreamRef.current);
      camStreamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [camId, cameraEnabled, supported, retry, refreshDevices]);

  // A device plugged in or out while the check is open
  useEffect(() => {
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return;
    md.addEventListener("devicechange", refreshDevices);
    return () => md.removeEventListener("devicechange", refreshDevices);
  }, [refreshDevices]);

  const join = () => {
    // The camera switch is remembered as the learner set it; a camera that failed here makes the room fall back to
    // recording the voice only, as it already does
    const choice: StoredMediaChoice = { micDeviceId: micId, cameraDeviceId: camId, cameraEnabled };
    storeMediaChoice(choice);
    onJoin(choice);
  };

  const selectClass =
    "w-full text-sm rounded-xl border border-slate-200 dark:border-[rgba(148,163,184,0.20)] bg-white dark:bg-[#060d1a] text-slate-700 dark:text-[#CBD5E1] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/30";
  const hasError = micState === "error" || camState === "error";
  const bars = 12;

  return (
    <div data-testid="device-check" className="min-h-[70vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-4xl grid gap-6 md:grid-cols-[1.4fr_1fr] items-center">
        {/* Preview */}
        <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-900 shadow-lg">
          <video
            ref={videoRef}
            data-testid="device-check-video"
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-cover -scale-x-100 ${camState === "ready" ? "" : "hidden"}`}
          />
          {camState !== "ready" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-300 text-sm px-6 text-center">
              {camState === "starting" ? (
                <span>Đang mở camera...</span>
              ) : camState === "off" ? (
                <>
                  <CameraOff size={32} aria-hidden="true" />
                  <span>Camera đang tắt</span>
                </>
              ) : (
                <>
                  <CameraOff size={32} aria-hidden="true" />
                  <span>{camError}</span>
                </>
              )}
            </div>
          )}

          {/* Mic level + toggles, over the preview like a video call */}
          <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-3">
            <div
              className="flex items-end gap-0.5 h-6 px-2 py-1 rounded-full bg-black/50"
              role="meter"
              aria-label="Mức âm lượng micro"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(level * 100)}
              data-testid="device-check-level"
            >
              {Array.from({ length: bars }, (_, i) => (
                <span
                  key={i}
                  className={`w-1 rounded-full transition-all ${level * bars > i ? "bg-blue-400" : "bg-white/30"}`}
                  style={{ height: `${30 + (i / bars) * 70}%` }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setCameraEnabled((v) => !v)}
              aria-pressed={cameraEnabled}
              aria-label={cameraEnabled ? "Tắt camera" : "Bật camera"}
              data-testid="device-check-camera-toggle"
              className={`w-11 h-11 rounded-full flex items-center justify-center text-white focus:outline-none focus:ring-2 focus:ring-white/60 ${
                cameraEnabled ? "bg-white/20 hover:bg-white/30" : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {cameraEnabled ? <Camera size={20} /> : <CameraOff size={20} />}
            </button>
          </div>
        </div>

        {/* Status, pickers, join */}
        <div className="space-y-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-[#F8FAFC]">Kiểm tra micro và camera</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Camera dùng để phân tích biểu cảm, micro dùng để chuyển giọng nói thành chữ và chấm phong thái.
            </p>
          </div>

          <div className="space-y-2 text-sm" aria-live="polite">
            <div className="flex items-start gap-2" data-testid="device-check-mic-status">
              {micState === "error" ? (
                <MicOff size={18} className="text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
              ) : heard ? (
                <CheckCircle2 size={18} className="text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
              ) : (
                <Mic size={18} className="text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <span className={micState === "error" ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-300"}>
                {micState === "error"
                  ? micError
                  : micState !== "ready"
                    ? "Đang mở micro..."
                    : noMeter
                      ? "Micro đã mở (trình duyệt không hiển thị được mức âm lượng)."
                      : heard
                        ? "Micro hoạt động tốt."
                      : "Hãy nói thử một câu: thanh âm lượng phải nhảy lên."}
              </span>
            </div>
            <div className="flex items-start gap-2" data-testid="device-check-camera-status">
              {camState === "error" ? (
                <TriangleAlert size={18} className="text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
              ) : camState === "ready" ? (
                <CheckCircle2 size={18} className="text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
              ) : (
                <Camera size={18} className="text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <span className="text-slate-700 dark:text-slate-300">
                {camState === "error"
                  ? "Không có camera: vẫn vào phòng được, chỉ không chấm biểu cảm."
                  : camState === "ready"
                    ? "Camera hoạt động tốt."
                    : camState === "off"
                      ? "Camera tắt: trong phòng chỉ ghi âm, không chấm biểu cảm."
                      : "Đang mở camera..."}
              </span>
            </div>
          </div>

          {mics.length > 0 && (
            <div>
              <label htmlFor="device-check-mic" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Micro
              </label>
              <select
                id="device-check-mic"
                data-testid="device-check-mic-select"
                value={micId ?? ""}
                onChange={(e) => setMicId(e.target.value || null)}
                className={selectClass}
              >
                <option value="">Mặc định của hệ thống</option>
                {mics.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Micro ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}
          {cams.length > 0 && (
            <div>
              <label htmlFor="device-check-cam" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Camera
              </label>
              <select
                id="device-check-cam"
                data-testid="device-check-camera-select"
                value={camId ?? ""}
                onChange={(e) => setCamId(e.target.value || null)}
                disabled={!cameraEnabled}
                className={`${selectClass} disabled:opacity-50`}
              >
                <option value="">Mặc định của hệ thống</option>
                {cams.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {micState === "error" && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Không có micro bạn vẫn có thể vào phòng và gõ lập luận bằng bàn phím.
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={join}
              data-testid="device-check-join"
              className="px-6 py-2.5 rounded-full bg-[#0B5ED7] hover:bg-[#0a4fb4] text-white font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/40"
            >
              Vào phòng
            </button>
            {hasError && supported && (
              <button
                type="button"
                onClick={() => setRetry((n) => n + 1)}
                data-testid="device-check-retry"
                className="px-4 py-2.5 rounded-full border border-slate-200 dark:border-[rgba(148,163,184,0.20)] text-sm font-semibold text-slate-700 dark:text-[#CBD5E1] hover:bg-slate-100 dark:hover:bg-[#0C1627] inline-flex items-center gap-1.5"
              >
                <RefreshCw size={14} aria-hidden="true" /> Thử lại
              </button>
            )}
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2.5 rounded-full text-sm font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Quay lại
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeviceCheck;

export type RealtimeSttStatus = "idle" | "connecting" | "connected" | "closed" | "error";

export interface RealtimeSttTranscriptPayload {
  transcript: string;
  isFinal: boolean;
  speechFinal: boolean;
  fromFinalize: boolean;
}

export interface RealtimeSttConfigResponse {
  configured: boolean;
  preset_name: string;
  defaults: {
    transport: string;
    encoding: string;
    webrtc_filter: string;
    endpointing: number;
    smart_format: boolean;
    punctuate: boolean;
    model: string;
    language: string;
    sample_rate: number;
    utterance_end_ms: number;
  };
}

/**
 * Raw Voice WebRTC audio constraints (Preset Chuan Deepgram Web):
 * disables browser echoCancellation/noiseSuppression/AGC to preserve Vietnamese tones.
 */
export const RAW_VOICE_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};

export function pickSupportedAudioMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return undefined;
  }
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime));
}

export async function fetchRealtimeSttConfig(): Promise<RealtimeSttConfigResponse | null> {
  try {
    const res = await fetch("/api/multimodal/realtime-stt/config");
    if (!res.ok) return null;
    return (await res.json()) as RealtimeSttConfigResponse;
  } catch {
    return null;
  }
}

export interface RealtimeSttCallbacks {
  onStatusChange?: (status: RealtimeSttStatus) => void;
  onTranscript?: (payload: RealtimeSttTranscriptPayload) => void;
  onError?: (code: string, message: string) => void;
}

export class RealtimeSttClient {
  private ws: WebSocket | null = null;
  private isStopping = false;
  private latestInterim = "";
  private pendingChunks: ArrayBuffer[] = [];
  private closeResolve: (() => void) | null = null;
  private callbacks: RealtimeSttCallbacks;

  constructor(callbacks: RealtimeSttCallbacks) {
    this.callbacks = callbacks;
  }

  public connect(params?: {
    model?: "nova-2" | "nova-3";
    mode?: "vi" | "multi";
    endpointing?: number;
    smartFormat?: boolean;
  }): void {
    this.disconnectImmediate();
    this.isStopping = false;
    this.latestInterim = "";
    this.pendingChunks = [];

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const query = new URLSearchParams({
      model: params?.model ?? "nova-2",
      mode: params?.mode ?? "vi",
      endpointing: String(params?.endpointing ?? 300),
      smart_format: String(params?.smartFormat ?? false),
      punctuate: "true",
      encoding: "webm",
    });

    const wsUrl = `${protocol}//${window.location.host}/api/multimodal/ws/transcribe?${query.toString()}`;
    this.callbacks.onStatusChange?.("connecting");

    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    ws.onopen = () => {
      if (this.pendingChunks.length > 0 && !this.isStopping) {
        for (const chunk of this.pendingChunks) {
          ws.send(chunk);
        }
        this.pendingChunks = [];
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data));
        if (msg.type === "dg_status") {
          if (msg.status === "connecting") {
            this.callbacks.onStatusChange?.("connecting");
          } else if (msg.status === "connected") {
            this.callbacks.onStatusChange?.("connected");
          } else if (msg.status === "closed") {
            if (this.latestInterim.trim()) {
              this.callbacks.onTranscript?.({
                transcript: this.latestInterim.trim(),
                isFinal: true,
                speechFinal: true,
                fromFinalize: true,
              });
              this.latestInterim = "";
            }
            this.callbacks.onStatusChange?.("closed");
            this.resolveCloseWaiter();
          }
        } else if (msg.type === "transcript") {
          const text = String(msg.transcript || "");
          const isFinal = Boolean(msg.is_final);
          if (isFinal) {
            this.latestInterim = "";
          } else {
            this.latestInterim = text;
          }
          this.callbacks.onTranscript?.({
            transcript: text,
            isFinal,
            speechFinal: Boolean(msg.speech_final),
            fromFinalize: Boolean(msg.from_finalize),
          });
        } else if (msg.type === "error") {
          this.callbacks.onStatusChange?.("error");
          this.callbacks.onError?.(String(msg.code || "STT_ERROR"), String(msg.message || "Lỗi nhận diện giọng nói"));
          this.resolveCloseWaiter();
        }
      } catch {
        // Ignore malformed payloads
      }
    };

    ws.onerror = () => {
      this.callbacks.onStatusChange?.("error");
      this.resolveCloseWaiter();
    };

    ws.onclose = () => {
      this.resolveCloseWaiter();
    };
  }

  public sendAudioChunk(buffer: ArrayBuffer): void {
    if (!this.ws || this.isStopping) return;
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(buffer);
    } else if (this.ws.readyState === WebSocket.CONNECTING && this.pendingChunks.length < 100) {
      // Preserve initial WebM EBML header chunks while WebSocket handshake completes
      this.pendingChunks.push(buffer);
    }
  }

  public async stopAndFinalize(timeoutMs = 2200): Promise<void> {
    if (!this.ws) return;
    this.isStopping = true;

    if (this.ws.readyState === WebSocket.OPEN) {
      await new Promise<void>((resolve) => {
        this.closeResolve = resolve;
        const timer = window.setTimeout(() => {
          this.resolveCloseWaiter();
        }, timeoutMs);

        const origResolve = this.closeResolve;
        this.closeResolve = () => {
          window.clearTimeout(timer);
          origResolve?.();
        };

        try {
          this.ws?.send(JSON.stringify({ type: "stop" }));
        } catch {
          this.resolveCloseWaiter();
        }
      });
    }

    this.disconnectImmediate();
  }

  public disconnectImmediate(): void {
    this.pendingChunks = [];
    this.resolveCloseWaiter();
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close();
        }
      } catch {
        // Ignore close errors
      }
      this.ws = null;
    }
  }

  private resolveCloseWaiter(): void {
    if (this.closeResolve) {
      const fn = this.closeResolve;
      this.closeResolve = null;
      fn();
    }
  }
}


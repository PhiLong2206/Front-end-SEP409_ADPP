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
  private isClosed = false;
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
    this.isClosed = false;
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
            this.flushInterim();
            this.isClosed = true;
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
      // A socket we already replaced or closed on purpose must not mark the new recording as failed
      if (this.ws !== ws) return;
      this.callbacks.onStatusChange?.("error");
      this.resolveCloseWaiter();
    };

    ws.onclose = () => {
      // Closed without the server's "closed" status (network drop, server crash): the text may be partial
      if (!this.isClosed && this.ws === ws) {
        this.callbacks.onStatusChange?.("error");
      }
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

    // Timed out before the server's "closed": keep the last interim words rather than drop them
    this.flushInterim();
    this.isClosed = true;
    this.disconnectImmediate();
  }

  public disconnectImmediate(): void {
    this.pendingChunks = [];
    this.resolveCloseWaiter();
    const ws = this.ws;
    // Cleared before close(): a close we asked for is not reported as an error by onclose
    this.ws = null;
    if (ws) {
      try {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      } catch {
        // Ignore close errors
      }
    }
  }

  private flushInterim(): void {
    const text = this.latestInterim.trim();
    this.latestInterim = "";
    if (text) {
      this.callbacks.onTranscript?.({ transcript: text, isFinal: true, speechFinal: true, fromFinalize: true });
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

/**
 * What /multimodal/analyze-turn needs at the end of a recording.
 * When the live STT already gave the spoken text, the audio is not sent: the service then skips the
 * Whisper pass (about 0.4x the speech length on CPU) and computes pace / fillers from that text.
 * Without live text (no Deepgram key, network error), the audio goes to Whisper as before.
 */
export async function resolveTurnSpeechInput(
  liveSpokenText: string,
  readAudioBase64: () => Promise<string>
): Promise<{ audioBase64: string | null; spokenText: string | null }> {
  const spokenText = liveSpokenText.trim();
  if (spokenText) return { audioBase64: null, spokenText };
  return { audioBase64: await readAudioBase64(), spokenText: null };
}

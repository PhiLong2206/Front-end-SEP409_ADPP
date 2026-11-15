import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  RAW_VOICE_AUDIO_CONSTRAINTS,
  RealtimeSttClient,
  RealtimeSttStatus,
} from "../services/realtimeStt";

class MockWebSocket {
  public static OPEN = 1;
  public static CONNECTING = 0;
  public static instances: MockWebSocket[] = [];

  public url: string;
  public binaryType = "blob";
  public readyState = MockWebSocket.OPEN;
  public sent: Array<string | ArrayBuffer> = [];
  public onmessage: ((ev: { data: string }) => void) | null = null;
  public onerror: (() => void) | null = null;
  public onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  public send(data: string | ArrayBuffer): void {
    this.sent.push(data);
  }

  public close(): void {
    this.readyState = 3;
    this.onclose?.();
  }
}

describe("RealtimeSttClient (Preset Chuan Deepgram Web)", () => {
  const OriginalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    (globalThis as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = OriginalWebSocket;
  });

  it("uses Raw Voice audio constraints (echoCancellation/noiseSuppression/autoGainControl = false)", () => {
    expect(RAW_VOICE_AUDIO_CONSTRAINTS).toEqual({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    });
  });

  it("connects with Preset Chuan Deepgram Web params and handles interim + final + stop", async () => {
    const statuses: RealtimeSttStatus[] = [];
    const transcripts: Array<{ text: string; isFinal: boolean }> = [];

    const client = new RealtimeSttClient({
      onStatusChange: (s) => statuses.push(s),
      onTranscript: (p) => transcripts.push({ text: p.transcript, isFinal: p.isFinal }),
    });

    client.connect();
    expect(MockWebSocket.instances).toHaveLength(1);
    const ws = MockWebSocket.instances[0];
    expect(ws.url).toContain("/api/multimodal/ws/transcribe?");
    expect(ws.url).toContain("model=nova-2");
    expect(ws.url).toContain("mode=vi");
    expect(ws.url).toContain("endpointing=300");
    expect(ws.url).toContain("smart_format=false");
    expect(ws.url).toContain("encoding=webm");

    ws.onmessage?.({ data: JSON.stringify({ type: "dg_status", status: "connected" }) });
    ws.onmessage?.({
      data: JSON.stringify({
        type: "transcript",
        transcript: "Xin chào",
        is_final: false,
        speech_final: false,
      }),
    });
    ws.onmessage?.({
      data: JSON.stringify({
        type: "transcript",
        transcript: "Xin chào ban giám khảo.",
        is_final: true,
        speech_final: true,
      }),
    });

    expect(statuses).toEqual(["connecting", "connected"]);
    expect(transcripts).toEqual([
      { text: "Xin chào", isFinal: false },
      { text: "Xin chào ban giám khảo.", isFinal: true },
    ]);

    const stopPromise = client.stopAndFinalize(500);
    expect(ws.sent).toContain(JSON.stringify({ type: "stop" }));
    ws.onmessage?.({ data: JSON.stringify({ type: "dg_status", status: "closed" }) });
    await stopPromise;
    expect(statuses).toContain("closed");
  });
});


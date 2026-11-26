import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  downsampleFloat32ToInt16Pcm,
  float32ToInt16Pcm,
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

  it("supports linear16 PCM query params and converts Float32 samples to Int16 little-endian PCM", () => {
    const client = new RealtimeSttClient({});
    client.connect({ encoding: "linear16", sampleRate: 16000 });
    const ws = MockWebSocket.instances[0];
    expect(ws.url).toContain("encoding=linear16");
    expect(ws.url).toContain("sample_rate=16000");

    const pcm = float32ToInt16Pcm(new Float32Array([-1, 0, 0.5, 1.5]));
    const view = new DataView(pcm);
    expect(pcm.byteLength).toBe(8);
    expect(view.getInt16(0, true)).toBe(-32768);
    expect(view.getInt16(2, true)).toBe(0);
    expect(view.getInt16(4, true)).toBe(16383);
    expect(view.getInt16(6, true)).toBe(32767);

    // Downsampling 48kHz -> 16kHz (3:1) reduces 6 samples to 2 Int16 samples (4 bytes)
    const downsampled = downsampleFloat32ToInt16Pcm(
      new Float32Array([0.5, 0.5, 0.5, -0.5, -0.5, -0.5]),
      48000,
      16000
    );
    expect(downsampled.byteLength).toBe(4);
    const dsView = new DataView(downsampled);
    expect(dsView.getInt16(0, true)).toBe(16383);
    expect(dsView.getInt16(2, true)).toBe(-16384);
  });
});


describe("RealtimeSttClient: no lost words, failures reported", () => {
  const OriginalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    (globalThis as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = OriginalWebSocket;
    vi.useRealTimers();
  });

  const setup = () => {
    const statuses: RealtimeSttStatus[] = [];
    const finals: string[] = [];
    const client = new RealtimeSttClient({
      onStatusChange: (s) => statuses.push(s),
      onTranscript: (p) => {
        if (p.isFinal) finals.push(p.transcript);
      },
    });
    client.connect();
    const ws = MockWebSocket.instances[0];
    ws.onmessage?.({ data: JSON.stringify({ type: "dg_status", status: "connected" }) });
    return { client, ws, statuses, finals };
  };

  it("stop timing out before the server's 'closed' keeps the last interim words as final", async () => {
    vi.useFakeTimers();
    const { client, ws, statuses, finals } = setup();
    ws.onmessage?.({ data: JSON.stringify({ type: "transcript", transcript: "vì vậy chúng tôi", is_final: false }) });

    const stop = client.stopAndFinalize(500);
    await vi.advanceTimersByTimeAsync(600);
    await stop;

    expect(finals).toEqual(["vì vậy chúng tôi"]);
    expect(statuses).not.toContain("error"); // our own close is not a failure
  });

  it("the socket dropping without 'closed' is reported as an error", () => {
    const { ws, statuses } = setup();
    ws.readyState = 3;
    ws.onclose?.();

    expect(statuses).toContain("error");
  });

  it("disconnecting on purpose is not reported as an error", () => {
    const { client, statuses } = setup();
    client.disconnectImmediate();

    expect(statuses).not.toContain("error");
  });
});

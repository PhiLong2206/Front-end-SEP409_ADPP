import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import DebateRoom from "../pages/debater/DebatePractice/DebateRoom";

window.HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { userId: 1, id: 1, fullName: "Debater Test", role: "Debater" },
    isAuthenticated: true,
  }),
}));

const mockCreateOpponentSession = vi.fn();
const mockGetOpponentCasePlan = vi.fn();
const mockGenerateOpponentTurn = vi.fn();
const mockEvaluateSpeechArgument = vi.fn();
const mockAnalyzeTurn = vi.fn();

vi.mock("../api", () => ({
  aiApi: {
    createOpponentSession: (...args: unknown[]) => mockCreateOpponentSession(...args),
    getOpponentCasePlan: (...args: unknown[]) => mockGetOpponentCasePlan(...args),
    generateOpponentTurn: (...args: unknown[]) => mockGenerateOpponentTurn(...args),
    evaluateSpeechArgument: (...args: unknown[]) => mockEvaluateSpeechArgument(...args),
    analyzeTurn: (...args: unknown[]) => mockAnalyzeTurn(...args),
    evaluateSpeechMultimodal: vi.fn(async () => ({ content_evaluation: null })),
    evaluateDebateRound: vi.fn(),
    evaluateDebateSession: vi.fn(),
  },
  debateApi: {
    getSessionDetails: vi.fn(),
    getTranscript: vi.fn(),
    submitArgument: vi.fn(),
  },
}));

/** Browser media, enough for the room's recording path (no camera, microphone only). */
class FakeMediaRecorder {
  static isTypeSupported = () => true;
  mimeType = "audio/webm";
  state = "inactive";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start() {
    this.state = "recording";
    this.ondataavailable?.({ data: new Blob(["audio"], { type: "audio/webm" }) });
  }
  stop() {
    this.state = "inactive";
    this.onstop?.();
  }
}

class FakeWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  readyState = 3;
  binaryType = "arraybuffer";
  onopen: (() => void) | null = null;
  onmessage: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  constructor() {
    setTimeout(() => this.onerror?.(), 0); // no live STT here: the recording goes to Whisper
  }
  send() {}
  close() {}
}

describe("DebateRoom: 'Dừng & Gửi' sends the recorded turn, the AI answers without another click", () => {
  const renderRoom = async () => {
    render(
      <MemoryRouter initialEntries={["/debater/debate/rec-pro?role=PRO"]}>
        <Routes>
          <Route path="/debater/debate/:sessionId" element={<DebateRoom />} />
        </Routes>
      </MemoryRouter>
    );
    await act(async () => {});
  };
  const record = async () => {
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Ghi âm giọng nói & phân tích biểu cảm"));
      await new Promise((r) => setTimeout(r, 0));
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Dừng & Gửi"));
    });
    // analysis -> send -> AI turn: wait until the room is no longer analysing
    await waitFor(() => expect(mockAnalyzeTurn).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText(/xong sẽ tự gửi lượt nói/)).not.toBeInTheDocument());
  };
  const analysis = (transcript: string) => ({
    voice: { transcript_text: transcript, wpm: 130, duration_seconds: 5 },
    facial: {},
    overall_demeanor_score: 72,
    delivery_analytics: null,
  });

  beforeEach(() => {
    sessionStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const track = { label: "Mic", stop: vi.fn() };
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    vi.stubGlobal("MediaStream", class { constructor(public tracks: unknown[]) {} getAudioTracks() { return this.tracks; } });
    vi.stubGlobal("WebSocket", FakeWebSocket);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async (c: { video?: unknown }) => {
          if (c.video) throw new Error("no camera");
          return { getAudioTracks: () => [track], getVideoTracks: () => [], getTracks: () => [track] };
        }),
      },
    });
    mockCreateOpponentSession.mockResolvedValue({ opponent_session_id: "opp-1", status: "ready" });
    mockGetOpponentCasePlan.mockResolvedValue(null);
    mockGenerateOpponentTurn.mockImplementation(async (_id: string, body: { turn_index: number }) => ({
      turn_index: body.turn_index, round_type: "x", mode: "reply", speech_text: `Lượt AI số ${body.turn_index}`,
    }));
    mockEvaluateSpeechArgument.mockResolvedValue({
      overall_score: 8, overall_reasoning: "", criteria: [], strengths: [], weaknesses: [], suggestions: [],
    });
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("the Whisper transcript is sent right after the analysis", async () => {
    mockAnalyzeTurn.mockResolvedValue(analysis("Bài nói từ Whisper."));
    await renderRoom();
    await record();

    expect(mockAnalyzeTurn).toHaveBeenCalledTimes(1);
    expect(mockAnalyzeTurn.mock.calls[0][0].audio_base64).toMatch(/^data:audio\/webm/); // no live text: Whisper
    await waitFor(() => expect(mockGenerateOpponentTurn).toHaveBeenCalledTimes(1)); // no click on "Gửi lập luận"
    expect(mockGenerateOpponentTurn.mock.calls[0][1].new_learner_speeches[0]).toEqual({
      turn_index: 1, round_type: "opening", text: "Bài nói từ Whisper.",
    });
    expect(screen.getByText("Bài nói từ Whisper.")).toBeInTheDocument();
  });

  it("text typed before recording wins over the transcript", async () => {
    mockAnalyzeTurn.mockResolvedValue(analysis("Whisper nghe sai."));
    await renderRoom();
    fireEvent.change(screen.getByLabelText("Lập luận của bạn"), { target: { value: "Mình đã gõ sẵn." } });
    await record();
    await waitFor(() => expect(mockGenerateOpponentTurn).toHaveBeenCalled());
    expect(mockGenerateOpponentTurn.mock.calls[0][1].new_learner_speeches[0].text).toBe("Mình đã gõ sẵn.");
  });

  it("a failed analysis still sends the written text", async () => {
    mockAnalyzeTurn.mockRejectedValue(new Error("multimodal down"));
    await renderRoom();
    fireEvent.change(screen.getByLabelText("Lập luận của bạn"), { target: { value: "Vẫn gửi được." } });
    await record();
    await waitFor(() => expect(mockGenerateOpponentTurn).toHaveBeenCalled());
    expect(mockGenerateOpponentTurn.mock.calls[0][1].new_learner_speeches[0].text).toBe("Vẫn gửi được.");
  });

  it("while the recording is analysed the Send button is locked; the turn then goes out once", async () => {
    let finish!: (v: unknown) => void;
    mockAnalyzeTurn.mockImplementation(() => new Promise((r) => (finish = r)));
    await renderRoom();
    fireEvent.change(screen.getByLabelText("Lập luận của bạn"), { target: { value: "Đã gõ." } });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Ghi âm giọng nói & phân tích biểu cảm"));
      await new Promise((r) => setTimeout(r, 0));
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Dừng & Gửi"));
    });
    await waitFor(() => expect(mockAnalyzeTurn).toHaveBeenCalled());
    expect(screen.getByLabelText("Gửi lập luận")).toBeDisabled();

    await act(async () => {
      finish(analysis("Whisper."));
    });
    await waitFor(() => expect(mockGenerateOpponentTurn).toHaveBeenCalledTimes(1));
    expect(mockGenerateOpponentTurn.mock.calls[0][1].new_learner_speeches[0].text).toBe("Đã gõ.");
  });

  it("an empty recording sends nothing and says so", async () => {
    mockAnalyzeTurn.mockResolvedValue(analysis(""));
    await renderRoom();
    await record();
    expect(await screen.findByText(/Không nghe được nội dung nào/)).toBeInTheDocument();
    expect(mockGenerateOpponentTurn).not.toHaveBeenCalled();
  });

  it("records with the microphone picked on the device check, without the camera it switched off", async () => {
    localStorage.setItem("adpp.media.micDeviceId", "mic-usb");
    localStorage.setItem("adpp.media.cameraEnabled", "0");
    mockAnalyzeTurn.mockResolvedValue(analysis("Bài nói."));
    await renderRoom();
    await record();
    const calls = (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect(c.video).toBeUndefined(); // camera off: never asked for
      expect(c.audio.deviceId).toEqual({ ideal: "mic-usb" });
    }
  });
});

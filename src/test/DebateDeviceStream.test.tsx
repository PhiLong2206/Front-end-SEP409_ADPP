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

vi.mock("../services/debateHub", () => ({
  debateHubService: {
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(async () => {}),
    sendSpeakingStatus: vi.fn(),
    sendLiveTranscript: vi.fn(),
  },
}));

const sttInstances: { connect: ReturnType<typeof vi.fn> }[] = [];
vi.mock("../services/realtimeStt", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/realtimeStt")>();
  class FakeStt {
    connect = vi.fn();
    sendAudioChunk = vi.fn();
    stopAndFinalize = vi.fn(async () => {});
    disconnectImmediate = vi.fn();
    constructor() {
      sttInstances.push(this);
    }
  }
  return { ...actual, RealtimeSttClient: FakeStt };
});

const mockCreateOpponentSession = vi.fn();
const mockGetOpponentCasePlan = vi.fn();
const mockGenerateOpponentTurn = vi.fn();
const mockEvaluateSpeechArgument = vi.fn();
const mockAnalyzeTurn = vi.fn();
const mockGetSessionDetails = vi.fn();
const mockStartDebateSession = vi.fn();

vi.mock("../api", () => ({
  aiApi: {
    createOpponentSession: (...a: unknown[]) => mockCreateOpponentSession(...a),
    getOpponentCasePlan: (...a: unknown[]) => mockGetOpponentCasePlan(...a),
    generateOpponentTurn: (...a: unknown[]) => mockGenerateOpponentTurn(...a),
    evaluateSpeechArgument: (...a: unknown[]) => mockEvaluateSpeechArgument(...a),
    analyzeTurn: (...a: unknown[]) => mockAnalyzeTurn(...a),
    evaluateSpeechMultimodal: vi.fn(async () => ({ content_evaluation: null })),
    evaluateDebateRound: vi.fn(),
    evaluateDebateSession: vi.fn(),
  },
  debateApi: {
    getSessionDetails: (...a: unknown[]) => mockGetSessionDetails(...a),
    getTranscript: vi.fn().mockResolvedValue({ success: true, data: { arguments: [] } }),
    getPendingSwapRequests: vi.fn().mockResolvedValue({ success: true, data: [] }),
    startDebateSession: (...a: unknown[]) => mockStartDebateSession(...a),
    submitArgument: vi.fn(),
  },
}));

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

const makeTrack = () => ({ kind: "audio", label: "Mic", readyState: "live", stop: vi.fn() });
const makeStream = (track: ReturnType<typeof makeTrack>) => ({
  getAudioTracks: () => [track],
  getVideoTracks: () => [],
  getTracks: () => [track],
});

const setUserMedia = (impl: () => Promise<unknown>) => {
  const getUserMedia = vi.fn(impl);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, writable: true, value: { getUserMedia } });
  return getUserMedia;
};

describe("DebateRoom: the microphone is opened once, before the session starts, and shared by every round", () => {
  beforeEach(() => {
    sessionStorage.clear();
    sttInstances.length = 0;
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    vi.stubGlobal("MediaStream", class { constructor(public tracks: unknown[]) {} getAudioTracks() { return this.tracks; } });
    mockStartDebateSession.mockResolvedValue({ success: true });
    mockCreateOpponentSession.mockResolvedValue({ opponent_session_id: "opp-1", status: "ready" });
    mockGetOpponentCasePlan.mockResolvedValue(null);
    mockGenerateOpponentTurn.mockImplementation(async (_id: string, body: { turn_index: number }) => ({
      turn_index: body.turn_index, round_type: "x", mode: "reply", speech_text: `Lượt AI số ${body.turn_index}`,
    }));
    mockEvaluateSpeechArgument.mockResolvedValue({
      overall_score: 8, overall_reasoning: "", criteria: [], strengths: [], weaknesses: [], suggestions: [],
    });
    mockAnalyzeTurn.mockResolvedValue({
      voice: { transcript_text: "Bài nói.", wpm: 130, duration_seconds: 5 },
      facial: {},
      overall_demeanor_score: 72,
      delivery_analytics: null,
    });
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  let learnerSide = 1; // 1 = PRO (the AI is CON), 2 = CON (the AI is PRO and speaks first)
  const waitingAiSession = () => ({
    sessionId: 123,
    title: "Phiên AI",
    topic: "Mạng xã hội có hại hơn lợi?",
    status: 1,
    debateType: 1,
    createdByUserId: 1,
    createdAt: "2026-11-20T09:55:00Z",
    currentStage: 1,
    currentTurnSide: 1,
    participants: [
      { userId: 1, side: learnerSide, isAI: false, speakerName: "Debater Test" },
      { userId: null, side: learnerSide === 1 ? 2 : 1, isAI: true, speakerName: "AI" },
    ],
    preparationSeconds: 60,
    isPreparing: false,
    canSkipPreparation: false,
    totalRounds: 3,
    serverTime: new Date().toISOString(),
  });

  const renderBackendRoom = async (role = "PRO") => {
    mockGetSessionDetails.mockImplementation(async () => ({ success: true, data: waitingAiSession() }));
    render(
      <MemoryRouter initialEntries={[`/debater/debate/123?role=${role}`]}>
        <Routes>
          <Route path="/debater/debate/:sessionId" element={<DebateRoom />} />
        </Routes>
      </MemoryRouter>
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  };

  it("does not start the session until the microphone is open, then starts it exactly once", async () => {
    let open!: (stream: unknown) => void;
    setUserMedia(() => new Promise((r) => (open = r)));
    await renderBackendRoom();

    expect(screen.getByTestId("room-loading-panel")).toBeInTheDocument();
    expect(screen.getByText("Micro: đang kết nối…")).toBeInTheDocument();
    expect(mockStartDebateSession).not.toHaveBeenCalled();

    await act(async () => {
      open(makeStream(makeTrack()));
      await new Promise((r) => setTimeout(r, 0));
    });
    await waitFor(() => expect(mockStartDebateSession).toHaveBeenCalledTimes(1));
    expect(mockStartDebateSession).toHaveBeenCalledWith(123);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(mockStartDebateSession).toHaveBeenCalledTimes(1);
  });

  it("a refused microphone shows why and lets the learner go on without it, which starts the session", async () => {
    setUserMedia(() => Promise.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" })));
    await renderBackendRoom();

    expect(await screen.findByTestId("device-error")).toHaveTextContent("chặn quyền dùng micro");
    expect(screen.getByTestId("device-retry-btn")).toBeInTheDocument();
    expect(mockStartDebateSession).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByTestId("device-continue-without-mic-btn"));
    });
    await waitFor(() => expect(mockStartDebateSession).toHaveBeenCalledTimes(1));
  });

  it("the retry button asks the browser again and starts once the microphone opens", async () => {
    localStorage.setItem("adpp.media.cameraEnabled", "0"); // one getUserMedia call per attempt
    let attempt = 0;
    setUserMedia(async () => {
      attempt += 1;
      if (attempt === 1) throw Object.assign(new Error("busy"), { name: "NotReadableError" });
      return makeStream(makeTrack());
    });
    await renderBackendRoom();
    fireEvent.click(await screen.findByTestId("device-retry-btn"));
    await waitFor(() => expect(mockStartDebateSession).toHaveBeenCalledTimes(1));
    expect(attempt).toBe(2);
  });

  describe("one loading screen: microphone, the AI opponent's plan and, when the AI speaks first, its opening", () => {
    const settle = () =>
      act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });
    const itemState = (id: string) => screen.getByTestId(id).getAttribute("data-state");

    beforeEach(() => {
      learnerSide = 1;
      setUserMedia(async () => makeStream(makeTrack()));
    });
    afterEach(() => {
      learnerSide = 1;
    });

    it("does not start while the AI opponent is still planning, and starts exactly once when it is ready", async () => {
      let ready!: (v: unknown) => void;
      mockCreateOpponentSession.mockImplementation(() => new Promise((r) => (ready = r)));
      await renderBackendRoom();
      await settle();

      expect(itemState("room-item-mic")).toBe("done"); // the microphone is ready...
      expect(itemState("room-item-opponent")).toBe("loading"); // ...the opponent is not
      expect(screen.getByTestId("room-loading-count")).toHaveTextContent("2/3");
      expect(screen.queryByTestId("room-item-opening")).not.toBeInTheDocument(); // the AI is CON: no opening
      expect(mockStartDebateSession).not.toHaveBeenCalled();

      await act(async () => {
        ready({ opponent_session_id: "opp-1", status: "ready" });
      });
      await settle();
      await waitFor(() => expect(mockStartDebateSession).toHaveBeenCalledTimes(1));
      await settle();
      expect(mockStartDebateSession).toHaveBeenCalledTimes(1);
    });

    it("AI speaks first: waits for its opening to be written, and does not record it yet", async () => {
      learnerSide = 2;
      let written!: (v: unknown) => void;
      mockGenerateOpponentTurn.mockImplementation(() => new Promise((r) => (written = r)));
      await renderBackendRoom("CON");
      await settle();

      expect(itemState("room-item-opponent")).toBe("done");
      expect(itemState("room-item-opening")).toBe("loading");
      expect(mockStartDebateSession).not.toHaveBeenCalled();

      await act(async () => {
        written({ turn_index: 1, round_type: "opening", mode: "opening_first", speech_text: "Mở đầu của AI." });
      });
      await settle();
      await waitFor(() => expect(mockStartDebateSession).toHaveBeenCalledTimes(1));
      expect(mockGenerateOpponentTurn).toHaveBeenCalledTimes(1);
    });

    it("an opponent that fails shows an error on its item, and the retry button plans again", async () => {
      mockCreateOpponentSession.mockRejectedValueOnce({ status: 500, detail: "boom" });
      await renderBackendRoom();
      await settle();

      expect(itemState("room-item-opponent")).toBe("error");
      expect(mockStartDebateSession).not.toHaveBeenCalled();

      fireEvent.click(screen.getByTestId("opponent-retry-btn"));
      await settle();
      expect(mockCreateOpponentSession).toHaveBeenCalledTimes(2);
      await waitFor(() => expect(mockStartDebateSession).toHaveBeenCalledTimes(1));
    });

    it("an opening that fails to be written shows an error on its item, and the retry button writes it again", async () => {
      learnerSide = 2;
      mockGenerateOpponentTurn.mockRejectedValueOnce({ status: 500, detail: "boom" });
      await renderBackendRoom("CON");
      await settle();

      expect(itemState("room-item-opening")).toBe("error");
      expect(mockStartDebateSession).not.toHaveBeenCalled();

      fireEvent.click(screen.getByTestId("opening-retry-btn"));
      await settle();
      expect(mockGenerateOpponentTurn).toHaveBeenCalledTimes(2);
      await waitFor(() => expect(mockStartDebateSession).toHaveBeenCalledTimes(1));
    });
  });

  describe("recording in several rounds", () => {
    const renderLocalRoom = () =>
      render(
        <MemoryRouter initialEntries={["/debater/debate/rec-pro?role=PRO"]}>
          <Routes>
            <Route path="/debater/debate/:sessionId" element={<DebateRoom />} />
          </Routes>
        </MemoryRouter>
      );

    const record = async () => {
      await act(async () => {
        fireEvent.click(screen.getByLabelText("Ghi âm giọng nói & phân tích biểu cảm"));
        await new Promise((r) => setTimeout(r, 0));
      });
      await act(async () => {
        fireEvent.click(screen.getByText("Dừng & Gửi"));
      });
      await waitFor(() => expect(mockGenerateOpponentTurn).toHaveBeenCalled());
      await waitFor(() => expect(screen.queryByText(/xong sẽ tự gửi lượt nói/)).not.toBeInTheDocument());
    };

    it("round 2 reuses the stream of round 1: no new getUserMedia, a new STT client, tracks kept until unmount", async () => {
      const track = makeTrack();
      const getUserMedia = setUserMedia(async () => makeStream(track));
      const { unmount } = renderLocalRoom();
      await act(async () => {});

      await record();
      expect(getUserMedia).toHaveBeenCalledTimes(1);
      expect(sttInstances).toHaveLength(1);
      expect(track.stop).not.toHaveBeenCalled(); // sending the turn does not give the devices back

      mockGenerateOpponentTurn.mockClear();
      await waitFor(() => expect(screen.getByLabelText("Ghi âm giọng nói & phân tích biểu cảm")).not.toBeDisabled());
      await record();

      expect(getUserMedia).toHaveBeenCalledTimes(1);
      expect(sttInstances).toHaveLength(2);
      expect(sttInstances[1].connect).toHaveBeenCalled();
      expect(track.stop).not.toHaveBeenCalled();

      unmount();
      expect(track.stop).toHaveBeenCalled();
    });

    it("a track that ended is replaced: the next recording opens the devices again", async () => {
      const dead = makeTrack();
      const fresh = makeTrack();
      const streams = [makeStream(dead), makeStream(fresh)];
      const getUserMedia = setUserMedia(async () => streams.shift());
      renderLocalRoom();
      await act(async () => {});
      await record();
      expect(getUserMedia).toHaveBeenCalledTimes(1);

      dead.readyState = "ended";
      mockGenerateOpponentTurn.mockClear();
      await waitFor(() => expect(screen.getByLabelText("Ghi âm giọng nói & phân tích biểu cảm")).not.toBeDisabled());
      await record();
      expect(getUserMedia).toHaveBeenCalledTimes(2);
    });
  });
});

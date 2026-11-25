import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import DebateRoom from "../pages/debater/DebatePractice/DebateRoom";
import { clearIceServersCache, getIceServers } from "../services/teamCall";
import type { DebateHubCallbacks, TeamCallSignalType } from "../services/debateHub";

window.HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { userId: 1, id: 1, fullName: "Debater Test", role: "Debater" },
    isAuthenticated: true,
  }),
}));

let hubCallbacks: DebateHubCallbacks = {};
const mockSendTeamCallSignal = vi.fn();
const mockSendLiveTranscript = vi.fn();
const mockSendSpeakingStatus = vi.fn();
vi.mock("../services/debateHub", () => ({
  debateHubService: {
    connect: vi.fn(async (_id: number, callbacks: DebateHubCallbacks) => {
      hubCallbacks = callbacks;
    }),
    disconnect: vi.fn(async () => {}),
    sendSpeakingStatus: (...a: unknown[]) => mockSendSpeakingStatus(...a),
    sendLiveTranscript: (...a: unknown[]) => mockSendLiveTranscript(...a),
    sendTeamCallSignal: (...a: unknown[]) => mockSendTeamCallSignal(...a),
  },
}));

const mockGetSessionDetails = vi.fn();
const mockGetIceServers = vi.fn();

vi.mock("../api", () => ({
  aiApi: {
    createOpponentSession: vi.fn(async () => ({ opponent_session_id: "opp-1", status: "ready" })),
    getOpponentCasePlan: vi.fn(async () => null),
    generateOpponentTurn: vi.fn(),
    streamOpponentTurn: vi.fn(),
    evaluateSpeechArgument: vi.fn(),
    evaluateDebateRound: vi.fn(),
    evaluateDebateSession: vi.fn(),
  },
  debateApi: {
    getSessionDetails: (...a: unknown[]) => mockGetSessionDetails(...a),
    getTranscript: vi.fn().mockResolvedValue({ success: true, data: { arguments: [] } }),
    getPendingSwapRequests: vi.fn().mockResolvedValue({ success: true, data: [] }),
    startDebateSession: vi.fn().mockResolvedValue({ success: true }),
    getIceServers: (...a: unknown[]) => mockGetIceServers(...a),
  },
}));

// ---- a fake RTCPeerConnection
class FakePc {
  static all: FakePc[] = [];
  signalingState = "stable";
  connectionState = "new";
  remoteDescription: RTCSessionDescriptionInit | null = null;
  localDescription: RTCSessionDescriptionInit | null = null;
  onnegotiationneeded: (() => void) | null = null;
  onicecandidate: ((e: { candidate: unknown }) => void) | null = null;
  ontrack: ((e: { streams: unknown[]; track: unknown }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  constructor(public config: RTCConfiguration) {
    FakePc.all.push(this);
  }
  addTrack = vi.fn(() => {
    queueMicrotask(() => this.onnegotiationneeded?.());
  });
  setLocalDescription = vi.fn(async (description?: RTCSessionDescriptionInit) => {
    const type = description?.type ?? (this.signalingState === "have-remote-offer" ? "answer" : "offer");
    this.localDescription = { type, sdp: `sdp-${type}` };
    this.signalingState = type === "offer" ? "have-local-offer" : "stable";
  });
  setRemoteDescription = vi.fn(async (description: RTCSessionDescriptionInit) => {
    this.remoteDescription = description;
    this.signalingState = description.type === "offer" ? "have-remote-offer" : "stable";
  });
  addIceCandidate = vi.fn(async () => {});
  close = vi.fn();
}

const makeTrack = () => {
  const cloned = { kind: "audio", enabled: true, readyState: "live", stop: vi.fn(), clone: vi.fn() };
  const original = {
    kind: "audio",
    label: "Mic",
    enabled: true,
    readyState: "live",
    stop: vi.fn(),
    clone: vi.fn(() => cloned),
  };
  return { original, cloned };
};

const SERVER_T0 = Date.parse("2026-11-20T10:00:00.000Z");
const answer = JSON.stringify({ type: "answer", sdp: "remote-sdp" });

describe("voice call with the teammate during the preparation minute", () => {
  let participants: Array<Record<string, unknown>>;
  let prepEndsAtMs: number;
  let tracks: ReturnType<typeof makeTrack>;

  const session = () => ({
    sessionId: 123,
    title: "Phiên 2v2",
    topic: "Mạng xã hội có hại hơn lợi?",
    status: 2,
    debateType: 3,
    createdByUserId: 1,
    createdAt: "2026-11-20T09:55:00Z",
    currentStage: 1,
    currentTurnSide: 1,
    participants,
    preparationSeconds: 60,
    preparationEndsAt: new Date(prepEndsAtMs).toISOString(),
    isPreparing: Date.now() < prepEndsAtMs,
    canSkipPreparation: false,
    totalRounds: 3,
    serverTime: new Date().toISOString(),
    currentTurn: {
      turnId: 1,
      turnIndex: 0,
      turnOrder: 1,
      stage: 1,
      side: 1,
      roundLabel: "Mở đầu",
      timeLimitSeconds: 135,
      status: Date.now() < prepEndsAtMs ? 1 : 2,
      startedAt: new Date(prepEndsAtMs).toISOString(),
    },
  });

  const flush = async () => {
    for (let i = 0; i < 10; i++) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  };
  const advance = async (ms: number) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  };

  const renderRoom = async () => {
    const view = render(
      <MemoryRouter initialEntries={["/debater/debate/123?role=PRO"]}>
        <Routes>
          <Route path="/debater/debate/:sessionId" element={<DebateRoom />} />
        </Routes>
      </MemoryRouter>
    );
    await flush();
    await advance(10);
    await flush();
    return view;
  };

  const hangups = () => mockSendTeamCallSignal.mock.calls.filter((c) => c[0] === "hangup");
  const signalOf = (type: TeamCallSignalType, overrides: Record<string, unknown> = {}) => ({
    sessionId: 123,
    fromUserId: 2,
    fromName: "Đồng đội",
    type,
    payload: type === "answer" ? answer : JSON.stringify({ candidate: "candidate:1" }),
    ...overrides,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(SERVER_T0);
    sessionStorage.clear();
    localStorage.clear();
    clearIceServersCache();
    FakePc.all = [];
    hubCallbacks = {};
    prepEndsAtMs = SERVER_T0 + 60_000;
    // 2v2: me (1) and a teammate (2) are PRO, two opponents are CON
    participants = [
      { userId: 1, side: 1, isAI: false, speakerName: "Debater Test" },
      { userId: 2, side: 1, isAI: false, speakerName: "Bạn đồng đội" },
      { userId: 3, side: 2, isAI: false, speakerName: "Đối thủ A" },
      { userId: 4, side: 2, isAI: false, speakerName: "Đối thủ B" },
    ];
    tracks = makeTrack();
    const stream = {
      getAudioTracks: () => [tracks.original],
      getVideoTracks: () => [],
      getTracks: () => [tracks.original],
    };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      writable: true,
      value: { getUserMedia: vi.fn(async () => stream) },
    });
    vi.stubGlobal("RTCPeerConnection", FakePc);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    HTMLMediaElement.prototype.play = vi.fn(async () => {});
    mockSendTeamCallSignal.mockResolvedValue({ ok: true, code: null });
    mockGetIceServers.mockResolvedValue({
      success: true,
      data: { iceServers: [{ urls: "stun:stun.example.org" }], ttlSeconds: 600 },
    });
    mockGetSessionDetails.mockImplementation(async () => ({ success: true, data: session() }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("2v2 with a human teammate: fetches the ICE servers, makes the connection and sends an offer", async () => {
    await renderRoom();

    expect(mockGetIceServers).toHaveBeenCalledWith(123);
    expect(FakePc.all).toHaveLength(1);
    expect(FakePc.all[0].config.iceServers).toEqual([{ urls: "stun:stun.example.org" }]);
    // only audio, a clone of the shared track
    expect(tracks.original.clone).toHaveBeenCalledTimes(1);
    expect(FakePc.all[0].addTrack).toHaveBeenCalledWith(tracks.cloned, expect.anything());
    const offer = mockSendTeamCallSignal.mock.calls.find((c) => c[0] === "offer");
    expect(offer).toBeTruthy();
    expect(JSON.parse(offer![1] as string)).toMatchObject({ type: "offer" });

    expect(screen.getByTestId("team-call-panel")).toHaveTextContent("Đang gọi đồng đội Bạn đồng đội");
    expect(screen.getByTestId("team-call-status")).toHaveTextContent("Đang kết nối");
    expect(screen.getByTestId("team-call-status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByTestId("team-call-panel")).toHaveTextContent("Nên đeo tai nghe");
  });

  it("an answer and ICE candidates from the teammate are applied; the status turns to connected", async () => {
    await renderRoom();
    const pc = FakePc.all[0];

    await act(async () => {
      hubCallbacks.onTeamCallSignal?.(signalOf("answer"));
    });
    await flush();
    expect(pc.setRemoteDescription).toHaveBeenCalledWith({ type: "answer", sdp: "remote-sdp" });

    await act(async () => {
      hubCallbacks.onTeamCallSignal?.(signalOf("ice"));
    });
    await flush();
    expect(pc.addIceCandidate).toHaveBeenCalledWith({ candidate: "candidate:1" });

    pc.connectionState = "connected";
    await act(async () => {
      pc.onconnectionstatechange?.();
    });
    expect(screen.getByTestId("team-call-status")).toHaveTextContent("Đã nối");
  });

  it("signals from someone who is not the teammate, or from another session, are ignored", async () => {
    await renderRoom();
    const pc = FakePc.all[0];

    await act(async () => {
      hubCallbacks.onTeamCallSignal?.(signalOf("answer", { fromUserId: 3 })); // an opponent
      hubCallbacks.onTeamCallSignal?.(signalOf("answer", { sessionId: 999 })); // another session
      hubCallbacks.onTeamCallSignal?.(signalOf("ice", { fromUserId: 9 }));
    });
    await flush();

    expect(pc.setRemoteDescription).not.toHaveBeenCalled();
    expect(pc.addIceCandidate).not.toHaveBeenCalled();
  });

  it("an offer from the teammate is answered when nothing of ours is pending", async () => {
    await renderRoom();
    const pc = FakePc.all[0];
    pc.signalingState = "stable"; // nothing pending on our side
    mockSendTeamCallSignal.mockClear();

    await act(async () => {
      hubCallbacks.onTeamCallSignal?.(
        signalOf("offer", { payload: JSON.stringify({ type: "offer", sdp: "their-offer" }) })
      );
    });
    await flush();

    expect(pc.setRemoteDescription).toHaveBeenCalledWith({ type: "offer", sdp: "their-offer" });
    expect(mockSendTeamCallSignal.mock.calls.some((c) => c[0] === "answer")).toBe(true);
  });

  it("both sides offer at once: the side with the smaller user id (impolite) ignores the other's offer", async () => {
    await renderRoom();
    const pc = FakePc.all[0]; // my id is 1, the teammate's 2: I am impolite, and my own offer is waiting
    expect(pc.signalingState).toBe("have-local-offer");
    mockSendTeamCallSignal.mockClear();

    await act(async () => {
      hubCallbacks.onTeamCallSignal?.(
        signalOf("offer", { payload: JSON.stringify({ type: "offer", sdp: "their-offer" }) })
      );
    });
    await flush();

    expect(pc.setRemoteDescription).not.toHaveBeenCalled();
    expect(mockSendTeamCallSignal.mock.calls.some((c) => c[0] === "answer")).toBe(false);
  });

  it("TeamCallEnded hangs up exactly once, closes the connection and stops only the clone", async () => {
    const { unmount } = await renderRoom();
    const pc = FakePc.all[0];

    await act(async () => {
      hubCallbacks.onTeamCallEnded?.({ sessionId: 123, roundNumber: 1, endedAt: new Date().toISOString() });
    });
    await flush();

    expect(hangups()).toHaveLength(1);
    expect(pc.close).toHaveBeenCalledTimes(1);
    expect(tracks.cloned.stop).toHaveBeenCalledTimes(1);
    expect(tracks.original.stop).not.toHaveBeenCalled(); // recording and speech-to-text still use it
    expect(screen.queryByTestId("team-call-panel")).not.toBeInTheDocument();

    unmount();
    await flush();
    expect(hangups()).toHaveLength(1);
    expect(tracks.original.stop).toHaveBeenCalledTimes(1); // only the room itself gives the devices back, once
  });

  it("when the minute ends on the server clock the call is hung up exactly once (back-up of TeamCallEnded)", async () => {
    await renderRoom();
    const pc = FakePc.all[0];

    await advance(61_000);
    await flush();

    expect(hangups()).toHaveLength(1);
    expect(pc.close).toHaveBeenCalledTimes(1);
    expect(tracks.original.stop).not.toHaveBeenCalled();
    expect(screen.queryByTestId("team-call-panel")).not.toBeInTheDocument();
  });

  it("leaving the room hangs up exactly once", async () => {
    const { unmount } = await renderRoom();
    unmount();
    await flush();
    expect(hangups()).toHaveLength(1);
    expect(FakePc.all[0].close).toHaveBeenCalledTimes(1);
    expect(tracks.cloned.stop).toHaveBeenCalledTimes(1);
  });

  it("a hang-up from the teammate ends the call too, without sending one back", async () => {
    await renderRoom();
    await act(async () => {
      hubCallbacks.onTeamCallSignal?.(signalOf("hangup"));
    });
    await flush();
    expect(FakePc.all[0].close).toHaveBeenCalledTimes(1);
    expect(hangups()).toHaveLength(0);
    expect(screen.queryByTestId("team-call-panel")).not.toBeInTheDocument(); // nothing half-working stays on screen
  });

  it("a signal that arrives while there is no call (between minutes) is dropped, not replayed into the next one", async () => {
    await renderRoom();
    await act(async () => {
      hubCallbacks.onTeamCallEnded?.({ sessionId: 123, roundNumber: 1 });
    });
    await flush();
    // The minute is over: a late offer of the old minute arrives
    await act(async () => {
      hubCallbacks.onTeamCallSignal?.(
        signalOf("offer", { payload: JSON.stringify({ type: "offer", sdp: "old-offer" }) })
      );
    });
    await flush();

    // The next minute starts: its call must not apply the old offer
    prepEndsAtMs = Date.now() + 60_000;
    await act(async () => {
      hubCallbacks.onSessionStarted?.({});
    });
    await advance(3_500);
    await flush();
    expect(FakePc.all).toHaveLength(2);
    expect(FakePc.all[1].setRemoteDescription).not.toHaveBeenCalled();
  });

  describe("no call", () => {
    it("1v1 between learners: no ICE servers, no panel", async () => {
      participants = [
        { userId: 1, side: 1, isAI: false, speakerName: "Debater Test" },
        { userId: 3, side: 2, isAI: false, speakerName: "Đối thủ A" },
      ];
      await renderRoom();
      expect(mockGetIceServers).not.toHaveBeenCalled();
      expect(FakePc.all).toHaveLength(0);
      expect(screen.queryByTestId("team-call-panel")).not.toBeInTheDocument();
    });

    it("AI practice: no ICE servers, no panel", async () => {
      participants = [
        { userId: 1, side: 1, isAI: false, speakerName: "Debater Test" },
        { userId: null, side: 2, isAI: true, speakerName: "AI" },
      ];
      await renderRoom();
      expect(mockGetIceServers).not.toHaveBeenCalled();
      expect(FakePc.all).toHaveLength(0);
      expect(screen.queryByTestId("team-call-panel")).not.toBeInTheDocument();
    });

    it("2v2 whose teammate is the AI: no ICE servers, no panel", async () => {
      participants = [
        { userId: 1, side: 1, isAI: false, speakerName: "Debater Test" },
        { userId: null, side: 1, isAI: true, speakerName: "AI đồng đội" },
        { userId: 3, side: 2, isAI: false, speakerName: "Đối thủ A" },
        { userId: 4, side: 2, isAI: false, speakerName: "Đối thủ B" },
      ];
      await renderRoom();
      expect(mockGetIceServers).not.toHaveBeenCalled();
      expect(FakePc.all).toHaveLength(0);
      expect(screen.queryByTestId("team-call-panel")).not.toBeInTheDocument();
    });
  });

  it("TEAM_CALL_CLOSED hangs up at once and shows no error", async () => {
    mockSendTeamCallSignal.mockResolvedValue({ ok: false, code: "TEAM_CALL_CLOSED" });
    await renderRoom();
    await flush();

    expect(FakePc.all[0].close).toHaveBeenCalledTimes(1);
    expect(tracks.cloned.stop).toHaveBeenCalledTimes(1);
    expect(hangups()).toHaveLength(0); // the server already closed it
    expect(screen.queryByText("Không nối được")).not.toBeInTheDocument();
    expect(screen.queryByTestId("debate-feedback-banner")).not.toBeInTheDocument();
  });

  it("a connection that cannot be made says so with a retry button, and the preparation goes on", async () => {
    await renderRoom();
    const pc = FakePc.all[0];
    pc.connectionState = "failed";
    await act(async () => {
      pc.onconnectionstatechange?.();
    });

    expect(screen.getByTestId("team-call-status")).toHaveTextContent("Không nối được");
    expect(screen.getByTestId("preparation-countdown")).toBeInTheDocument(); // the preparation is not blocked

    mockGetIceServers.mockClear();
    fireEvent.click(screen.getByTestId("team-call-retry-btn"));
    await flush();
    expect(FakePc.all).toHaveLength(2);
    expect(screen.getByTestId("team-call-status")).toHaveTextContent("Đang kết nối");
  });

  it("an ICE server request that fails shows 'Không nối được' (retry), not a blocking error", async () => {
    mockGetIceServers.mockRejectedValue({ status: 403 });
    await renderRoom();
    expect(screen.getByTestId("team-call-status")).toHaveTextContent("Không nối được");
    expect(screen.getByTestId("team-call-retry-btn")).toBeInTheDocument();
  });

  it("the mute button turns the call's track off and on; the shared track is untouched", async () => {
    await renderRoom();
    fireEvent.click(screen.getByTestId("team-call-mute-btn"));
    expect(tracks.cloned.enabled).toBe(false);
    expect(tracks.original.enabled).toBe(true);
    expect(screen.getByTestId("team-call-mute-btn")).toHaveTextContent("Bật mic");

    fireEvent.click(screen.getByTestId("team-call-mute-btn"));
    expect(tracks.cloned.enabled).toBe(true);
    expect(screen.getByTestId("team-call-mute-btn")).toHaveTextContent("Tắt mic");
  });

  it("a browser that blocks the teammate's voice gets a button that turns the sound on", async () => {
    HTMLMediaElement.prototype.play = vi.fn(async () => {
      throw new Error("NotAllowedError");
    });
    await renderRoom();
    const pc = FakePc.all[0];
    await act(async () => {
      pc.ontrack?.({ streams: [{ getAudioTracks: () => [{}] }], track: {} });
    });
    await flush();

    expect(screen.getByTestId("team-call-enable-audio-btn")).toHaveTextContent("Bật âm thanh");
    HTMLMediaElement.prototype.play = vi.fn(async () => {});
    await act(async () => {
      fireEvent.click(screen.getByTestId("team-call-enable-audio-btn"));
    });
    await flush();
    expect(screen.queryByTestId("team-call-enable-audio-btn")).not.toBeInTheDocument();
  });

  it("a teammate who joins late gets the offer again", async () => {
    mockSendTeamCallSignal.mockResolvedValueOnce({ ok: false, code: "NO_TEAMMATE" });
    await renderRoom();
    const offers = () => mockSendTeamCallSignal.mock.calls.filter((c) => c[0] === "offer").length;
    expect(offers()).toBe(1);

    await advance(3_100);
    await flush();
    expect(offers()).toBe(2);
  });
});

describe("ICE servers are cached per session", () => {
  beforeEach(() => clearIceServersCache());

  it("asks once, and again when the time to live is nearly over", async () => {
    const fetcher = vi.fn(async () => ({ success: true, data: { iceServers: [{ urls: "stun:a" }], ttlSeconds: 100 } }));
    const t0 = 1_000_000;
    await getIceServers(7, fetcher, t0);
    await getIceServers(7, fetcher, t0 + 50_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await getIceServers(7, fetcher, t0 + 85_000); // past 80 % of the 100 s
    expect(fetcher).toHaveBeenCalledTimes(2);
    await getIceServers(8, fetcher, t0); // another session
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});

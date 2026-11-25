import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import DebateRoom from "../pages/debater/DebatePractice/DebateRoom";
import type { OpponentTurnStreamHandlers } from "../services/opponentTurnStream";

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

const mockCreateOpponentSession = vi.fn();
const mockStreamOpponentTurn = vi.fn();
const mockGetSessionDetails = vi.fn();
const mockSubmitArgument = vi.fn();
const mockSubmitAiArgument = vi.fn();
const mockRestartPreparation = vi.fn();

vi.mock("../api", () => ({
  aiApi: {
    createOpponentSession: (...a: unknown[]) => mockCreateOpponentSession(...a),
    getOpponentCasePlan: vi.fn(async () => null),
    generateOpponentTurn: vi.fn(),
    streamOpponentTurn: (...a: unknown[]) => mockStreamOpponentTurn(...a),
    evaluateSpeechArgument: vi.fn(async () => ({
      overall_score: 8, overall_reasoning: "", criteria: [], strengths: [], weaknesses: [], suggestions: [],
    })),
    evaluateDebateRound: vi.fn(),
    evaluateDebateSession: vi.fn(),
  },
  debateApi: {
    getSessionDetails: (...a: unknown[]) => mockGetSessionDetails(...a),
    getTranscript: vi.fn().mockResolvedValue({ success: true, data: { arguments: [] } }),
    getPendingSwapRequests: vi.fn().mockResolvedValue({ success: true, data: [] }),
    startDebateSession: vi.fn().mockResolvedValue({ success: true }),
    submitArgument: (...a: unknown[]) => mockSubmitArgument(...a),
    submitAiArgument: (...a: unknown[]) => mockSubmitAiArgument(...a),
    skipPreparation: vi.fn(),
    restartPreparation: (...a: unknown[]) => mockRestartPreparation(...a),
  },
}));

class FakeUtterance {
  public voice: SpeechSynthesisVoice | null = null;
  public lang = "";
  public rate = 1;
  public onend: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

// The fake browser voice reads until the test says it is done (a 90-second reading)
const queuedUtterances: FakeUtterance[] = [];
const endSpeech = () => queuedUtterances.splice(0).forEach((u) => u.onend?.());
const synth = {
  getVoices: () => [{ lang: "vi-VN", name: "HoaiMy", localService: false } as SpeechSynthesisVoice],
  speak: vi.fn((u: FakeUtterance) => {
    queuedUtterances.push(u);
  }),
  cancel: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

// One long sentence: the reader's own stall watchdog scales with its length, so it takes longer than 90 s to read
const LONG_SPEECH = `${"Phản bác dài của AI ".repeat(150)}kết thúc.`;

// The turn table: PRO, CON, PRO, CON, then the closing starts with CON
const SIDE_OF_TURN = [1, 2, 1, 2, 2, 1];
const STAGE_OF_TURN = [1, 1, 2, 2, 3, 3];

const SERVER_T0 = Date.parse("2026-11-20T10:00:00.000Z");

describe("the preparation between rounds is counted from the end of the AI's reading", () => {
  let prepEndsAtMs = SERVER_T0 + 60_000;
  let nextTurnIndex = 0;
  let userSide = 1; // 1 = PRO, 2 = CON
  // When set, the learner's turn starts the next preparation with this many ms to go (as the Backend does)
  let prepAfterLearnerTurnMs: number | null = null;
  let finishStream: (text: string) => void;
  let streamHandlers: OpponentTurnStreamHandlers;

  const now = () => Date.now();

  /** The Backend session: the learner is PRO (turns 0, 2, 4), the AI is CON (turns 1, 3, 5). */
  const session = () => ({
    sessionId: 123,
    title: "Phiên AI",
    topic: "Mạng xã hội có hại hơn lợi?",
    status: 2,
    debateType: 1,
    createdByUserId: 1,
    createdAt: "2026-11-20T09:55:00Z",
    currentStage: STAGE_OF_TURN[nextTurnIndex],
    currentTurnSide: SIDE_OF_TURN[nextTurnIndex],
    participants: [
      { userId: 1, side: userSide, isAI: false, speakerName: "Debater Test" },
      { userId: null, side: userSide === 1 ? 2 : 1, isAI: true, speakerName: "AI" },
    ],
    preparationSeconds: 60,
    preparationEndsAt: new Date(prepEndsAtMs).toISOString(),
    isPreparing: now() < prepEndsAtMs,
    canSkipPreparation: now() < prepEndsAtMs,
    totalRounds: 3,
    serverTime: new Date(now()).toISOString(),
    currentTurn: {
      turnId: nextTurnIndex + 1,
      turnIndex: nextTurnIndex,
      turnOrder: nextTurnIndex + 1,
      stage: STAGE_OF_TURN[nextTurnIndex],
      side: SIDE_OF_TURN[nextTurnIndex],
      roundLabel: ["Mở đầu", "Mở đầu", "Phản biện", "Phản biện", "Kết luận", "Kết luận"][nextTurnIndex],
      timeLimitSeconds: 135,
      status: now() < prepEndsAtMs ? 1 : 2,
      startedAt: new Date(prepEndsAtMs).toISOString(),
    },
  });

  const advance = async (ms: number) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  };
  const flush = async () => {
    for (let i = 0; i < 8; i++) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  };

  /** Round 1: the learner speaks, the AI answers (its turn ends the round) and starts reading it aloud. */
  const playRoundOneUntilAiHasWritten = async () => {
    render(
      <MemoryRouter initialEntries={["/debater/debate/123?role=PRO"]}>
        <Routes>
          <Route path="/debater/debate/:sessionId" element={<DebateRoom />} />
        </Routes>
      </MemoryRouter>
    );
    await flush();
    await advance(60_000); // the first preparation is over
    mockSubmitArgument.mockImplementation(async () => {
      nextTurnIndex = 1;
      if (prepAfterLearnerTurnMs !== null) prepEndsAtMs = now() + prepAfterLearnerTurnMs;
      return { success: true, data: session() };
    });
    fireEvent.change(screen.getByLabelText("Lập luận của bạn"), { target: { value: "Luận điểm của mình." } });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Gửi lập luận"));
    });
    await flush();
    expect(mockStreamOpponentTurn).toHaveBeenCalledTimes(1);

    await act(async () => {
      streamHandlers.onAttempt?.(1, null);
      streamHandlers.onDelta?.(`${LONG_SPEECH} `);
    });
    await flush();
    if (localStorage.getItem("adpp.aiReadAloud") !== "off") {
      expect(queuedUtterances.length).toBeGreaterThan(0); // the AI is being read aloud
    }

    // The AI has written all: the Backend moves on to the next round, whose minute starts now (to be restarted later)
    mockSubmitAiArgument.mockImplementation(async () => {
      nextTurnIndex = 2;
      prepEndsAtMs = now() + 60_000;
      return { success: true, data: { turnIndex: 1, alreadyRecorded: false, argument: {}, session: session() } };
    });
    await act(async () => {
      finishStream(LONG_SPEECH);
    });
    await flush();
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(SERVER_T0);
    vi.stubEnv("VITE_AI_TURN_STREAM", "true");
    sessionStorage.clear();
    localStorage.clear(); // the read-aloud switch is remembered
    queuedUtterances.length = 0;
    prepEndsAtMs = SERVER_T0 + 60_000;
    nextTurnIndex = 0;
    userSide = 1;
    prepAfterLearnerTurnMs = null;
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    (window as unknown as { speechSynthesis: typeof synth }).speechSynthesis = synth;
    (globalThis as unknown as { SpeechSynthesisUtterance: typeof FakeUtterance }).SpeechSynthesisUtterance = FakeUtterance;
    mockGetSessionDetails.mockImplementation(async () => ({ success: true, data: session() }));
    mockCreateOpponentSession.mockResolvedValue({ opponent_session_id: "opp-1", status: "ready" });
    mockStreamOpponentTurn.mockImplementation(
      (_id: string, body: { turn_index: number }, handlers: OpponentTurnStreamHandlers) =>
        new Promise((resolve) => {
          streamHandlers = handlers;
          finishStream = (text) =>
            resolve({ turn_index: body.turn_index, round_type: "opening", mode: "reply", speech_text: text });
        })
    );
    mockSubmitAiArgument.mockReset(); // a one-time answer left by an earlier test must not leak into this one
    mockRestartPreparation.mockImplementation(async () => {
      prepEndsAtMs = now() + 60_000; // the Backend counts the minute from now
      return { success: true, data: session() };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.stubEnv("VITE_AI_TURN_STREAM", "false");
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("restarts once when the 90-second reading ends by itself, and counts down from the new end", async () => {
    await playRoundOneUntilAiHasWritten();

    // While the AI reads: no countdown, no polling of the session, no restart yet
    const detailsCallsWhileReading = mockGetSessionDetails.mock.calls.length;
    expect(screen.getByTestId("preparation-ai-presenting")).toHaveTextContent("Đối thủ AI đang trình bày");
    await advance(90_000);
    expect(screen.getByTestId("ai-waiting-clock")).toHaveTextContent("—"); // one clock: no number while the AI reads
    expect(screen.queryByTestId("preparation-countdown")).not.toBeInTheDocument();
    expect(mockGetSessionDetails.mock.calls.length).toBe(detailsCallsWhileReading);
    expect(mockRestartPreparation).not.toHaveBeenCalled();

    // The reading ends
    await act(async () => {
      endSpeech();
    });
    await flush();
    expect(mockRestartPreparation).toHaveBeenCalledTimes(1);
    expect(mockRestartPreparation).toHaveBeenCalledWith(123);
    expect(screen.queryByTestId("preparation-ai-presenting")).not.toBeInTheDocument();
    expect(screen.getByTestId("preparation-countdown")).toHaveTextContent("01:00");

    await advance(10_000);
    expect(screen.getByTestId("preparation-countdown")).toHaveTextContent("00:50");
    expect(mockRestartPreparation).toHaveBeenCalledTimes(1);
  });

  it("does not restart when the learner starts recording while the AI is still reading", async () => {
    await playRoundOneUntilAiHasWritten();
    // The learner is allowed to record only once the preparation is over: let the old minute run out
    prepEndsAtMs = now() - 1_000;
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Ghi âm giọng nói & phân tích biểu cảm"));
    });
    await flush();
    await advance(5_000);

    expect(mockRestartPreparation).not.toHaveBeenCalled();
  });

  it("restarts when the learner skips the rest of the reading", async () => {
    await playRoundOneUntilAiHasWritten();

    await act(async () => {
      fireEvent.click(screen.getByTestId("skip-ai-reading-btn"));
    });
    await flush();

    expect(mockRestartPreparation).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("preparation-countdown")).toHaveTextContent("01:00");
  });

  it("does not restart when read-aloud is turned off during the reading", async () => {
    await playRoundOneUntilAiHasWritten();

    await act(async () => {
      fireEvent.click(screen.getByTestId("ai-read-aloud-toggle"));
    });
    await flush();

    expect(mockRestartPreparation).not.toHaveBeenCalled();
  });

  it("a failed restart keeps the current clock and only warns", async () => {
    mockRestartPreparation.mockRejectedValue(new Error("boom"));
    await playRoundOneUntilAiHasWritten();
    const warn = vi.mocked(console.warn);
    await act(async () => {
      fireEvent.click(screen.getByTestId("skip-ai-reading-btn"));
    });
    await flush();

    expect(mockRestartPreparation).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("Could not restart the preparation clock:", expect.any(Error));
    expect(screen.getByTestId("preparation-countdown")).toHaveTextContent("01:00"); // the server's own minute
    await advance(10_000);
    expect(screen.getByTestId("preparation-countdown")).toHaveTextContent("00:50");
  });

  it("without read-aloud it restarts as soon as the AI has written, once", async () => {
    localStorage.setItem("adpp.aiReadAloud", "off");
    await playRoundOneUntilAiHasWritten();

    expect(queuedUtterances).toHaveLength(0);
    expect(mockRestartPreparation).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("preparation-ai-presenting")).not.toBeInTheDocument();
    await advance(5_000);
    expect(mockRestartPreparation).toHaveBeenCalledTimes(1);
  });

  describe("Round 2 as PRO: the AI speaks turns 3 and 4 back to back while the preparation of Round 3 is running", () => {
    const streams: { handlers: OpponentTurnStreamHandlers; finish: (text: string) => void }[] = [];
    const record = (turnIndex: number, nextIndex: number) =>
      mockSubmitAiArgument.mockImplementationOnce(async () => {
        nextTurnIndex = nextIndex;
        prepEndsAtMs = now() + 60_000; // a new round: its preparation minute (planned) starts
        return { success: true, data: { turnIndex, alreadyRecorded: false, argument: {}, session: session() } };
      });

    /** Round 1 is played, the preparation of Round 2 is skipped, the learner sends turn 2 and the AI writes turn 3. */
    const reachAiTurnThree = async () => {
      await playRoundOneUntilAiHasWritten();
      await act(async () => {
        fireEvent.click(screen.getByTestId("skip-ai-reading-btn"));
      });
      await flush();
      await advance(60_000); // the restarted minute of Round 2 is over
      expect(screen.queryByTestId("preparation-panel")).not.toBeInTheDocument();

      streams.length = 0;
      mockStreamOpponentTurn.mockImplementation(
        (_id: string, body: { turn_index: number }, handlers: OpponentTurnStreamHandlers) =>
          new Promise((resolve) => {
            streams.push({
              handlers,
              finish: (text) =>
                resolve({ turn_index: body.turn_index, round_type: "x", mode: "reply", speech_text: text }),
            });
          })
      );
      mockSubmitArgument.mockImplementation(async () => {
        nextTurnIndex = 3;
        return { success: true, data: session() };
      });
      fireEvent.change(screen.getByLabelText("Lập luận của bạn"), { target: { value: "Phản biện của mình." } });
      await act(async () => {
        fireEvent.click(screen.getByLabelText("Gửi lập luận"));
      });
      await flush();
      expect(streams).toHaveLength(1);

      // Turn 3 is written and recorded: the Backend says "preparing" (Round 3), and the AI goes on with turn 4
      record(3, 4);
      await act(async () => {
        streams[0].handlers.onAttempt?.(1, null);
        streams[0].handlers.onDelta?.(`${LONG_SPEECH} `);
      });
      await flush();
      await act(async () => {
        streams[0].finish(LONG_SPEECH);
      });
      await flush();
      expect(streams).toHaveLength(2); // turn 4 started at once
    };

    it("hides the clock and does not read the session while turn 4 is being written", async () => {
      await reachAiTurnThree();
      await act(async () => {
        streams[1].handlers.onAttempt?.(1, null);
        streams[1].handlers.onDelta?.("Mở đầu kết luận. ");
      });
      await flush();
      const calls = mockGetSessionDetails.mock.calls.length;

      expect(screen.getByTestId("preparation-ai-presenting")).toBeInTheDocument();
      await advance(10_000);

      expect(screen.getByTestId("preparation-ai-presenting")).toBeInTheDocument();
      expect(mockGetSessionDetails.mock.calls.length).toBe(calls);
      expect(mockRestartPreparation).toHaveBeenCalledTimes(1); // only the one of Round 1
    });

    it("restarts once, when both AI speeches have been read, and counts down from the new end", async () => {
      await reachAiTurnThree();
      record(4, 5);
      await act(async () => {
        streams[1].handlers.onAttempt?.(1, null);
        streams[1].handlers.onDelta?.(`${LONG_SPEECH} `);
      });
      await flush();
      await act(async () => {
        streams[1].finish(LONG_SPEECH);
      });
      await flush();
      expect(mockRestartPreparation).toHaveBeenCalledTimes(1); // still reading

      await act(async () => {
        endSpeech();
      });
      await flush();
      await act(async () => {
        endSpeech();
      });
      await flush();

      expect(mockRestartPreparation).toHaveBeenCalledTimes(2); // Round 1's and this one
      expect(screen.getByTestId("preparation-countdown")).toHaveTextContent("01:00");
    });
  });

  describe("skipping the reading one part at a time (the learner is PRO: the AI reads the rebuttal, then the closing)", () => {
    const TURN3 = LONG_SPEECH;
    const TURN4 = `${"Kết luận của AI ".repeat(150)}hết.`;
    const streams: { handlers: OpponentTurnStreamHandlers; finish: (text: string) => void }[] = [];
    const spoken = () => synth.speak.mock.calls.map((c) => (c[0] as FakeUtterance).text);
    const skipButton = () => screen.getByTestId("skip-ai-reading-btn");

    /** Round 2: the learner sends turn 2, the AI writes turn 3 (recorded), and turn 4 starts to stream at once. */
    const reachTurnFourStreaming = async () => {
      await playRoundOneUntilAiHasWritten();
      await act(async () => {
        fireEvent.click(skipButton()); // Round 1's AI speech: the learner has read it
      });
      await flush();
      await advance(60_000);

      streams.length = 0;
      mockStreamOpponentTurn.mockImplementation(
        (_id: string, body: { turn_index: number }, handlers: OpponentTurnStreamHandlers) =>
          new Promise((resolve) => {
            streams.push({
              handlers,
              finish: (text) =>
                resolve({ turn_index: body.turn_index, round_type: "x", mode: "reply", speech_text: text }),
            });
          })
      );
      mockSubmitArgument.mockImplementation(async () => {
        nextTurnIndex = 3;
        return { success: true, data: session() };
      });
      fireEvent.change(screen.getByLabelText("Lập luận của bạn"), { target: { value: "Phản biện của mình." } });
      await act(async () => {
        fireEvent.click(screen.getByLabelText("Gửi lập luận"));
      });
      await flush();
      mockSubmitAiArgument.mockImplementationOnce(async () => {
        nextTurnIndex = 4;
        prepEndsAtMs = now() + 60_000;
        return { success: true, data: { turnIndex: 3, alreadyRecorded: false, argument: {}, session: session() } };
      });
      await act(async () => {
        streams[0].handlers.onAttempt?.(1, null);
        streams[0].handlers.onDelta?.(`${TURN3} `);
      });
      await flush();
      await act(async () => {
        streams[0].finish(TURN3);
      });
      await flush();
      expect(streams).toHaveLength(2); // turn 4 started at once
    };

    const finishTurnFour = async () => {
      mockSubmitAiArgument.mockImplementationOnce(async () => {
        nextTurnIndex = 5;
        prepEndsAtMs = now() + 60_000;
        return { success: true, data: { turnIndex: 4, alreadyRecorded: false, argument: {}, session: session() } };
      });
      await act(async () => {
        streams[1].handlers.onAttempt?.(1, null);
        streams[1].handlers.onDelta?.(`${TURN4} `);
      });
      await flush();
      await act(async () => {
        streams[1].finish(TURN4);
      });
      await flush();
    };

    it("the first click skips only the rebuttal, the closing is read next, and nothing restarts until it is skipped too", async () => {
      await reachTurnFourStreaming();
      await finishTurnFour();
      expect(skipButton()).toHaveTextContent("Bỏ qua phần Phản biện");
      expect(spoken().some((t) => t.startsWith("Kết luận của AI"))).toBe(false); // held until the rebuttal is done
      expect(mockRestartPreparation).toHaveBeenCalledTimes(1); // only Round 1's

      await act(async () => {
        fireEvent.click(skipButton());
      });
      await flush();

      // The rebuttal was stopped (its voice cancelled), the closing began to be read at once
      expect(synth.cancel).toHaveBeenCalled();
      expect(spoken().some((t) => t.startsWith("Kết luận của AI"))).toBe(true);
      expect(skipButton()).toHaveTextContent("Bỏ qua phần Kết luận");
      expect(mockRestartPreparation).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("ai-waiting-clock")).toBeInTheDocument(); // still no clock

      // The second click skips the closing: only now the minute is restarted, once
      await act(async () => {
        fireEvent.click(skipButton());
      });
      await flush();
      expect(screen.queryByTestId("skip-ai-reading-btn")).not.toBeInTheDocument();
      expect(mockRestartPreparation).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId("preparation-countdown")).toHaveTextContent("01:00");
    });

    it("skipping the reading while the text is still streaming turns the streamed text to the main colour", async () => {
      await reachTurnFourStreaming();
      await act(async () => {
        streams[1].handlers.onAttempt?.(1, null);
        streams[1].handlers.onDelta?.("Mở đầu kết luận. ");
      });
      await flush();
      await advance(50);
      expect(screen.getByTestId("ai-live-speech")).toBeInTheDocument();
      expect(screen.queryAllByTestId("read-unspoken").length).toBeGreaterThan(0); // grey: the voice is not there yet

      await act(async () => {
        fireEvent.click(skipButton()); // the rebuttal
      });
      await act(async () => {
        fireEvent.click(skipButton()); // the closing, which is still being written
      });
      await advance(50);
      await act(async () => {
        streams[1].handlers.onDelta?.("Thêm một câu nữa. ");
      });
      await advance(50);
      expect(screen.queryByTestId("read-unspoken")).not.toBeInTheDocument();
      expect(screen.getByTestId("ai-live-speech")).toHaveTextContent("Mở đầu kết luận. Thêm một câu nữa.");
    });

    it("two AI turns in a row (rebuttal, then closing): two messages, one per turn, none twice", async () => {
      await reachTurnFourStreaming();
      await finishTurnFour();
      await advance(50);

      const aiMessages = screen.getAllByTestId("message-item").filter((el) => el.getAttribute("data-speaker") === "AI");
      // Round 1's answer, the rebuttal (turn 3) and the closing (turn 4)
      expect(aiMessages).toHaveLength(3);
      expect(screen.queryByTestId("ai-live-speech")).not.toBeInTheDocument();
      expect(screen.queryByTestId("message-pending-label")).not.toBeInTheDocument();
      expect(screen.getByText(/Kết luận của AI/, { selector: "p, span" })).toBeInTheDocument();
    });

    it("skipping while the closing is still being written stops the rebuttal, and the closing is read when it is ready", async () => {
      await reachTurnFourStreaming();
      await act(async () => {
        streams[1].handlers.onAttempt?.(1, null);
        streams[1].handlers.onDelta?.("Mở đầu kết luận. ");
      });
      await flush();

      await act(async () => {
        fireEvent.click(skipButton());
      });
      await flush();
      expect(mockRestartPreparation).toHaveBeenCalledTimes(1); // the closing is still to come
      expect(screen.getByTestId("preparation-ai-presenting")).toBeInTheDocument();

      await finishTurnFour();
      expect(spoken().some((t) => t.startsWith("Kết luận của AI"))).toBe(true); // the closing is read
      expect(mockRestartPreparation).toHaveBeenCalledTimes(1);

      await act(async () => {
        endSpeech();
      });
      await flush();
      expect(mockRestartPreparation).toHaveBeenCalledTimes(2);
    });
  });

  it("learner CON: the AI's turn 2 written during the preparation keeps the clock hidden until it has been read", async () => {
    userSide = 2;
    mockSubmitArgument.mockImplementation(async () => {
      nextTurnIndex = 2;
      prepEndsAtMs = now() + 60_000; // the learner's turn ends Round 1: the preparation of Round 2 runs
      return { success: true, data: session() };
    });
    render(
      <MemoryRouter initialEntries={["/debater/debate/123?role=CON"]}>
        <Routes>
          <Route path="/debater/debate/:sessionId" element={<DebateRoom />} />
        </Routes>
      </MemoryRouter>
    );
    await flush();
    await advance(60_000); // the AI (PRO) opens Round 1
    mockSubmitAiArgument.mockImplementationOnce(async () => {
      nextTurnIndex = 1;
      return { success: true, data: { turnIndex: 0, alreadyRecorded: false, argument: {}, session: session() } };
    });
    await act(async () => {
      streamHandlers.onAttempt?.(1, null);
      streamHandlers.onDelta?.("Mở đầu. ");
    });
    await act(async () => {
      finishStream("Mở đầu.");
    });
    await flush();
    await act(async () => {
      endSpeech();
    });
    await flush();

    fireEvent.change(screen.getByLabelText("Lập luận của bạn"), { target: { value: "Phản bác của mình." } });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Gửi lập luận"));
    });
    await flush();
    // The AI writes turn 2 while the preparation runs
    await act(async () => {
      streamHandlers.onAttempt?.(1, null);
      streamHandlers.onDelta?.(`${LONG_SPEECH} `);
    });
    await flush();
    expect(screen.getByTestId("preparation-ai-presenting")).toBeInTheDocument();

    mockSubmitAiArgument.mockImplementationOnce(async () => {
      nextTurnIndex = 3;
      return { success: true, data: { turnIndex: 2, alreadyRecorded: false, argument: {}, session: session() } };
    });
    await act(async () => {
      finishStream(LONG_SPEECH);
    });
    await flush();
    expect(screen.getByTestId("preparation-ai-presenting")).toBeInTheDocument(); // recorded, still being read
    expect(mockRestartPreparation).not.toHaveBeenCalled();

    await act(async () => {
      endSpeech();
    });
    await flush();
    expect(mockRestartPreparation).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("preparation-countdown")).toHaveTextContent("01:00");
  });

  it("older Backend: a record refused with PREPARATION_IN_PROGRESS is sent again after the minute, with no error shown", async () => {
    localStorage.setItem("adpp.aiReadAloud", "off");
    prepAfterLearnerTurnMs = 30_000; // the next preparation (30 s to go) is already running when the AI's record is refused
    mockSubmitAiArgument.mockImplementationOnce(async () => {
      nextTurnIndex = 2;
      throw {
        success: false,
        message: "raw backend text",
        errors: { code: "PREPARATION_IN_PROGRESS" },
        status: 409,
      };
    });
    await playRoundOneUntilAiHasWritten();
    expect(mockSubmitAiArgument).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("debate-feedback-banner")).not.toBeInTheDocument();

    await advance(2_000);
    expect(mockSubmitAiArgument).toHaveBeenCalledTimes(1); // not before the end of the preparation

    await advance(30_000);
    expect(mockSubmitAiArgument).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId("debate-feedback-banner")).not.toBeInTheDocument();
    expect(screen.getByText(/Phản bác dài của AI/)).toBeInTheDocument();
  });

  describe("the AI text follows the voice, and the reading speed", () => {
    const spokenText = () => screen.queryAllByTestId("read-spoken").map((el) => el.textContent ?? "").join("");

    it("lights the text up as the voice reaches it, and everything turns to the main colour when the reading is skipped", async () => {
      await playRoundOneUntilAiHasWritten();
      await advance(50);
      // The reading of the AI speech has begun: the whole message is grey so far
      expect(screen.queryByTestId("read-unspoken")).toBeInTheDocument();
      expect(spokenText()).toBe("");

      await act(async () => {
        (queuedUtterances[0] as unknown as { onboundary?: (e: { charIndex: number; charLength: number }) => void })
          .onboundary?.({ charIndex: 16, charLength: 4 });
      });
      await advance(50); // shown at most once a frame
      expect(spokenText().length).toBe(20);
      expect(screen.getByTestId("read-unspoken")).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByTestId("skip-ai-reading-btn"));
      });
      await advance(50);
      expect(screen.queryByTestId("read-unspoken")).not.toBeInTheDocument(); // the whole speech is in the main colour
      expect(screen.getByText(/Phản bác dài của AI/)).toBeInTheDocument();
    });

    it("turning read-aloud off puts the text in the main colour at once", async () => {
      await playRoundOneUntilAiHasWritten();
      await advance(50);
      expect(screen.queryByTestId("read-unspoken")).toBeInTheDocument();
      await act(async () => {
        fireEvent.click(screen.getByTestId("ai-read-aloud-toggle"));
      });
      await advance(50);
      expect(screen.queryByTestId("read-unspoken")).not.toBeInTheDocument();
    });

    it("without read-aloud the AI text is never greyed", async () => {
      localStorage.setItem("adpp.aiReadAloud", "off");
      await playRoundOneUntilAiHasWritten();
      expect(screen.queryByTestId("read-unspoken")).not.toBeInTheDocument();
    });

    it("the speed buttons change the speed and remember it", async () => {
      await playRoundOneUntilAiHasWritten();
      expect(screen.getByTestId("ai-read-rate-btn")).toHaveTextContent("Tốc độ: 1×");
      expect(screen.getByTestId("ai-read-rate-btn")).toHaveAttribute("aria-label", "Tốc độ đọc của AI: 1×");

      fireEvent.click(screen.getByTestId("ai-read-rate-btn"));
      expect(screen.getAllByRole("menuitemradio").map((el) => el.textContent)).toEqual(["0.5×", "0.75×", "1×", "1.25×", "1.5×"]);
      fireEvent.click(screen.getByTestId("ai-read-rate-option-1.5"));

      expect(screen.getByTestId("ai-read-rate-btn")).toHaveTextContent("Tốc độ: 1.5×");
      expect(localStorage.getItem("adpp.aiReadRate")).toBe("1.5");
      expect(screen.queryByTestId("ai-read-rate-menu")).not.toBeInTheDocument();
    });

    it("a remembered speed is read back, and a value outside 0.5 - 1.5 is clamped", async () => {
      localStorage.setItem("adpp.aiReadRate", "9");
      await playRoundOneUntilAiHasWritten();
      expect(screen.getByTestId("ai-read-rate-btn")).toHaveTextContent("Tốc độ: 1.5×");
      // the first sentence of the AI was said at 1.05 x 1.5
      expect(queuedUtterances[0].rate).toBeCloseTo(1.05 * 1.5);
    });

    it("a stored speed that is not a number falls back to 1", async () => {
      localStorage.setItem("adpp.aiReadRate", "abc");
      await playRoundOneUntilAiHasWritten();
      expect(screen.getByTestId("ai-read-rate-btn")).toHaveTextContent("Tốc độ: 1×");
    });
  });

  describe("the AI speech never disappears between the end of the stream and the Backend record", () => {
    // Every AI bubble on screen: the streaming one and the messages
    const bubbles = () =>
      screen.queryAllByTestId("ai-live-speech").length +
      screen.queryAllByTestId("message-item").filter((el) => el.getAttribute("data-speaker") === "AI").length;
    const speechOnScreen = () => document.body.textContent?.includes("Phản bác dài của AI") ?? false;

    /** Counts the AI bubbles after every change of the page, while `fn` runs. */
    const watchBubbles = async (fn: () => Promise<void>) => {
      const counts: number[] = [];
      const observer = new MutationObserver(() => counts.push(bubbles()));
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      try {
        await fn();
      } finally {
        counts.push(...(observer.takeRecords().length ? [bubbles()] : []));
        observer.disconnect();
      }
      return counts;
    };

    /** The learner sends turn 1, the AI streams its answer; the record of the AI turn answers when the test says. */
    const startWithSlowRecord = async () => {
      let answerRecord!: (value: unknown) => void;
      let failRecord!: (error: unknown) => void;
      mockSubmitAiArgument.mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            answerRecord = resolve;
            failRecord = reject;
          })
      );
      render(
        <MemoryRouter initialEntries={["/debater/debate/123?role=PRO"]}>
          <Routes>
            <Route path="/debater/debate/:sessionId" element={<DebateRoom />} />
          </Routes>
        </MemoryRouter>
      );
      await flush();
      await advance(60_000);
      mockSubmitArgument.mockImplementation(async () => {
        nextTurnIndex = 1;
        return { success: true, data: session() };
      });
      fireEvent.change(screen.getByLabelText("Lập luận của bạn"), { target: { value: "Luận điểm của mình." } });
      await act(async () => {
        fireEvent.click(screen.getByLabelText("Gửi lập luận"));
      });
      await flush();
      await act(async () => {
        streamHandlers.onAttempt?.(1, null);
        streamHandlers.onDelta?.(`${LONG_SPEECH} `);
      });
      await flush();
      const recorded = () => {
        nextTurnIndex = 2;
        prepEndsAtMs = now() + 60_000;
        return { success: true, data: { turnIndex: 1, alreadyRecorded: false, argument: {}, session: session() } };
      };
      return { answerRecord: () => answerRecord(recorded()), failRecord: (e: unknown) => failRecord(e) };
    };

    it("from the end of the stream to the answer of the record there is always exactly one bubble with the whole speech", async () => {
      localStorage.setItem("adpp.aiReadAloud", "off");
      const { answerRecord } = await startWithSlowRecord();
      expect(bubbles()).toBe(1); // streaming

      const counts = await watchBubbles(async () => {
        await act(async () => {
          finishStream(LONG_SPEECH);
        });
        await flush();
        await advance(2_000); // the record is slow
        expect(speechOnScreen()).toBe(true);
        expect(bubbles()).toBe(1);
        await act(async () => {
          answerRecord();
        });
        await flush();
      });

      expect(bubbles()).toBe(1);
      expect(speechOnScreen()).toBe(true);
      expect(counts.length).toBeGreaterThan(0);
      expect(counts.every((n) => n === 1)).toBe(true); // never 0, never 2
      expect(screen.queryByTestId("message-pending-label")).not.toBeInTheDocument();
    });

    it("a record that fails keeps the speech on screen, says it is not recorded, and a retry keeps one message", async () => {
      localStorage.setItem("adpp.aiReadAloud", "off");
      const { failRecord } = await startWithSlowRecord();
      await act(async () => {
        finishStream(LONG_SPEECH);
      });
      await flush();
      await act(async () => {
        failRecord(new Error("network down"));
      });
      await flush();

      expect(bubbles()).toBe(1);
      expect(speechOnScreen()).toBe(true);
      expect(screen.getByTestId("message-pending-label")).toHaveTextContent("Chưa ghi lên máy chủ");
      expect(screen.getByTestId("retry-ai-record-btn")).toBeInTheDocument();

      mockSubmitAiArgument.mockImplementationOnce(async () => {
        nextTurnIndex = 2;
        prepEndsAtMs = now() + 60_000;
        return { success: true, data: { turnIndex: 1, alreadyRecorded: false, argument: {}, session: session() } };
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId("retry-ai-record-btn"));
      });
      await flush();

      expect(bubbles()).toBe(1); // still one message, not two
      expect(speechOnScreen()).toBe(true);
      expect(screen.queryByTestId("message-pending-label")).not.toBeInTheDocument();
      expect(mockStreamOpponentTurn).toHaveBeenCalledTimes(1); // /turns was not asked again
    });

    it("a record refused with PREPARATION_IN_PROGRESS: the speech shows while it waits, then is recorded", async () => {
      localStorage.setItem("adpp.aiReadAloud", "off");
      prepAfterLearnerTurnMs = 30_000;
      const { failRecord } = await startWithSlowRecord();
      await act(async () => {
        finishStream(LONG_SPEECH);
      });
      await flush();
      await act(async () => {
        failRecord({ success: false, errors: { code: "PREPARATION_IN_PROGRESS" }, status: 409 });
      });
      await flush();

      expect(bubbles()).toBe(1);
      expect(speechOnScreen()).toBe(true);
      expect(screen.getByTestId("message-pending-label")).toHaveTextContent("Đang chờ ghi…");
      expect(screen.queryByTestId("debate-feedback-banner")).not.toBeInTheDocument();

      mockSubmitAiArgument.mockImplementationOnce(async () => {
        nextTurnIndex = 2;
        return { success: true, data: { turnIndex: 1, alreadyRecorded: false, argument: {}, session: session() } };
      });
      await advance(2_000); // the minute is over (on the clock the room knows): the record is sent again
      await flush();
      expect(mockSubmitAiArgument).toHaveBeenCalledTimes(2);
      expect(bubbles()).toBe(1);
      expect(speechOnScreen()).toBe(true);
      expect(screen.queryByTestId("message-pending-label")).not.toBeInTheDocument();
    });

    it("the lit-up part of the text is not reset when the streaming bubble becomes the message", async () => {
      const { answerRecord } = await startWithSlowRecord();
      await advance(50);
      await act(async () => {
        (queuedUtterances[0] as unknown as { onboundary?: (e: { charIndex: number; charLength: number }) => void })
          .onboundary?.({ charIndex: 16, charLength: 4 });
      });
      await advance(50);
      const spoken = () => screen.queryAllByTestId("read-spoken").map((el) => el.textContent ?? "").join("");
      expect(spoken()).toHaveLength(20);

      await act(async () => {
        finishStream(LONG_SPEECH);
      });
      await flush();
      await advance(50);
      // Now a message (the record has not answered): the reading goes on from the same place
      expect(screen.queryByTestId("ai-live-speech")).not.toBeInTheDocument();
      expect(spoken()).toHaveLength(20);
      expect(screen.queryAllByTestId("read-unspoken").length).toBeGreaterThan(0);

      await act(async () => {
        answerRecord();
      });
      await flush();
      await advance(50);
      expect(spoken()).toHaveLength(20);
      expect(queuedUtterances.length).toBeGreaterThan(0); // the reader was not cut
    });

    it("a stream that breaks halfway is not kept on screen", async () => {
      localStorage.setItem("adpp.aiReadAloud", "off");
      render(
        <MemoryRouter initialEntries={["/debater/debate/123?role=PRO"]}>
          <Routes>
            <Route path="/debater/debate/:sessionId" element={<DebateRoom />} />
          </Routes>
        </MemoryRouter>
      );
      await flush();
      await advance(60_000);
      let failStream!: (error: unknown) => void;
      mockStreamOpponentTurn.mockImplementationOnce(
        (_id: string, _body: unknown, handlers: OpponentTurnStreamHandlers) =>
          new Promise((_resolve, reject) => {
            streamHandlers = handlers;
            failStream = reject;
          })
      );
      mockSubmitArgument.mockImplementation(async () => {
        nextTurnIndex = 1;
        return { success: true, data: session() };
      });
      fireEvent.change(screen.getByLabelText("Lập luận của bạn"), { target: { value: "Luận điểm của mình." } });
      await act(async () => {
        fireEvent.click(screen.getByLabelText("Gửi lập luận"));
      });
      await flush();
      await act(async () => {
        streamHandlers.onAttempt?.(1, null);
        streamHandlers.onDelta?.("Bài nói dở dang. ");
      });
      expect(screen.getByTestId("ai-live-speech")).toBeInTheDocument();

      await act(async () => {
        failStream({ status: 504, detail: "timeout" });
      });
      await flush();
      expect(screen.queryByTestId("ai-live-speech")).not.toBeInTheDocument();
      expect(document.body.textContent).not.toContain("Bài nói dở dang");
      expect(screen.queryAllByTestId("message-item").filter((el) => el.getAttribute("data-speaker") === "AI")).toHaveLength(0);
    });
  });
});

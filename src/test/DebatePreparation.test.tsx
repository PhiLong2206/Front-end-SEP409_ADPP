import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import DebateRoom from "../pages/debater/DebatePractice/DebateRoom";
import type { DebateHubCallbacks } from "../services/debateHub";

window.HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { userId: 1, id: 1, fullName: "Debater Test", role: "Debater" },
    isAuthenticated: true,
  }),
}));

let hubCallbacks: DebateHubCallbacks = {};
vi.mock("../services/debateHub", () => ({
  debateHubService: {
    connect: vi.fn(async (_id: number, callbacks: DebateHubCallbacks) => {
      hubCallbacks = callbacks;
    }),
    disconnect: vi.fn(async () => {}),
    sendSpeakingStatus: vi.fn(),
    sendLiveTranscript: vi.fn(),
  },
}));

const mockCreateOpponentSession = vi.fn();
const mockGetOpponentCasePlan = vi.fn();
const mockGenerateOpponentTurn = vi.fn();
const mockEvaluateSpeechArgument = vi.fn();
const mockGetSessionDetails = vi.fn();
const mockGetTranscript = vi.fn();
const mockSubmitArgument = vi.fn();
const mockSubmitAiArgument = vi.fn();
const mockSkipPreparation = vi.fn();

vi.mock("../api", () => ({
  aiApi: {
    createOpponentSession: (...args: unknown[]) => mockCreateOpponentSession(...args),
    getOpponentCasePlan: (...args: unknown[]) => mockGetOpponentCasePlan(...args),
    generateOpponentTurn: (...args: unknown[]) => mockGenerateOpponentTurn(...args),
    evaluateSpeechArgument: (...args: unknown[]) => mockEvaluateSpeechArgument(...args),
    evaluateDebateRound: vi.fn(),
    evaluateDebateSession: vi.fn(),
  },
  debateApi: {
    getSessionDetails: (...args: unknown[]) => mockGetSessionDetails(...args),
    getTranscript: (...args: unknown[]) => mockGetTranscript(...args),
    getPendingSwapRequests: vi.fn().mockResolvedValue({ success: true, data: [] }),
    startDebateSession: vi.fn().mockResolvedValue({ success: true }),
    submitArgument: (...args: unknown[]) => mockSubmitArgument(...args),
    submitAiArgument: (...args: unknown[]) => mockSubmitAiArgument(...args),
    skipPreparation: (...args: unknown[]) => mockSkipPreparation(...args),
  },
}));

/** The real server time of the test: 2026-11-20 10:00:00 UTC. The machine clock may be set apart from it. */
const SERVER_T0 = Date.parse("2026-11-20T10:00:00.000Z");

describe("the preparation before Round 1 and the round announcements", () => {
  // How far the machine's clock is from the server's, and when the preparation ends (server clock)
  let machineOffsetMs = 0;
  let prepEndsAtMs = SERVER_T0 + 60_000;
  let mode: "ai" | "p2p" = "ai";
  let userSide = 1;
  let canSkip = true;
  let serverStillPreparingUntilMs = 0; // the Backend keeps saying "preparing" until the server clock passes this
  let userInRoom = true;

  const serverNow = () => Date.now() - machineOffsetMs;

  /** What the Backend answers right now: still preparing until the server clock reaches the end of the preparation. */
  const sessionNow = () => {
    const sNow = serverNow();
    const preparing = sNow < Math.max(prepEndsAtMs, serverStillPreparingUntilMs);
    return {
      sessionId: 123,
      title: "Phiên chuẩn bị",
      topic: "Mạng xã hội có hại hơn lợi?",
      status: 2,
      debateType: mode === "ai" ? 1 : 2,
      createdByUserId: 1,
      createdAt: "2026-11-20T09:55:00Z",
      currentStage: 1,
      currentTurnSide: 1,
      participants: !userInRoom
        ? [
            { userId: 7, side: 1, isAI: false, speakerName: "Người A" },
            { userId: 8, side: 2, isAI: false, speakerName: "Người B" },
          ]
        : mode === "ai"
          ? [
              { userId: 1, side: userSide, isAI: false, speakerName: "Debater Test" },
              { userId: null, side: userSide === 1 ? 2 : 1, isAI: true, speakerName: "AI" },
            ]
          : [
              { userId: 1, side: userSide, isAI: false, speakerName: "Debater Test" },
              { userId: 2, side: userSide === 1 ? 2 : 1, isAI: false, speakerName: "Đối thủ" },
            ],
      preparationSeconds: 60,
      preparationEndsAt: new Date(prepEndsAtMs).toISOString(),
      isPreparing: preparing,
      canSkipPreparation: preparing && canSkip,
      totalRounds: 3,
      serverTime: new Date(sNow).toISOString(),
      currentTurn: {
        turnId: 1,
        turnIndex: 0,
        turnOrder: 1,
        stage: 1,
        side: 1,
        roundLabel: "Mở đầu",
        timeLimitSeconds: 135,
        status: preparing ? 1 : 2,
        startedAt: new Date(prepEndsAtMs).toISOString(),
      },
    };
  };

  const flush = async () => {
    for (let i = 0; i < 6; i++) {
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

  const renderRoom = async (role: "PRO" | "CON" = "PRO") => {
    userSide = role === "PRO" ? 1 : 2;
    render(
      <MemoryRouter initialEntries={[`/debater/debate/123?role=${role}`]}>
        <Routes>
          <Route path="/debater/debate/:sessionId" element={<DebateRoom />} />
          <Route path="/debater/debate/:sessionId/result" element={<div>Result</div>} />
        </Routes>
      </MemoryRouter>
    );
    await flush();
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(SERVER_T0);
    sessionStorage.clear();
    machineOffsetMs = 0;
    prepEndsAtMs = SERVER_T0 + 60_000;
    mode = "ai";
    canSkip = true;
    serverStillPreparingUntilMs = 0;
    userInRoom = true;
    hubCallbacks = {};
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetSessionDetails.mockImplementation(async () => ({ success: true, data: sessionNow() }));
    mockGetTranscript.mockResolvedValue({ success: true, data: { arguments: [] } });
    mockCreateOpponentSession.mockResolvedValue({ opponent_session_id: "opp-1", status: "ready" });
    mockGetOpponentCasePlan.mockResolvedValue(null);
    mockGenerateOpponentTurn.mockImplementation(async (_id: string, body: { turn_index: number }) => ({
      turn_index: body.turn_index,
      round_type: "opening",
      mode: "opening_first",
      speech_text: `Lượt AI số ${body.turn_index}`,
    }));
    mockSubmitAiArgument.mockResolvedValue({ success: true, data: { turnIndex: 0, alreadyRecorded: false, argument: {}, session: sessionNow() } });
    mockEvaluateSpeechArgument.mockResolvedValue({
      overall_score: 8,
      overall_reasoning: "Tốt",
      criteria: [],
      strengths: [],
      weaknesses: [],
      suggestions: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("shows the countdown, the motion and the side, locks recording and sending, and does not call the AI (AI speaks first)", async () => {
    await renderRoom("CON"); // the learner is CON: the AI (PRO) would open Round 1

    expect(screen.getByTestId("preparation-panel")).toBeInTheDocument();
    expect(screen.getByText("Thời gian chuẩn bị")).toBeInTheDocument();
    expect(screen.getByTestId("preparation-countdown")).toHaveTextContent("01:00");
    expect(screen.getByTestId("preparation-motion")).toHaveTextContent("Mạng xã hội có hại hơn lợi?");
    expect(screen.getByTestId("preparation-side")).toHaveTextContent("Phản đối (CON)");
    expect(screen.getByText("Vòng 1 – Mở đầu sắp bắt đầu")).toBeInTheDocument();
    expect(screen.getByTestId("round-label")).toHaveTextContent("Chuẩn bị");

    expect(screen.getByLabelText("Lập luận của bạn")).toBeDisabled();
    expect(screen.getByLabelText("Gửi lập luận")).toBeDisabled();
    expect(screen.getByLabelText("Ghi âm giọng nói & phân tích biểu cảm")).toBeDisabled();

    await advance(30_000);
    expect(screen.getByTestId("preparation-countdown")).toHaveTextContent("00:30");
    expect(mockGenerateOpponentTurn).not.toHaveBeenCalled();
    expect(mockSubmitArgument).not.toHaveBeenCalled();
  });

  it("at 00:00 it reads the session again, then starts Round 1 with its banner, and only then the AI opens", async () => {
    await renderRoom("CON");
    const callsBefore = mockGetSessionDetails.mock.calls.length;

    await advance(60_000);

    expect(mockGetSessionDetails.mock.calls.length).toBeGreaterThan(callsBefore);
    expect(screen.queryByTestId("preparation-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("round-banner")).toHaveTextContent("Vòng 1 – Mở đầu");
    expect(screen.getByTestId("round-label")).toHaveTextContent("Vòng 1/3 – Mở đầu");
    expect(mockGenerateOpponentTurn).toHaveBeenCalledTimes(1); // the AI opened once the preparation was over

    await advance(3_000);
    expect(screen.queryByTestId("round-banner")).not.toBeInTheDocument(); // the banner lasts about 3 seconds
  });

  it("AI practice: 'Bắt đầu ngay' skips the preparation through the API and starts Round 1", async () => {
    await renderRoom("PRO");
    mockSkipPreparation.mockImplementation(async () => {
      prepEndsAtMs = serverNow(); // the Backend moves the start of Round 1 to now
      return { success: true, data: sessionNow() };
    });

    fireEvent.click(screen.getByTestId("skip-preparation-btn"));
    await flush();

    expect(mockSkipPreparation).toHaveBeenCalledWith(123);
    expect(screen.queryByTestId("preparation-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("round-banner")).toHaveTextContent("Vòng 1 – Mở đầu");
    expect(screen.getByLabelText("Lập luận của bạn")).not.toBeDisabled();
  });

  it("after 'Bắt đầu ngay' the Round 1 deadline counts from the skip, not from the planned end of the preparation", async () => {
    await renderRoom("PRO"); // the preparation was planned to end 60 s from now
    mockSkipPreparation.mockImplementation(async () => {
      // The Backend keeps the planned end in the response: the skip is only visible as "not preparing any more"
      const skipped = { ...sessionNow(), isPreparing: false, canSkipPreparation: false, serverTime: new Date(serverNow()).toISOString() };
      return { success: true, data: skipped };
    });
    mockGetSessionDetails.mockImplementation(async () => ({
      success: true,
      data: { ...sessionNow(), isPreparing: false, canSkipPreparation: false },
    }));

    fireEvent.click(screen.getByTestId("skip-preparation-btn"));
    await flush();

    // Round 1 began at the skip (now): the learner has the full 135 s
    expect(screen.getByTestId("debate-countdown-timer")).toHaveTextContent("02:15");
  });

  it("when the server still says 'preparing' after 00:00 the room stays locked and asks again until Round 1 begins", async () => {
    serverStillPreparingUntilMs = SERVER_T0 + 64_000; // 4 s after the countdown reached zero
    await renderRoom("PRO");

    await advance(62_000);
    expect(screen.getByTestId("preparation-panel")).toBeInTheDocument(); // still locked
    expect(screen.getByLabelText("Lập luận của bạn")).toBeDisabled();
    expect(screen.queryByTestId("round-banner")).not.toBeInTheDocument();

    await advance(3_000);
    expect(screen.queryByTestId("preparation-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("round-banner")).toHaveTextContent("Vòng 1 – Mở đầu");
  });

  it("someone who only watches (not a participant) sees the preparation without a side or a skip button", async () => {
    mode = "p2p";
    userInRoom = false;
    await renderRoom("PRO");

    expect(screen.getByTestId("preparation-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("preparation-side")).not.toBeInTheDocument();
    expect(screen.queryByTestId("skip-preparation-btn")).not.toBeInTheDocument();
  });

  it("a debate between learners (canSkipPreparation false) has no 'Bắt đầu ngay' button", async () => {
    mode = "p2p";
    canSkip = false;
    await renderRoom("PRO");

    expect(screen.getByTestId("preparation-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("skip-preparation-btn")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Lập luận của bạn")).toBeDisabled();
  });

  it("counts down on the server clock: a machine clock 5 minutes off still shows the seconds left", async () => {
    machineOffsetMs = 5 * 60_000; // the machine is 5 minutes ahead of the server
    vi.setSystemTime(SERVER_T0 + machineOffsetMs);
    prepEndsAtMs = SERVER_T0 + 45_000;
    await renderRoom("PRO");

    expect(screen.getByTestId("preparation-countdown")).toHaveTextContent("00:45");
    await advance(10_000);
    expect(screen.getByTestId("preparation-countdown")).toHaveTextContent("00:35");
  });

  it("after a reload in the middle of the preparation it keeps counting from the end time, not from 60 s", async () => {
    prepEndsAtMs = SERVER_T0 + 20_000; // 40 s of the 60 s have already gone
    await renderRoom("PRO");
    expect(screen.getByTestId("preparation-countdown")).toHaveTextContent("00:20");
  });

  it("RoundStarted shows the banner once and changes the label at the top of the room", async () => {
    await renderRoom("PRO");
    await advance(60_000); // Round 1 begins
    await advance(3_000);
    expect(screen.queryByTestId("round-banner")).not.toBeInTheDocument();

    const event = {
      sessionId: 123,
      roundNumber: 2,
      totalRounds: 3,
      roundLabel: "Phản biện",
      startedAt: new Date(serverNow()).toISOString(),
      currentTurnSide: "CON" as const,
    };
    await act(async () => {
      hubCallbacks.onRoundStarted?.(event);
    });

    expect(screen.getAllByTestId("round-banner")).toHaveLength(1);
    expect(screen.getByTestId("round-banner")).toHaveTextContent("Vòng 2 – Phản biện");
    expect(screen.getByTestId("round-banner")).toHaveAttribute("class", expect.stringContaining("animate-fade-in"));
    expect(screen.getByTestId("round-label")).toHaveTextContent("Vòng 2/3 – Phản biện");

    // The same round again (a repeated event, or a reload) is not announced twice
    await advance(3_000);
    expect(screen.queryByTestId("round-banner")).not.toBeInTheDocument();
    await act(async () => {
      hubCallbacks.onRoundStarted?.(event);
    });
    expect(screen.queryByTestId("round-banner")).not.toBeInTheDocument();
  });

  it("the banner is a polite live region that does not block clicks", async () => {
    await renderRoom("PRO");
    await advance(60_000);

    const banner = screen.getByTestId("round-banner");
    const region = banner.parentElement!;
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region.className).toContain("pointer-events-none");
  });

  it("Round 1 deadline = the end of the preparation + the turn time (also with a machine clock that is off)", async () => {
    machineOffsetMs = 5 * 60_000;
    vi.setSystemTime(SERVER_T0 + machineOffsetMs);
    prepEndsAtMs = SERVER_T0 - 10_000; // the preparation ended 10 s ago on the server clock
    await renderRoom("PRO"); // the learner speaks first

    // 135 s of the turn minus the 10 s already gone
    expect(screen.getByTestId("debate-countdown-timer")).toHaveTextContent("02:05");
    const deadline = Number(sessionStorage.getItem("adpp_turn_deadline_123_ai_r1_pro"));
    expect(deadline).toBe(Date.now() + 125_000);
  });

  it("a speech refused with 409 PREPARATION_IN_PROGRESS is not a network error: the text stays and the session is read again", async () => {
    prepEndsAtMs = SERVER_T0 - 1_000; // the server already says: no preparation
    await renderRoom("PRO");
    mockSubmitArgument.mockRejectedValue({
      success: false,
      message: "raw backend text",
      errors: { code: "PREPARATION_IN_PROGRESS" },
      status: 409,
    });
    const callsBefore = mockGetSessionDetails.mock.calls.length;

    fireEvent.change(screen.getByLabelText("Lập luận của bạn"), { target: { value: "Luận điểm mở đầu." } });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Gửi lập luận"));
    });
    await flush();

    expect(screen.getByTestId("debate-feedback-banner")).toHaveTextContent("Đang trong thời gian chuẩn bị");
    expect((screen.getByLabelText("Lập luận của bạn") as HTMLTextAreaElement).value).toBe("Luận điểm mở đầu.");
    expect(mockGetSessionDetails.mock.calls.length).toBeGreaterThan(callsBefore);
    expect(mockGenerateOpponentTurn).not.toHaveBeenCalled();
  });
});

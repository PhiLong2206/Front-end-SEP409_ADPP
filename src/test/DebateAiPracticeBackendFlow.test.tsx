import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
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
const mockGetSessionDetails = vi.fn();
const mockGetTranscript = vi.fn();
const mockSubmitArgument = vi.fn();
const mockSubmitAiArgument = vi.fn();
const mockEvaluateDebateRound = vi.fn();
const mockEvaluateDebateSession = vi.fn();
const mockGetEvaluation = vi.fn();

vi.mock("../api", () => ({
  aiApi: {
    createOpponentSession: (...args: unknown[]) => mockCreateOpponentSession(...args),
    getOpponentCasePlan: (...args: unknown[]) => mockGetOpponentCasePlan(...args),
    generateOpponentTurn: (...args: unknown[]) => mockGenerateOpponentTurn(...args),
    evaluateSpeechArgument: (...args: unknown[]) => mockEvaluateSpeechArgument(...args),
    evaluateDebateRound: (...args: unknown[]) => mockEvaluateDebateRound(...args),
    evaluateDebateSession: (...args: unknown[]) => mockEvaluateDebateSession(...args),
  },
  debateApi: {
    getSessionDetails: (...args: unknown[]) => mockGetSessionDetails(...args),
    getTranscript: (...args: unknown[]) => mockGetTranscript(...args),
    getEvaluation: (...args: unknown[]) => mockGetEvaluation(...args),
    getPendingSwapRequests: vi.fn().mockResolvedValue({ success: true, data: [] }),
    startDebateSession: vi.fn().mockResolvedValue({ success: true }),
    submitArgument: (...args: unknown[]) => mockSubmitArgument(...args),
    submitAiArgument: (...args: unknown[]) => mockSubmitAiArgument(...args),
  },
}));

/** Backend turn order (DebateTurnOrder.cs), index 0..5 */
const TURN_SIDES = [1, 2, 1, 2, 2, 1]; // 1 = PRO, 2 = CON

describe("AI practice against a simulated Backend: the Backend decides whose turn is next", () => {
  let recorded = 0;
  let calls: string[] = [];
  let userSide = 1;

  const sessionAfter = (done: number) => ({
    sessionId: 123,
    title: "AI practice",
    topic: "Mạng xã hội có hại hơn lợi?",
    status: done >= 6 ? 3 : 2,
    debateType: 1,
    createdByUserId: 1,
    createdAt: "2026-11-03T10:15:30.123Z",
    participants: [
      { userId: 1, side: userSide, isAI: false, speakerName: "Debater Test" },
      { userId: null, side: userSide === 1 ? 2 : 1, isAI: true, speakerName: "AI" },
    ],
    currentTurn: done < 6 ? { turnIndex: done, side: TURN_SIDES[done], turnOrder: done + 1 } : undefined,
  });

  const reject = (code: string) =>
    Promise.reject({ success: false, message: "raw backend text", errors: { code }, status: 409 });

  const flush = async () => {
    for (let i = 0; i < 6; i++) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  };

  const renderRoom = async (role: "PRO" | "CON") => {
    userSide = role === "PRO" ? 1 : 2;
    mockGetSessionDetails.mockResolvedValue({ success: true, data: sessionAfter(0) });
    render(
      <MemoryRouter initialEntries={[`/debater/debate/123?role=${role}`]}>
        <Routes>
          <Route path="/debater/debate/:sessionId" element={<DebateRoom />} />
        </Routes>
      </MemoryRouter>
    );
    await flush();
  };

  const submit = async (text: string) => {
    fireEvent.change(screen.getByLabelText("Lập luận của bạn"), { target: { value: text } });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Gửi lập luận"));
    });
    await flush();
  };

  const opponentTurns = () => mockGenerateOpponentTurn.mock.calls.map(([, body]) => body.turn_index);

  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    recorded = 0;
    calls = [];
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateOpponentSession.mockResolvedValue({ opponent_session_id: "opp-1", status: "ready" });
    mockGetOpponentCasePlan.mockResolvedValue(null);
    mockGetTranscript.mockResolvedValue({ success: true, data: { arguments: [] } });
    mockEvaluateSpeechArgument.mockResolvedValue({
      overall_score: 8,
      overall_reasoning: "Tốt",
      criteria: [],
      strengths: [],
      weaknesses: [],
      suggestions: [],
    });
    mockGenerateOpponentTurn.mockImplementation(async (_id: string, body: { turn_index: number }) => ({
      turn_index: body.turn_index,
      round_type: "x",
      mode: "reply",
      speech_text: `Lượt AI số ${body.turn_index - 1}`, // Backend index of the turn
    }));
    mockSubmitArgument.mockImplementation((_id: number, body: { content: string }) => {
      if (recorded >= 6 || TURN_SIDES[recorded] !== userSide) return reject("NOT_YOUR_TURN");
      calls.push(`user:${recorded}`);
      recorded++;
      return Promise.resolve({ success: true, message: "ok", data: sessionAfter(recorded), content: body.content });
    });
    mockSubmitAiArgument.mockImplementation((_id: number, body: { turnIndex: number }) => {
      if (body.turnIndex !== recorded) return reject("TURN_OUT_OF_ORDER");
      if (TURN_SIDES[body.turnIndex] === userSide) return reject("NOT_AI_TURN");
      calls.push(`ai:${body.turnIndex}`);
      recorded++;
      return Promise.resolve({
        success: true,
        message: "ok",
        data: { turnIndex: body.turnIndex, alreadyRecorded: false, argument: {}, session: sessionAfter(recorded) },
      });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("learner PRO: runs all 6 turns, the AI speaks turns 3 and 4 back to back, and the learner closes (turn 5)", async () => {
    await renderRoom("PRO");

    await submit("PRO mở đầu");
    await submit("PRO phản biện");
    // after the rebuttal the AI played BOTH turn 3 (rebuttal CON) and turn 4 (closing CON)
    expect(calls).toEqual(["user:0", "ai:1", "user:2", "ai:3", "ai:4"]);
    expect(screen.getByText(/Vòng 3\/3/)).toBeInTheDocument();
    expect(screen.getByLabelText("Lập luận của bạn")).not.toBeDisabled();

    await submit("PRO kết luận");

    expect(calls).toEqual(["user:0", "ai:1", "user:2", "ai:3", "ai:4", "user:5"]);
    expect(opponentTurns()).toEqual([2, 4, 5]); // opponent service turn_index = turnIndex + 1
    expect(screen.getByTestId("debate-completed-banner")).toBeInTheDocument();
  });

  it("final grading: the official result of the Backend session, nothing graded by the FE itself", async () => {
    const part = (overallScore: number) => ({
      side: "x",
      speakerName: "x",
      overallScore,
      stageBreakdown: {},
      progressTrend: "",
      strengths: [],
      weaknesses: [],
      suggestions: [],
      roundEvaluations: [],
    });
    mockGetEvaluation.mockResolvedValue({
      success: true,
      message: "ok",
      data: { judgementId: 1, sessionId: 123, suggestedWinnerSide: "PRO", evaluatedAt: "", proEvaluation: part(7), conEvaluation: part(4) },
    });
    await renderRoom("PRO");
    await submit("PRO mở đầu");
    await submit("PRO phản biện");
    await submit("PRO kết luận");

    await act(async () => {
      fireEvent.click(screen.getByTestId("header-submit-debate-btn"));
    });
    await flush();

    expect(mockGetEvaluation).toHaveBeenCalledTimes(1);
    expect(mockGetEvaluation).toHaveBeenCalledWith("123");
    expect(mockEvaluateDebateRound).not.toHaveBeenCalled();
    expect(mockEvaluateDebateSession).not.toHaveBeenCalled();
  });

  it("learner CON: the AI opens (turn 0), the learner speaks turns 3 and 4 back to back, the AI closes (turn 5)", async () => {
    await renderRoom("CON");

    expect(calls).toEqual(["ai:0"]);
    expect(opponentTurns()).toEqual([1]);

    await submit("CON mở đầu");
    expect(calls).toEqual(["ai:0", "user:1", "ai:2"]);

    // rebuttal (turn 3): no AI turn follows, the learner immediately plays the closing (turn 4)
    await submit("CON phản biện");
    expect(calls).toEqual(["ai:0", "user:1", "ai:2", "user:3"]);
    expect(screen.getByText(/Vòng 3\/3/)).toBeInTheDocument();
    expect(screen.getByLabelText("Lập luận của bạn")).not.toBeDisabled();
    expect(screen.getByTestId("debate-countdown-timer")).toHaveTextContent("02:00");

    await submit("CON kết luận");

    expect(calls).toEqual(["ai:0", "user:1", "ai:2", "user:3", "user:4", "ai:5"]);
    expect(opponentTurns()).toEqual([1, 3, 6]);
    expect(screen.getByTestId("debate-completed-banner")).toBeInTheDocument();
  });

  it("follows the Backend's currentTurn over the fixed table: if the Backend says it is the learner's turn again, no AI turn is requested", async () => {
    await renderRoom("PRO");
    // The table would expect an AI turn after turn 0, but the Backend reports turn 2 (PRO = the learner) as next
    mockSubmitArgument.mockImplementationOnce(() =>
      Promise.resolve({ success: true, message: "ok", data: sessionAfter(2) })
    );

    await submit("PRO mở đầu");

    expect(mockGenerateOpponentTurn).not.toHaveBeenCalled();
    expect(mockSubmitAiArgument).not.toHaveBeenCalled();
    expect(screen.getByText(/Vòng 2\/3/)).toBeInTheDocument();
    expect(screen.getByLabelText("Lập luận của bạn")).not.toBeDisabled();
  });

  it("blocks the chain on a TURN_OUT_OF_ORDER error with a Vietnamese message, and retries only the recording step", async () => {
    await renderRoom("PRO");
    mockSubmitAiArgument.mockImplementationOnce(() => reject("TURN_OUT_OF_ORDER"));

    await submit("PRO mở đầu");

    expect(screen.getByTestId("debate-feedback-banner")).toHaveTextContent("Không ghi được lượt của Đối thủ AI");
    expect(screen.getByTestId("debate-feedback-banner")).toHaveTextContent("không đúng thứ tự");
    expect(screen.getByTestId("debate-feedback-banner")).not.toHaveTextContent("raw backend text");
    expect(screen.queryByText("Lượt AI số 1")).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId("retry-ai-record-btn"));
    });
    await flush();

    expect(mockGenerateOpponentTurn).toHaveBeenCalledTimes(1); // /turns is not called again
    expect(mockSubmitArgument).toHaveBeenCalledTimes(1); // nor the user's /arguments
    expect(calls).toEqual(["user:0", "ai:1"]);
    expect(screen.getByText("Lượt AI số 1")).toBeInTheDocument();
    expect(screen.getByText(/Vòng 2\/3/)).toBeInTheDocument();
  });
});

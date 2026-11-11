import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
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
    getSessionDetails: vi.fn(),
    getTranscript: vi.fn(),
    submitArgument: vi.fn(),
    getEvaluation: (...args: unknown[]) => mockGetEvaluation(...args),
  },
}));

const ResultProbe = () => {
  const state = useLocation().state as { result?: { overallScore: number } } | null;
  return <div data-testid="result-page">Điểm: {state?.result?.overallScore}</div>;
};

const side = (overallScore: number) => ({
  side: "PRO",
  speakerName: "Debater Test",
  overallScore,
  stageBreakdown: { opening: overallScore, rebuttal: overallScore, closing: overallScore },
  progressTrend: "ổn định",
  strengths: [],
  weaknesses: [],
  suggestions: [],
  roundEvaluations: [],
});
/** Official result: PRO (the user, ?role=PRO) 6/10 → shown as 60. */
const officialResult = {
  success: true,
  message: "ok",
  data: { judgementId: 1, sessionId: 1, suggestedWinnerSide: "CON", evaluatedAt: "", proEvaluation: side(6), conEvaluation: side(9) },
};

describe("Final grading progress overlay and per-turn indicator", () => {
  const flush = async () => {
    for (let i = 0; i < 4; i++) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  };

  const renderRoom = async () => {
    render(
      <MemoryRouter initialEntries={["/debater/debate/grading-progress?role=PRO"]}>
        <Routes>
          <Route path="/debater/debate/:sessionId" element={<DebateRoom />} />
          <Route path="/debater/debate/:sessionId/result" element={<ResultProbe />} />
        </Routes>
      </MemoryRouter>
    );
    await flush();
  };

  const completeThreeRounds = async () => {
    for (let round = 1; round <= 3; round++) {
      fireEvent.change(screen.getByLabelText("Lập luận của bạn"), { target: { value: `Lập luận vòng ${round}` } });
      await act(async () => {
        fireEvent.click(screen.getByLabelText("Gửi lập luận"));
      });
    }
    expect(screen.getByTestId("debate-completed-banner")).toBeInTheDocument();
  };

  const submitFinal = async () => {
    await act(async () => {
      fireEvent.click(screen.getByTestId("header-submit-debate-btn"));
    });
  };

  type Deferred = { resolve: (v: unknown) => void; reject: (e: unknown) => void };
  let evaluationCalls: Deferred[];

  const progress = () => screen.getByTestId("grading-progress");

  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    evaluationCalls = [];
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateOpponentSession.mockResolvedValue({ opponent_session_id: "opp-1", status: "ready" });
    mockGetOpponentCasePlan.mockResolvedValue(null);
    mockGenerateOpponentTurn.mockResolvedValue({
      turn_index: 2,
      round_type: "opening",
      mode: "reply",
      speech_text: "Phản hồi từ Đối thủ AI.",
    });
    mockEvaluateSpeechArgument.mockResolvedValue({
      overall_score: 8,
      overall_reasoning: "Tốt",
      criteria: [],
      strengths: [],
      weaknesses: [],
      suggestions: [],
    });
    // GET /evaluation stays pending until the test resolves it (the Backend may be evaluating)
    mockGetEvaluation.mockImplementation(
      () =>
        new Promise((resolve, reject) => {
          evaluationCalls.push({ resolve, reject });
        })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("shows one step while the official result is fetched, and closes when it arrives", async () => {
    await renderRoom();
    await completeThreeRounds();
    expect(screen.queryByTestId("grading-overlay")).not.toBeInTheDocument();

    await submitFinal();
    expect(screen.getByTestId("grading-overlay")).toBeInTheDocument();
    expect(screen.getByText("Đang chấm điểm phiên tranh biện...")).toBeInTheDocument();
    expect(progress()).toHaveTextContent("Đang tổng hợp kết quả...");
    expect(screen.getByTestId("header-submit-debate-btn")).toBeDisabled();
    // The Backend grades: the FE no longer calls the evaluator for the rounds or the session
    expect(mockGetEvaluation).toHaveBeenCalledTimes(1);
    expect(mockEvaluateDebateRound).not.toHaveBeenCalled();
    expect(mockEvaluateDebateSession).not.toHaveBeenCalled();

    await act(async () => evaluationCalls[0].resolve(officialResult));
    expect(screen.queryByTestId("grading-overlay")).not.toBeInTheDocument();
    expect(screen.getByTestId("result-page")).toHaveTextContent("Điểm: 60");
  });

  it("adds the 'may take up to a minute' hint only after about 15 seconds", async () => {
    await renderRoom();
    await completeThreeRounds();
    await submitFinal();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(14_000);
    });
    expect(screen.queryByTestId("grading-slow-hint")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(screen.getByTestId("grading-slow-hint")).toHaveTextContent(
      "Quá trình chấm có thể mất đến 1 phút, vui lòng không đóng trang."
    );
  });

  it("asks before the tab is closed while grading, and not afterwards", async () => {
    await renderRoom();
    await completeThreeRounds();
    await submitFinal();

    const during = new Event("beforeunload", { cancelable: true });
    const duringSpy = vi.spyOn(during, "preventDefault");
    window.dispatchEvent(during);
    expect(duringSpy).toHaveBeenCalled();

    await act(async () => evaluationCalls[0].reject(new Error("evaluation down")));
    expect(screen.queryByTestId("grading-overlay")).not.toBeInTheDocument();

    const after = new Event("beforeunload", { cancelable: true });
    const afterSpy = vi.spyOn(after, "preventDefault");
    window.dispatchEvent(after);
    expect(afterSpy).not.toHaveBeenCalled();
  });

  it("closes the overlay on an error, shows the banner with a retry, and the retry fetches the result again", async () => {
    await renderRoom();
    await completeThreeRounds();
    await submitFinal();

    await act(async () => evaluationCalls[0].reject({ success: false, status: 404, message: "No evaluation found" }));

    expect(screen.queryByTestId("grading-overlay")).not.toBeInTheDocument();
    expect(screen.getByTestId("debate-feedback-banner")).toHaveTextContent("Chưa chấm được kết quả tranh biện");

    await act(async () => {
      fireEvent.click(screen.getByTestId("retry-finish-evaluation-btn"));
    });
    expect(screen.getByTestId("grading-overlay")).toBeInTheDocument();
    expect(progress()).toHaveTextContent("Đang tổng hợp kết quả...");

    await act(async () => evaluationCalls[1].resolve(officialResult));
    expect(mockGetEvaluation).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("result-page")).toHaveTextContent("Điểm: 60");
  });

  it("shows a small 'grading this turn' indicator on the message without blocking the screen", async () => {
    let resolveTurnEvaluation!: (value: unknown) => void;
    mockEvaluateSpeechArgument.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveTurnEvaluation = resolve;
        })
    );

    await renderRoom();
    fireEvent.change(screen.getByLabelText("Lập luận của bạn"), { target: { value: "Lập luận vòng 1" } });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Gửi lập luận"));
    });

    expect(screen.getByTestId("turn-evaluating-indicator")).toHaveTextContent("Đang chấm lượt này...");
    expect(screen.queryByTestId("grading-overlay")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Lập luận của bạn")).not.toBeDisabled();

    await act(async () => {
      resolveTurnEvaluation({
        overall_score: 8,
        overall_reasoning: "Tốt",
        criteria: [],
        strengths: [],
        weaknesses: [],
        suggestions: [],
      });
    });
    expect(screen.queryByTestId("turn-evaluating-indicator")).not.toBeInTheDocument();
  });
});

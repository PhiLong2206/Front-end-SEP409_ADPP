import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import DebateRoom from "../pages/debater/DebatePractice/DebateRoom";
import DebateResult from "../pages/debater/DebatePractice/DebateResult";
import { debateApi } from "../api";

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
  const state = useLocation().state;
  return <div data-testid="result-page">{state ? "with state" : "no state"}</div>;
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
  data: { judgementId: 1, sessionId: 42, suggestedWinnerSide: "CON", evaluatedAt: "", proEvaluation: side(6), conEvaluation: side(9) },
};

/** The result page right after the last turn: the Backend is still grading, GET /evaluation waits for it. */
const renderResultPage = async () => {
  vi.mocked(debateApi.getSessionDetails).mockResolvedValue({
    success: true,
    message: "ok",
    data: { sessionId: 42, title: "t", topic: "Chủ đề", participants: [{ userId: 1, side: 1, isAI: false, speakerName: "Debater Test" }] },
  } as never);
  render(
    <MemoryRouter initialEntries={["/debater/debate/42/result"]}>
      <Routes>
        <Route path="/debater/debate/:sessionId/result" element={<DebateResult />} />
      </Routes>
    </MemoryRouter>
  );
  await act(async () => {
    await Promise.resolve();
  });
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

  it("the room's submit opens the result page at once: the room itself waits for nothing", async () => {
    await renderRoom();
    await completeThreeRounds();

    await submitFinal();

    expect(screen.getByTestId("result-page")).toHaveTextContent("no state"); // the page loads GET /evaluation itself
    expect(screen.queryByTestId("grading-overlay")).not.toBeInTheDocument();
    expect(mockGetEvaluation).not.toHaveBeenCalled();
    expect(mockEvaluateDebateRound).not.toHaveBeenCalled();
    expect(mockEvaluateDebateSession).not.toHaveBeenCalled();
  });

  it("result page: 'Đang tổng hợp kết quả' overlay while GET /evaluation waits, closed when the result arrives", async () => {
    await renderResultPage();

    expect(screen.getByTestId("grading-overlay")).toBeInTheDocument();
    expect(progress()).toHaveTextContent("Đang tổng hợp kết quả...");
    expect(mockGetEvaluation).toHaveBeenCalledTimes(1);

    await act(async () => evaluationCalls[0].resolve(officialResult));
    expect(screen.queryByTestId("grading-overlay")).not.toBeInTheDocument();
    expect(screen.getByTestId("result-overall-score")).toHaveTextContent("60");
  });

  it("result page: adds the 'may take up to a minute' hint only after about 15 seconds", async () => {
    await renderResultPage();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(14_000);
    });
    expect(screen.queryByTestId("grading-slow-hint")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    // The Backend keeps grading without the page: leaving it loses nothing
    expect(screen.getByTestId("grading-slow-hint")).toHaveTextContent(
      "Quá trình chấm có thể mất đến 1 phút. Bạn có thể đóng trang, kết quả vẫn được lưu."
    );
  });

  it("result page: an error closes the overlay with a retry, which waits for the result again", async () => {
    await renderResultPage();

    await act(async () => evaluationCalls[0].reject({ success: false, status: 404, message: "No evaluation found" }));
    expect(screen.queryByTestId("grading-overlay")).not.toBeInTheDocument();
    expect(screen.getByTestId("result-load-error")).toHaveTextContent("No evaluation found");

    await act(async () => {
      fireEvent.click(screen.getByTestId("result-retry-btn"));
    });
    expect(screen.getByTestId("grading-overlay")).toBeInTheDocument();

    await act(async () => evaluationCalls[1].resolve(officialResult));
    expect(mockGetEvaluation).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("result-overall-score")).toHaveTextContent("60");
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

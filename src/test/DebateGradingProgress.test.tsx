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
  },
}));

const ResultProbe = () => {
  const state = useLocation().state as { result?: { overallScore: number } } | null;
  return <div data-testid="result-page">Điểm: {state?.result?.overallScore}</div>;
};

const roundResult = (stage: string) => ({
  stage,
  round_score: 7,
  criteria: [{ name: "Logic", score: 4, reasoning: "Tốt" }],
  consistency_note: "",
  strengths: [],
  weaknesses: [],
  suggestions: [],
});
const sessionResult = { overall_score: 6, stage_breakdown: {}, progress_trend: "ổn định" };

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

  type Deferred = { stage: string; resolve: (v: unknown) => void; reject: (e: unknown) => void };
  let roundCalls: Deferred[];
  let sessionCalls: Array<{ resolve: (v: unknown) => void }>;

  const progress = () => screen.getByTestId("grading-progress");

  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    roundCalls = [];
    sessionCalls = [];
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
    // Rounds and the session stay pending until the test resolves them
    mockEvaluateDebateRound.mockImplementation(
      ({ stage }: { stage: string }) =>
        new Promise((resolve, reject) => {
          roundCalls.push({ stage, resolve, reject });
        })
    );
    mockEvaluateDebateSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          sessionCalls.push({ resolve });
        })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("shows the real step being graded, updates as each request completes, and closes when done", async () => {
    await renderRoom();
    await completeThreeRounds();
    expect(screen.queryByTestId("grading-overlay")).not.toBeInTheDocument();

    await submitFinal();
    expect(screen.getByTestId("grading-overlay")).toBeInTheDocument();
    expect(screen.getByText("Đang chấm điểm phiên tranh biện...")).toBeInTheDocument();
    expect(progress()).toHaveTextContent("Đang chấm các vòng (xong 0/3)...");
    expect(screen.getByTestId("header-submit-debate-btn")).toBeDisabled();
    // The 3 rounds are sent at once (parallel), not one after the other
    expect(roundCalls.map((c) => c.stage)).toEqual(["opening", "rebuttal", "closing"]);

    await act(async () => roundCalls[1].resolve(roundResult("rebuttal")));
    expect(progress()).toHaveTextContent("Đang chấm các vòng (xong 1/3)...");

    await act(async () => roundCalls[0].resolve(roundResult("opening")));
    expect(progress()).toHaveTextContent("Đang chấm các vòng (xong 2/3)...");

    await act(async () => roundCalls[2].resolve(roundResult("closing")));
    expect(progress()).toHaveTextContent("Đang tổng hợp kết quả...");

    await act(async () => sessionCalls[0].resolve(sessionResult));
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

    await act(async () => roundCalls[0].reject(new Error("round down")));
    // The other rounds run in parallel: the error is reported once they have all finished
    await act(async () => roundCalls[1].resolve(roundResult("rebuttal")));
    await act(async () => roundCalls[2].resolve(roundResult("closing")));
    expect(screen.queryByTestId("grading-overlay")).not.toBeInTheDocument();

    const after = new Event("beforeunload", { cancelable: true });
    const afterSpy = vi.spyOn(after, "preventDefault");
    window.dispatchEvent(after);
    expect(afterSpy).not.toHaveBeenCalled();
  });

  it("closes the overlay on an error, shows the banner with a retry, and the retry only redoes the failed steps", async () => {
    await renderRoom();
    await completeThreeRounds();
    await submitFinal();

    await act(async () => roundCalls[0].resolve(roundResult("opening")));
    await act(async () => roundCalls[1].reject(new Error("round 2 down")));
    // Still grading: closing runs in parallel and is waited for (and kept) before the error is shown
    expect(screen.getByTestId("grading-overlay")).toBeInTheDocument();
    await act(async () => roundCalls[2].resolve(roundResult("closing")));

    expect(screen.queryByTestId("grading-overlay")).not.toBeInTheDocument();
    expect(screen.getByTestId("debate-feedback-banner")).toHaveTextContent("Chưa chấm được kết quả tranh biện");
    expect(mockEvaluateDebateRound).toHaveBeenCalledTimes(3);

    await act(async () => {
      fireEvent.click(screen.getByTestId("retry-finish-evaluation-btn"));
    });
    // Opening and closing already succeeded: the retry only redoes the rebuttal
    expect(screen.getByTestId("grading-overlay")).toBeInTheDocument();
    expect(progress()).toHaveTextContent("Đang chấm các vòng (xong 2/3)...");
    expect(roundCalls[3].stage).toBe("rebuttal");

    await act(async () => roundCalls[3].resolve(roundResult("rebuttal")));
    await act(async () => sessionCalls[0].resolve(sessionResult));

    expect(mockEvaluateDebateRound).toHaveBeenCalledTimes(4); // not 6
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

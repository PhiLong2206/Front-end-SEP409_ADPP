import { StrictMode } from "react";
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
const mockGetOpponentSession = vi.fn();
const mockGenerateOpponentTurn = vi.fn();
const mockEvaluateSpeechArgument = vi.fn();
const mockGetSessionDetails = vi.fn();
const mockGetTranscript = vi.fn();
const mockSubmitArgument = vi.fn();
const mockStartDebateSession = vi.fn();
const mockEvaluateDebateRound = vi.fn();
const mockEvaluateDebateSession = vi.fn();
const mockRecordAiArgument = vi.fn();
const mockGetEvaluation = vi.fn();

vi.mock("../api", () => ({
  aiApi: {
    createOpponentSession: (...args: unknown[]) => mockCreateOpponentSession(...args),
    getOpponentCasePlan: (...args: unknown[]) => mockGetOpponentCasePlan(...args),
    getOpponentSession: (...args: unknown[]) => mockGetOpponentSession(...args),
    generateOpponentTurn: (...args: unknown[]) => mockGenerateOpponentTurn(...args),
    evaluateSpeechArgument: (...args: unknown[]) => mockEvaluateSpeechArgument(...args),
    evaluateDebateRound: (...args: unknown[]) => mockEvaluateDebateRound(...args),
    evaluateDebateSession: (...args: unknown[]) => mockEvaluateDebateSession(...args),
  },
  debateApi: {
    getSessionDetails: (...args: unknown[]) => mockGetSessionDetails(...args),
    getTranscript: (...args: unknown[]) => mockGetTranscript(...args),
    getPendingSwapRequests: vi.fn().mockResolvedValue({ success: true, data: [] }),
    submitArgument: (...args: unknown[]) => mockSubmitArgument(...args),
    startDebateSession: (...args: unknown[]) => mockStartDebateSession(...args),
    getEvaluation: (...args: unknown[]) => mockGetEvaluation(...args),
  },
}));

const mockNavigations: string[] = [];
const ResultProbe = () => {
  const location = useLocation();
  mockNavigations.push(location.key);
  return <div data-testid="result-page">{location.state ? "with state" : "no state"}</div>;
};

vi.mock("../utils/recordAiArgument", () => ({
  recordAiArgument: (...args: unknown[]) => mockRecordAiArgument(...args),
}));

const renderDebateRoom = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/debater/debate/:sessionId" element={<DebateRoom />} />
        <Route path="/debater/debate/:sessionId/result" element={<ResultProbe />} />
      </Routes>
    </MemoryRouter>
  );

describe("DebateRoom blocks the flow when the Backend / AI services fail", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateOpponentSession.mockResolvedValue({ opponent_session_id: "opp-1", status: "ready" });
    mockGetOpponentCasePlan.mockResolvedValue(null);
    mockGenerateOpponentTurn.mockResolvedValue({
      turn_index: 2,
      round_type: "opening",
      mode: "opening_reply",
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
    mockGetTranscript.mockResolvedValue({ success: true, data: { arguments: [] } });
    mockStartDebateSession.mockResolvedValue({ success: true });
    mockGetSessionDetails.mockResolvedValue({
      success: true,
      data: {
        sessionId: 123,
        title: "AI practice",
        topic: "Mạng xã hội có hại hơn lợi?",
        status: 2,
        debateType: 1,
        createdByUserId: 1,
        createdAt: "2026-11-03T10:15:30.123Z",
        participants: [
          { userId: 1, side: 1, isAI: false, speakerName: "Debater Test" },
          { userId: null, side: 2, isAI: true, speakerName: "AI" },
        ],
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("does not count the argument as submitted when submitArgument returns 400 (not your turn)", async () => {
    mockSubmitArgument.mockRejectedValue({
      success: false,
      message: "It is not your turn to submit an argument. Current turn belongs to CON.",
      errors: { code: "NOT_YOUR_TURN" },
      status: 400,
    });

    renderDebateRoom("/debater/debate/123?role=PRO");
    await act(async () => {});

    const textarea = screen.getByLabelText("Lập luận của bạn") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Lập luận mở đầu của tôi." } });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Gửi lập luận"));
    });

    expect(mockSubmitArgument).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("debate-feedback-banner")).toHaveTextContent("Chưa tới lượt của bạn"); // by errors.code, not the raw Backend text
    // Nothing downstream ran and the turn did not advance
    expect(mockEvaluateSpeechArgument).not.toHaveBeenCalled();
    expect(mockGenerateOpponentTurn).not.toHaveBeenCalled();
    expect(screen.getByText(/Vòng 1\/3/)).toBeInTheDocument();
    // The user keeps their text and can try again
    expect(textarea.value).toBe("Lập luận mở đầu của tôi.");
    expect(textarea).not.toBeDisabled();
  });

  it("blocks the next turn when the evaluator fails, and unblocks after a successful retry", async () => {
    mockEvaluateSpeechArgument.mockRejectedValueOnce(new Error("evaluator down"));

    renderDebateRoom("/debater/debate/eval-fail?role=PRO");
    await act(async () => {});

    fireEvent.change(screen.getByLabelText("Lập luận của bạn"), { target: { value: "Lập luận Vòng 1." } });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Gửi lập luận"));
    });

    // The AI opponent answered and the round advanced, but the debater cannot continue
    expect(screen.getByText(/Vòng 2\/3/)).toBeInTheDocument();
    expect(screen.getByTestId("debate-feedback-banner")).toHaveTextContent("Chưa chấm được lượt phát biểu");
    expect(screen.getByLabelText("Lập luận của bạn")).toBeDisabled();
    expect(screen.getByTestId("retry-turn-evaluation-btn")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId("retry-turn-evaluation-btn"));
    });

    expect(mockEvaluateSpeechArgument).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId("retry-turn-evaluation-btn")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Lập luận của bạn")).not.toBeDisabled();
  });

  it("blocks the debate when the AI opponent session cannot be created, and recovers on retry", async () => {
    mockCreateOpponentSession.mockRejectedValueOnce(new Error("opponent down"));

    renderDebateRoom("/debater/debate/opp-fail?role=PRO");
    await act(async () => {});

    expect(screen.getByTestId("debate-feedback-banner")).toHaveTextContent("Không kết nối được Đối thủ AI");
    expect(screen.getByLabelText("Lập luận của bạn")).toBeDisabled();
    // No simulated opponent speech / no fake case plan
    expect(mockGenerateOpponentTurn).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByTestId("retry-opponent-init-btn"));
    });

    expect(mockCreateOpponentSession).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId("retry-opponent-init-btn")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Lập luận của bạn")).not.toBeDisabled();
  });
});

describe("DebateRoom final submission (handleFinishDebate)", () => {
  const completeThreeRounds = async () => {
    for (let round = 1; round <= 3; round++) {
      fireEvent.change(screen.getByLabelText("Lập luận của bạn"), {
        target: { value: `Lập luận vòng ${round}` },
      });
      await act(async () => {
        fireEvent.click(screen.getByLabelText("Gửi lập luận"));
      });
    }
    expect(screen.getByTestId("debate-completed-banner")).toBeInTheDocument();
  };

  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateOpponentSession.mockResolvedValue({ opponent_session_id: "opp-1", status: "ready" });
    mockGetOpponentCasePlan.mockResolvedValue(null);
    mockGenerateOpponentTurn.mockResolvedValue({
      turn_index: 2,
      round_type: "opening",
      mode: "opening_reply",
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
    // Overall = the official holistic overall score (5 → 50), not the criteria average (4/5 → 80)
    const pro = {
      side: "PRO",
      speakerName: "Debater",
      overallScore: 5,
      stageBreakdown: { opening: 7, rebuttal: 7, closing: 7 },
      progressTrend: "Ổn định",
      strengths: [],
      weaknesses: [],
      suggestions: [],
      roundEvaluations: ["opening", "rebuttal", "closing"].map((stage, i) => ({
        roundNumber: i + 1,
        stage,
        roundScore: 7,
        consistencyNote: "",
        criteria: [{ name: "Logic", score: 4, reasoning: "Tốt" }],
        strengths: [],
        weaknesses: [],
        suggestions: [],
      })),
    };
    mockGetEvaluation.mockResolvedValue({
      success: true,
      message: "ok",
      data: { judgementId: 1, sessionId: 1, suggestedWinnerSide: "PRO", evaluatedAt: "", proEvaluation: pro, conEvaluation: null },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("opens the result page without grading anything itself: the page loads the official result", async () => {
    renderDebateRoom("/debater/debate/finish-open?role=PRO");
    await act(async () => {});
    await completeThreeRounds();

    await act(async () => {
      fireEvent.click(screen.getByTestId("header-submit-debate-btn"));
    });

    expect(screen.getByTestId("result-page")).toHaveTextContent("no state");
    expect(mockGetEvaluation).not.toHaveBeenCalled();
    expect(mockEvaluateDebateRound).not.toHaveBeenCalled();
    expect(mockEvaluateDebateSession).not.toHaveBeenCalled();
  });

  it("navigates only once when the submit button is double-clicked", async () => {
    mockNavigations.length = 0;
    renderDebateRoom("/debater/debate/finish-double-click?role=PRO");
    await act(async () => {});
    await completeThreeRounds();

    const submitBtn = screen.getByTestId("header-submit-debate-btn");
    await act(async () => {
      fireEvent.click(submitBtn);
      fireEvent.click(submitBtn);
    });

    expect(screen.getByTestId("result-page")).toBeInTheDocument();
    expect(new Set(mockNavigations).size).toBe(1);
  });
});

describe("DebateRoom waits for the AI opponent case plan and retries only the failed step", () => {
  const PLANNING_409 = {
    status: 409,
    detail: "Session chua san sang (status=planning), can Case Planning xong truoc",
  };
  const sessionData = {
    sessionId: 123,
    title: "AI practice",
    topic: "Mạng xã hội có hại hơn lợi?",
    status: 2,
    debateType: 1,
    createdByUserId: 1,
    createdAt: "2026-11-03T10:15:30.123Z",
    participants: [
      { userId: 1, side: 1, isAI: false, speakerName: "Debater Test" },
      { userId: null, side: 2, isAI: true, speakerName: "AI" },
    ],
  };

  // Long promise chains (create → poll → fail) need more than one microtask tick to settle
  const flushPromises = async () => {
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  };

  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateOpponentSession.mockResolvedValue({ opponent_session_id: "opp-1", status: "ready" });
    mockGetOpponentCasePlan.mockResolvedValue(null);
    mockGenerateOpponentTurn.mockResolvedValue({
      turn_index: 2,
      round_type: "opening",
      mode: "opening_reply",
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
    mockGetTranscript.mockResolvedValue({ success: true, data: { arguments: [] } });
    mockGetSessionDetails.mockResolvedValue({ success: true, data: sessionData });
    mockSubmitArgument.mockResolvedValue({ success: true, data: sessionData });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("keeps the input locked while the case plan is planning and unlocks once it is ready", async () => {
    mockCreateOpponentSession.mockResolvedValue({ opponent_session_id: "opp-1", status: "planning" });
    mockGetOpponentSession
      .mockResolvedValueOnce({ status: "planning" })
      .mockResolvedValueOnce({ status: "ready" });

    renderDebateRoom("/debater/debate/planning-wait?role=PRO");
    await flushPromises();

    expect(screen.getByLabelText("Lập luận của bạn")).toBeDisabled();
    expect(screen.getByPlaceholderText(/AI đang chuẩn bị lập luận/)).toBeInTheDocument();
    expect(mockGetOpponentCasePlan).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(mockGetOpponentSession).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Lập luận của bạn")).not.toBeDisabled();
    expect(mockGetOpponentCasePlan).toHaveBeenCalledTimes(1);
  });

  it("shows a retryable error when planning fails", async () => {
    mockCreateOpponentSession.mockResolvedValue({ opponent_session_id: "opp-1", status: "planning" });
    mockGetOpponentSession.mockResolvedValue({ status: "failed" });

    renderDebateRoom("/debater/debate/planning-failed?role=PRO");
    await flushPromises();

    expect(screen.getByTestId("debate-feedback-banner")).toHaveTextContent("Không kết nối được Đối thủ AI");
    expect(screen.getByLabelText("Lập luận của bạn")).toBeDisabled();
    expect(screen.getByTestId("retry-opponent-init-btn")).toBeInTheDocument();
    expect(mockGetOpponentCasePlan).not.toHaveBeenCalled();
  });

  it("treats a 409 'still planning' answer to /turns as temporary: waits and calls again without an error", async () => {
    mockGenerateOpponentTurn.mockRejectedValueOnce(PLANNING_409);

    renderDebateRoom("/debater/debate/turn-409?role=PRO");
    await act(async () => {});

    fireEvent.change(screen.getByLabelText("Lập luận của bạn"), { target: { value: "Lập luận mở đầu." } });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Gửi lập luận"));
    });
    expect(mockGenerateOpponentTurn).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("retry-ai-turn-btn")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(mockGenerateOpponentTurn).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Phản hồi từ Đối thủ AI.")).toBeInTheDocument();
    expect(screen.getByText(/Vòng 2\/3/)).toBeInTheDocument();
  });

  it("retry after a failed /turns call does not submit the argument or evaluate again", async () => {
    mockGenerateOpponentTurn.mockRejectedValueOnce(new Error("opponent 500"));

    renderDebateRoom("/debater/debate/123?role=PRO");
    await act(async () => {});

    fireEvent.change(screen.getByLabelText("Lập luận của bạn"), { target: { value: "Lập luận mở đầu." } });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Gửi lập luận"));
    });

    expect(screen.getByTestId("debate-feedback-banner")).toHaveTextContent("Không nhận được phản hồi từ Đối thủ AI");
    expect(mockSubmitArgument).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByTestId("retry-ai-turn-btn"));
    });

    expect(mockGenerateOpponentTurn).toHaveBeenCalledTimes(2);
    expect(mockSubmitArgument).toHaveBeenCalledTimes(1); // not "It is not your turn" again
    expect(mockEvaluateSpeechArgument).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Phản hồi từ Đối thủ AI.")).toBeInTheDocument();
  });

  it("creates the opponent session and fetches the case plan only once under StrictMode", async () => {
    render(
      <StrictMode>
        <MemoryRouter initialEntries={["/debater/debate/strict-mode?role=PRO"]}>
          <Routes>
            <Route path="/debater/debate/:sessionId" element={<DebateRoom />} />
          </Routes>
        </MemoryRouter>
      </StrictMode>
    );
    await act(async () => {});

    expect(mockCreateOpponentSession).toHaveBeenCalledTimes(1);
    expect(mockGetOpponentCasePlan).toHaveBeenCalledTimes(1);
  });
});

describe("DebateRoom input is locked until the opponent session is ready", () => {
  const sessionData = {
    sessionId: 123,
    title: "AI practice",
    topic: "Mạng xã hội có hại hơn lợi?",
    status: 2,
    debateType: 1,
    createdByUserId: 1,
    createdAt: "2026-11-03T10:15:30.123Z",
    participants: [
      { userId: 1, side: 1, isAI: false, speakerName: "Debater Test" },
      { userId: null, side: 2, isAI: true, speakerName: "AI" },
    ],
  };

  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateOpponentSession.mockResolvedValue({ opponent_session_id: "opp-1", status: "ready" });
    mockGetOpponentCasePlan.mockResolvedValue(null);
    mockGenerateOpponentTurn.mockResolvedValue({
      turn_index: 2,
      round_type: "opening",
      mode: "opening_reply",
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
    mockGetTranscript.mockResolvedValue({ success: true, data: { arguments: [] } });
    mockGetSessionDetails.mockResolvedValue({ success: true, data: sessionData });
    mockSubmitArgument.mockResolvedValue({ success: true, data: sessionData });
    mockRecordAiArgument.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("is locked (and the countdown does not run) even before POST /sessions returns", async () => {
    let resolveCreate!: (value: unknown) => void;
    mockCreateOpponentSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
    );

    renderDebateRoom("/debater/debate/lock-before-post?role=PRO");
    await act(async () => {});

    expect(screen.getByLabelText("Lập luận của bạn")).toBeDisabled();
    expect(screen.getByPlaceholderText(/AI đang chuẩn bị lập luận/)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(screen.getByTestId("debate-countdown-timer")).toHaveTextContent("02:15");

    await act(async () => {
      resolveCreate({ opponent_session_id: "opp-1", status: "ready" });
    });

    expect(screen.getByLabelText("Lập luận của bạn")).not.toBeDisabled();
    expect(screen.getByTestId("debate-countdown-timer")).toHaveTextContent("02:15");
  });
});

describe("DebateRoom recording the AI turn in the Backend (hook for a future endpoint)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateOpponentSession.mockResolvedValue({ opponent_session_id: "opp-1", status: "ready" });
    mockGetOpponentCasePlan.mockResolvedValue(null);
    mockGenerateOpponentTurn.mockResolvedValue({
      turn_index: 2,
      round_type: "opening",
      mode: "opening_reply",
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
    mockRecordAiArgument.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("retries only the recording step when it fails (no new /turns call), then shows the AI speech", async () => {
    mockRecordAiArgument.mockRejectedValueOnce(new Error("record failed"));

    renderDebateRoom("/debater/debate/record-fail?role=PRO");
    await act(async () => {});

    fireEvent.change(screen.getByLabelText("Lập luận của bạn"), { target: { value: "Lập luận mở đầu." } });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Gửi lập luận"));
    });

    expect(screen.getByTestId("debate-feedback-banner")).toHaveTextContent("Không ghi được lượt của Đối thủ AI");
    expect(screen.queryByTestId("retry-ai-turn-btn")).not.toBeInTheDocument();
    expect(screen.queryByText("Phản hồi từ Đối thủ AI.")).not.toBeInTheDocument();
    expect(screen.getByText(/Vòng 1\/3/)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId("retry-ai-record-btn"));
    });

    expect(mockRecordAiArgument).toHaveBeenCalledTimes(2);
    expect(mockGenerateOpponentTurn).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Phản hồi từ Đối thủ AI.")).toBeInTheDocument();
    expect(screen.getByText(/Vòng 2\/3/)).toBeInTheDocument();
  });
});

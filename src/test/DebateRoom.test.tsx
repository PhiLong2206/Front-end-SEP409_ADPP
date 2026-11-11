import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import DebateRoom from "../pages/debater/DebatePractice/DebateRoom";

// Mock scrollIntoView for jsdom
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock useAuth hook
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { userId: 1, id: 1, fullName: "Debater Test", role: "Debater" },
    isAuthenticated: true,
  }),
}));

// Mock API calls
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

const renderDebateRoom = async (initialEntry = "/debater/debate/test-session?role=PRO&difficulty=Trung%20b%C3%ACnh") => {
  const utils = render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/debater/debate/:sessionId" element={<DebateRoom />} />
        <Route path="/debater/debate/:sessionId/result" element={<div>Result Page</div>} />
      </Routes>
    </MemoryRouter>
  );
  // The input stays locked until the AI opponent session is ready: let the init promises settle
  await act(async () => {});
  return utils;
};

describe("DebateRoom Timer Expiration & State Machine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    mockCreateOpponentSession.mockResolvedValue({ opponent_session_id: "opp-1", status: "ready" });
    mockGetOpponentCasePlan.mockResolvedValue(null);
    mockGenerateOpponentTurn.mockResolvedValue({
      turn_index: 2,
      round_type: "opening",
      mode: "opening_reply",
      speech_text: "Phản hồi chính thức từ Đối thủ AI.",
    });
    mockEvaluateSpeechArgument.mockResolvedValue({
      overall_score: 8.0,
      overall_reasoning: "Lập luận tốt",
      criteria: [{ name: "Logic", score: 8, reasoning: "Tốt" }],
      strengths: ["Rõ ràng"],
      weaknesses: [],
      suggestions: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("1. handles timeout at 00:00 with no submitted argument (disables input/Send, updates status, no fake AI response)", async () => {
    await renderDebateRoom("/debater/debate/session-timeout-1?role=PRO");

    // Initially in Round 1 (02:15), active turn indicator is "Đến lượt bạn phát biểu"
    expect(screen.getByTestId("debate-countdown-timer")).toHaveTextContent("02:15");
    expect(screen.getByTestId("turn-status-indicator")).toHaveTextContent("Đến lượt bạn phát biểu");

    const textarea = screen.getByLabelText("Lập luận của bạn") as HTMLTextAreaElement;
    const sendBtn = screen.getByLabelText("Gửi lập luận") as HTMLButtonElement;
    expect(textarea).not.toBeDisabled();

    // Advance 135 seconds to reach 00:00
    await act(async () => {
      vi.advanceTimersByTime(135_000);
    });

    // Countdown reaches 00:00
    expect(screen.getByTestId("debate-countdown-timer")).toHaveTextContent("00:00");

    // UI no longer displays "Đến lượt bạn phát biểu" — shows "Đã hết thời gian phát biểu"
    expect(screen.getByTestId("turn-status-indicator")).toHaveTextContent("Đã hết thời gian phát biểu");
    expect(screen.queryByText("Đến lượt bạn phát biểu")).not.toBeInTheDocument();

    // Argument input and Send button are disabled
    expect(textarea).toBeDisabled();
    expect(sendBtn).toBeDisabled();

    // Timeout notification and round timeout notice are visible
    expect(screen.getByTestId("debate-feedback-banner")).toHaveTextContent("Hết giờ, bạn chưa phát biểu");
    expect(screen.getByTestId("round-1-timeout-notice")).toBeInTheDocument();

    // No fake AI Opponent turn was generated on timeout
    expect(mockGenerateOpponentTurn).not.toHaveBeenCalled();
  });

  it("2. handles timeout in subsequent round after an argument has been submitted in Round 1", async () => {
    await renderDebateRoom("/debater/debate/session-timeout-2?role=PRO");

    const textarea = screen.getByLabelText("Lập luận của bạn") as HTMLTextAreaElement;
    const sendBtn = screen.getByLabelText("Gửi lập luận") as HTMLButtonElement;

    // Submit argument in Round 1 (Opening)
    fireEvent.change(textarea, {
      target: { value: "Luận điểm mở đầu của tôi về kiến nghị này rất rõ ràng." },
    });
    expect(sendBtn).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(sendBtn);
    });

    // Transitions to Round 2 (Rebuttal) with fresh 02:00 timer
    expect(screen.getByText(/Vòng 2\/3/)).toBeInTheDocument();
    expect(screen.getByTestId("debate-countdown-timer")).toHaveTextContent("02:00");
    expect(screen.getByTestId("turn-status-indicator")).toHaveTextContent("Đến lượt bạn phát biểu");

    // Advance 120 seconds in Round 2 without submitting a Round 2 argument
    await act(async () => {
      vi.advanceTimersByTime(120_000);
    });

    expect(screen.getByTestId("debate-countdown-timer")).toHaveTextContent("00:00");
    expect(screen.getByTestId("turn-status-indicator")).toHaveTextContent("Đã hết thời gian phát biểu");
    expect(textarea).toBeDisabled();
    expect(sendBtn).toBeDisabled();
    expect(screen.getByTestId("round-2-timeout-notice")).toBeInTheDocument();
    // Round 1 messages are preserved
    expect(screen.getByText("Luận điểm mở đầu của tôi về kiến nghị này rất rõ ràng.")).toBeInTheDocument();
    expect(screen.getByText("Phản hồi chính thức từ Đối thủ AI.")).toBeInTheDocument();
  });

  it("3. transitions cleanly between Opening (Round 1), Rebuttal (Round 2), and Conclusion (Round 3)", async () => {
    await renderDebateRoom("/debater/debate/session-transitions?role=PRO");

    // Round 1 (Opening) times out at 00:00
    await act(async () => {
      vi.advanceTimersByTime(135_000);
    });
    expect(screen.getByTestId("round-1-timeout-notice")).toBeInTheDocument();

    // Advance from Opening (Round 1) to Rebuttal (Round 2)
    const advanceToR2Btn = screen.getByTestId("advance-round-after-timeout-btn");
    await act(async () => {
      fireEvent.click(advanceToR2Btn);
    });

    expect(screen.getByText(/Vòng 2\/3/)).toBeInTheDocument();
    expect(screen.getByTestId("debate-countdown-timer")).toHaveTextContent("02:00");
    expect(screen.getByTestId("turn-status-indicator")).toHaveTextContent("Đến lượt bạn phát biểu");

    // Submit argument in Rebuttal (Round 2) -> transitions to Conclusion (Round 3)
    const textarea = screen.getByLabelText("Lập luận của bạn") as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: { value: "Phản biện của tôi ở Vòng 2 bác bỏ các giả định của đối phương." },
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Gửi lập luận"));
    });

    expect(screen.getByText(/Vòng 3\/3/)).toBeInTheDocument();
    expect(screen.getByTestId("debate-countdown-timer")).toHaveTextContent("02:00");
    expect(screen.getByTestId("turn-status-indicator")).toHaveTextContent("Đến lượt bạn phát biểu");
  });

  it("4. completes the final round (Conclusion / Round 3) both on timeout at 00:00 and on submission", async () => {
    await renderDebateRoom("/debater/debate/session-final-timeout?role=PRO");

    // Round 1 timeout -> advance to Round 2
    await act(async () => {
      vi.advanceTimersByTime(135_000);
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("advance-round-after-timeout-btn"));
    });

    // Round 2 timeout -> advance to Round 3
    await act(async () => {
      vi.advanceTimersByTime(120_000);
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("advance-round-after-timeout-btn"));
    });

    expect(screen.getByText(/Vòng 3\/3/)).toBeInTheDocument();

    // Let Round 3 (Conclusion) expire at 00:00
    await act(async () => {
      vi.advanceTimersByTime(120_000);
    });

    // Final round completes automatically at 00:00
    expect(screen.getByTestId("debate-countdown-timer")).toHaveTextContent("00:00");
    expect(screen.getByTestId("turn-status-indicator")).toHaveTextContent("Đã hoàn thành 3 vòng");
    expect(screen.getByTestId("debate-completed-banner")).toBeInTheDocument();
    expect(screen.getByLabelText("Lập luận của bạn")).toBeDisabled();
    expect(screen.getByLabelText("Gửi lập luận")).toBeDisabled();
  });

  const turnReply = (turn: number, text: string) => ({
    turn_index: turn,
    round_type: turn <= 2 ? "opening" : turn <= 4 ? "rebuttal" : "closing",
    mode: "reply",
    speech_text: text,
  });

  it("5. PRO learner: after the rebuttal the AI (CON) speaks turn 4 THEN turn 5 (closing, CON first); PRO's closing (turn 6) completes the debate", async () => {
    await renderDebateRoom("/debater/debate/session-r3-order?role=PRO");

    const textarea = screen.getByLabelText("Lập luận của bạn") as HTMLTextAreaElement;
    const sendBtn = screen.getByLabelText("Gửi lập luận") as HTMLButtonElement;

    // Round 1: PRO speaks turn 1 -> AI replies turn 2
    mockGenerateOpponentTurn.mockResolvedValueOnce(turnReply(2, "Phản hồi Mở đầu của phe CON ở Vòng 1."));
    fireEvent.change(textarea, { target: { value: "Luận điểm Mở đầu của phe PRO ở Vòng 1." } });
    await act(async () => {
      fireEvent.click(sendBtn);
    });
    expect(screen.getByText(/Vòng 2\/3/)).toBeInTheDocument();
    expect(mockGenerateOpponentTurn.mock.calls[0][1]).toMatchObject({
      turn_index: 2,
      new_learner_speeches: [{ turn_index: 1, round_type: "opening" }],
    });

    // Round 2: PRO speaks turn 3 -> AI replies turn 4 and then, back to back, turn 5 (closing CON)
    mockGenerateOpponentTurn.mockResolvedValueOnce(turnReply(4, "Phản hồi Phản biện của phe CON ở Vòng 2."));
    let resolveTurn5!: (value: unknown) => void;
    mockGenerateOpponentTurn.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveTurn5 = resolve;
        })
    );
    fireEvent.change(textarea, { target: { value: "Luận điểm Phản biện của phe PRO ở Vòng 2." } });
    await act(async () => {
      fireEvent.click(sendBtn);
    });

    // Turn 4 is shown, turn 5 is still pending: the round has NOT advanced yet
    expect(screen.getByText("Phản hồi Phản biện của phe CON ở Vòng 2.")).toBeInTheDocument();
    expect(screen.getByText(/Vòng 2\/3/)).toBeInTheDocument();
    expect(screen.getByTestId("turn-status-indicator")).toHaveTextContent("Đối thủ AI đang phản hồi...");

    await act(async () => {
      resolveTurn5(turnReply(5, "Kết luận mở màn của phe CON ở Vòng 3."));
    });

    expect(mockGenerateOpponentTurn.mock.calls[1][1]).toMatchObject({
      turn_index: 4,
      new_learner_speeches: [{ turn_index: 3, round_type: "rebuttal" }],
    });
    expect(mockGenerateOpponentTurn.mock.calls[2][1]).toEqual({ turn_index: 5, new_learner_speeches: [] });
    expect(screen.getByText("Kết luận mở màn của phe CON ở Vòng 3.")).toBeInTheDocument();
    expect(screen.getByText(/Vòng 3\/3/)).toBeInTheDocument();
    expect(screen.queryByTestId("debate-completed-banner")).not.toBeInTheDocument();

    // Round 3: PRO speaks last (turn 6): nothing is requested from the AI and the debate is complete
    fireEvent.change(textarea, { target: { value: "Kết luận cuối của phe PRO ở Vòng 3." } });
    await act(async () => {
      fireEvent.click(sendBtn);
    });
    expect(mockGenerateOpponentTurn).toHaveBeenCalledTimes(3);
    expect(screen.getByTestId("debate-completed-banner")).toBeInTheDocument();
    expect(screen.getByTestId("submit-and-view-result-btn")).not.toBeDisabled();
  });

  it("6. shows error/waiting state (not advancing) if the AI's closing turn 5 fails after the rebuttal, and continues upon retry", async () => {
    await renderDebateRoom("/debater/debate/session-r3-error?role=PRO");

    const textarea = screen.getByLabelText("Lập luận của bạn") as HTMLTextAreaElement;
    const sendBtn = screen.getByLabelText("Gửi lập luận") as HTMLButtonElement;

    // Round 1
    fireEvent.change(textarea, { target: { value: "Lập luận Vòng 1 của PRO." } });
    await act(async () => {
      fireEvent.click(sendBtn);
    });

    // Round 2: turn 4 works, turn 5 fails
    mockGenerateOpponentTurn.mockResolvedValueOnce(turnReply(4, "Phản hồi Vòng 2 của CON."));
    mockGenerateOpponentTurn.mockRejectedValueOnce(new Error("Request timeout"));
    fireEvent.change(textarea, { target: { value: "Lập luận Vòng 2 của PRO." } });
    await act(async () => {
      fireEvent.click(sendBtn);
    });

    // Must NOT advance to round 3 — stay blocked with error & retry option
    expect(screen.getByText(/Vòng 2\/3/)).toBeInTheDocument();
    expect(screen.getByTestId("debate-feedback-banner")).toHaveTextContent("Không nhận được phản hồi từ Đối thủ AI");
    expect(screen.getByTestId("retry-ai-turn-btn")).toBeInTheDocument();
    expect(screen.getByLabelText("Lập luận của bạn")).toBeDisabled();

    // Retry asks for turn 5 again (no learner speech: it was already delivered with turn 4)
    mockGenerateOpponentTurn.mockResolvedValueOnce(turnReply(5, "Kết luận mở màn của CON sau khi thử lại."));
    await act(async () => {
      fireEvent.click(screen.getByTestId("retry-ai-turn-btn"));
    });

    const lastCall = mockGenerateOpponentTurn.mock.calls[mockGenerateOpponentTurn.mock.calls.length - 1][1];
    expect(lastCall).toEqual({ turn_index: 5, new_learner_speeches: [] });
    expect(screen.getByText("Kết luận mở màn của CON sau khi thử lại.")).toBeInTheDocument();
    expect(screen.getByText(/Vòng 3\/3/)).toBeInTheDocument();
    expect(screen.getByLabelText("Lập luận của bạn")).not.toBeDisabled();
  });

  it("7. prevents timer reaching 00:00 during a pending AI response from prematurely timing out the round", async () => {
    await renderDebateRoom("/debater/debate/session-timer-race?role=PRO");

    const textarea = screen.getByLabelText("Lập luận của bạn") as HTMLTextAreaElement;
    const sendBtn = screen.getByLabelText("Gửi lập luận") as HTMLButtonElement;

    // Round 1
    fireEvent.change(textarea, { target: { value: "Lập luận Vòng 1." } });
    await act(async () => {
      fireEvent.click(sendBtn);
    });
    expect(screen.getByText(/Vòng 2\/3/)).toBeInTheDocument();

    // Advance 118s in Round 2 so only 2s remain on the clock
    await act(async () => {
      vi.advanceTimersByTime(118_000);
    });
    expect(screen.getByTestId("debate-countdown-timer")).toHaveTextContent("00:02");

    // Submit the Round 2 argument while the AI Opponent takes a long time to respond
    let resolvePendingAi!: (value: unknown) => void;
    mockGenerateOpponentTurn.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePendingAi = resolve;
        })
    );
    fireEvent.change(textarea, { target: { value: "Phản biện Vòng 2 sát giờ." } });
    await act(async () => {
      fireEvent.click(sendBtn);
    });

    // 30 seconds past the original deadline while the AI is still responding
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.queryByTestId("round-2-timeout-notice")).not.toBeInTheDocument();
    expect(screen.getByTestId("turn-status-indicator")).toHaveTextContent("Đối thủ AI đang phản hồi...");

    // Resolve the AI response -> the chain continues (turn 5) and the debate moves to Round 3 cleanly
    await act(async () => {
      resolvePendingAi(turnReply(4, "Phản hồi của CON hoàn tất."));
    });

    expect(screen.getByText("Phản hồi của CON hoàn tất.")).toBeInTheDocument();
    expect(screen.getByText(/Vòng 3\/3/)).toBeInTheDocument();
    expect(screen.getByTestId("debate-countdown-timer")).toHaveTextContent("02:00");
  });

  it("8. prevents double submission and duplicate AI turns on rapid clicks", async () => {
    await renderDebateRoom("/debater/debate/session-no-dup?role=PRO");

    const textarea = screen.getByLabelText("Lập luận của bạn") as HTMLTextAreaElement;
    const sendBtn = screen.getByLabelText("Gửi lập luận") as HTMLButtonElement;

    let resolveAiTurn!: (value: unknown) => void;
    mockGenerateOpponentTurn.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAiTurn = resolve;
        })
    );

    fireEvent.change(textarea, { target: { value: "Luận điểm duy nhất trong vòng 1." } });

    await act(async () => {
      fireEvent.click(sendBtn);
      fireEvent.click(sendBtn);
      fireEvent.click(sendBtn);
    });

    expect(mockGenerateOpponentTurn).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveAiTurn({
        turn_index: 2,
        round_type: "opening",
        mode: "opening_reply",
        speech_text: "Phản hồi duy nhất từ AI.",
      });
    });

    expect(screen.getAllByText("Luận điểm duy nhất trong vòng 1.")).toHaveLength(1);
    expect(screen.getAllByText("Phản hồi duy nhất từ AI.")).toHaveLength(1);
  });
});

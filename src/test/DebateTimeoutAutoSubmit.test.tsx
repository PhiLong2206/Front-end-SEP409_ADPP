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
  },
}));

const sessionAfter = (done: number) => ({
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
  currentTurn: { turnIndex: done },
});

describe("DebateRoom when the countdown reaches 00:00 in an AI practice session", () => {
  const renderRoom = async (sessionId: string) => {
    render(
      <MemoryRouter initialEntries={[`/debater/debate/${sessionId}?role=PRO`]}>
        <Routes>
          <Route path="/debater/debate/:sessionId" element={<DebateRoom />} />
        </Routes>
      </MemoryRouter>
    );
    for (let i = 0; i < 4; i++) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  };

  const type = (text: string) =>
    fireEvent.change(screen.getByLabelText("Lập luận của bạn"), { target: { value: text } });

  const advance = (ms: number) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });

  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
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
    mockGenerateOpponentTurn.mockResolvedValue({
      turn_index: 2,
      round_type: "opening",
      mode: "reply",
      speech_text: "Phản hồi từ Đối thủ AI.",
    });
    mockGetSessionDetails.mockResolvedValue({ success: true, data: sessionAfter(0) });
    mockSubmitArgument.mockResolvedValue({ success: true, data: sessionAfter(1) });
    mockSubmitAiArgument.mockResolvedValue({
      success: true,
      data: { turnIndex: 1, alreadyRecorded: false, argument: {}, session: sessionAfter(2) },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("auto-submits what was written through the normal flow (argument, evaluate, AI turn, record AI turn)", async () => {
    await renderRoom("123");
    type("Lập luận chưa viết xong khi hết giờ.   ");

    await advance(135_000);

    expect(mockSubmitArgument).toHaveBeenCalledTimes(1);
    expect(mockSubmitArgument).toHaveBeenCalledWith(123, { content: "Lập luận chưa viết xong khi hết giờ." });
    expect(mockEvaluateSpeechArgument).toHaveBeenCalledTimes(1);
    expect(mockGenerateOpponentTurn).toHaveBeenCalledTimes(1);
    expect(mockSubmitAiArgument).toHaveBeenCalledWith(123, { content: "Phản hồi từ Đối thủ AI.", turnIndex: 1 });
    expect(screen.getByText("Lập luận chưa viết xong khi hết giờ.")).toBeInTheDocument();
    expect(screen.getByText("Phản hồi từ Đối thủ AI.")).toBeInTheDocument();
    expect(screen.getByText(/Vòng 2\/3/)).toBeInTheDocument();
    expect(screen.getByTestId("debate-feedback-banner")).toHaveTextContent(
      "Hết giờ, đã tự động nộp phần bạn đã viết."
    );
    // The round was not marked as timed out
    expect(screen.queryByTestId("round-1-timeout-notice")).not.toBeInTheDocument();
  });

  it("does not submit twice when the user clicks send right at the deadline", async () => {
    await renderRoom("deadline-click");
    type("Gửi sát giờ.");

    await advance(134_000); // 1 second left
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Gửi lập luận")); // the user's own submit...
      await vi.advanceTimersByTimeAsync(1_000); // ...and the clock reaches 00:00 in the same moment
    });

    expect(mockEvaluateSpeechArgument).toHaveBeenCalledTimes(1);
    expect(mockGenerateOpponentTurn).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("Gửi sát giờ.")).toHaveLength(1);
  });

  it("does not submit twice when the user clicks send right after the auto-submit started", async () => {
    await renderRoom("deadline-click-2");
    let resolveTurn!: (value: unknown) => void;
    mockGenerateOpponentTurn.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveTurn = resolve;
        })
    );
    type("Gửi khi hết giờ.");

    await advance(135_000); // auto-submit is in flight (AI answer pending)
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Gửi lập luận"));
    });
    await act(async () => {
      resolveTurn({ turn_index: 2, round_type: "opening", mode: "reply", speech_text: "AI trả lời." });
    });

    expect(mockEvaluateSpeechArgument).toHaveBeenCalledTimes(1);
    expect(mockGenerateOpponentTurn).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("Gửi khi hết giờ.")).toHaveLength(1);
  });

  it("locks the input and sends nothing to the Backend when the input is empty (or only spaces)", async () => {
    await renderRoom("123");
    type("   ");

    await advance(135_000);

    expect(screen.getByTestId("debate-feedback-banner")).toHaveTextContent(
      "Hết giờ, bạn chưa phát biểu. Lượt bỏ qua chưa được hỗ trợ."
    );
    expect(screen.getByLabelText("Lập luận của bạn")).toBeDisabled();
    expect(mockSubmitArgument).not.toHaveBeenCalled();
    expect(mockSubmitAiArgument).not.toHaveBeenCalled();
    expect(mockEvaluateSpeechArgument).not.toHaveBeenCalled();
    expect(mockGenerateOpponentTurn).not.toHaveBeenCalled();
    // A Backend session cannot skip a turn yet: no way to move on to the next round by hand
    expect(screen.queryByTestId("advance-round-after-timeout-btn")).not.toBeInTheDocument();
    expect(screen.getByText(/Vòng 1\/3/)).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup, fireEvent } from "@testing-library/react";
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
const mockGetOpponentSession = vi.fn();
const mockGetOpponentCasePlan = vi.fn();
const mockGenerateOpponentTurn = vi.fn();
const mockGetSessionDetails = vi.fn();
const mockGetTranscript = vi.fn();
const mockSubmitArgument = vi.fn();
const mockSubmitAiArgument = vi.fn();
const mockEvaluateSpeechArgument = vi.fn();

vi.mock("../api", () => ({
  aiApi: {
    createOpponentSession: (...args: unknown[]) => mockCreateOpponentSession(...args),
    getOpponentSession: (...args: unknown[]) => mockGetOpponentSession(...args),
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

const CREATED_AT = "2026-11-03T10:15:30.123Z";
const MISMATCH_DETAIL = "Luot 2 da duoc sinh voi bai noi learner khac request (khac noi dung: [1], chua tung gui: -)";

const backendSession = (overrides: Record<string, unknown> = {}) => ({
  sessionId: 12,
  title: "AI practice",
  topic: "Mạng xã hội có hại hơn lợi?",
  difficulty: "Medium",
  status: 2,
  debateType: 1,
  createdByUserId: 1,
  createdAt: CREATED_AT,
  participants: [
    { userId: 1, side: 1, isAI: false, speakerName: "Debater Test" }, // the learner is PRO: speaks first
    { userId: null, side: 2, isAI: true, speakerName: "AI" },
  ],
  currentTurn: { turnIndex: 0 },
  ...overrides,
});

const flush = async () => {
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const renderRoom = async (entry: string) => {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/debater/debate/:sessionId" element={<DebateRoom />} />
      </Routes>
    </MemoryRouter>
  );
  await flush();
};

const createdOpponentIds = (): string[] =>
  mockCreateOpponentSession.mock.calls.map((call) => call[0].external_session_id);

const sendSpeech = async (text: string) => {
  fireEvent.change(screen.getByLabelText("Lập luận của bạn"), { target: { value: text } });
  await act(async () => {
    fireEvent.click(screen.getByLabelText("Gửi lập luận"));
  });
  await flush();
};

describe("each debate has its own opponent session", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateOpponentSession.mockResolvedValue({ opponent_session_id: "opp-1", status: "ready" });
    mockGetOpponentSession.mockResolvedValue({ status: "ready" });
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
      mode: "opening",
      speech_text: "Phản hồi của AI.",
    });
    mockSubmitAiArgument.mockResolvedValue({
      success: true,
      data: { turnIndex: 1, alreadyRecorded: false, argument: {}, session: backendSession({ currentTurn: { turnIndex: 2 } }) },
    });
    mockSubmitArgument.mockResolvedValue({
      success: true,
      data: backendSession({ currentTurn: { turnIndex: 1 } }),
    });
    mockGetSessionDetails.mockResolvedValue({ success: true, data: backendSession() });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe("session-N rooms (practising a topic)", () => {
    it("two practices of the same topic in new tabs never share an opponent session", async () => {
      await renderRoom("/debater/debate/session-5");
      cleanup();
      sessionStorage.clear(); // a new tab starts with an empty sessionStorage
      await renderRoom("/debater/debate/session-5");

      const [first, second] = createdOpponentIds();
      expect(first).not.toBe(second);
      expect(first).not.toBe("session-5");
      expect(second).not.toBe("session-5");
    });

    it("a reload in the same tab keeps the same opponent session", async () => {
      await renderRoom("/debater/debate/session-5");
      cleanup();
      await renderRoom("/debater/debate/session-5");

      const [first, second] = createdOpponentIds();
      expect(second).toBe(first);
    });

    it("two topics in the same tab do not share an opponent session", async () => {
      await renderRoom("/debater/debate/session-5");
      cleanup();
      await renderRoom("/debater/debate/session-6");

      const [first, second] = createdOpponentIds();
      expect(second).not.toBe(first);
    });

    it("sends every turn to that same opponent session", async () => {
      await renderRoom("/debater/debate/session-5");
      await sendSpeech("Bài nói lượt 1");

      expect(mockGenerateOpponentTurn).toHaveBeenCalled();
      expect(mockGenerateOpponentTurn.mock.calls[0][0]).toBe(createdOpponentIds()[0]);
      expect(mockGetOpponentCasePlan).toHaveBeenCalledWith(createdOpponentIds()[0]);
    });
  });

  describe("Backend sessions", () => {
    it("a Backend session with a reused id (the Backend DB was reset) gets another opponent session", async () => {
      await renderRoom("/debater/debate/12");
      cleanup();
      sessionStorage.clear();
      mockGetSessionDetails.mockResolvedValue({
        success: true,
        data: backendSession({ createdAt: "2026-12-01T08:00:00.456Z" }),
      });
      await renderRoom("/debater/debate/12");

      const [first, second] = createdOpponentIds();
      expect(first).not.toBe(second);
    });

    it("a reload in the middle of the debate reconnects to the same opponent session, even from a new tab", async () => {
      await renderRoom("/debater/debate/12");
      cleanup();
      sessionStorage.clear();
      await renderRoom("/debater/debate/12");

      const [first, second] = createdOpponentIds();
      expect(second).toBe(first);
    });

    it("builds an id that holds both values and is safe in a URL path", async () => {
      await renderRoom("/debater/debate/12");

      const [id] = createdOpponentIds();
      expect(id).toMatch(/12/);
      expect(id).toMatch(/20261103/);
      expect(encodeURIComponent(id)).toBe(id);
      expect(id.length).toBeLessThanOrEqual(200);
    });

    it("refuses to start without createdAt rather than falling back to an id that can collide", async () => {
      mockGetSessionDetails.mockResolvedValue({ success: true, data: backendSession({ createdAt: undefined }) });

      await renderRoom("/debater/debate/12");

      expect(mockCreateOpponentSession).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Lập luận của bạn")).toBeDisabled();
      expect(screen.getAllByText(/thời điểm tạo phiên tranh biện/).length).toBeGreaterThan(0);
      expect(screen.queryByRole("button", { name: /Thử lại/ })).not.toBeInTheDocument();
    });

    it("never reuses an opponent session that holds other data: it reports the conflict", async () => {
      mockCreateOpponentSession.mockRejectedValue({
        status: 409,
        detail: "external_session_id 'x' da ton tai voi du lieu khac: motion",
      });

      await renderRoom("/debater/debate/12");

      expect(mockGetOpponentSession).not.toHaveBeenCalled();
      expect(mockGenerateOpponentTurn).not.toHaveBeenCalled();
      expect(screen.getAllByText(/không khớp/).length).toBeGreaterThan(0);
      expect(screen.getByLabelText("Lập luận của bạn")).toBeDisabled();
    });

    it("offers no retry on a data conflict and stops calling the service, even as the session keeps polling", async () => {
      mockCreateOpponentSession.mockRejectedValue({
        status: 409,
        detail: "external_session_id 'x' da ton tai voi du lieu khac: difficulty",
      });

      await renderRoom("/debater/debate/12");

      expect(screen.queryByTestId("retry-opponent-init-btn")).not.toBeInTheDocument();
      expect(screen.getByTestId("debate-feedback-banner")).toHaveTextContent("Thử lại sẽ không khắc phục được");
      expect(screen.getByLabelText("Lập luận của bạn")).toBeDisabled();
      expect(screen.getByLabelText("Lập luận của bạn")).toHaveAttribute(
        "placeholder",
        expect.stringContaining("tạo phiên tranh biện mới")
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      await flush();

      expect(mockCreateOpponentSession).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId("retry-opponent-init-btn")).not.toBeInTheDocument();
      expect(screen.getByTestId("debate-feedback-banner")).toHaveTextContent("không khớp");
    });

    it("still offers a retry on a temporary failure to create the session", async () => {
      mockCreateOpponentSession.mockRejectedValue({ status: 504, detail: "timeout" });

      await renderRoom("/debater/debate/12");

      expect(screen.getByTestId("retry-opponent-init-btn")).toBeInTheDocument();
    });
  });

  describe("the 'generated from another speech' conflict on /turns", () => {
    const mismatch = { status: 409, code: "LEARNER_SPEECH_MISMATCH", detail: MISMATCH_DETAIL };

    it("shows a clear message, not the raw one, and offers no useless retry", async () => {
      mockGenerateOpponentTurn.mockRejectedValue(mismatch);
      await renderRoom("/debater/debate/12");
      await sendSpeech("Bài nói lượt 1");

      expect(screen.getAllByText(/tạo phiên tranh biện mới/).length).toBeGreaterThan(0);
      expect(screen.queryByText(/Luot 2 da duoc sinh/)).not.toBeInTheDocument();
      expect(screen.queryByText(/lỗi kết nối/)).not.toBeInTheDocument();
      expect(screen.queryByTestId("retry-ai-turn-btn")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Thử lại/ })).not.toBeInTheDocument();
      expect(mockGenerateOpponentTurn).toHaveBeenCalledTimes(1);
    });

    it("keeps the retry for other /turns failures", async () => {
      mockGenerateOpponentTurn.mockRejectedValue({ status: 502, detail: "AI tra ve bai noi khong hop le" });
      await renderRoom("/debater/debate/12");
      await sendSpeech("Bài nói lượt 1");

      expect(screen.getByRole("button", { name: /Thử lại/ })).toBeInTheDocument();
    });
  });

  describe("the speech is locked once /arguments has succeeded", () => {
    it("clears and locks the input, and a retry of /turns sends the original speech", async () => {
      mockGenerateOpponentTurn.mockRejectedValueOnce({ status: 502, detail: "x" });
      await renderRoom("/debater/debate/12");
      await sendSpeech("  Bài nói đã nộp  ");

      const input = screen.getByLabelText("Lập luận của bạn") as HTMLTextAreaElement;
      expect(input).toBeDisabled();
      expect(input.value).toBe("");

      // Even a change event on the locked input must not reach what was submitted
      fireEvent.change(input, { target: { value: "Sửa lại sau khi đã nộp" } });
      fireEvent.click(screen.getByLabelText("Gửi lập luận"));
      expect(mockSubmitArgument).toHaveBeenCalledTimes(1);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /Thử lại/ }));
      });
      await flush();

      const speeches = mockGenerateOpponentTurn.mock.calls.map((c) => c[1].new_learner_speeches[0].text);
      expect(speeches).toEqual(["Bài nói đã nộp", "Bài nói đã nộp"]);
      expect(mockSubmitArgument.mock.calls[0][1].content).toBe("Bài nói đã nộp");
    });

    it("leaves the speech editable when /arguments failed, and /turns is not called", async () => {
      mockSubmitArgument.mockRejectedValueOnce({ message: "mạng lỗi" });
      await renderRoom("/debater/debate/12");
      await sendSpeech("Bài nói chưa nộp được");

      const input = screen.getByLabelText("Lập luận của bạn") as HTMLTextAreaElement;
      expect(input).not.toBeDisabled();
      expect(input.value).toBe("Bài nói chưa nộp được");
      expect(mockGenerateOpponentTurn).not.toHaveBeenCalled();
    });
  });
});

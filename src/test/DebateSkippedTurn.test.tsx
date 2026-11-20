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
    getSessionDetails: vi.fn(),
    getTranscript: vi.fn(),
    submitArgument: vi.fn(),
  },
}));

describe("DebateRoom tells the AI when the learner skipped a turn", () => {
  const renderRoom = async (entry: string) => {
    render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/debater/debate/:sessionId" element={<DebateRoom />} />
        </Routes>
      </MemoryRouter>
    );
    await act(async () => {});
  };
  const sentSpeech = (call: number) => mockGenerateOpponentTurn.mock.calls[call][1].new_learner_speeches[0];

  beforeEach(() => {
    sessionStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateOpponentSession.mockResolvedValue({ opponent_session_id: "opp-1", status: "ready" });
    mockGetOpponentCasePlan.mockResolvedValue(null);
    mockGenerateOpponentTurn.mockImplementation(async (_id: string, body: { turn_index: number }) => ({
      turn_index: body.turn_index, round_type: "x", mode: "reply", speech_text: `Lượt AI số ${body.turn_index}`,
    }));
    mockEvaluateSpeechArgument.mockResolvedValue({
      overall_score: 8, overall_reasoning: "", criteria: [], strengths: [], weaknesses: [], suggestions: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("'Bỏ lượt' sends skipped: true (the notice text stays only for the record)", async () => {
    await renderRoom("/debater/debate/skip-pro?role=PRO");
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Bỏ lượt"));
    });
    expect(sentSpeech(0)).toEqual({
      turn_index: 1, round_type: "opening", text: "(Thí sinh chủ động bỏ lượt)", skipped: true,
    });
  });

  it("a written speech is not a skip", async () => {
    await renderRoom("/debater/debate/skip-pro-2?role=PRO");
    fireEvent.change(screen.getByLabelText("Lập luận của bạn"), { target: { value: "PRO mở đầu" } });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Gửi lập luận"));
    });
    expect(sentSpeech(0)).toEqual({ turn_index: 1, round_type: "opening", text: "PRO mở đầu" });
  });
});

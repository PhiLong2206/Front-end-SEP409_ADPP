import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import DebateRoom from "../pages/debater/DebatePractice/DebateRoom";
import {
  TURN_ORDER,
  getAiTurnsAfterLearnerTurn,
  getAiTurnsFromBackendState,
  getTurnIndex,
  readBackendTurnState,
  toOpponentTurnIndex,
} from "../utils/turnOrder";

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

describe("TURN_ORDER (shared with the Backend: CON speaks first in the closing round)", () => {
  it("matches the Backend table (0-based turnIndex)", () => {
    expect(TURN_ORDER.map((t) => [t.turnIndex, t.stage, t.side])).toEqual([
      [0, "opening", "pro"],
      [1, "opening", "con"],
      [2, "rebuttal", "pro"],
      [3, "rebuttal", "con"],
      [4, "closing", "con"],
      [5, "closing", "pro"],
    ]);
  });

  it("converts to the opponent service's turn_index in one place (+1)", () => {
    expect([0, 1, 2, 3, 4, 5].map(toOpponentTurnIndex)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("gives each learner side its own turnIndex per round", () => {
    expect([1, 2, 3].map((r) => getTurnIndex(r, "pro"))).toEqual([0, 2, 5]);
    expect([1, 2, 3].map((r) => getTurnIndex(r, "con"))).toEqual([1, 3, 4]);
  });

  it("fallback: lists the AI turns that follow each learner turn (including two in a row)", () => {
    // learner PRO / AI CON
    expect([0, 2, 5].map((t) => getAiTurnsAfterLearnerTurn(t, "con"))).toEqual([[1], [3, 4], []]);
    // learner CON / AI PRO
    expect([1, 3, 4].map((t) => getAiTurnsAfterLearnerTurn(t, "pro"))).toEqual([[2], [], [5]]);
  });

  it("reads the next turn from the Backend session instead of guessing", () => {
    expect(readBackendTurnState({ status: 2, currentTurn: { turnIndex: 4 } })).toEqual({
      completed: false,
      nextTurnIndex: 4,
    });
    expect(readBackendTurnState({ status: 3 })).toEqual({ completed: true, nextTurnIndex: null });
    expect(readBackendTurnState({ status: 2, currentTurn: { turnIndex: null } })).toBeNull();
    expect(readBackendTurnState(undefined)).toBeNull();

    // AI is CON: turn 3 and turn 4 both belong to it; turn 5 belongs to the learner
    expect(getAiTurnsFromBackendState({ completed: false, nextTurnIndex: 4 }, "con")).toEqual([4]);
    expect(getAiTurnsFromBackendState({ completed: false, nextTurnIndex: 5 }, "con")).toEqual([]);
    expect(getAiTurnsFromBackendState({ completed: true, nextTurnIndex: null }, "con")).toEqual([]);
  });
});

describe("DebateRoom sends the right turn_index in every round", () => {
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

  const submit = async (text: string) => {
    fireEvent.change(screen.getByLabelText("Lập luận của bạn"), { target: { value: text } });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Gửi lập luận"));
    });
  };

  const requestedTurns = () =>
    mockGenerateOpponentTurn.mock.calls.map(([, body]) => ({
      turn: body.turn_index,
      speeches: (body.new_learner_speeches as Array<{ turn_index: number; round_type: string }>).map(
        (sp) => [sp.turn_index, sp.round_type]
      ),
    }));

  const isBefore = (first: string, second: string) =>
    Boolean(
      screen.getByText(first).compareDocumentPosition(screen.getByText(second)) &
        Node.DOCUMENT_POSITION_FOLLOWING
    );

  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateOpponentSession.mockResolvedValue({ opponent_session_id: "opp-1", status: "ready" });
    mockGetOpponentCasePlan.mockResolvedValue(null);
    mockGenerateOpponentTurn.mockImplementation(async (_id: string, body: { turn_index: number }) => ({
      turn_index: body.turn_index,
      round_type: "x",
      mode: "reply",
      speech_text: `Lượt AI số ${body.turn_index}`,
    }));
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

  it("learner PRO / AI CON: AI speaks 2, then 4+5 back to back; the closing is CON (AI) first, then PRO (learner) last", async () => {
    await renderRoom("/debater/debate/order-pro?role=PRO");

    await submit("PRO mở đầu");
    await submit("PRO phản biện");
    expect(screen.getByText(/Vòng 3\/3/)).toBeInTheDocument();
    await submit("PRO kết luận");

    expect(requestedTurns()).toEqual([
      { turn: 2, speeches: [[1, "opening"]] },
      { turn: 4, speeches: [[3, "rebuttal"]] },
      { turn: 5, speeches: [] },
    ]); // nothing is requested after PRO's final turn 6
    expect(screen.getByTestId("debate-completed-banner")).toBeInTheDocument();
    // Closing order in the chat: AI (CON, turn 5) before the learner (PRO, turn 6)
    expect(isBefore("Lượt AI số 5", "PRO kết luận")).toBe(true);
  });

  it("learner CON / AI PRO: AI opens with turn 1, speaks 3 after the opening, none after the rebuttal, 6 after the learner's closing", async () => {
    await renderRoom("/debater/debate/order-con?role=CON");

    expect(requestedTurns()).toEqual([{ turn: 1, speeches: [] }]);

    await submit("CON mở đầu");
    await submit("CON phản biện");
    // after turn 4 the learner speaks again (turn 5): no AI turn in between
    expect(requestedTurns().map((t) => t.turn)).toEqual([1, 3]);
    expect(screen.getByText(/Vòng 3\/3/)).toBeInTheDocument();
    expect(screen.getByLabelText("Lập luận của bạn")).not.toBeDisabled();

    await submit("CON kết luận");

    expect(requestedTurns()).toEqual([
      { turn: 1, speeches: [] },
      { turn: 3, speeches: [[2, "opening"]] },
      { turn: 6, speeches: [[5, "closing"]] },
    ]);
    expect(screen.getByTestId("debate-completed-banner")).toBeInTheDocument();
    // Closing order in the chat: the learner (CON, turn 5) before the AI (PRO, turn 6)
    expect(isBefore("CON kết luận", "Lượt AI số 6")).toBe(true);
  });
});

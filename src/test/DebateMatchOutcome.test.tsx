import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import DebateResult from "../pages/debater/DebatePractice/DebateResult";
import { buildDebateResultFromEvaluation, buildMatchOutcome } from "../utils/debateScoring";
import type { DebateEvaluationResponse, ParticipantEvaluationDto } from "../types";

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { userId: 1, id: 1, fullName: "Nguyen Van A", role: "Debater" }, isAuthenticated: true }),
}));

const mockGetSessionDetails = vi.fn();
const mockGetEvaluation = vi.fn();
vi.mock("../api", () => ({
  debateApi: {
    getSessionDetails: (...args: unknown[]) => mockGetSessionDetails(...args),
    getEvaluation: (...args: unknown[]) => mockGetEvaluation(...args),
  },
}));

const part = (side: string, overallScore: number): ParticipantEvaluationDto => ({
  side,
  speakerName: side,
  overallScore,
  stageBreakdown: { opening: overallScore, rebuttal: overallScore, closing: overallScore },
  skippedStages: [],
  progressTrend: "",
  strengths: [],
  weaknesses: [],
  suggestions: [],
  roundEvaluations: [],
});

const evaluation = (pro: number, con: number, suggestedWinnerSide: string): DebateEvaluationResponse => ({
  judgementId: 1,
  sessionId: 42,
  suggestedWinnerSide,
  overallScorePro: pro,
  overallScoreCon: con,
  evaluatedAt: "2026-11-13T10:00:00Z",
  proEvaluation: part("PRO", pro),
  conEvaluation: part("CON", con),
});

describe("buildMatchOutcome", () => {
  it("follows the Backend's suggestedWinnerSide, from the user's side", () => {
    expect(buildMatchOutcome(evaluation(7.5, 6, "PRO"), "pro", ["B"])).toEqual({
      result: "win", myScore: 75, opponentScore: 60, opponentNames: ["B"],
    });
    expect(buildMatchOutcome(evaluation(7.5, 6, "PRO"), "con", ["A"])).toMatchObject({
      result: "lose", myScore: 60, opponentScore: 75,
    });
    expect(buildMatchOutcome(evaluation(6.5, 6.5, "TIE"), "pro", [])?.result).toBe("draw");
    expect(buildMatchOutcome(evaluation(6, 7, "con"), "con", [])?.result).toBe("win"); // case-insensitive
  });

  it("without a winner side, compares the two scores; with neither, returns null", () => {
    expect(buildMatchOutcome(evaluation(5, 8, ""), "pro", [])?.result).toBe("lose");
    expect(buildMatchOutcome(evaluation(8, 8, ""), "con", [])?.result).toBe("draw");
    const unknown = { ...evaluation(5, 5, ""), overallScorePro: null, overallScoreCon: null };
    expect(buildMatchOutcome(unknown, "pro", [])).toBeNull();
  });

  it("is attached only when the result is asked for a match", () => {
    expect(buildDebateResultFromEvaluation(evaluation(7, 6, "PRO"), "pro", "t")?.matchOutcome).toBeUndefined();
    expect(buildDebateResultFromEvaluation(evaluation(7, 6, "PRO"), "pro", "t", { opponentNames: ["B"] })?.matchOutcome?.result).toBe("win");
    // A side that never spoke still gets the outcome (a real 0)
    const silent = { ...evaluation(0, 6, "CON"), proEvaluation: null };
    expect(buildDebateResultFromEvaluation(silent, "pro", "t", { opponentNames: ["B"] })?.matchOutcome).toMatchObject({
      result: "lose", myScore: 0, opponentScore: 60,
    });
  });
});

const session = (participants: Array<{ userId: number | null; side: number; isAI?: boolean; speakerName: string }>) => ({
  success: true,
  data: {
    sessionId: 42,
    title: "Phòng 1v1",
    topic: "Học thông qua chơi",
    status: 3,
    participants: participants.map((p) => ({ isAI: false, ...p })),
  },
});

const renderResult = () =>
  render(
    <MemoryRouter initialEntries={["/debater/debate/42/result"]}>
      <Routes>
        <Route path="/debater/debate/:sessionId/result" element={<DebateResult />} />
      </Routes>
    </MemoryRouter>
  );

describe("DebateResult: win / lose banner", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("1v1: shows that I won, with both scores and the opponent's name", async () => {
    mockGetSessionDetails.mockResolvedValue(session([
      { userId: 1, side: 1, speakerName: "Nguyen Van A" },
      { userId: 2, side: 2, speakerName: "Tran Thi B" },
    ]));
    mockGetEvaluation.mockResolvedValue({ success: true, data: evaluation(7.2, 6.1, "PRO") });
    renderResult();

    expect(await screen.findByTestId("match-outcome-title")).toHaveTextContent("Bạn thắng");
    expect(screen.getByTestId("match-outcome-my-score")).toHaveTextContent("72");
    expect(screen.getByTestId("match-outcome-opponent-score")).toHaveTextContent("61");
    expect(screen.getByTestId("match-outcome")).toHaveTextContent("Tran Thi B");
  });

  it("1v1 from the losing seat, and 2v2 lists both opponents", async () => {
    mockGetSessionDetails.mockResolvedValue(session([
      { userId: 1, side: 2, speakerName: "Nguyen Van A" },
      { userId: 3, side: 2, speakerName: "Le Van C" },
      { userId: 2, side: 1, speakerName: "Tran Thi B" },
      { userId: 4, side: 1, speakerName: "Pham Thi D" },
    ]));
    mockGetEvaluation.mockResolvedValue({ success: true, data: evaluation(7.2, 6.1, "PRO") });
    renderResult();

    expect(await screen.findByTestId("match-outcome-title")).toHaveTextContent("Bạn thua");
    expect(screen.getByTestId("match-outcome")).toHaveTextContent("Tran Thi B, Pham Thi D");
    expect(screen.getByTestId("match-outcome")).not.toHaveTextContent("Le Van C"); // my teammate
  });

  it("a draw", async () => {
    mockGetSessionDetails.mockResolvedValue(session([
      { userId: 1, side: 1, speakerName: "A" },
      { userId: 2, side: 2, speakerName: "B" },
    ]));
    mockGetEvaluation.mockResolvedValue({ success: true, data: evaluation(6.5, 6.5, "TIE") });
    renderResult();

    expect(await screen.findByTestId("match-outcome-title")).toHaveTextContent("Hòa");
  });

  it("without suggestedWinnerSide: decided by the two scores; an unnamed opponent shows as 'Đối thủ'", async () => {
    mockGetSessionDetails.mockResolvedValue(session([
      { userId: 1, side: 2, speakerName: "A" },
      { userId: 2, side: 1, speakerName: "" },
    ]));
    mockGetEvaluation.mockResolvedValue({ success: true, data: evaluation(5.5, 6.8, "") });
    renderResult();

    expect(await screen.findByTestId("match-outcome-title")).toHaveTextContent("Bạn thắng");
    expect(screen.getByTestId("match-outcome")).toHaveTextContent("Đối thủ");
    expect(screen.getByRole("region", { name: "Bạn thắng" })).toBeInTheDocument();
  });

  it("AI practice: no banner (the opponent is the AI)", async () => {
    mockGetSessionDetails.mockResolvedValue(session([
      { userId: 1, side: 1, speakerName: "A" },
      { userId: null, side: 2, speakerName: "AI Opponent", isAI: true },
    ]));
    mockGetEvaluation.mockResolvedValue({ success: true, data: evaluation(7, 6, "PRO") });
    renderResult();

    expect(await screen.findByTestId("result-overall-score")).toHaveTextContent("70");
    expect(screen.queryByTestId("match-outcome")).not.toBeInTheDocument();
  });
});

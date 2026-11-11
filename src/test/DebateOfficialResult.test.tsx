import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import DebateResult from "../pages/debater/DebatePractice/DebateResult";
import DebateHistory from "../pages/debater/DebateHistory/DebateHistory";
import { buildDebateResultFromEvaluation } from "../utils/debateScoring";
import type { DebateEvaluationResponse, ParticipantEvaluationDto } from "../types";

let mockAuthUser: { userId?: number; id?: number; fullName: string; role: string } | null = {
  userId: 1,
  id: 1,
  fullName: "Nguyen Van A",
  role: "Debater",
};
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: mockAuthUser, isAuthenticated: true }),
}));

const mockGetSessionDetails = vi.fn();
const mockGetEvaluation = vi.fn();
const mockGetUserHistory = vi.fn();
vi.mock("../api", () => ({
  debateApi: {
    getSessionDetails: (...args: unknown[]) => mockGetSessionDetails(...args),
    getEvaluation: (...args: unknown[]) => mockGetEvaluation(...args),
    getUserHistory: (...args: unknown[]) => mockGetUserHistory(...args),
  },
}));

const part = (side: string, overallScore: number, overrides: Partial<ParticipantEvaluationDto> = {}): ParticipantEvaluationDto => ({
  side,
  speakerName: side,
  overallScore,
  stageBreakdown: { opening: overallScore, rebuttal: overallScore, closing: overallScore },
  skippedStages: [],
  progressTrend: `xu hướng ${side}`,
  strengths: [`mạnh ${side}`],
  weaknesses: [],
  suggestions: [],
  roundEvaluations: [
    {
      roundNumber: 1,
      stage: "opening",
      roundScore: overallScore,
      consistencyNote: "",
      criteria: [{ name: "Evidence", score: 1, reasoning: "Số liệu sai" }],
      strengths: [],
      weaknesses: [],
      suggestions: [],
      evidenceChecks: [
        {
          turnIndex: 0,
          excerpt: `lượt ${side}`,
          evidenceCheck: {
            status: "checked",
            claims: [
              {
                claim: "Dự án có tổng cộng 40 lớp tập huấn",
                label: "CONTRADICTED",
                reason: "Fact ghi 115 lớp",
                citations: [{ factId: "2af92cb1", content: "Có 115 lớp tập huấn", citation: "Thanh Niên - https://thanhnien.vn/a.htm", stance: "contradicts" }],
              },
            ],
            counts: { CONTRADICTED: 1 },
            version: "v4_detail_conflict",
          },
        },
      ],
      evidenceScoreBefore: 3,
      evidenceScoreAfter: 1,
      evidenceRuleApplied: "1/1 claim CONTRADICTED",
    },
  ],
  ...overrides,
});

const evaluation = (overrides: Partial<DebateEvaluationResponse> = {}): DebateEvaluationResponse => ({
  judgementId: 5,
  sessionId: 42,
  suggestedWinnerSide: "PRO",
  overallScorePro: 8,
  overallScoreCon: 6,
  evaluatedAt: "2026-11-11T10:00:00Z",
  proEvaluation: part("PRO", 8),
  conEvaluation: part("CON", 6),
  ...overrides,
});

describe("buildDebateResultFromEvaluation (official result → result screen of one side)", () => {
  it("takes the user's side only", () => {
    expect(buildDebateResultFromEvaluation(evaluation(), "pro", "t")?.overallScore).toBe(80);
    const con = buildDebateResultFromEvaluation(evaluation(), "con", "t")!;
    expect(con.overallScore).toBe(60);
    expect(con.progressTrend).toBe("xu hướng CON");
    expect(con.strengths).toEqual(["mạnh CON"]);
    expect(con.evidenceRounds?.[0].turns[0].excerpt).toBe("lượt CON");
  });

  it("maps the camelCase evidence checks, and still drops a stray error field", () => {
    const withError = evaluation();
    (withError.proEvaluation!.roundEvaluations[0].evidenceChecks![0].evidenceCheck as Record<string, unknown>).error =
      "TimeoutError: verify qua 20 s";

    const rounds = buildDebateResultFromEvaluation(withError, "pro", "t")!.evidenceRounds!;

    expect(rounds).toHaveLength(1);
    expect(rounds[0]).toMatchObject({ stage: "opening", label: "Mở đầu", scoreBefore: 3, scoreAfter: 1, ruleApplied: "1/1 claim CONTRADICTED" });
    const claim = rounds[0].turns[0].claims[0];
    expect(claim.label).toBe("CONTRADICTED");
    expect(claim.citations[0]).toEqual({
      fact_id: "2af92cb1",
      content: "Có 115 lớp tập huấn",
      citation: "Thanh Niên - https://thanhnien.vn/a.htm",
      stance: "contradicts",
    });
    expect(JSON.stringify(rounds)).not.toContain("TimeoutError");
  });

  it("a skipped stage keeps 'no score' in the stage breakdown", () => {
    const result = buildDebateResultFromEvaluation(
      evaluation({ proEvaluation: part("PRO", 5.33, { stageBreakdown: { opening: 8, closing: 8 }, skippedStages: ["rebuttal"] }) }),
      "pro",
      "t"
    )!;
    expect(result.stageBreakdown?.map((s) => [s.stage, s.score])).toEqual([
      ["opening", 8],
      ["rebuttal", null],
      ["closing", 8],
    ]);
    expect(result.overallScore).toBe(53);
  });

  it("an old judgement (no evidence, no skippedStages) maps without evidence", () => {
    const old = part("PRO", 7, { skippedStages: undefined });
    old.roundEvaluations = old.roundEvaluations.map((r) => ({ ...r, evidenceChecks: null, evidenceScoreBefore: null, evidenceScoreAfter: null, evidenceRuleApplied: null }));

    const result = buildDebateResultFromEvaluation(evaluation({ proEvaluation: old }), "pro", "t")!;

    expect(result.overallScore).toBe(70);
    expect(result.evidenceRounds).toBeUndefined();
  });

  it("my side never spoke (no evaluation, score 0): a real 0 with every stage 'not spoken'", () => {
    const result = buildDebateResultFromEvaluation(evaluation({ conEvaluation: null, overallScoreCon: 0 }), "con", "t")!;
    expect(result.overallScore).toBe(0);
    expect(result.stageBreakdown?.every((s) => s.score === null)).toBe(true);
  });

  it("my side scored but has no evaluation: null (an error, never an invented 0)", () => {
    expect(buildDebateResultFromEvaluation(evaluation({ proEvaluation: null, overallScorePro: 7 }), "pro", "t")).toBeNull();
  });
});

const session = (participants: Array<{ userId: number | null; side: number; isAI?: boolean }>) => ({
  success: true,
  data: {
    sessionId: 42,
    title: "Học qua chơi",
    topic: "Học thông qua chơi nên được áp dụng rộng rãi",
    status: 3,
    participants: participants.map((p) => ({ isAI: false, speakerName: "x", ...p })),
  },
});

const renderResult = (state?: unknown) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/debater/debate/42/result", state }]}>
      <Routes>
        <Route path="/debater/debate/:sessionId/result" element={<DebateResult />} />
      </Routes>
    </MemoryRouter>
  );

describe("DebateResult without the room's state (F5 in a new tab, history, shared link)", () => {
  beforeEach(() => {
    mockAuthUser = { userId: 1, id: 1, fullName: "Nguyen Van A", role: "Debater" };
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetSessionDetails.mockResolvedValue(session([{ userId: 1, side: 2 }, { userId: null, side: 1, isAI: true }]));
    mockGetEvaluation.mockResolvedValue({ success: true, message: "ok", data: evaluation() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("loads the official result of MY side, with the evidence panel", async () => {
    renderResult();

    expect(screen.getByTestId("result-loading")).toHaveTextContent("Đang tải kết quả tranh biện");
    expect(await screen.findByTestId("result-overall-score")).toHaveTextContent("60"); // I am CON
    expect(mockGetEvaluation).toHaveBeenCalledWith(42);
    expect(screen.getByText(/Học thông qua chơi/)).toBeInTheDocument();
    expect(screen.getByTestId("evidence-check-panel")).toBeInTheDocument();
    expect(screen.getByText("Dự án có tổng cộng 40 lớp tập huấn")).toBeInTheDocument();
  });

  it("shows a clear error with a retry when the result cannot be loaded, and the result once it can", async () => {
    mockGetEvaluation.mockRejectedValueOnce({ success: false, status: 404, message: "No evaluation found for this debate session." });
    renderResult();

    expect(await screen.findByTestId("result-load-error")).toHaveTextContent(
      "Không tải được kết quả tranh biện. (No evaluation found for this debate session.)"
    );
    fireEvent.click(screen.getByTestId("result-retry-btn"));

    expect(await screen.findByTestId("result-overall-score")).toHaveTextContent("60");
    expect(mockGetEvaluation).toHaveBeenCalledTimes(2);
  });

  it("someone who did not take part gets an error, not one side's result", async () => {
    mockGetSessionDetails.mockResolvedValue(session([{ userId: 7, side: 1 }, { userId: 8, side: 2 }]));
    renderResult();

    expect(await screen.findByTestId("result-load-error")).toHaveTextContent("bạn không tham gia phiên tranh biện này");
  });

  it("uses the room's state when it has it: no request", async () => {
    const fromRoom = buildDebateResultFromEvaluation(evaluation(), "pro", "Chủ đề phòng")!;
    renderResult({ result: fromRoom });

    expect(screen.getByTestId("result-overall-score")).toHaveTextContent("80");
    expect(mockGetEvaluation).not.toHaveBeenCalled();
    expect(mockGetSessionDetails).not.toHaveBeenCalled();
  });
});

describe("DebateHistory", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("offers 'Xem kết quả' only for a completed debate, linking to its result page", async () => {
    mockGetUserHistory.mockResolvedValue({
      success: true,
      data: [
        { sessionId: 42, title: "Đã xong", topic: "t", debateType: 1, status: 3, userSide: 1, createdAt: "2026-11-10T10:00:00Z" },
        { sessionId: 43, title: "Đang diễn ra", topic: "t", debateType: 2, status: 2, userSide: 2, createdAt: "2026-11-10T11:00:00Z" },
        { sessionId: 44, title: "Đã xong (chuỗi)", topic: "t", debateType: 2, status: "Completed", userSide: 2, createdAt: "2026-11-10T12:00:00Z" },
      ],
    });
    render(
      <MemoryRouter>
        <DebateHistory />
      </MemoryRouter>
    );

    const link = await screen.findByTestId("history-result-link-42");
    expect(link).toHaveTextContent("Xem kết quả");
    expect(link).toHaveAttribute("href", "/debater/debate/42/result");
    expect(screen.getByTestId("history-result-link-44")).toHaveAttribute("href", "/debater/debate/44/result");
    expect(screen.queryByTestId("history-result-link-43")).not.toBeInTheDocument();
  });
});

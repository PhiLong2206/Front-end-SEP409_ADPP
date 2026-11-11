import { describe, it, expect, vi } from "vitest";
import { buildDebateResult, normalizeCriteria } from "../utils/debateScoring";
import type { ArgumentEvaluationResult, RoundEvaluationResult, SessionEvaluationResult } from "../types";

const round = (
  stage: RoundEvaluationResult["stage"],
  round_score: number,
  criteria: RoundEvaluationResult["criteria"]
): RoundEvaluationResult => ({
  stage,
  round_score,
  criteria,
  consistency_note: "",
  strengths: [],
  weaknesses: [],
  suggestions: [],
});

describe("normalizeCriteria", () => {
  it("maps English and Vietnamese names to stable keys and scales 0-5 to 0-100", () => {
    const result = normalizeCriteria([
      [
        { name: "Logic & Cấu trúc", score: 4, reasoning: "ok" },
        { name: "Evidence", score: 2.5, reasoning: "" },
        { name: "Tính thuyết phục", score: 5, reasoning: "" },
      ],
    ]);
    const byKey = Object.fromEntries(result.map((c) => [c.key, c]));
    expect(byKey.logic.percent).toBe(80);
    expect(byKey.evidence.percent).toBe(50);
    expect(byKey.persuasiveness.percent).toBe(100);
    expect(byKey.logic.label).toBe("Lập luận");
  });

  it("leaves missing criteria as null instead of inventing a value", () => {
    const result = normalizeCriteria([[{ name: "Logic", score: 3, reasoning: "" }]]);
    const missing = result.filter((c) => c.key !== "logic");
    expect(missing.length).toBe(4);
    expect(missing.every((c) => c.score === null && c.percent === null)).toBe(true);
  });

  it("averages a criterion across rounds and uses an explicit key when provided", () => {
    const result = normalizeCriteria([
      [{ key: "relevance", name: "x", score: 2, reasoning: "" }],
      [{ name: "Tính liên quan", score: 4, reasoning: "" }],
    ]);
    expect(result.find((c) => c.key === "relevance")?.score).toBe(3);
  });

  it("clamps out-of-range scores and reports them", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = normalizeCriteria([[{ name: "Logic", score: 8, reasoning: "" }]]);
    expect(result.find((c) => c.key === "logic")?.percent).toBe(100);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("buildDebateResult", () => {
  const rounds = [
    round("opening", 6, [
      { name: "Logic", score: 4, reasoning: "" },
      { name: "Evidence", score: 2, reasoning: "" },
    ]),
    round("closing", 8, [
      { name: "Logic", score: 2, reasoning: "" },
      { name: "Evidence", score: 4, reasoning: "" },
    ]),
  ];
  const lastTurn: ArgumentEvaluationResult = {
    overall_score: 9,
    overall_reasoning: "",
    criteria: [{ name: "Logic", score: 1, reasoning: "" }],
    strengths: [],
    weaknesses: [],
    suggestions: [],
  };

  it("overall = the session's holistic overall_score (0-10 → /100), NOT the average of the criteria", () => {
    const session: SessionEvaluationResult = {
      overall_score: 7,
      stage_breakdown: { opening: 6, closing: 8 },
      progress_trend: "up",
    };
    const result = buildDebateResult({
      sessionId: "s",
      topicTitle: "t",
      sessionResult: session,
      roundResults: rounds,
      lastTurnEvaluation: lastTurn,
    });
    expect(result?.overallScore).toBe(70);
    // criteria (avg 3/5 = 60) are still shown per criterion but do not drive the overall score
    expect(result?.criteria.find((c) => c.key === "logic")?.percent).toBe(60);
    // stage scores are kept as trend information
    expect(result?.stageBreakdown?.map((s) => s.label)).toEqual(["Mở đầu", "Kết luận"]);
  });

  it("lists a skipped stage without a score, in stage order, even if the evaluator returned one", () => {
    const result = buildDebateResult({
      sessionId: "s",
      topicTitle: "t",
      sessionResult: {
        overall_score: 7,
        stage_breakdown: { opening: 6, rebuttal: 0, closing: 8 },
        progress_trend: "",
      },
      roundResults: [],
      lastTurnEvaluation: null,
      skippedStages: ["rebuttal"],
    });

    expect(result?.stageBreakdown?.map((s) => [s.label, s.score])).toEqual([
      ["Mở đầu", 6],
      ["Phản biện", null],
      ["Kết luận", 8],
    ]);
  });

  it("without a session result, uses the average of the rounds' round_score", () => {
    const result = buildDebateResult({
      sessionId: "s",
      topicTitle: "t",
      sessionResult: null,
      roundResults: [round("opening", 5, []), round("closing", 8, [])],
      lastTurnEvaluation: lastTurn,
    });
    expect(result?.overallScore).toBe(65); // (5 + 8) / 2 = 6.5
  });

  it("without session and rounds, falls back to the last turn's overall_score", () => {
    const result = buildDebateResult({
      sessionId: "s",
      topicTitle: "t",
      sessionResult: null,
      roundResults: [],
      lastTurnEvaluation: lastTurn,
    });
    expect(result?.overallScore).toBe(90);
  });

  it("returns null when no source has an overall score", () => {
    expect(
      buildDebateResult({
        sessionId: "s",
        topicTitle: "t",
        sessionResult: null,
        roundResults: [],
        lastTurnEvaluation: null,
      })
    ).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { buildSessionDeliverySummary } from "../utils/deliverySummary";
import DeliveryEvaluationPanel from "../components/debate/grading/DeliveryEvaluationPanel";
import type { ArgumentDetailDto } from "../types";

const makeArg = (overrides: Partial<ArgumentDetailDto>): ArgumentDetailDto => ({
  argumentId: 1,
  turnOrder: 1,
  stage: 1,
  side: 1,
  userId: 10,
  speakerName: "Bạn",
  isAI: false,
  content: "Lập luận",
  submittedAt: "2026-11-27T00:00:00Z",
  ...overrides,
});

describe("buildSessionDeliverySummary & DeliveryEvaluationPanel", () => {
  it("returns null when no learner turn has deliveryAnalytics", () => {
    const args = [
      makeArg({ argumentId: 1, deliveryAnalytics: null }),
      makeArg({
        argumentId: 2,
        isAI: true,
        userId: null,
        deliveryAnalytics: { wpm: 140, overallDemeanorScore: 90 },
      }),
    ];
    expect(buildSessionDeliverySummary(args, 10)).toBeNull();
  });

  it("aggregates camelCase and snake_case deliveryAnalytics for the learner only", () => {
    const args = [
      makeArg({
        argumentId: 1,
        stage: 1,
        deliveryAnalytics: {
          wpm: 120,
          paceEvaluation: "Vừa phải",
          fluencyScore: 80,
          fillerCount: 2,
          composureScore: 84,
          eyeContactRate: 90,
          dominantEmotion: "neutral",
          overallDemeanorScore: 82,
        },
      }),
      makeArg({
        argumentId: 2,
        stage: 2,
        deliveryAnalytics: {
          wpm: 140,
          pace_evaluation: "Hơi nhanh",
          fluency_score: 90,
          filler_count: 1,
          composure_score: 88,
          eye_contact_rate: 80,
          dominant_emotion: "happy",
          overall_demeanor_score: 88,
        },
      }),
      // Another user's turn in P2P must be ignored
      makeArg({
        argumentId: 3,
        userId: 99,
        deliveryAnalytics: { wpm: 200, overallDemeanorScore: 40 },
      }),
    ];

    const summary = buildSessionDeliverySummary(args, 10);
    expect(summary).not.toBeNull();
    expect(summary!.overallDemeanorScore).toBe(85);
    expect(summary!.avgWpm).toBe(130);
    expect(summary!.avgFluency).toBe(85);
    expect(summary!.totalFillers).toBe(3);
    expect(summary!.avgComposure).toBe(86);
    expect(summary!.avgEyeContact).toBe(85);
    expect(summary!.turns).toHaveLength(2);

    render(<DeliveryEvaluationPanel summary={summary} />);
    expect(screen.getByTestId("delivery-evaluation-panel")).toBeInTheDocument();
    expect(screen.getByText("2 lượt ghi âm")).toBeInTheDocument();
    expect(screen.getByText("130")).toBeInTheDocument();
    expect(screen.getByText("3 từ đệm")).toBeInTheDocument();
    expect(screen.getByText("Mở đầu")).toBeInTheDocument();
    expect(screen.getByText("Phản biện")).toBeInTheDocument();
    expect(screen.getAllByText(/Bình tĩnh/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders empty state when summary is null", () => {
    render(<DeliveryEvaluationPanel summary={null} />);
    expect(screen.getByTestId("delivery-evaluation-empty")).toBeInTheDocument();
  });
});

import type { ArgumentDetailDto, DeliveryAnalytics } from "../types";
import { isSameUserId } from "./debateSpeaker";

export interface DeliveryTurnSummary {
  argumentId: number;
  stageLabel: string;
  wpm: number;
  paceEvaluation: string;
  fluencyScore: number;
  fillerCount: number;
  composureScore: number;
  eyeContactRate: number;
  dominantEmotion: string;
  overallDemeanorScore: number;
}

export interface SessionDeliverySummary {
  overallDemeanorScore: number;
  avgWpm: number;
  paceEvaluation: string;
  avgFluency: number;
  totalFillers: number;
  avgComposure: number;
  avgEyeContact: number;
  dominantEmotion: string;
  turns: DeliveryTurnSummary[];
}

function stageLabelOf(stage: ArgumentDetailDto["stage"]): string {
  const raw = String(stage ?? "").toLowerCase();
  if (raw === "1" || raw === "opening") return "Mở đầu";
  if (raw === "2" || raw === "rebuttal") return "Phản biện";
  if (raw === "3" || raw === "closing") return "Kết luận";
  return "Lượt nói";
}

function readNum(primary: number | undefined, fallback: number | undefined, defaultVal = 0): number {
  const val = primary ?? fallback;
  return typeof val === "number" && Number.isFinite(val) ? val : defaultVal;
}

function normalizeTurn(arg: ArgumentDetailDto, da: DeliveryAnalytics): DeliveryTurnSummary {
  return {
    argumentId: arg.argumentId,
    stageLabel: stageLabelOf(arg.stage),
    wpm: Math.round(readNum(da.wpm, undefined, 0)),
    paceEvaluation: (da.paceEvaluation ?? da.pace_evaluation ?? "").trim(),
    fluencyScore: Math.round(readNum(da.fluencyScore, da.fluency_score, 0)),
    fillerCount: Math.round(readNum(da.fillerCount, da.filler_count, 0)),
    composureScore: Math.round(readNum(da.composureScore, da.composure_score, 0)),
    eyeContactRate: Math.round(readNum(da.eyeContactRate, da.eye_contact_rate, 0)),
    dominantEmotion: (da.dominantEmotion ?? da.dominant_emotion ?? "neutral").trim() || "neutral",
    overallDemeanorScore: Math.round(readNum(da.overallDemeanorScore, da.overall_demeanor_score, 0)),
  };
}

function mostFrequent(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v || v === "none") continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best = "neutral";
  let max = 0;
  for (const [k, c] of counts.entries()) {
    if (c > max) {
      best = k;
      max = c;
    }
  }
  return best;
}

/**
 * Aggregates voice & facial delivery analytics across the learner's recorded turns in a session.
 * Returns null if no turn has deliveryAnalytics (e.g. text-only debate).
 */
export function buildSessionDeliverySummary(
  args: ArgumentDetailDto[] | undefined,
  userId: number | string | null
): SessionDeliverySummary | null {
  if (!args || args.length === 0) return null;

  const learnerTurns = args
    .filter((a) => !a.isAI && a.deliveryAnalytics != null && (userId == null || isSameUserId(a.userId, userId)))
    .map((a) => normalizeTurn(a, a.deliveryAnalytics!));

  if (learnerTurns.length === 0) return null;

  const n = learnerTurns.length;
  const avg = (getter: (t: DeliveryTurnSummary) => number) =>
    Math.round(learnerTurns.reduce((sum, t) => sum + getter(t), 0) / n);

  const totalFillers = learnerTurns.reduce((sum, t) => sum + t.fillerCount, 0);
  const paces = learnerTurns.map((t) => t.paceEvaluation).filter(Boolean);

  return {
    overallDemeanorScore: avg((t) => t.overallDemeanorScore),
    avgWpm: avg((t) => t.wpm),
    paceEvaluation: paces[paces.length - 1] ?? "",
    avgFluency: avg((t) => t.fluencyScore),
    totalFillers,
    avgComposure: avg((t) => t.composureScore),
    avgEyeContact: avg((t) => t.eyeContactRate),
    dominantEmotion: mostFrequent(learnerTurns.map((t) => t.dominantEmotion)),
    turns: learnerTurns,
  };
}


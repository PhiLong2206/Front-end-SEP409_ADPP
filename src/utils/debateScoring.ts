import type {
  ArgumentEvaluationResult,
  DebateEvaluationResponse,
  EvidenceClaim,
  EvidenceStatus,
  EvidenceTopic,
  RoundEvaluationResult,
  RubricCriterionScore,
  SessionEvaluationResult,
} from "../types";

/**
 * Score scales returned by the AI Evaluator Service. These are the ONLY places
 * where a scale is declared — components must read them from here (or from the
 * normalized data) instead of hardcoding `/5`, `/10` or `/100`.
 */
/** `criteria[].score` — 0..5 */
export const CRITERION_MAX_SCORE = 5;
/** `overall_score` and `round_score` — 0..10 */
export const OVERALL_MAX_SCORE = 10;
/** `stage_breakdown[stage]` — 0..10 */
export const STAGE_MAX_SCORE = 10;
/** Denominator of every percentage shown in the UI (circle score, criteria bars). */
export const PERCENT_MAX = 100;

export type CriterionKey =
  | "logic"
  | "evidence"
  | "relevance"
  | "structure"
  | "persuasiveness"
  | "rebuttal";

/** Criteria always listed on the result screen (shown as "—" when the evaluator did not score them). */
export const CORE_CRITERION_KEYS: CriterionKey[] = [
  "logic",
  "evidence",
  "relevance",
  "structure",
  "persuasiveness",
];

/** Single key → Vietnamese label table shared by the bars column and the reasoning column. */
export const CRITERION_LABELS: Record<CriterionKey, string> = {
  logic: "Lập luận",
  evidence: "Dẫn chứng",
  relevance: "Tính liên quan",
  structure: "Cấu trúc",
  persuasiveness: "Tính thuyết phục",
  rebuttal: "Phản biện",
};

const STAGE_LABELS: Record<string, string> = {
  opening: "Mở đầu",
  rebuttal: "Phản biện",
  closing: "Kết luận",
};

const foldText = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * TODO(BE): the evaluator should return a stable `key` per criterion
 * (logic | evidence | relevance | structure | persuasiveness | rebuttal).
 * Until then we resolve the key from the criterion name via this alias table
 * (English and Vietnamese names, diacritics/case/punctuation insensitive).
 */
const CRITERION_ALIASES: Record<string, CriterionKey> = {
  logic: "logic",
  "logic cau truc": "logic",
  "logic lap luan": "logic",
  "lap luan": "logic",
  evidence: "evidence",
  "dan chung": "evidence",
  "dan chung thuc tien": "evidence",
  "bang chung": "evidence",
  relevance: "relevance",
  "tinh lien quan": "relevance",
  "lien quan": "relevance",
  "do phu hop": "relevance",
  structure: "structure",
  "cau truc": "structure",
  "bo cuc": "structure",
  persuasiveness: "persuasiveness",
  "tinh thuyet phuc": "persuasiveness",
  "suc thuyet phuc": "persuasiveness",
  "thuyet phuc": "persuasiveness",
  rebuttal: "rebuttal",
  "phan bien": "rebuttal",
  "ky nang phan bien": "rebuttal",
};

const hasOwn = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

const isCriterionKey = (value: string): value is CriterionKey => hasOwn(CRITERION_LABELS, value);

const resolveCriterionKey = (criterion: RubricCriterionScore): CriterionKey | null => {
  if (criterion.key && isCriterionKey(criterion.key)) return criterion.key;
  const folded = foldText(criterion.name ?? "");
  return hasOwn(CRITERION_ALIASES, folded) ? CRITERION_ALIASES[folded] : null;
};

export interface NormalizedCriterion {
  /** Stable key (CriterionKey, or the folded raw name for a criterion we do not know). */
  key: string;
  /** Vietnamese label from CRITERION_LABELS (or the raw name for an unknown criterion). */
  label: string;
  /** Raw score, 0..maxScore. `null` = the evaluator did not score this criterion. */
  score: number | null;
  maxScore: number;
  /** score / maxScore as a 0..100 integer. `null` when `score` is null. */
  percent: number | null;
  reasoning: string;
}

export interface NormalizedStageScore {
  stage: string;
  label: string;
  /** 0..maxScore. `null` = the debater did not speak in this stage, so it has no score. */
  score: number | null;
  maxScore: number;
}

/** Result-screen payload. Every score here is already in its display scale. */
export interface DebateResultData {
  sessionId: string;
  topicTitle: string;
  /** 0..100, the evaluator's holistic overall score — NOT the average of the criteria (see computeOverallPercent) */
  overallScore: number;
  ratingText: string;
  criteria: NormalizedCriterion[];
  strengths: string[];
  improvements: string[];
  progressTrend?: string;
  stageBreakdown?: NormalizedStageScore[];
  /** Evidence check per graded round (RAG). Absent when no round was checked. */
  evidenceRounds?: EvidenceRoundView[];
}

/** One learner turn's evidence check, without the evaluator's technical `error`. */
export interface EvidenceTurnView {
  turnIndex: number;
  excerpt: string;
  status: EvidenceStatus;
  claims: EvidenceClaim[];
}

export interface EvidenceRoundView {
  stage: string;
  label: string;
  turns: EvidenceTurnView[];
  /** Evidence criterion (0-5) before / after the code adjusted it; null when nothing was adjusted. */
  scoreBefore: number | null;
  scoreAfter: number | null;
  ruleApplied: string;
}

const EVIDENCE_TOPICS: readonly EvidenceTopic[] = ["education", "environment", "technology", "society"];

/** The session's `evidenceTopic` as the evaluator expects it, or undefined (= the evaluator does not check). */
export function toEvidenceTopic(value: string | null | undefined): EvidenceTopic | undefined {
  const normalized = value?.trim().toLowerCase();
  return EVIDENCE_TOPICS.find((t) => t === normalized);
}

/** Evidence checks of the graded rounds, in stage order. `error` is dropped here: the result screen never sees it. */
export function buildEvidenceRounds(roundResults: RoundEvaluationResult[]): EvidenceRoundView[] | undefined {
  const rounds = roundResults
    .filter((r) => (r.evidence_checks?.length ?? 0) > 0)
    .map((r) => ({
      stage: r.stage,
      label: stageLabel(r.stage),
      turns: (r.evidence_checks ?? [])
        .filter((c) => c?.evidence_check)
        .map((c) => ({
          turnIndex: c.turn_index,
          excerpt: c.excerpt ?? "",
          status: c.evidence_check.status,
          claims: (c.evidence_check.claims ?? []).map((claim) => ({ ...claim, citations: claim.citations ?? [] })),
        })),
      scoreBefore: isFiniteNumber(r.evidence_score_before) ? r.evidence_score_before : null,
      scoreAfter: isFiniteNumber(r.evidence_score_after) ? r.evidence_score_after : null,
      ruleApplied: r.evidence_rule_applied ?? "",
    }))
    .filter((r) => r.turns.length > 0)
    .sort((a, b) => stageRank(a.stage) - stageRank(b.stage));
  return rounds.length > 0 ? rounds : undefined;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const average = (values: number[]): number | null =>
  values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null;

const round1 = (value: number): number => Math.round(value * 10) / 10;

const toPercent = (score: number, max: number): number =>
  Math.round((Math.min(Math.max(score, 0), max) / max) * PERCENT_MAX);

const clampToScale = (score: number, max: number, what: string): number => {
  if (score < 0 || score > max) {
    console.error(`[ADPP scoring] ${what} = ${score} is outside the expected 0-${max} scale; clamping.`);
  }
  return Math.min(Math.max(score, 0), max);
};

/**
 * Merges one or more criteria lists (one per round, or a single list for a turn) into a
 * stable, ordered list: the core criteria first (score `null` when missing), then
 * any other known/unknown criterion that was actually returned.
 * When a criterion appears in several lists its score is averaged.
 */
export function normalizeCriteria(sources: RubricCriterionScore[][]): NormalizedCriterion[] {
  const byKey = new Map<
    string,
    { label: string; scores: number[]; maxScore: number; reasoning: string }
  >();

  for (const list of sources) {
    for (const criterion of list ?? []) {
      const known = resolveCriterionKey(criterion);
      const key = known ?? (foldText(criterion.name ?? "") || `criterion-${byKey.size}`);
      const entry = byKey.get(key) ?? {
        label: known ? CRITERION_LABELS[known] : criterion.name,
        scores: [],
        maxScore: CRITERION_MAX_SCORE,
        reasoning: "",
      };
      if (isFiniteNumber(criterion.max_score) && criterion.max_score > 0) {
        entry.maxScore = criterion.max_score;
      }
      if (isFiniteNumber(criterion.score)) {
        entry.scores.push(clampToScale(criterion.score, entry.maxScore, `criteria[${key}].score`));
      }
      // Keep the most recent non-empty explanation (the last round is the most representative).
      if (criterion.reasoning?.trim()) entry.reasoning = criterion.reasoning;
      byKey.set(key, entry);
    }
  }

  const build = (key: string): NormalizedCriterion => {
    const entry = byKey.get(key);
    const avg = entry ? average(entry.scores) : null;
    const maxScore = entry?.maxScore ?? CRITERION_MAX_SCORE;
    const score = avg === null ? null : round1(avg);
    return {
      key,
      label: entry?.label ?? (isCriterionKey(key) ? CRITERION_LABELS[key] : key),
      score,
      maxScore,
      percent: score === null ? null : toPercent(score, maxScore),
      reasoning: entry?.reasoning ?? "",
    };
  };

  const ordered: string[] = [...CORE_CRITERION_KEYS];
  for (const key of byKey.keys()) {
    if (!ordered.includes(key)) ordered.push(key);
  }
  return ordered.map(build);
}

const getRatingText = (percent: number): string =>
  percent >= 80 ? "Xuất sắc" : percent >= 65 ? "Khá tốt" : "Cần cải thiện";

const unique = (items: string[]): string[] => Array.from(new Set(items.filter((s) => s?.trim())));

export interface BuildDebateResultInput {
  sessionId: string;
  topicTitle: string;
  sessionResult: SessionEvaluationResult | null;
  roundResults: RoundEvaluationResult[];
  /** Evaluation of the last submitted turn — last-resort source for criteria/feedback only. */
  lastTurnEvaluation: ArgumentEvaluationResult | null;
  /** Stages the debater did not speak in: listed on the result screen without a score. */
  skippedStages?: string[];
}

const STAGE_ORDER = Object.keys(STAGE_LABELS);
const stageRank = (stage: string): number => {
  const rank = STAGE_ORDER.indexOf(stage);
  return rank === -1 ? STAGE_ORDER.length : rank;
};
const stageLabel = (stage: string): string => (hasOwn(STAGE_LABELS, stage) ? STAGE_LABELS[stage] : stage);

/**
 * Overall score (0..100) = the evaluator's HOLISTIC judgement (`overall_score`, 0..10).
 * This is a deliberate design decision and NOT the average of the criteria: averaging compresses
 * every score towards the middle ("score compression"). The result screen tells the user so.
 * Source order: session overall → average of the rounds' `round_score` → last turn's overall.
 */
function computeOverallPercent(
  sessionResult: SessionEvaluationResult | null,
  roundResults: RoundEvaluationResult[],
  lastTurnEvaluation: ArgumentEvaluationResult | null
): number | null {
  const roundAverage = average(roundResults.map((r) => r.round_score).filter(isFiniteNumber));
  const overall10 = isFiniteNumber(sessionResult?.overall_score)
    ? sessionResult.overall_score
    : roundAverage ??
      (isFiniteNumber(lastTurnEvaluation?.overall_score) ? lastTurnEvaluation.overall_score : null);
  if (overall10 === null) return null;
  return toPercent(clampToScale(overall10, OVERALL_MAX_SCORE, "overall_score"), OVERALL_MAX_SCORE);
}

/**
 * The ONE place that converts evaluator responses into result-screen data.
 * Criteria source priority: sessionResult → roundResults (averaged) → lastTurnEvaluation.
 * Returns `null` when no source carries an overall score — callers must show an error
 * instead of inventing numbers.
 */
export function buildDebateResult(input: BuildDebateResultInput): DebateResultData | null {
  const { sessionId, topicTitle, sessionResult, roundResults, lastTurnEvaluation, skippedStages = [] } = input;

  // Criteria for the WHOLE session
  const criteriaSources: RubricCriterionScore[][] = sessionResult?.criteria?.length
    ? [sessionResult.criteria]
    : roundResults.some((r) => r.criteria?.length)
    ? roundResults.map((r) => r.criteria ?? [])
    : [lastTurnEvaluation?.criteria ?? []];
  const criteria = normalizeCriteria(criteriaSources);

  const overallScore = computeOverallPercent(sessionResult, roundResults, lastTurnEvaluation);
  if (overallScore === null) return null;

  // Stage scores (0..STAGE_MAX_SCORE)
  const stageEntries: Array<[string, number]> =
    sessionResult?.stage_breakdown && Object.keys(sessionResult.stage_breakdown).length > 0
    ? Object.entries(sessionResult.stage_breakdown)
    : roundResults.map((r) => [r.stage, r.round_score] as [string, number]);
  const stageBreakdown: NormalizedStageScore[] = [
    ...stageEntries
      .filter(([stage, score]) => isFiniteNumber(score) && !skippedStages.includes(stage))
      .map(([stage, score]) => ({
        stage,
        label: stageLabel(stage),
        score,
        maxScore: STAGE_MAX_SCORE,
      })),
    ...skippedStages.map((stage) => ({
      stage,
      label: stageLabel(stage),
      score: null,
      maxScore: STAGE_MAX_SCORE,
    })),
  ].sort((a, b) => stageRank(a.stage) - stageRank(b.stage));

  const strengths = sessionResult?.overall_strengths?.length
    ? sessionResult.overall_strengths
    : roundResults.some((r) => r.strengths?.length)
    ? unique(roundResults.flatMap((r) => r.strengths ?? []))
    : lastTurnEvaluation?.strengths ?? [];
  const improvements = sessionResult?.overall_weaknesses?.length
    ? sessionResult.overall_weaknesses
    : roundResults.some((r) => r.weaknesses?.length)
    ? unique(roundResults.flatMap((r) => r.weaknesses ?? []))
    : lastTurnEvaluation?.weaknesses ?? [];

  return {
    sessionId,
    topicTitle,
    overallScore,
    ratingText: getRatingText(overallScore),
    criteria,
    strengths,
    improvements,
    progressTrend: sessionResult?.progress_trend || lastTurnEvaluation?.overall_reasoning || undefined,
    stageBreakdown: stageBreakdown.length > 0 ? stageBreakdown : undefined,
    evidenceRounds: buildEvidenceRounds(roundResults),
  };
}

/**
 * Official result (GET /api/debate/{id}/evaluation) → result-screen data for ONE side, the user's.
 * Converted to the evaluator's own shapes so buildDebateResult stays the single place of the scoring rules.
 * Returns null when the user's side has no evaluation although it scored (the caller shows an error).
 */
export function buildDebateResultFromEvaluation(
  evaluation: DebateEvaluationResponse,
  side: "pro" | "con",
  topicTitle: string
): DebateResultData | null {
  const sessionId = String(evaluation.sessionId);
  const part = side === "pro" ? evaluation.proEvaluation : evaluation.conEvaluation;
  if (!part) {
    const sideScore = side === "pro" ? evaluation.overallScorePro : evaluation.overallScoreCon;
    // That side never spoke: nothing was graded, a real 0
    return isFiniteNumber(sideScore) && sideScore > 0 ? null : buildNoSpeechDebateResult(sessionId, topicTitle);
  }

  const sessionResult: SessionEvaluationResult = {
    overall_score: part.overallScore,
    stage_breakdown: part.stageBreakdown ?? {},
    progress_trend: part.progressTrend ?? "",
    overall_strengths: part.strengths ?? [],
    overall_weaknesses: part.weaknesses ?? [],
    overall_suggestions: part.suggestions ?? [],
  };
  const roundResults: RoundEvaluationResult[] = (part.roundEvaluations ?? []).map((r) => ({
    stage: r.stage as RoundEvaluationResult["stage"],
    round_score: r.roundScore,
    criteria: r.criteria ?? [],
    consistency_note: r.consistencyNote ?? "",
    strengths: r.strengths ?? [],
    weaknesses: r.weaknesses ?? [],
    suggestions: r.suggestions ?? [],
    evidence_checks: (r.evidenceChecks ?? []).map((c) => ({
      turn_index: c.turnIndex,
      excerpt: c.excerpt,
      evidence_check: c.evidenceCheck && {
        status: c.evidenceCheck.status,
        claims: (c.evidenceCheck.claims ?? []).map((claim) => ({
          claim: claim.claim,
          label: claim.label,
          reason: claim.reason,
          citations: (claim.citations ?? []).map((f) => ({
            fact_id: f.factId,
            content: f.content,
            citation: f.citation,
            stance: f.stance,
          })),
        })),
        counts: c.evidenceCheck.counts ?? {},
      },
    })),
    evidence_score_before: r.evidenceScoreBefore,
    evidence_score_after: r.evidenceScoreAfter,
    evidence_rule_applied: r.evidenceRuleApplied ?? "",
  }));

  return buildDebateResult({
    sessionId,
    topicTitle,
    sessionResult,
    roundResults,
    lastTurnEvaluation: null,
    skippedStages: part.skippedStages ?? [],
  });
}

/** Result for a debater who never spoke: a real 0, not an evaluator output. */
export function buildNoSpeechDebateResult(sessionId: string, topicTitle: string): DebateResultData {
  return {
    sessionId,
    topicTitle,
    overallScore: 0,
    ratingText: getRatingText(0),
    criteria: normalizeCriteria([]),
    strengths: [],
    improvements: ["Chưa ghi nhận lập luận nào do hết thời gian phát biểu."],
    stageBreakdown: STAGE_ORDER.map((stage) => ({
      stage,
      label: stageLabel(stage),
      score: null,
      maxScore: STAGE_MAX_SCORE,
    })),
  };
}

/** Best-effort human message from an axios/interceptor rejection. */
export function getErrorMessage(error: unknown, fallback: string): string {
  const e = error as { message?: string; detail?: string; response?: { data?: { detail?: string } } } | null;
  return e?.response?.data?.detail || e?.detail || e?.message || fallback;
}

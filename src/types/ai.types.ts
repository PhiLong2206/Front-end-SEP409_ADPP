import { DebateStage, DebateSide, AIDifficulty, ArgumentScore } from "./debate.types";

export interface AIOpponentRequest {
  topicMotion: string;
  stage: DebateStage;
  roundNumber: number;
  aiSide: DebateSide;
  difficulty: AIDifficulty;
  previousTranscript: Array<{
    speaker: string;
    text: string;
  }>;
}

export interface AIOpponentResponse {
  argument: string;
  speechAudioUrl?: string;
  thinkingProcess?: string;
}

export interface AIEvaluationRequest {
  topicMotion: string;
  stage: DebateStage;
  side: DebateSide;
  argumentText: string;
  contextTranscript?: string[];
}

export interface AIEvaluationResponse {
  score: ArgumentScore;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

export interface AIRebuttalRequest {
  topicMotion: string;
  opponentArgument: string;
  userSide: DebateSide;
  stage: DebateStage;
}

export interface AIRebuttalResponse {
  suggestedPoints: string[];
  counterArguments: string[];
  fallaciesIdentified?: string[];
}

export interface AIJudgeResult {
  winner: "Affirmative" | "Negative" | "Tie";
  affirmativeScore: number;
  negativeScore: number;
  detailedAnalysis: string;
  feedbackForAffirmative: string;
  feedbackForNegative: string;
}

// ── AI Microservices Integration (ai-opponent-service & ai-evaluator-service) ──

export type OpponentSide = "pro" | "con" | "AFFIRMATIVE" | "NEGATIVE";
export type BackendDebateSide = "pro" | "con";
export type OpponentDifficulty = "easy" | "medium" | "hard" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type BackendDifficulty = "easy" | "medium" | "hard";
export type DebateRoundType = "opening" | "rebuttal" | "closing";

export type TurnMode = "opening_first" | "opening_reply" | "rebuttal" | "closing";
export type SessionStatus = "created" | "planning" | "ready" | "failed";

export interface AIHealthResponse {
  status: string;
  llm_provider: string;
}

export interface CreateOpponentSessionRequest {
  external_session_id: string;
  motion: string;
  learner_side: BackendDebateSide;
  ai_side: BackendDebateSide;
  difficulty?: BackendDifficulty;
  language?: "vi";
}

export interface CreateOpponentSessionResponse {
  opponent_session_id: string;
  status: SessionStatus | string;
}

export interface SessionResponse {
  id: string;
  external_session_id: string;
  motion: string;
  ai_side: BackendDebateSide;
  learner_side: BackendDebateSide;
  difficulty: BackendDifficulty;
  language: string;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
  case_file?: CaseFileResponse | null;
}

export type LearnerSpeechInput = DebaterSpeechInput;
export interface DebaterSpeechInput {
  turn_index: number;
  round_type: DebateRoundType;
  text: string;
}

export interface CreateTurnRequest {
  turn_index: number;
  new_learner_speeches?: DebaterSpeechInput[];
}

export interface TurnResponse {
  turn_index: number;
  round_type: DebateRoundType | string;
  mode: TurnMode | string;
  speech_text: string;
}

export interface CasePlanDefinition {
  term: string;
  meaning: string;
}

export interface CasePlanArgument {
  id: string;
  title: string;
  claim: string;
  reasoning: string;
  example: string;
  impact: string;
}

export interface CasePlanAnticipated {
  id: string;
  learner_claim: string;
  planned_response: string;
}

export interface CaseFileContent {
  motion_reading: string;
  definitions: CasePlanDefinition[];
  arguments: CasePlanArgument[];
  anticipated_opponent_arguments: CasePlanAnticipated[];
  weighing: string;
}

export interface CaseFileResponse {
  id: string;
  session_id: string;
  content: CaseFileContent;
  prompt_version: string;
  llm_provider: string;
  llm_model: string;
  temperature: number;
  created_at: string;
}

export interface ArgumentEvaluationPayload {
  motion: string;
  side: BackendDebateSide;
  stage?: DebateRoundType;
  argument_text: string;
  opponent_argument_text?: string | null;
}

export type TurnSpeaker = "learner" | "opponent";

export interface ArgumentTurn {
  speaker: TurnSpeaker;
  text: string;
}

export interface RubricCriterionScore {
  /**
   * Stable criterion key: logic | evidence | relevance | structure | persuasiveness | rebuttal.
   * TODO(BE): not returned yet — the FE falls back to an alias table on `name`.
   */
  key?: string;
  name: string;
  /** Scale 0-5 (see CRITERION_MAX_SCORE in utils/debateScoring). */
  score: number;
  /** Optional maximum of `score`; the FE assumes 5 when absent. TODO(BE). */
  max_score?: number;
  reasoning: string;
}

export type CriterionScore = RubricCriterionScore;

export interface ArgumentEvaluationResult {
  /** Scale 0-10 (see OVERALL_MAX_SCORE in utils/debateScoring). */
  overall_score: number;
  overall_reasoning: string;
  /** Each criterion is scored 0-5. */
  criteria: RubricCriterionScore[];
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  raw_model_output?: string | null;
}

/** Fact-base topics of the evaluator's evidence check (RAG). Comes from the session's `evidenceTopic`. */
export type EvidenceTopic = "education" | "environment" | "technology" | "society";

export type EvidenceLabel = "SUPPORTED" | "CONTRADICTED" | "NOT_FOUND" | "CONFLICTING";
export type EvidenceStatus = "checked" | "no_claims" | "unavailable" | "no_fact_base";

export interface EvidenceCitation {
  fact_id: string;
  /** Fact text, cut to 300 characters by the evaluator. */
  content: string;
  /** Source, e.g. "Thanh Niên - https://..." */
  citation?: string | null;
  stance?: "supports" | "contradicts" | null;
}

export interface EvidenceClaim {
  claim: string;
  label: EvidenceLabel;
  reason: string;
  citations: EvidenceCitation[];
}

export interface EvidenceCheckSummary {
  status: EvidenceStatus;
  claims: EvidenceClaim[];
  counts: Partial<Record<EvidenceLabel, number>>;
  evidence_score_before?: number | null;
  evidence_score_after?: number | null;
  rule_applied?: string;
  /** Technical reason when status = unavailable. Never shown to the user. */
  error?: string | null;
  version?: string;
}

export interface TurnEvidenceCheck {
  /** Position of the turn in the request's `turns`. */
  turn_index: number;
  /** First 200 characters of the turn. */
  excerpt: string;
  evidence_check: EvidenceCheckSummary;
}

export interface RoundEvaluationRequest {
  motion: string;
  side: BackendDebateSide;
  stage: DebateRoundType;
  turns: ArgumentTurn[];
  /** Fact-base topic: the evaluator checks the learner's figures against it. Omitted = no check. */
  topic?: EvidenceTopic;
  /** false = do not check this round (default true). */
  check_evidence?: boolean;
}

export interface RoundEvaluationResult {
  stage: DebateRoundType;
  /** Scale 0-10 (same as overall_score). */
  round_score: number;
  /** Each criterion is scored 0-5. */
  criteria: RubricCriterionScore[];
  consistency_note: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  raw_model_output?: string | null;
  /** One entry per learner turn; empty when the round was not checked (no topic, RAG off). */
  evidence_checks?: TurnEvidenceCheck[];
  /** Evidence score (0-5) before / after the code adjusted it from the check. */
  evidence_score_before?: number | null;
  evidence_score_after?: number | null;
  evidence_rule_applied?: string;
}

export interface SessionEvaluationRequest {
  motion: string;
  side: BackendDebateSide;
  rounds: RoundEvaluationResult[];
  /** Stages the learner did not speak in (never in `rounds`). Omitted when there are none. */
  skipped_stages?: DebateRoundType[];
}

export interface SessionEvaluationResult {
  /** Scale 0-10. */
  overall_score: number;
  /** Per-stage score (opening / rebuttal / closing), scale 0-10. */
  stage_breakdown: Record<string, number>;
  /**
   * Whole-session criteria, each scored 0-5.
   * TODO(BE): not returned yet — the FE averages the per-round criteria instead.
   */
  criteria?: RubricCriterionScore[];
  progress_trend: string;
  overall_strengths?: string[];
  overall_weaknesses?: string[];
  overall_suggestions?: string[];
  raw_model_output?: string | null;
}



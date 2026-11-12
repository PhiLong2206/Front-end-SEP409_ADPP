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
  delivery_analytics?: DeliveryAnalyticsPayload | DeliveryAnalytics | null;
}

export type TurnSpeaker = "learner" | "opponent";

export interface ArgumentTurn {
  speaker: TurnSpeaker;
  text: string;
}

export interface RubricCriterionScore {
  /**
   * Stable criterion key: logic | evidence | relevance | structure | persuasiveness | rebuttal.
   */
  key?: string;
  name: string;
  /** Scale 0-5 (see CRITERION_MAX_SCORE in utils/debateScoring). */
  score: number;
  /** Optional maximum of `score`; the FE assumes 5 when absent. */
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
  delivery_analytics?: DeliveryAnalyticsPayload | DeliveryAnalytics | null;
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

// ── AI Coaching DTOs (ai-evaluator-service /coaching) ──

export interface ArgumentCoachingRequest {
  motion: string;
  side: BackendDebateSide;
  stage?: DebateRoundType;
  argument_text: string;
  opponent_argument_text?: string | null;
  evaluation: ArgumentEvaluationResult;
}

export interface RoundCoachingRequest {
  motion: string;
  side: BackendDebateSide;
  stage: DebateRoundType;
  turns: ArgumentTurn[];
  round_evaluation: RoundEvaluationResult;
}

export interface CoachingResult {
  summary: string;
  focus_area: string;
  drills: string[];
  rewritten_example?: string | null;
  next_turn_advice?: string[];
  raw_model_output?: string | null;
}

// ── AI Multimodal Debate Service DTOs (ai-multimodal-service on port 8003) ──

export interface MultimodalHealthResponse {
  status: string;
  service: string;
  models: {
    deepface_ready: boolean;
    detector_backend: string;
    whisper_ready: boolean;
    deepface_source: string;
  };
}

export interface DeliveryAnalytics {
  dominantEmotion?: string;
  eyeContactRate?: number;
  composureScore?: number;
  confidenceScore?: number;
  wpm?: number;
  paceEvaluation?: string;
  paceScore?: number;
  fillerCount?: number;
  fluencyScore?: number;
  overallDemeanorScore?: number;
  emotionBreakdown?: Record<string, number>;
  // Snake_case fields returned directly by Python ai-multimodal-service
  dominant_emotion?: string;
  eye_contact_rate?: number;
  composure_score?: number;
  confidence_score?: number;
  pace_evaluation?: string;
  pace_score?: number;
  filler_count?: number;
  fluency_score?: number;
  overall_demeanor_score?: number;
  emotion_breakdown?: Record<string, number>;
}

export type DeliveryAnalyticsPayload = DeliveryAnalytics;

export interface EmotionSample {
  time: number;
  dominant: string;
  scores: Record<string, number>;
  face_detected: boolean;
}

export interface FaceRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FrameAnalysisRequest {
  image_base64: string;
  timestamp?: number;
  detector_backend?: string;
}

export interface FrameAnalysisResult {
  face_detected: boolean;
  dominant_emotion: string;
  dominant_score: number;
  emotion_scores: Record<string, number>;
  face_confidence: number;
  region: FaceRegion | null;
  composure_instant: number;
  timestamp?: number | null;
}

export interface VoiceMetrics {
  transcript_text: string;
  duration_seconds: number;
  word_count: number;
  wpm: number;
  pace_evaluation: string;
  pace_score: number;
  filler_count: number;
  filler_words_found: Record<string, number>;
  fluency_score: number;
}

export interface FacialMetrics {
  total_frames_analyzed: number;
  face_detected_frames: number;
  eye_contact_rate: number;
  dominant_emotion: string;
  composure_score: number;
  emotion_counts: Record<string, number>;
  emotion_pct: Record<string, number>;
}

export interface MultimodalTurnRequest {
  audio_base64?: string | null;
  frames_base64?: string[];
  emotion_timeline?: EmotionSample[];
  total_frames_captured?: number;
  duration_seconds?: number;
  transcript_override?: string | null;
  include_report_chart?: boolean;
}

export interface MultimodalTurnResult {
  overall_demeanor_score: number;
  voice: VoiceMetrics;
  facial: FacialMetrics;
  delivery_analytics: DeliveryAnalytics;
  report_chart_base64?: string | null;
}

export interface IntegratedDebateEvaluationRequest {
  motion: string;
  side: "pro" | "con";
  stage: "opening" | "rebuttal" | "closing";
  opponent_argument_text?: string | null;
  turn_data: MultimodalTurnRequest;
  existing_multimodal_result?: MultimodalTurnResult | null;
}

export interface IntegratedDebateEvaluationResult {
  multimodal: MultimodalTurnResult;
  argument_text_used: string;
  content_evaluation?: ArgumentEvaluationResult | null;
  evaluation_error?: string | null;
}




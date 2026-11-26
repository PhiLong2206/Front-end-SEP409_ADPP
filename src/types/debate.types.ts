import type { DeliveryAnalytics } from "./ai.types";

export type DebateStage = "Opening" | "Rebuttal" | "Closing";
export type DebateSide = "Affirmative" | "Negative"; // For / Against
export type DebateMode = "AI_Opponent" | "Two_Learners" | "Two_Debaters";
export type DebateRoomMode = "ai" | "1v1" | "2v2" | "competition";
export type DebateRoleInRoom = "Debater" | "Judge" | "Spectator";
export type AIDifficulty = "Easy" | "Medium" | "Hard";

export interface DebateTeamMember {
  speakerName: string;
  isCurrentUser?: boolean;
  roleTag?: string;
  hasSpokenInCurrentRound?: boolean;
  isSpeakingNow?: boolean;
  isAI?: boolean;
}

export interface DebateTeamGroup {
  teamName: string;
  members: DebateTeamMember[];
}

export enum SystemDebateSide {
  PRO = 1,
  CON = 2,
  Affirmative = 1,
  Negative = 2,
}

export enum BackendDebateType {
  AiPractice = 1,
  P2pMatch = 2,
  Direct1v1 = 3,
}

export enum BackendDebateStage {
  Opening = 1,
  Rebuttal = 2,
  Closing = 3,
}

export enum BackendSessionStatus {
  Waiting = 1,
  InProgress = 2,
  Completed = 3,
  Cancelled = 4,
}

export enum BackendTurnStatus {
  Pending = 1,
  Active = 2,
  Completed = 3,
  Skipped = 4,
}

export enum BackendChallengeStatus {
  Pending = 1,
  Accepted = 2,
  Rejected = 3,
  Cancelled = 4,
  Expired = 5,
}

export interface ArgumentScore {
  logic: number; // 0-10
  evidence: number; // 0-10
  relevance: number; // 0-10
  structure: number; // 0-10
  persuasiveness: number; // 0-10
  overallScore: number; // 0-10
  explanation: string;
}

export interface DebateTurn {
  id: string;
  sessionId: string;
  speakerRole: "Learner" | "AI" | "OpponentLearner" | "Debater" | "OpponentDebater";
  speakerId?: string;
  stage: DebateStage;
  roundNumber: number;
  content: string;
  audioUrl?: string;
  durationSeconds?: number;
  score?: ArgumentScore;
  rebuttalSuggestions?: string[];
  createdAt: string;
}

export interface DebateSession {
  id: string;
  topicId: string;
  topicTitle: string;
  motion: string;
  learnerId: string;
  debaterId?: string;
  learnerName: string;
  debaterName?: string;
  mode: DebateMode;
  userSide: DebateSide;
  aiDifficulty: AIDifficulty;
  currentStage: DebateStage;
  currentRound: number;
  isCompleted: boolean;
  finalScore?: number;
  finalFeedback?: string;
  turns: DebateTurn[];
  startedAt: string;
  completedAt?: string;
}

export interface CreateDebateSessionDto {
  topicId: string;
  mode: DebateMode;
  userSide: DebateSide;
  aiDifficulty: AIDifficulty;
}

export interface SubmitTurnDto {
  stage: DebateStage;
  roundNumber: number;
  content: string;
  durationSeconds?: number;
}

// ── Backend DTOs ──────────────────────────────────────────
export interface CreateAiPracticeSessionRequest {
  topicId?: number;
  title: string;
  topic: string;
  /** Category code (see constants/topicCategories), required by the backend when there is no topicId */
  category?: string;
  userSide: SystemDebateSide | number;
  isAI?: boolean;
  difficulty?: string;
  enableRag?: boolean;
  turnTimeLimitSeconds?: number;
}

export interface CreateP2pSessionRequest {
  topicId?: number;
  title: string;
  topic: string;
  /** Category code (see constants/topicCategories), required by the backend when there is no topicId */
  category?: string;
  userSide: SystemDebateSide | number;
  isAI?: boolean;
  turnTimeLimitSeconds?: number;
}

export interface JoinSessionRequest {
  preferredSide?: SystemDebateSide | number;
}

export interface Create2v2SessionRequest {
  topicId?: number;
  title: string;
  topic: string;
  userSide: SystemDebateSide | number;
  isAI?: boolean;
  turnTimeLimitSeconds?: number;
}

export interface Join2v2SessionRequest {
  preferredSide?: SystemDebateSide | number;
}

export interface SendSwapSideRequest {
  targetUserId: number;
}

export interface RespondSwapSideRequest {
  requesterUserId: number;
  accept: boolean;
}

export interface SideSwapRequestResponse {
  sessionId: number;
  requesterUserId: number;
  requesterName?: string;
  requesterSide: string;
  targetUserId: number;
  targetName?: string;
  targetSide: string;
  createdAt: string;
  expiresInSeconds: number;
}

export interface SubmitArgumentRequest {
  content: string;
  durationSeconds?: number;
  deliveryAnalytics?: DeliveryAnalytics;
}

/** POST /api/debate/{sessionId}/ai-arguments — records the AI opponent's turn. */
export interface SubmitAiArgumentRequest {
  content: string;
  /** 0-based: 0 opening PRO, 1 opening CON, 2 rebuttal PRO, 3 rebuttal CON, 4 closing CON, 5 closing PRO. */
  turnIndex: number;
}

export interface SubmitAiArgumentResponse {
  turnIndex: number;
  /** true when this turn had already been recorded (idempotent retry). */
  alreadyRecorded: boolean;
  argument: ArgumentDetailDto;
  session: DebateSessionResponse;
}

export interface ParticipantDto {
  participantId: number;
  userId?: number;
  speakerName: string;
  isAI: boolean;
  side: SystemDebateSide | number;
  joinedAt: string;
}

export interface TurnDto {
  turnId: number;
  stage: BackendDebateStage | number;
  side: SystemDebateSide | number;
  turnOrder: number;
  /** 0-based index into the 1v1 turn order (0..5); absent for 2v2. This is the `turnIndex` of /ai-arguments. */
  turnIndex?: number | null;
  timeLimitSeconds: number;
  status: BackendTurnStatus | number;
  /** While the session is preparing it is the preparation end, i.e. the start of Round 1. */
  startedAt?: string;
  /** "Mở đầu" | "Phản biện" | "Kết luận" */
  roundLabel?: string;
}

export interface DebateSessionResponse {
  sessionId: number;
  roomCode?: string | null;
  title: string;
  topic: string;
  /** Canonical debatable resolution (motion) shared across UI, guides, AI Opponent, AI Hint, and Evaluator. */
  motion?: string;
  /** Fact-base topic for the evaluator's evidence check (from Topic.Category); null when the category has none. */
  evidenceTopic?: string | null;
  debateType: BackendDebateType | number;
  /** The difficulty of the TOPIC: the Backend fills it from Topic.Difficulty. */
  difficulty?: string;
  /** The difficulty chosen for this session. The Backend does not send it yet. */
  sessionDifficulty?: string;
  currentStage: BackendDebateStage | number;
  currentTurnSide: SystemDebateSide | number;
  status: BackendSessionStatus | number;
  createdByUserId: number;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  participants: ParticipantDto[];
  /** The task of each side of the topic (never null from the Backend). */
  proGuide?: string;
  conGuide?: string;
  /** Seats of the room: 1v1 and AI practice 2, 2v2 4. Older Backends do not send it. */
  maxParticipants?: number;
  /** True for a team (2v2) debate. Older Backends do not send it: the room then guesses from the title. */
  isTeamDebate?: boolean;
  currentTurn?: TurnDto;
  /** Preparation before Round 1 (every mode): 60 s. */
  preparationSeconds?: number;
  /** UTC ISO: the start of Round 1; null once there is no preparation. */
  preparationEndsAt?: string | null;
  isPreparing?: boolean;
  /** Only true for an AI practice session that is still preparing. */
  canSkipPreparation?: boolean;
  totalRounds?: number;
  /** UTC ISO: when the server built this response (to read the countdown on the server clock). */
  serverTime?: string;
  currentUserBalance?: number | null;
}

/** SignalR "RoundStarted": a new round began (Round 2 or 3, or preparation skipped). Not sent when the 60 s run out. */
export interface RoundStartedEvent {
  sessionId: number;
  roundNumber: number;
  totalRounds: number;
  roundLabel: string;
  startedAt: string;
  currentTurnSide: "PRO" | "CON";
  timestamp?: string;
}

export interface ArgumentDetailDto {
  argumentId: number;
  turnOrder: number;
  stage: BackendDebateStage | number;
  side: SystemDebateSide | number;
  /** Author of the speech; null for the AI. */
  userId?: number | null;
  speakerName: string;
  isAI: boolean;
  content: string;
  wordCount?: number | null;
  durationSeconds?: number | null;
  deliveryAnalytics?: DeliveryAnalytics | null;
  submittedAt: string;
}

export interface DebateTranscriptResponse {
  sessionId: number;
  title: string;
  topic: string;
  status: BackendSessionStatus | number;
  arguments: ArgumentDetailDto[];
}

export interface DebateHistoryItemDto {
  sessionId: number;
  roomCode?: string | null;
  title: string;
  topic: string;
  debateType: BackendDebateType | number;
  status: BackendSessionStatus | number;
  userSide: SystemDebateSide | number;
  createdAt: string;
  endedAt?: string;
  maxParticipants?: number;
  participantCount?: number;
  isTeamDebate?: boolean;
}

// ── Debate Challenge DTOs ──────────────────────────────────
export interface CreateChallengeRequest {
  challengedUserId: number;
  topicId?: number;
  topic: string;
  /** Category code (see constants/topicCategories), required by the backend when there is no topicId */
  category?: string;
  challengerPreferredSide: SystemDebateSide | number;
  turnTimeLimitSeconds?: number;
  expiresAt?: string;
}

export interface ChallengeUserSummaryDto {
  userId: number;
  fullName: string;
  email: string;
}

export interface ChallengeResponse {
  challengeId: number;
  challenger: ChallengeUserSummaryDto;
  challenged: ChallengeUserSummaryDto;
  topic: string;
  challengerPreferredSide: SystemDebateSide | number;
  turnTimeLimitSeconds: number;
  status: BackendChallengeStatus | number;
  debateSessionId?: number;
  createdAt: string;
  respondedAt?: string;
  expiresAt?: string;
}

// ── AI Evaluation DTOs ─────────────────────────────────────
export interface DebateEvaluationCriteriaScore {
  criteriaId?: number;
  name?: string;
  score: number;
  weight?: number;
  feedback?: string;
}

// GET /api/debate/{sessionId}/evaluation — the official result (SystemService stores it as an AIJudgement).
export interface EvaluationCitationDto {
  factId: string;
  content: string;
  citation?: string | null;
  stance?: "supports" | "contradicts" | null;
}

export interface EvaluationClaimDto {
  claim: string;
  label: "SUPPORTED" | "CONTRADICTED" | "NOT_FOUND" | "CONFLICTING";
  reason: string;
  citations: EvaluationCitationDto[];
}

/** One learner turn's evidence check. The Backend never sends the evaluator's technical error. */
export interface EvaluationTurnEvidenceCheckDto {
  turnIndex: number;
  excerpt: string;
  evidenceCheck: {
    status: "checked" | "no_claims" | "unavailable" | "no_fact_base";
    claims: EvaluationClaimDto[];
    counts: Record<string, number>;
    evidenceScoreBefore?: number | null;
    evidenceScoreAfter?: number | null;
    ruleApplied?: string;
    version?: string | null;
  };
}

export interface RoundEvaluationDetailDto {
  /** 1 = opening, 2 = rebuttal, 3 = closing. */
  roundNumber: number;
  stage: string;
  /** 0-10 */
  roundScore: number;
  consistencyNote: string;
  /** Each 0-5. */
  criteria: Array<{ name: string; score: number; reasoning: string }>;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  /** null: judgement stored before the evidence check existed. */
  evidenceChecks?: EvaluationTurnEvidenceCheckDto[] | null;
  evidenceScoreBefore?: number | null;
  evidenceScoreAfter?: number | null;
  evidenceRuleApplied?: string | null;
}

export interface ParticipantEvaluationDto {
  side: string;
  speakerName: string;
  /** 0-10 */
  overallScore: number;
  stageBreakdown: Record<string, number>;
  /** Stages this side did not speak in (counted 0). Absent in judgements stored before it existed. */
  skippedStages?: string[];
  progressTrend: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  roundEvaluations: RoundEvaluationDetailDto[];
}

export interface DebateEvaluationResponse {
  judgementId: number;
  sessionId: number;
  suggestedWinnerSide: string;
  overallScorePro?: number | null;
  overallScoreCon?: number | null;
  overallScore?: number | null;
  summary?: string | null;
  overallFeedback?: string | null;
  evaluatedAt: string;
  /** null when that side never spoke (nothing was graded). */
  proEvaluation?: ParticipantEvaluationDto | null;
  conEvaluation?: ParticipantEvaluationDto | null;
}

export interface DebateAiEvaluationResponse {
  sessionId: number;
  summary?: string;
  winnerSide?: string;
  proScore?: number;
  conScore?: number;
  scores?: DebateEvaluationCriteriaScore[];
  evaluatedAt?: string;
  [key: string]: unknown;
}

export interface SingleArgumentEvaluationResponse {
  argumentId: number;
  sessionId: number;
  stage: string;
  side: string;
  speakerName: string;
  overallScore: number;
  overallReasoning: string;
  criteria: Array<{ name: string; score: number; reasoning: string }>;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  deliveryAnalytics?: DeliveryAnalytics | null;
}


/** One STUN/TURN server of GET /debate/{id}/ice-servers (the shape RTCPeerConnection takes). */
export interface IceServerDto {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface IceServersResponse {
  iceServers: IceServerDto[];
  ttlSeconds: number;
}

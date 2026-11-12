import axiosClient from "./axiosClient";
import {
  ApiResponse,
  DebateSession,
  DebateTurn,
  CreateDebateSessionDto,
  SubmitTurnDto,
  ArgumentScore,
  CreateAiPracticeSessionRequest,
  CreateP2pSessionRequest,
  JoinSessionRequest,
  Create2v2SessionRequest,
  Join2v2SessionRequest,
  SendSwapSideRequest,
  RespondSwapSideRequest,
  SideSwapRequestResponse,
  SubmitArgumentRequest,
  SubmitAiArgumentRequest,
  SubmitAiArgumentResponse,
  DebateSessionResponse,
  DebateTranscriptResponse,
  DebateHistoryItemDto,
  CreateChallengeRequest,
  ChallengeResponse,
  DebateAiEvaluationResponse,
  DebateEvaluationResponse,
  SingleArgumentEvaluationResponse,
} from "../types";

/**
 * Waiting for the official result. Above the Backend's own limit (each evaluator call 120 s, gateway 180 s),
 * so a slow evaluation ends with the Backend's error rather than a client timeout.
 */
export const EVALUATION_TIMEOUT_MS = 200_000;

const debateApi = {
  // ── Debate Practice & P2P Endpoints (SystemService) ────────
  /**
   * POST /api/Debate/ai-practice [Authorized]
   * Starts a new AI debate practice session.
   */
  createAiPracticeSession: (
    data: CreateAiPracticeSessionRequest
  ): Promise<ApiResponse<DebateSessionResponse>> =>
    axiosClient.post("/debate/ai-practice", data),

  /**
   * POST /api/Debate/p2p [Authorized]
   * Initiates a peer-to-peer debate match.
   */
  createP2pSession: (
    data: CreateP2pSessionRequest
  ): Promise<ApiResponse<DebateSessionResponse>> =>
    axiosClient.post("/debate/p2p", data),

  /**
   * POST /api/Debate/{sessionId}/join [Authorized]
   * Joins an existing P2P debate session.
   */
  joinP2pSession: (
    sessionId: number | string,
    data: JoinSessionRequest = {}
  ): Promise<ApiResponse<DebateSessionResponse>> =>
    axiosClient.post(`/debate/${sessionId}/join`, data),

  /**
   * POST /api/Debate/2v2 [Authorized]
   * Initiates a 2v2 team debate match.
   */
  create2v2Session: (
    data: Create2v2SessionRequest
  ): Promise<ApiResponse<DebateSessionResponse>> =>
    axiosClient.post("/debate/2v2", data),

  /**
   * POST /api/Debate/{sessionId}/join-2v2 [Authorized]
   * Joins an existing 2v2 debate session.
   */
  join2v2Session: (
    sessionId: number | string,
    data: Join2v2SessionRequest = {}
  ): Promise<ApiResponse<DebateSessionResponse>> =>
    axiosClient.post(`/debate/${sessionId}/join-2v2`, data),

  /**
   * POST /api/Debate/{sessionId}/switch-side [Authorized]
   * Switches user to the opposite side if slot is available (< 2).
   */
  switchSide: (
    sessionId: number | string
  ): Promise<ApiResponse<DebateSessionResponse>> =>
    axiosClient.post(`/debate/${sessionId}/switch-side`),

  /**
   * POST /api/Debate/{sessionId}/swap-request [Authorized]
   * Sends a side swap request to an opponent debater (TTL: 60s).
   */
  sendSwapRequest: (
    sessionId: number | string,
    data: SendSwapSideRequest
  ): Promise<ApiResponse<boolean>> =>
    axiosClient.post(`/debate/${sessionId}/swap-request`, data),

  /**
   * GET /api/Debate/{sessionId}/swap-requests [Authorized]
   * Retrieves pending side swap requests targeting current user.
   */
  getPendingSwapRequests: (
    sessionId: number | string
  ): Promise<ApiResponse<SideSwapRequestResponse[]>> =>
    axiosClient.get(`/debate/${sessionId}/swap-requests`),

  /**
   * POST /api/Debate/{sessionId}/swap-response [Authorized]
   * Accepts or rejects a pending side swap request.
   */
  respondSwapRequest: (
    sessionId: number | string,
    data: RespondSwapSideRequest
  ): Promise<ApiResponse<DebateSessionResponse>> =>
    axiosClient.post(`/debate/${sessionId}/swap-response`, data),

  /**
   * POST /api/Debate/{sessionId}/start [Authorized]
   * Starts the debate session (Host only).
   */
  startDebateSession: (
    sessionId: number | string
  ): Promise<ApiResponse<DebateSessionResponse>> =>
    axiosClient.post(`/debate/${sessionId}/start`),

  /**
   * POST /api/Debate/{sessionId}/leave [Authorized]
   * Cancels the session for every participant. The timeout keeps a slow server from trapping the user in the room.
   */
  leaveSession: (
    sessionId: number | string
  ): Promise<ApiResponse<DebateSessionResponse>> =>
    axiosClient.post(`/debate/${sessionId}/leave`, undefined, { timeout: 5000 }),

  /**
   * GET /api/Debate/{sessionId} [Authorized]
   * Retrieves debate session details, participants and turns.
   */
  getSessionDetails: (
    sessionId: number | string
  ): Promise<ApiResponse<DebateSessionResponse>> =>
    axiosClient.get(`/debate/${sessionId}`),

  // Alias for getSessionDetails
  getSessionById: (
    id: number | string
  ): Promise<ApiResponse<DebateSessionResponse>> =>
    axiosClient.get(`/debate/${id}`),

  /**
   * POST /api/Debate/{sessionId}/arguments [Authorized]
   * Submits an argument for the current user's turn (with optional durationSeconds & deliveryAnalytics).
   */
  submitArgument: (
    sessionId: number | string,
    data: SubmitArgumentRequest
  ): Promise<ApiResponse<DebateSessionResponse>> =>
    axiosClient.post(`/debate/${sessionId}/arguments`, data),

  /**
   * POST /api/Debate/{sessionId}/arguments/{argumentId}/evaluate [Authorized]
   * Evaluates a single argument in a session (including stored DeliveryAnalytics).
   */
  evaluateSingleArgument: (
    sessionId: number | string,
    argumentId: number | string
  ): Promise<ApiResponse<SingleArgumentEvaluationResponse>> =>
    axiosClient.post(`/debate/${sessionId}/arguments/${argumentId}/evaluate`, undefined, {
      timeout: EVALUATION_TIMEOUT_MS,
    }),

  /**
   * POST /api/Debate/{sessionId}/evaluate [Authorized]
   * Triggers or retries AI evaluation for a completed debate session.
   */
  evaluateDebate: (
    sessionId: number | string
  ): Promise<ApiResponse<DebateAiEvaluationResponse | object>> =>
    axiosClient.post(`/debate/${sessionId}/evaluate`),

  // Alias for evaluateDebate
  triggerAiEvaluation: (
    sessionId: number | string
  ): Promise<ApiResponse<DebateAiEvaluationResponse | object>> =>
    axiosClient.post(`/debate/${sessionId}/evaluate`),

  /**
   * GET /api/Debate/{sessionId}/evaluation [Authorized]
   * The official result of a debate (stored AIJudgement). For a completed debate without one yet, the Backend
   * evaluates it first (or waits for the evaluation already running), so the call can take a while:
   * EVALUATION_TIMEOUT_MS. Fails (404) when the session is not completed or has no speech to grade.
   */
  getEvaluation: (
    sessionId: number | string
  ): Promise<ApiResponse<DebateEvaluationResponse>> =>
    axiosClient.get(`/debate/${sessionId}/evaluation`, { timeout: EVALUATION_TIMEOUT_MS }),

  // Alias for getEvaluation
  getAiEvaluation: (
    sessionId: number | string
  ): Promise<ApiResponse<DebateEvaluationResponse>> =>
    axiosClient.get(`/debate/${sessionId}/evaluation`, { timeout: EVALUATION_TIMEOUT_MS }),

  /**
   * POST /api/Debate/{sessionId}/ai-arguments [Authorized]
   * Records the AI opponent's argument for `turnIndex` (idempotent: a repeated call returns alreadyRecorded).
   * Errors carry `errors.code`: INVALID_REQUEST, NOT_AI_SESSION, NOT_AI_TURN, NOT_PARTICIPANT,
   * SESSION_NOT_FOUND, TURN_OUT_OF_ORDER, SESSION_NOT_IN_PROGRESS, CONCURRENT_SUBMISSION.
   */
  submitAiArgument: (
    sessionId: number | string,
    data: SubmitAiArgumentRequest
  ): Promise<ApiResponse<SubmitAiArgumentResponse>> =>
    axiosClient.post(`/debate/${sessionId}/ai-arguments`, data),

  /**
   * GET /api/Debate/{sessionId}/transcript [Authorized]
   * Retrieves the full transcript of arguments for a debate session.
   */
  getTranscript: (
    sessionId: number | string
  ): Promise<ApiResponse<DebateTranscriptResponse>> =>
    axiosClient.get(`/debate/${sessionId}/transcript`),

  /**
   * GET /api/Debate/my-history [Authorized]
   * Retrieves the current user's debate history.
   */
  getUserHistory: (): Promise<ApiResponse<DebateHistoryItemDto[]>> =>
    axiosClient.get("/debate/my-history"),

  getMyHistory: (): Promise<ApiResponse<DebateHistoryItemDto[]>> =>
    axiosClient.get("/debate/my-history"),

  // ── 1v1 Debate Challenges (SystemService) ───────────────────
  /**
   * POST /api/debate/challenges [Authorized]
   * Sends a 1v1 challenge to another user.
   */
  createChallenge: (
    data: CreateChallengeRequest
  ): Promise<ApiResponse<ChallengeResponse>> =>
    axiosClient.post("/debate/challenges", data),

  /**
   * GET /api/debate/challenges/received [Authorized]
   * Retrieves incoming debate challenges received by the current user.
   */
  getReceivedChallenges: (): Promise<ApiResponse<ChallengeResponse[]>> =>
    axiosClient.get("/debate/challenges/received"),

  /**
   * GET /api/debate/challenges/sent [Authorized]
   * Retrieves outgoing debate challenges sent by the current user.
   */
  getSentChallenges: (): Promise<ApiResponse<ChallengeResponse[]>> =>
    axiosClient.get("/debate/challenges/sent"),

  /**
   * GET /api/debate/challenges/{challengeId} [Authorized]
   * Retrieves details of a specific debate challenge.
   */
  getChallengeById: (
    challengeId: number | string
  ): Promise<ApiResponse<ChallengeResponse>> =>
    axiosClient.get(`/debate/challenges/${challengeId}`),

  /**
   * POST /api/debate/challenges/{challengeId}/accept [Authorized]
   * Accepts an incoming debate challenge, creating a debate session.
   */
  acceptChallenge: (
    challengeId: number | string
  ): Promise<ApiResponse<ChallengeResponse>> =>
    axiosClient.post(`/debate/challenges/${challengeId}/accept`),

  /**
   * POST /api/debate/challenges/{challengeId}/reject [Authorized]
   * Rejects an incoming debate challenge.
   */
  rejectChallenge: (
    challengeId: number | string
  ): Promise<ApiResponse<ChallengeResponse>> =>
    axiosClient.post(`/debate/challenges/${challengeId}/reject`),

  /**
   * POST /api/debate/challenges/{challengeId}/cancel [Authorized]
   * Cancels a pending challenge created by the current user.
   */
  cancelChallenge: (
    challengeId: number | string
  ): Promise<ApiResponse<ChallengeResponse>> =>
    axiosClient.post(`/debate/challenges/${challengeId}/cancel`),

  // ── Backward Compatibility Helpers ──────────────────────────
  createSession: (data: CreateDebateSessionDto): Promise<ApiResponse<DebateSession>> =>
    axiosClient.post("/debate/ai-practice", data),

  endSession: (id: string): Promise<ApiResponse<DebateSession>> =>
    axiosClient.post(`/debate/${id}/end`),

  submitTurn: (sessionId: string, turnData: SubmitTurnDto): Promise<ApiResponse<DebateTurn>> =>
    axiosClient.post(`/debate/${sessionId}/arguments`, { content: turnData.content }),

  getSessionFeedback: (sessionId: string): Promise<ApiResponse<{ score: ArgumentScore; summary: string }>> =>
    axiosClient.get(`/debate/${sessionId}/feedback`),

  getProgressStats: (): Promise<ApiResponse<{ totalDebates: number; averageScore: number; scoreTrends: unknown[] }>> =>
    axiosClient.get("/debate/progress"),
};

export default debateApi;


import axios from "axios";
import {
  CreateOpponentSessionRequest,
  CreateOpponentSessionResponse,
  SessionResponse,
  CreateTurnRequest,
  TurnResponse,
  CaseFileResponse,
  ArgumentEvaluationPayload,
  ArgumentEvaluationResult,
  RoundEvaluationRequest,
  RoundEvaluationResult,
  SessionEvaluationRequest,
  SessionEvaluationResult,
  AIHealthResponse,
  ArgumentCoachingRequest,
  RoundCoachingRequest,
  CoachingResult,
  MultimodalHealthResponse,
  FrameAnalysisRequest,
  FrameAnalysisResult,
  MultimodalTurnRequest,
  MultimodalTurnResult,
  IntegratedDebateEvaluationRequest,
  IntegratedDebateEvaluationResult,
} from "../types";

// Dedicated client for AI Opponent Generation Service (port 8002)
const AI_OPPONENT_BASE_URL =
  import.meta.env.VITE_AI_OPPONENT_URL ||
  import.meta.env.VITE_AI_API_BASE_URL ||
  "/opponent";

const aiOpponentClient = axios.create({
  baseURL: AI_OPPONENT_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

aiOpponentClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.data) {
      const data = error.response.data;
      // Keep the HTTP status: callers distinguish a temporary 409 (still planning) from real failures
      return Promise.reject(
        typeof data === "object" ? { ...data, status: error.response.status } : data
      );
    }
    return Promise.reject(error);
  }
);

// Dedicated client for AI Evaluator Service (port 8000)
const AI_EVALUATOR_BASE_URL =
  import.meta.env.VITE_AI_EVALUATOR_URL ||
  "/evaluate";

const aiEvaluatorClient = axios.create({
  baseURL: AI_EVALUATOR_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

aiEvaluatorClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.data) {
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
);

// Dedicated client for AI Coaching endpoints on Evaluator Service (port 8000: /coaching/*)
const aiCoachingClient = axios.create({
  baseURL: "/coaching",
  headers: {
    "Content-Type": "application/json",
  },
});

aiCoachingClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.data) {
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
);

// Dedicated client for AI Multimodal Debate Service (port 8003: /multimodal/*)
const AI_MULTIMODAL_BASE_URL =
  import.meta.env.VITE_AI_MULTIMODAL_URL ||
  "/multimodal";

const aiMultimodalClient = axios.create({
  baseURL: AI_MULTIMODAL_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

aiMultimodalClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.data) {
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
);

const aiApi = {
  // ── AI Opponent Generation Service (port 8002: /opponent/*) ──
  checkOpponentHealth: async (): Promise<AIHealthResponse> => {
    try {
      const res = await axios.get("/ai-health");
      return res.data;
    } catch {
      const res = await axios.get("http://localhost:8002/health");
      return res.data;
    }
  },

  // 1. POST /opponent/sessions - Create session & run synchronous case planning
  createOpponentSession: (
    data: CreateOpponentSessionRequest
  ): Promise<CreateOpponentSessionResponse> =>
    aiOpponentClient.post("/sessions", data),

  // 2. GET /opponent/sessions/{external_session_id} - Inspect session & case file
  getOpponentSession: (externalSessionId: string): Promise<SessionResponse> =>
    aiOpponentClient.get(`/sessions/${externalSessionId}`),

  // 3. GET /opponent/sessions/{external_session_id}/case-plan - Retrieve generated case plan
  getOpponentCasePlan: (externalSessionId: string): Promise<CaseFileResponse> =>
    aiOpponentClient.get(`/sessions/${externalSessionId}/case-plan`),

  // 4. POST /opponent/sessions/{external_session_id}/turns - Generate AI speech turn
  generateOpponentTurn: (
    externalSessionId: string,
    data: CreateTurnRequest
  ): Promise<TurnResponse> =>
    aiOpponentClient.post(`/sessions/${externalSessionId}/turns`, data),

  // ── AI Evaluator Service (port 8000: /evaluate/*) ────────────
  checkEvaluatorHealth: async (): Promise<AIHealthResponse> => {
    try {
      const res = await axios.get("/evaluator-health");
      return res.data;
    } catch {
      const res = await axios.get("http://localhost:8000/health");
      return res.data;
    }
  },

  // 1. POST /evaluate - Evaluate 1 argument turn against rubric
  evaluateSpeechArgument: (
    data: ArgumentEvaluationPayload
  ): Promise<ArgumentEvaluationResult> =>
    aiEvaluatorClient.post("", data),

  // 2. POST /evaluate/round - Evaluate an entire round with multiple turns & consistency
  evaluateDebateRound: (
    data: RoundEvaluationRequest
  ): Promise<RoundEvaluationResult> =>
    aiEvaluatorClient.post("/round", data),

  // 3. POST /evaluate/session - Synthesize final report from scored rounds
  evaluateDebateSession: (
    data: SessionEvaluationRequest
  ): Promise<SessionEvaluationResult> =>
    aiEvaluatorClient.post("/session", data),

  // 4. POST /coaching/argument - Generate coaching drills & rewrite for a single argument
  coachArgument: (
    data: ArgumentCoachingRequest
  ): Promise<CoachingResult> =>
    aiCoachingClient.post("/argument", data),

  // 5. POST /coaching/round - Generate coaching summary & drills for a full round
  coachRound: (
    data: RoundCoachingRequest
  ): Promise<CoachingResult> =>
    aiCoachingClient.post("/round", data),

  // ── AI Multimodal Debate Service (port 8003: /multimodal/*) ──
  checkMultimodalHealth: async (): Promise<MultimodalHealthResponse> => {
    try {
      const res = await axios.get("/multimodal-health");
      return res.data;
    } catch {
      const res = await axios.get("http://localhost:8003/health");
      return res.data;
    }
  },

  // 1. POST /multimodal/analyze-frame - Realtime webcam frame emotion & face detection (DeepFace YuNet)
  analyzeFrame: (
    data: FrameAnalysisRequest
  ): Promise<FrameAnalysisResult> =>
    aiMultimodalClient.post("/analyze-frame", data),

  // 2. POST /multimodal/analyze-turn - End-of-turn STT (Faster-Whisper) + facial metrics + chart PNG
  analyzeTurn: (
    data: MultimodalTurnRequest
  ): Promise<MultimodalTurnResult> =>
    aiMultimodalClient.post("/analyze-turn", data),

  // 3. POST /multimodal/evaluate-speech - Integrated multimodal + content rubric evaluation
  evaluateSpeechMultimodal: (
    data: IntegratedDebateEvaluationRequest
  ): Promise<IntegratedDebateEvaluationResult> =>
    aiMultimodalClient.post("/evaluate-speech", data),

  // 4. POST /multimodal/demo-sample-audio - Test sample audio & emotion timeline
  runDemoSampleAudio: (): Promise<MultimodalTurnResult> =>
    aiMultimodalClient.post("/demo-sample-audio"),
};

export default aiApi;

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  Shield,
  Flame,
  Swords,
  RefreshCw,
  Copy,
  Check,
  X,
  Loader2,
  ArrowRight,
} from "lucide-react";
import DebateHeader from "../../../components/debate/DebateHeader";
import DebateChat from "../../../components/debate/DebateChat";
import DebateComposer from "../../../components/debate/DebateComposer";
import DebateSidebar from "../../../components/debate/DebateSidebar";
import { CoachingAdvice } from "../../../components/debate/AICoachingPanel";
import LeaveDebateConfirmModal from "../../../components/debate/LeaveDebateConfirmModal";
import GradingOverlay from "../../../components/debate/GradingOverlay";
import { aiApi, debateApi } from "../../../api";
import { useAuth } from "../../../hooks/useAuth";
import { getSpeakerRelation, isSameUserId, UnattributedSpeechError } from "../../../utils/debateSpeaker";
import {
  useDebateNavigationGuard,
  saveActiveDebateSession,
  clearActiveDebateSession,
} from "../../../hooks/useDebateNavigationGuard";
import {
  COMPLETED_STORAGE_PREFIX,
  CURRENT_ROUND_PREFIX,
  DEADLINE_STORAGE_PREFIX,
  DIFFICULTY_STORAGE_PREFIX,
  EXPIRED_STORAGE_PREFIX,
  MESSAGES_STORAGE_PREFIX,
  TIMED_OUT_ROUNDS_PREFIX,
  clearDebateRoomStorage,
  isDebateLeaveEnabled,
  leaveDebateRoom,
} from "../../../utils/debateLeave";
import {
  CaseFileResponse,
  ArgumentEvaluationResult,
  BackendDebateSide,
  BackendDifficulty,
  DebateRoundType,
  RoundEvaluationResult,
  ArgumentTurn,
  TurnSpeaker,
  SessionEvaluationResult,
  DebateSessionResponse,
  SideSwapRequestResponse,
  DebateRoomMode,
  DebateRoleInRoom,
  DebateTeamGroup,
} from "../../../types";
import {
  buildDebateResult,
  buildNoSpeechDebateResult,
  getErrorMessage,
  toEvidenceTopic,
} from "../../../utils/debateScoring";
import { recordAiArgument } from "../../../utils/recordAiArgument";
import { getDebateErrorMessage } from "../../../utils/debateErrors";
import {
  getAiTurnsAfterLearnerTurn,
  getAiTurnsFromBackendState,
  getTurnEntry,
  getTurnIndex,
  readBackendTurnState,
  toOpponentTurnIndex,
} from "../../../utils/turnOrder";
import {
  buildBackendOpponentSessionId,
  getLocalOpponentSessionId,
  getOpponentErrorMessage,
  isLearnerSpeechMismatch,
  isPlanningConflict,
  isSessionDataConflict,
  normalizeMotion,
  retryWhilePlanning,
  waitUntilOpponentReady,
  parseDifficulty,
} from "../../../utils/opponentReadiness";

/** One AI turn of a chain that follows a learner turn (see getAiTurnsAfterLearnerTurn). */
interface AiTurnContext {
  /** Round of the learner turn that triggered the chain; the debate advances from it when the chain ends. */
  learnerRound: number;
  /** Backend turnIndex (0-based) the AI speaks now. */
  aiTurnIndex: number;
  /** Fallback only (no Backend session): AI turns that follow back-to-back. Otherwise the Backend decides. */
  remainingAiTurns: number[];
  /** Learner speech sent with the FIRST AI turn of the chain only (`turn_index` is the opponent service's, 1-based). */
  learnerSpeech?: { turn_index: number; round_type: DebateRoundType; text: string };
}

/** Everything needed to (re)run the evaluation of one submitted turn. */
interface TurnEvaluationContext {
  /** The learner message being evaluated (shows the small "grading this turn" indicator). */
  messageId?: string;
  stage: DebateRoundType;
  argumentText: string;
  opponentText: string | null;
}

const TURN_EVALUATION_ERROR = "Chưa chấm được lượt phát biểu này. Vui lòng thử lại.";
const FINISH_EVALUATION_ERROR = "Chưa chấm được kết quả tranh biện. Vui lòng thử lại.";
const GRADING_BLOCKED_ERROR =
  "Không thể chấm điểm phiên này vì không xác định được người nói của một số lượt. Thử lại sẽ không khắc phục được, vui lòng liên hệ quản trị viên.";
const OPPONENT_SPEECH_MISMATCH_ERROR =
  "Đối thủ AI đã tạo lượt này từ một bài nói khác nên phiên này không thể tiếp tục. Thử lại sẽ không khắc phục được, vui lòng quay lại và tạo phiên tranh biện mới.";
const OPPONENT_SESSION_ID_ERROR =
  "Không thể khởi tạo Đối thủ AI vì máy chủ không trả về thời điểm tạo phiên tranh biện. Vui lòng liên hệ quản trị viên.";
const ROUNDS_PER_SESSION = 3;
const TRANSCRIPT_CHECK_ATTEMPTS = 3;
const TRANSCRIPT_CHECK_DELAY_MS = 1000;

/** The Backend has closed the session and the transcript holds every turn of every round. */
const isTranscriptComplete = (session: DebateSessionResponse, turnCount: number): boolean =>
  (session.status === 3 || String(session.status) === "Completed") &&
  !session.currentTurn &&
  turnCount >= session.participants.length * ROUNDS_PER_SESSION;

export interface DebateRoomMessage {
  id: string;
  speaker: "Debater" | "AI";
  speakerName: string;
  side: "Ủng hộ" | "Phản đối";
  stage: "Mở đầu" | "Phản biện" | "Kết luận";
  roundNumber: number;
  timestamp: string;
  content: string;
  isCurrentUser?: boolean;
  /** The transcript's userId, or the account id on a speech this client just submitted. */
  speakerUserId?: string | number;
}

const ROUND_1_DEFAULT_SECONDS = 135; // 02:15
const SUBSEQUENT_ROUND_SECONDS = 120; // 02:00

const readStoredNumber = (key: string): number | null => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const writeStoredValue = (key: string, value: string) => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage quota errors
  }
};

const removeStoredValue = (key: string) => {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Ignore storage errors
  }
};

const DebateRoom: React.FC = () => {
  const { sessionId = "demo-session" } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const roleParam = searchParams.get("role") || "PRO";
  const normalizedRole = roleParam.trim().toUpperCase();
  const motionParam = searchParams.get("motion") || "Mạng xã hội có gây hại nhiều hơn lợi ích?";
  const [motionText, setMotionText] = useState(motionParam);

  // URL values are only a fallback (local sessions, or before the Backend session has loaded):
  // re-entering a room without the query string (e.g. from the result page) must not change them.
  const urlSide: BackendDebateSide =
    normalizedRole === "CON" || normalizedRole === "PHẢN ĐỐI" || normalizedRole === "2"
      ? "con"
      : "pro";
  const urlDifficulty = parseDifficulty(searchParams.get("difficulty"));

  // Restore round & timeout state across page refreshes for the same sessionId
  const [currentRound, setCurrentRound] = useState<number>(() => {
    const saved = readStoredNumber(CURRENT_ROUND_PREFIX + sessionId);
    return saved && saved >= 1 && saved <= 3 ? saved : 1;
  });
  const [timedOutRounds, setTimedOutRounds] = useState<number[]>(() => {
    try {
      const raw = sessionStorage.getItem(TIMED_OUT_ROUNDS_PREFIX + sessionId);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [isDebateCompleted, setIsDebateCompleted] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(COMPLETED_STORAGE_PREFIX + sessionId) === "1";
    } catch {
      return false;
    }
  });

  const [messages, setMessages] = useState<DebateRoomMessage[]>(() => {
    try {
      const raw = sessionStorage.getItem(MESSAGES_STORAGE_PREFIX + sessionId);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [argumentText, setArgumentText] = useState("");
  const [secondsRemaining, setSecondsRemaining] = useState<number>(ROUND_1_DEFAULT_SECONDS);
  const [isTurnExpired, setIsTurnExpired] = useState<boolean>(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Synchronous locks to prevent duplicate sends, concurrent AI turns & premature timeout triggers
  const isSubmittingRef = useRef(false);
  const isAiGeneratingRef = useRef(false);
  const handledTimeoutKeyRef = useRef<string | null>(null);
  const submittedRoundsRef = useRef<Set<number>>(new Set());
  const inFlightTurnIndexRef = useRef<number | null>(null);
  // Backend "start" must be requested at most once per session (StrictMode double effects + 3s polling)
  const startRequestedSessionRef = useRef<number | null>(null);
  const isFinishingRef = useRef(false);
  // Final grading results that already succeeded: a retry only redoes the steps that did not, or whose
  // input changed. `fingerprint` is the exact content that was graded.
  const finishRoundResultsRef = useRef<Map<string, { fingerprint: string; result: RoundEvaluationResult }>>(
    new Map()
  );
  const finishSessionResultRef = useRef<{ fingerprint: string; result: SessionEvaluationResult } | null>(null);
  const messagesRef = useRef<DebateRoomMessage[]>([]);
  // Latest input text and submit function, read by the timeout handler (which runs from a timer)
  const argumentTextRef = useRef("");
  const sendArgumentRef = useRef<(opts?: { auto?: boolean }) => Promise<void>>(async () => {});
  const opponentReadyRef = useRef<{ sessionId: string; promise: Promise<void> } | null>(null);
  const casePlanRequestedRef = useRef<string | null>(null);
  const unmountedRef = useRef(false);
  const clearedOnLeaveRef = useRef(false);
  // Rounds whose argument the Backend already accepted: a retry must never submit them again
  const argumentsSubmittedRoundsRef = useRef<Set<number>>(new Set());

  const [pendingAiTurn, setPendingAiTurn] = useState<AiTurnContext | null>(null);

  // Microservice & Assistant Panel states
  const [, setAiOpponentStatus] = useState<string>("init");
  const [opponentError, setOpponentError] = useState<string | null>(null);
  const [evaluatorError, setEvaluatorError] = useState<string | null>(null);
  const [casePlan, setCasePlan] = useState<CaseFileResponse | null>(null);
  const [evaluationResult, setEvaluationResult] = useState<ArgumentEvaluationResult | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [sidebarTab, setSidebarTab] = useState<string>("evaluator");
  const [hasNewEvaluation, setHasNewEvaluation] = useState<boolean>(false);
  // AI Opponent service failed to initialise / produce its opening turn: the debate is blocked until retried
  const [opponentInitFailed, setOpponentInitFailed] = useState<boolean>(false);
  // The current AI turn was generated from another speech: retrying cannot help, the debate cannot continue
  const [isOpponentSpeechMismatch, setIsOpponentSpeechMismatch] = useState<boolean>(false);
  // The opponent session exists with other data: creating it again cannot help, the debate cannot start
  const [isOpponentDataConflict, setIsOpponentDataConflict] = useState<boolean>(false);
  const [opponentInitNonce, setOpponentInitNonce] = useState<number>(0);
  // The input stays locked until the opponent session is READY (created AND case plan finished)
  const [opponentReady, setOpponentReady] = useState<boolean>(false);
  // The AI turn was generated but could not be recorded in the Backend: only that step is retried
  const [pendingAiRecord, setPendingAiRecord] = useState<{
    ctx: AiTurnContext;
    speechText: string;
  } | null>(null);
  // Evaluation of a submitted turn failed: the debate is blocked until the retry succeeds
  const [pendingTurnEvaluation, setPendingTurnEvaluation] = useState<TurnEvaluationContext | null>(null);
  const [finishEvaluationFailed, setFinishEvaluationFailed] = useState<boolean>(false);
  const [isGradingBlocked, setIsGradingBlocked] = useState<boolean>(false);
  // Step of the final grading that is running now (null = not grading): drives the full-screen overlay
  const [gradingMessage, setGradingMessage] = useState<string | null>(null);
  // Learner message whose turn evaluation is in flight (small non-blocking indicator in the chat)
  const [evaluatingMessageId, setEvaluatingMessageId] = useState<string | null>(null);

  // Auth & Backend Session Details State
  const { user } = useAuth();
  // Not parsed to a number: compare it with isSameUserId. null = the account has not loaded yet.
  const currentUserId = user?.userId ?? user?.id ?? null;

  const [sessionDetails, setSessionDetails] = useState<DebateSessionResponse | null>(null);
  const [pendingSwapRequests, setPendingSwapRequests] = useState<SideSwapRequestResponse[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [roomFeedback, setRoomFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const numSessionId = parseInt(sessionId, 10);
  const isBackendSession = !isNaN(numSessionId) && numSessionId > 0;
  // One opponent session per debate. null: a Backend session that has not loaded yet (or has no createdAt).
  const backendCreatedAt = sessionDetails?.createdAt;
  const opponentSessionId = useMemo(
    () =>
      isBackendSession
        ? buildBackendOpponentSessionId(numSessionId, backendCreatedAt)
        : getLocalOpponentSessionId(sessionId),
    [isBackendSession, numSessionId, backendCreatedAt, sessionId]
  );
  // Determine whether this is an AI Practice session or a P2P (1v1 / 2v2) session.
  // Note: Backend SystemService's MapToSessionResponse currently returns `debateType = 1` (AiPractice)
  // even for P2P and 2v2 sessions. However, AI Practice sessions always create an AI participant (`isAI: true`)
  // and navigate with `?motion=...` in the URL, whereas P2P/2v2 sessions have only human participants (`isAI: false`).
  const hasExplicitAiQuery = Boolean(searchParams.get("motion") || searchParams.get("difficulty"));
  const hasAiParticipant = Boolean(sessionDetails?.participants?.some((p) => p.isAI));
  const isLoadingBackendSession = isBackendSession && !sessionDetails && !hasExplicitAiQuery;

  const isAiSession = sessionDetails
    ? hasAiParticipant
    : !isBackendSession || hasExplicitAiQuery;

  const isP2pOr2v2 = sessionDetails
    ? !hasAiParticipant
    : isBackendSession && !hasExplicitAiQuery;

  const is2v2 = Boolean(
    sessionDetails &&
      !hasAiParticipant &&
      (sessionDetails.participants.length > 2 ||
        (sessionDetails.title &&
          (sessionDetails.title.toLowerCase().includes("2 vs 2") ||
            sessionDetails.title.toLowerCase().includes("2v2"))))
  );
  const myParticipant = sessionDetails?.participants.find((p) => isSameUserId(p.userId, currentUserId));
  const isParticipant = Boolean(myParticipant);
  const queryRole = searchParams.get("role")?.toLowerCase();
  const userRoleInRoom: DebateRoleInRoom = !isBackendSession
    ? "Debater"
    : isParticipant
    ? "Debater"
    : queryRole === "judge"
    ? "Judge"
    : "Spectator";

  const isCompetition =
    searchParams.get("mode") === "competition" ||
    Boolean(
      sessionDetails &&
        (sessionDetails.debateType === 4 ||
          (sessionDetails.title && sessionDetails.title.includes("[Giải đấu]")))
    );
  const roomMode: DebateRoomMode = isCompetition
    ? "competition"
    : is2v2
    ? "2v2"
    : isP2pOr2v2
    ? "1v1"
    : "ai";

  const isHost = Boolean(sessionDetails && isSameUserId(sessionDetails.createdByUserId, currentUserId));
  const proParticipants =
    sessionDetails?.participants.filter((p) => p.side === 1 || String(p.side) === "PRO") || [];
  const conParticipants =
    sessionDetails?.participants.filter((p) => p.side === 2 || String(p.side) === "CON") || [];
  const canHostStart = Boolean(
    sessionDetails &&
      (is2v2
        ? proParticipants.length >= 2 && conParticipants.length >= 2
        : proParticipants.length >= 1 && conParticipants.length >= 1)
  );

  const mySide = myParticipant?.side;

  // ONE source for the session data sent to the AI services: the Backend session first, then the URL.
  const backendLearnerSide: BackendDebateSide | null =
    mySide === 1 || String(mySide) === "PRO" ? "pro" : mySide === 2 || String(mySide) === "CON" ? "con" : null;
  const debaterSide: BackendDebateSide = backendLearnerSide ?? urlSide;
  const aiSide: BackendDebateSide = debaterSide === "pro" ? "con" : "pro";
  // Links from the history and result pages have no query string, so the URL's value is kept for them: another
  // difficulty for the same debate would be refused by the opponent service (409). createdAt ties it to this
  // debate, because a numeric id can come back after a Backend DB reset.
  const difficultyStamp = `${sessionDetails?.createdAt ?? ""}|`;
  const storedDifficulty = useMemo(() => {
    try {
      const stored = sessionStorage.getItem(DIFFICULTY_STORAGE_PREFIX + sessionId);
      return stored?.startsWith(difficultyStamp) ? parseDifficulty(stored.slice(difficultyStamp.length)) : null;
    } catch {
      return null;
    }
  }, [sessionId, difficultyStamp]);
  const difficulty: BackendDifficulty =
    parseDifficulty(sessionDetails?.sessionDifficulty) ??
    urlDifficulty ??
    storedDifficulty ??
    parseDifficulty(sessionDetails?.difficulty) ??
    "medium";
  const resolvedMotion = normalizeMotion(sessionDetails?.topic || motionParam);
  const isMyP2pTurn =
    !isP2pOr2v2 || !sessionDetails
      ? true
      : sessionDetails.currentTurnSide === mySide ||
        (String(sessionDetails.currentTurnSide) === "PRO" &&
          (mySide === 1 || String(mySide) === "PRO")) ||
        (String(sessionDetails.currentTurnSide) === "CON" &&
          (mySide === 2 || String(mySide) === "CON"));

  // Who a speech counts as when grading the current user. In P2P every human is a "Debater" message, so
  // the author must be identified; a teammate's or unidentifiable speech gets no role (null) and is not sent.
  const participants = sessionDetails?.participants;
  const getEvaluatorSpeaker = useCallback(
    (m: DebateRoomMessage): TurnSpeaker | null => {
      if (!isP2pOr2v2) return m.speaker === "Debater" ? "learner" : "opponent";
      const relation = getSpeakerRelation(m, participants ?? [], currentUserId);
      return relation === "self" ? "learner" : relation === "opponent" ? "opponent" : null;
    },
    [isP2pOr2v2, participants, currentUserId]
  );

  // Two-sided round tracking: a round is only complete when both PRO and CON have spoken (or explicit timeout before submission)
  const hasDebaterSpokenInRound = useCallback(
    (round: number) =>
      messages.some(
        (m) => m.roundNumber === round && m.speaker === "Debater" && Boolean(m.content?.trim())
      ),
    [messages]
  );

  const hasOpponentSpokenInRound = useCallback(
    (round: number) =>
      messages.some(
        (m) => m.roundNumber === round && m.speaker === "AI" && Boolean(m.content?.trim())
      ),
    [messages]
  );

  const hasDebaterSpokenInCurrentRound = hasDebaterSpokenInRound(currentRound);
  const hasOpponentSpokenInCurrentRound = hasOpponentSpokenInRound(currentRound);
  const isCurrentRoundTimedOut =
    timedOutRounds.includes(currentRound) && !hasDebaterSpokenInCurrentRound;

  const isWaitingForAiFirstTurn =
    !isP2pOr2v2 &&
    aiSide === "pro" &&
    currentRound === 1 &&
    !hasOpponentSpokenInRound(1) &&
    !isCurrentRoundTimedOut;

  // Keep session in waiting-for-opponent state after Debater speaks until AI Opponent response is recorded
  const isWaitingForOpponentInAiMode =
    !isP2pOr2v2 &&
    (isWaitingForAiFirstTurn ||
      isAiGenerating ||
      (hasDebaterSpokenInCurrentRound && !hasOpponentSpokenInCurrentRound) ||
      Boolean(pendingAiTurn) ||
      Boolean(pendingAiRecord));

  // Round 3 is genuinely complete ONLY when both PRO and CON have spoken in Round 3, or Round 3 timed out before Debater spoke
  const isRound3GenuinelyComplete =
    (hasDebaterSpokenInRound(3) && hasOpponentSpokenInRound(3)) ||
    (timedOutRounds.includes(3) &&
      !hasDebaterSpokenInRound(3) &&
      !isAiGenerating &&
      !isSubmitting);

  const EffectiveDebateCompleted = isP2pOr2v2
    ? isDebateCompleted
    : isDebateCompleted && isRound3GenuinelyComplete;

  // Persist currentRound, timedOutRounds, and EffectiveDebateCompleted to sessionStorage
  useEffect(() => {
    writeStoredValue(CURRENT_ROUND_PREFIX + sessionId, String(currentRound));
  }, [sessionId, currentRound]);

  useEffect(() => {
    writeStoredValue(TIMED_OUT_ROUNDS_PREFIX + sessionId, JSON.stringify(timedOutRounds));
  }, [sessionId, timedOutRounds]);

  useEffect(() => {
    if (urlDifficulty) writeStoredValue(DIFFICULTY_STORAGE_PREFIX + sessionId, difficultyStamp + urlDifficulty);
  }, [sessionId, urlDifficulty, difficultyStamp]);

  useEffect(() => {
    writeStoredValue(MESSAGES_STORAGE_PREFIX + sessionId, JSON.stringify(messages));
  }, [sessionId, messages]);

  useEffect(() => {
    if (EffectiveDebateCompleted) {
      writeStoredValue(COMPLETED_STORAGE_PREFIX + sessionId, "1");
    } else if (!isP2pOr2v2 && isDebateCompleted && !isRound3GenuinelyComplete) {
      setIsDebateCompleted(false);
      removeStoredValue(COMPLETED_STORAGE_PREFIX + sessionId);
    }
  }, [sessionId, EffectiveDebateCompleted, isP2pOr2v2, isDebateCompleted, isRound3GenuinelyComplete]);

  // Never treat turn as expired while waiting for AI Opponent or submitting an argument
  const EffectiveExpired =
    !isWaitingForOpponentInAiMode &&
    !isSubmitting &&
    (isTurnExpired || isCurrentRoundTimedOut || secondsRemaining <= 0);

  const isDebaterTurnInAiMode =
    !EffectiveDebateCompleted &&
    !EffectiveExpired &&
    !isAiGenerating &&
    !isSubmitting &&
    !isWaitingForOpponentInAiMode &&
    !opponentInitFailed &&
    (isP2pOr2v2 || opponentReady) &&
    !pendingTurnEvaluation &&
    !hasDebaterSpokenInCurrentRound;

  const canSpeak =
    userRoleInRoom === "Debater" &&
    (isP2pOr2v2
      ? isMyP2pTurn && !isSubmitting && !EffectiveDebateCompleted && !EffectiveExpired
      : isDebaterTurnInAiMode);

  const cannotSpeakReason = userRoleInRoom === "Judge"
    ? "Bạn đang ở chế độ Giám khảo theo dõi trận đấu (Read-only)."
    : userRoleInRoom === "Spectator"
    ? "Bạn đang ở chế độ Giám sát/Khán giả theo dõi trận đấu (Read-only)."
    : EffectiveDebateCompleted
    ? "Đã hoàn thành 3 vòng tranh biện. Nhấn 'Nộp bài' ở góc trên để xem kết quả."
    : opponentInitFailed
    ? "Chưa kết nối được Đối thủ AI. Vui lòng nhấn 'Thử lại' ở thanh thông báo phía trên."
    : opponentError === OPPONENT_SESSION_ID_ERROR
    ? OPPONENT_SESSION_ID_ERROR
    : isOpponentDataConflict
    ? "Phiên này không thể tiếp tục. Vui lòng quay lại và tạo phiên tranh biện mới."
    : !isP2pOr2v2 && !opponentReady
    ? "AI đang chuẩn bị lập luận..."
    : pendingTurnEvaluation
    ? "Chưa chấm được lượt phát biểu trước. Vui lòng nhấn 'Thử lại' ở thanh thông báo phía trên."
    : isAiGenerating || isWaitingForAiFirstTurn
    ? "Đối thủ AI đang phản hồi..."
    : isSubmitting
    ? "Đang gửi lập luận..."
    : isOpponentSpeechMismatch
    ? "Phiên này không thể tiếp tục. Vui lòng quay lại và tạo phiên tranh biện mới."
    : isWaitingForOpponentInAiMode
    ? opponentError
      ? "Chưa nhận được phản hồi từ Đối thủ AI. Vui lòng nhấn 'Thử lại' ở thanh thông báo phía trên."
      : "Đang chờ Đối thủ AI hoàn tất lượt phát biểu trong vòng này..."
    : EffectiveExpired
    ? isP2pOr2v2
      ? "Đã hết thời gian phát biểu (00:00). Đang chờ máy chủ cập nhật lượt tiếp theo..."
      : currentRound < 3
      ? `Đã hết thời gian phát biểu (00:00). Nhấn "Sang Vòng ${currentRound + 1}" ở trên để tiếp tục.`
      : "Đã hết thời gian phát biểu (00:00). Phiên tranh biện đã hoàn tất."
    : !isMyP2pTurn
    ? "Đang chờ lượt phát biểu của đối thủ..."
    : undefined;

  const loadBackendSession = useCallback(async (numId: number): Promise<DebateSessionResponse | null> => {
    try {
      const res = await debateApi.getSessionDetails(numId);
      if (res?.success && res.data) {
        setIsReconnecting(false);
        setSessionDetails(res.data);
        if (res.data.topic || res.data.title) {
          setMotionText(res.data.topic || res.data.title);
        }
        // Sync server-owned status and round ONLY for P2P/2v2 sessions.
        // Note: Backend MapToSessionResponse currently returns debateType=1 for all sessions,
        // so check `participants.some(p => p.isAI)` as the authoritative indicator of AI vs P2P/2v2.
        const serverHasAi = Boolean(res.data.participants?.some((p) => p.isAI));
        const serverIsP2p = !serverHasAi;

        if (
          serverHasAi &&
          (res.data.status === 1 || String(res.data.status) === "Waiting") &&
          startRequestedSessionRef.current !== numId
        ) {
          startRequestedSessionRef.current = numId;
          debateApi.startDebateSession(numId).catch((startErr) => {
            console.error("Error starting AI debate session:", startErr);
            setRoomFeedback({
              text: getDebateErrorMessage(startErr, "Không thể bắt đầu phiên tranh biện."),
              type: "error",
            });
          });
        }

        if (serverIsP2p) {
          const stageNum =
            res.data.currentStage === 1 || String(res.data.currentStage) === "Opening"
              ? 1
              : res.data.currentStage === 2 || String(res.data.currentStage) === "Rebuttal"
              ? 2
              : 3;
          setCurrentRound(stageNum);
          if (res.data.status === 3 || String(res.data.status) === "Completed") {
            setIsDebateCompleted(true);
            setSecondsRemaining(0);
          }
        }
        return res.data;
      }
      return null;
    } catch (e) {
      if (isP2pOr2v2) {
        setIsReconnecting(true);
      } else {
        setRoomFeedback({
          text: getDebateErrorMessage(e, "Không tải được thông tin phiên tranh biện."),
          type: "error",
        });
      }
      console.error("Error fetching session details:", e);
      return null;
    }
  }, [isP2pOr2v2]);

  // Resolves to the loaded speeches, or null when the transcript could not be read.
  const loadBackendTranscript = useCallback(
    async (numId: number): Promise<DebateRoomMessage[] | null> => {
      try {
        const res = await debateApi.getTranscript(numId);
        if (!res?.success || !res.data?.arguments) return null;
        if (res.data.arguments.length > 0) {
          const loadedMsgs: DebateRoomMessage[] = res.data.arguments.map((arg) => {
            const stageNum =
              arg.stage === 1 || String(arg.stage) === "Opening"
                ? 1
                : arg.stage === 2 || String(arg.stage) === "Rebuttal"
                ? 2
                : 3;
            return {
              id: `arg-${arg.argumentId}`,
              speaker: arg.isAI ? "AI" : "Debater",
              speakerName: arg.speakerName || (arg.isAI ? "Đối thủ AI" : "Bạn"),
              side: arg.side === 1 || String(arg.side) === "PRO" ? "Ủng hộ" : "Phản đối",
              stage: stageNum === 1 ? "Mở đầu" : stageNum === 2 ? "Phản biện" : "Kết luận",
              roundNumber: stageNum,
              timestamp: arg.submittedAt
                ? new Date(arg.submittedAt).toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "",
              content: arg.content,
              isCurrentUser:
                arg.userId !== undefined && arg.userId !== null
                  ? isSameUserId(arg.userId, currentUserId)
                  : !arg.isAI && (!user?.fullName || arg.speakerName === user.fullName || !isP2pOr2v2),
              speakerUserId: arg.userId ?? undefined,
            };
          });
          setMessages(loadedMsgs);
          return loadedMsgs;
        }
        return [];
      } catch (e) {
        console.warn("Error fetching transcript:", e);
        return null;
      }
    },
    [user?.fullName, isP2pOr2v2, currentUserId]
  );

  // Unique turn key for wall-clock deadline & single-execution timeout handling
  const activeTurnKey = isP2pOr2v2
    ? `${sessionId}_p2p_s${sessionDetails?.currentStage ?? currentRound}_t${sessionDetails?.currentTurnSide ?? 1}_m${messages.length}`
    : `${sessionId}_ai_r${currentRound}_${debaterSide}`;

  // Reset local expired flag when switching to a brand-new turn that hasn't expired
  useEffect(() => {
    const alreadyExpiredInStorage =
      sessionStorage.getItem(EXPIRED_STORAGE_PREFIX + activeTurnKey) === "1";
    const roundAlreadyTimedOut =
      !isP2pOr2v2 && timedOutRounds.includes(currentRound) && !hasDebaterSpokenInCurrentRound;
    setIsTurnExpired(
      !hasDebaterSpokenInCurrentRound && (alreadyExpiredInStorage || roundAlreadyTimedOut)
    );
  }, [activeTurnKey, isP2pOr2v2, timedOutRounds, currentRound, hasDebaterSpokenInCurrentRound]);

  // Single-execution timeout handler when countdown reaches 00:00
  const handleTurnTimeout = useCallback(
    (turnKey: string) => {
      if (handledTimeoutKeyRef.current === turnKey) return;
      // Never mark a round or the debate complete via timer while AI is responding or after Debater already spoke in this round
      if (
        isSubmittingRef.current ||
        isAiGeneratingRef.current ||
        isSubmitting ||
        isAiGenerating ||
        EffectiveDebateCompleted ||
        (!isP2pOr2v2 &&
          (submittedRoundsRef.current.has(currentRound) ||
            hasDebaterSpokenInCurrentRound ||
            isWaitingForOpponentInAiMode))
      ) {
        return;
      }

      handledTimeoutKeyRef.current = turnKey;

      // AI practice, time is up but the learner wrote something: submit it through the normal flow
      // (evaluate, AI turn, record the AI turn). `submittedRoundsRef` / `isSubmittingRef` make a click on
      // "Gửi" at the same moment a no-op, so it is never sent twice.
      if (!isP2pOr2v2 && argumentTextRef.current.trim()) {
        setIsRecording(false);
        void sendArgumentRef.current({ auto: true });
        // handleSendArgument clears the feedback strip synchronously: show the notice afterwards
        setRoomFeedback({ text: "Hết giờ, đã tự động nộp phần bạn đã viết.", type: "success" });
        return;
      }

      writeStoredValue(EXPIRED_STORAGE_PREFIX + turnKey, "1");

      setSecondsRemaining(0);
      setIsTurnExpired(true);
      setIsRecording(false);
      setTimedOutRounds((prev) => (prev.includes(currentRound) ? prev : [...prev, currentRound]));

      const roundLabel =
        currentRound === 1 ? "Mở đầu" : currentRound === 2 ? "Phản biện" : "Kết luận";

      if (isP2pOr2v2) {
        // Backend owns turn transitions in P2P/2v2 mode: do not fake a local turn transition
        setRoomFeedback({
          text: `Đã hết thời gian phát biểu ở Vòng ${currentRound} (${roundLabel}). Đang đồng bộ trạng thái lượt tiếp theo với máy chủ...`,
          type: "error",
        });
        if (isBackendSession) {
          loadBackendSession(numSessionId);
          loadBackendTranscript(numSessionId);
        }
        return;
      }

      // AI practice, nothing was written: the input stays locked and nothing is sent to the Backend.
      // TODO(BE): skipping a turn needs a skip-turn endpoint. Until it exists a Backend session cannot move
      // on without the learner's turn, so it stays blocked here; only local (non-Backend) sessions, which
      // have no Backend state to keep in sync, can still move on to the next round by hand.
      setRoomFeedback({
        text: "Hết giờ, bạn chưa phát biểu. Lượt bỏ qua chưa được hỗ trợ.",
        type: "error",
      });
      if (!isBackendSession && currentRound >= 3) {
        setIsDebateCompleted(true);
      }
    },
    [
      EffectiveDebateCompleted,
      currentRound,
      hasDebaterSpokenInCurrentRound,
      isAiGenerating,
      isBackendSession,
      isP2pOr2v2,
      isSubmitting,
      isWaitingForOpponentInAiMode,
      loadBackendSession,
      loadBackendTranscript,
      numSessionId,
    ]
  );

  // Explicit round advancement after a timeout in Round 1 or Round 2 (AI Practice Mode)
  const handleAdvanceTimedOutRound = useCallback(() => {
    if (isP2pOr2v2 || EffectiveDebateCompleted || currentRound >= 3) return;

    const nextRound = currentRound + 1;
    const nextRoundLabel = nextRound === 2 ? "Phản biện" : "Kết luận";
    const nextTurnKey = `${sessionId}_ai_r${nextRound}_${debaterSide}`;

    // Initialize a fresh wall-clock deadline for the new round
    const nextDeadlineMs = Date.now() + SUBSEQUENT_ROUND_SECONDS * 1000;
    writeStoredValue(DEADLINE_STORAGE_PREFIX + nextTurnKey, String(nextDeadlineMs));
    removeStoredValue(EXPIRED_STORAGE_PREFIX + nextTurnKey);

    handledTimeoutKeyRef.current = null;
    setIsTurnExpired(false);
    setSecondsRemaining(SUBSEQUENT_ROUND_SECONDS);
    setCurrentRound(nextRound);
    setRoomFeedback({
      text: `Đã chuyển sang Vòng ${nextRound} (${nextRoundLabel}). Đến lượt bạn phát biểu.`,
      type: "success",
    });
  }, [EffectiveDebateCompleted, currentRound, debaterSide, isP2pOr2v2, sessionId]);

  // Wall-clock countdown timer — resilient to re-renders, Strict Mode, tab switching, and page refreshes
  const isWaitingInLobby =
    isBackendSession &&
    isP2pOr2v2 &&
    (isLoadingBackendSession ||
      sessionDetails?.status === 1 ||
      String(sessionDetails?.status) === "Waiting");

  const isTerminalBackendStatus =
    sessionDetails?.status === 3 ||
    sessionDetails?.status === 4 ||
    String(sessionDetails?.status) === "Completed" ||
    String(sessionDetails?.status) === "Cancelled";

  // Active-debate navigation protection for AI 1v1, P2P 1v1, and P2P 2v2:
  // - Never blocks while waiting for players in the P2P/2v2 lobby
  // - Automatically disabled once the debate is completed, canceled, or terminal
  const isDebateActivelyInProgress =
    !isLoadingBackendSession &&
    !EffectiveDebateCompleted &&
    !isTerminalBackendStatus &&
    !isWaitingInLobby &&
    (isP2pOr2v2
      ? sessionDetails?.status === 2 || String(sessionDetails?.status) === "InProgress"
      : true);

  const {
    isConfirmOpen: isLeaveConfirmOpen,
    isLeaving,
    requestExit,
    confirmLeave,
    cancelLeave,
  } = useDebateNavigationGuard({
    // Leaving a waiting room cancels it too, once the Backend can: then it needs the same confirmation.
    // Not while the session is loading: it may be a running AI debate, which the user did not choose to cancel.
    when: isDebateActivelyInProgress || (isDebateLeaveEnabled() && isWaitingInLobby && !isLoadingBackendSession),
    defaultExitPath: "/debater/dashboard",
    onBeforeLeave: async () => {
      clearedOnLeaveRef.current = await leaveDebateRoom(sessionId, isBackendSession ? numSessionId : null);
    },
  });

  const isSessionCancelled = sessionDetails?.status === 4 || String(sessionDetails?.status) === "Cancelled";

  // Persist active session metadata for recovery after refresh/reconnect; clear when terminal
  useEffect(() => {
    if (isDebateActivelyInProgress) {
      const searchStr = searchParams.toString();
      const fullUrl = `/debater/debate/${sessionId}${searchStr ? `?${searchStr}` : ""}`;
      saveActiveDebateSession({
        sessionId,
        url: fullUrl,
        mode: roomMode,
        topicTitle: motionText,
        updatedAt: Date.now(),
      });
    } else if (EffectiveDebateCompleted || isTerminalBackendStatus) {
      clearActiveDebateSession(sessionId);
    }
  }, [
    EffectiveDebateCompleted,
    isDebateActivelyInProgress,
    isTerminalBackendStatus,
    motionText,
    roomMode,
    searchParams,
    sessionId,
  ]);

  // Monitor browser online/offline status for reconnection indicator without resetting timers
  useEffect(() => {
    const handleOffline = () => {
      if (isDebateActivelyInProgress) {
        setIsReconnecting(true);
      }
    };
    const handleOnline = () => {
      setIsReconnecting(false);
      if (isBackendSession) {
        loadBackendSession(numSessionId);
        if (isP2pOr2v2 && !isLoadingBackendSession) {
          loadBackendTranscript(numSessionId);
        }
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [
    isBackendSession,
    isDebateActivelyInProgress,
    isP2pOr2v2,
    isLoadingBackendSession,
    loadBackendSession,
    loadBackendTranscript,
    numSessionId,
  ]);

  const isCountdownActive =
    !isWaitingInLobby &&
    !EffectiveDebateCompleted &&
    !isSubmitting &&
    !isAiGenerating &&
    !isWaitingForOpponentInAiMode &&
    (isP2pOr2v2 || (opponentReady && !hasDebaterSpokenInCurrentRound));

  useEffect(() => {
    if (EffectiveDebateCompleted) {
      setSecondsRemaining(0);
      return;
    }

    if (!isCountdownActive) {
      return;
    }

    // Check if this turn has already expired previously (e.g. before page refresh or re-render)
    const alreadyExpired =
      sessionStorage.getItem(EXPIRED_STORAGE_PREFIX + activeTurnKey) === "1" ||
      (!isP2pOr2v2 && timedOutRounds.includes(currentRound) && !hasDebaterSpokenInCurrentRound);

    if (alreadyExpired) {
      setSecondsRemaining(0);
      setIsTurnExpired(true);
      handleTurnTimeout(activeTurnKey);
      return;
    }

    const defaultDurationSec =
      isP2pOr2v2 && sessionDetails?.currentTurn?.timeLimitSeconds
        ? sessionDetails.currentTurn.timeLimitSeconds
        : currentRound === 1
        ? ROUND_1_DEFAULT_SECONDS
        : SUBSEQUENT_ROUND_SECONDS;

    let deadlineMs = readStoredNumber(DEADLINE_STORAGE_PREFIX + activeTurnKey);
    if (!deadlineMs || deadlineMs <= 0) {
      deadlineMs = Date.now() + defaultDurationSec * 1000;
      writeStoredValue(DEADLINE_STORAGE_PREFIX + activeTurnKey, String(deadlineMs));
    }

    const syncClock = () => {
      const remaining = Math.max(0, Math.ceil((deadlineMs! - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        handleTurnTimeout(activeTurnKey);
      }
    };

    syncClock();
    const intervalId = setInterval(syncClock, 250);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        syncClock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
    };
  }, [
    EffectiveDebateCompleted,
    activeTurnKey,
    currentRound,
    handleTurnTimeout,
    hasDebaterSpokenInCurrentRound,
    isCountdownActive,
    isP2pOr2v2,
    sessionDetails?.currentTurn?.timeLimitSeconds,
    timedOutRounds,
  ]);

  // Polling for backend sessions — only overwrite transcript in P2P/2v2 mode
  useEffect(() => {
    if (!isBackendSession) return;

    loadBackendSession(numSessionId);
    // While the session is loading its type is unknown: an AI room's messages must not be replaced by the transcript
    if (isP2pOr2v2 && !isLoadingBackendSession) {
      loadBackendTranscript(numSessionId);
    }

    // A finished or cancelled session cannot change any more: one load above is enough
    if (isTerminalBackendStatus || EffectiveDebateCompleted) return;

    const interval = setInterval(() => {
      loadBackendSession(numSessionId);
      if (!isP2pOr2v2) return;

      if (sessionDetails?.status === 1) {
        debateApi
          .getPendingSwapRequests(numSessionId)
          .then((res) => {
            if (res?.success && Array.isArray(res.data)) {
              setPendingSwapRequests(res.data);
            }
          })
          .catch(() => {});
      } else if (sessionDetails?.status === 2) {
        loadBackendTranscript(numSessionId);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [
    isBackendSession,
    isP2pOr2v2,
    isLoadingBackendSession,
    numSessionId,
    sessionDetails?.status,
    loadBackendSession,
    loadBackendTranscript,
    isTerminalBackendStatus,
    EffectiveDebateCompleted,
  ]);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      // The room's effects can still save state between the clear on leaving and this unmount
      if (clearedOnLeaveRef.current) {
        clearDebateRoomStorage(sessionId);
      }
    };
  }, [sessionId]);

  // Initialize session with AI Opponent Service (only for AI mode when debate is active).
  // Any failure blocks the debate (no simulated opponent) until the user retries.
  useEffect(() => {
    if (!isAiSession) return;
    if (isP2pOr2v2) return;
    if (isWaitingInLobby || isLoadingBackendSession) return;
    // The session data must come from the Backend session: wait for it instead of using URL defaults
    if (isBackendSession && !sessionDetails) return;
    // A finished debate never (re)creates an opponent session
    if (EffectiveDebateCompleted || isTerminalBackendStatus) return;
    // Each poll of the session runs this effect again: a conflict must not call the service every time
    if (isOpponentDataConflict) return;

    let isMounted = true;
    const initOpponent = async () => {
      try {
        setOpponentError(null);
        setOpponentInitFailed(false);

        // No retry: the same session data would give the same answer
        if (!opponentSessionId) {
          setOpponentError(OPPONENT_SESSION_ID_ERROR);
          return;
        }

        // Create the opponent session and wait until its case plan is READY. The in-flight work is
        // shared by StrictMode's double effect run and by retries; it is dropped on failure so a
        // retry starts over.
        let readiness = opponentReadyRef.current;
        if (!readiness || readiness.sessionId !== opponentSessionId) {
          setAiOpponentStatus("planning");
          const promise = (async () => {
            let status: string;
            try {
              const created = await aiApi.createOpponentSession({
                external_session_id: opponentSessionId,
                motion: resolvedMotion,
                learner_side: debaterSide,
                ai_side: aiSide,
                difficulty,
                language: "vi",
              });
              status = created.status;
            } catch (createErr) {
              if (isPlanningConflict(createErr)) {
                // 409 "still preparing" = planning already running for this session: just wait for it
                status = "planning";
              } else {
                throw createErr;
              }
            }
            if (status === "failed") {
              throw new Error("Đối thủ AI không lập được kế hoạch tranh biện.");
            }
            if (status !== "ready") {
              await waitUntilOpponentReady(
                async () => (await aiApi.getOpponentSession(opponentSessionId)).status,
                { isCancelled: () => unmountedRef.current }
              );
            }
          })()
            .catch((readyErr) => {
              opponentReadyRef.current = null;
              throw readyErr;
            });
          readiness = { sessionId: opponentSessionId, promise };
          opponentReadyRef.current = readiness;
        }
        await readiness.promise;
        setOpponentReady(true);
        if (isMounted) {
          setAiOpponentStatus("ready");
        }

        // Fetch the Case Plan once per session (the case file exists only after planning is READY)
        if (casePlanRequestedRef.current !== opponentSessionId) {
          casePlanRequestedRef.current = opponentSessionId;
          try {
            const plan = await aiApi.getOpponentCasePlan(opponentSessionId);
            if (isMounted && plan) {
              setCasePlan(plan);
            }
          } catch {
            // Case plan is only informational
          }
        }

        // After a reload the AI may already have spoken its opening: never ask for it again
        const aiAlreadyOpened = messagesRef.current.some((m) => m.speaker === "AI" && m.roundNumber === 1);
        if (aiSide === "pro" && isMounted && !aiAlreadyOpened) {
          isAiGeneratingRef.current = true;
          setIsAiGenerating(true);
          try {
            const firstTurnRes = await retryWhilePlanning(
              () =>
                aiApi.generateOpponentTurn(opponentSessionId, {
                  turn_index: toOpponentTurnIndex(0),
                  new_learner_speeches: [],
                }),
              { isCancelled: () => unmountedRef.current }
            );
            const speechText = firstTurnRes?.speech_text?.trim();
            if (!speechText) {
              throw new Error("Đối thủ AI không trả về nội dung phản hồi hợp lệ.");
            }

            // A failure here fails the init (retry regenerates turn 1, which the service treats as idempotent)
            await recordAiArgument({
              backendSessionId: isBackendSession ? numSessionId : null,
              turnIndex: 0,
              text: speechText,
            });

            if (isMounted) {
              const aiFirstMsg: DebateRoomMessage = {
                id: `msg-${Date.now()}`,
                speaker: "AI",
                speakerName: "Đối thủ AI",
                side: "Ủng hộ",
                stage: "Mở đầu",
                roundNumber: 1,
                timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
                content: speechText,
                isCurrentUser: false,
              };
              setMessages((prev) => (prev.length === 0 ? [aiFirstMsg] : prev));
            }
          } finally {
            isAiGeneratingRef.current = false;
            if (isMounted) setIsAiGenerating(false);
          }
        }
      } catch (initErr) {
        console.error("Error initialising AI Opponent:", initErr);
        if (isMounted) {
          setAiOpponentStatus("error");
          if (isSessionDataConflict(initErr)) {
            setIsOpponentDataConflict(true);
          } else {
            setOpponentInitFailed(true);
          }
          setOpponentError(getOpponentErrorMessage(initErr));
        }
      }
    };

    initOpponent();
    return () => {
      isMounted = false;
    };
  }, [
    opponentSessionId,
    resolvedMotion,
    debaterSide,
    aiSide,
    difficulty,
    isAiSession,
    isP2pOr2v2,
    isWaitingInLobby,
    isLoadingBackendSession,
    isOpponentDataConflict,
    opponentInitNonce,
    isBackendSession,
    numSessionId,
    sessionDetails,
    EffectiveDebateCompleted,
    isTerminalBackendStatus,
  ]);

  const handleStartDebateSession = async () => {
    if (!isBackendSession) return;
    setIsStarting(true);
    setRoomFeedback(null);
    try {
      const res = await debateApi.startDebateSession(numSessionId);
      if (res?.success && res.data) {
        setSessionDetails(res.data);
        setRoomFeedback({ text: "Trận đấu đã chính thức bắt đầu!", type: "success" });
      } else {
        setRoomFeedback({ text: res?.message || "Chưa thể bắt đầu (yêu cầu đủ người tham gia).", type: "error" });
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setRoomFeedback({ text: e.message || "Lỗi khi bắt đầu trận đấu.", type: "error" });
    } finally {
      setIsStarting(false);
    }
  };

  const handleSwitchSide = async () => {
    if (!isBackendSession) return;
    try {
      const res = await debateApi.switchSide(numSessionId);
      if (res?.success && res.data) {
        setSessionDetails(res.data);
        setRoomFeedback({ text: "Đã đổi phe thành công!", type: "success" });
      } else {
        setRoomFeedback({ text: res?.message || "Không thể đổi phe (phe đối diện đã đủ người).", type: "error" });
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setRoomFeedback({ text: e.message || "Lỗi khi đổi phe.", type: "error" });
    }
  };

  const handleSendSwapRequest = async (targetUserId: number) => {
    if (!isBackendSession || !targetUserId) return;
    try {
      const res = await debateApi.sendSwapRequest(numSessionId, { targetUserId });
      if (res?.success) {
        setRoomFeedback({ text: "Đã gửi lời mời tráo phe! Đang chờ phản hồi (60s)...", type: "success" });
      } else {
        setRoomFeedback({ text: res?.message || "Không thể gửi yêu cầu tráo phe.", type: "error" });
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setRoomFeedback({ text: e.message || "Lỗi khi gửi yêu cầu tráo phe.", type: "error" });
    }
  };

  const handleRespondSwapRequest = async (requesterUserId: number, accept: boolean) => {
    if (!isBackendSession) return;
    try {
      const res = await debateApi.respondSwapRequest(numSessionId, { requesterUserId, accept });
      if (res?.success && res.data) {
        setSessionDetails(res.data);
        setPendingSwapRequests((prev) => prev.filter((r) => r.requesterUserId !== requesterUserId));
        setRoomFeedback({
          text: accept ? "Đã đổi phe thành công!" : "Đã từ chối lời mời đổi phe.",
          type: accept ? "success" : "error",
        });
      } else {
        setRoomFeedback({ text: res?.message || "Không thể xử lý yêu cầu đổi phe.", type: "error" });
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setRoomFeedback({ text: e.message || "Lỗi phản hồi yêu cầu đổi phe.", type: "error" });
    }
  };

  // Single collapsible side panel toggle for AI Hints, Case Plan, and Evaluation
  const handleToggleAssistantTab = (tab: "coach" | "caseplan" | "evaluator") => {
    if (isSidebarOpen && sidebarTab === tab) {
      setIsSidebarOpen(false);
    } else {
      setSidebarTab(tab);
      setIsSidebarOpen(true);
      if (tab === "evaluator") {
        setHasNewEvaluation(false);
      }
    }
  };

  const advanceToNextRoundOrComplete = useCallback(
    (roundBeingCompleted: number) => {
      if (roundBeingCompleted >= 3) {
        setIsTurnExpired(false);
        setIsDebateCompleted(true);
        setSecondsRemaining(0);
      } else {
        const nextRound = roundBeingCompleted + 1;
        const nextTurnKey = `${sessionId}_ai_r${nextRound}_${debaterSide}`;
        const nextDeadlineMs = Date.now() + SUBSEQUENT_ROUND_SECONDS * 1000;
        // An AI reply can land after the room is gone: it must not save state back for a room that was left
        if (!unmountedRef.current) {
          writeStoredValue(DEADLINE_STORAGE_PREFIX + nextTurnKey, String(nextDeadlineMs));
          removeStoredValue(EXPIRED_STORAGE_PREFIX + nextTurnKey);
        }

        handledTimeoutKeyRef.current = null;
        setIsTurnExpired(false);
        setSecondsRemaining(SUBSEQUENT_ROUND_SECONDS);
        setCurrentRound(nextRound);
      }
    },
    [debaterSide, sessionId]
  );

  const appendOpponentMessage = useCallback(
    (aiTurnIndex: number, speechText: string) => {
      const { round } = getTurnEntry(aiTurnIndex);
      const aiResponseMsg: DebateRoomMessage = {
        id: `msg-ai-t${aiTurnIndex}-${Date.now()}`,
        speaker: "AI",
        speakerName: "Đối thủ AI",
        side: aiSide === "pro" ? "Ủng hộ" : "Phản đối",
        stage: round === 1 ? "Mở đầu" : round === 2 ? "Phản biện" : "Kết luận",
        roundNumber: round,
        timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        content: speechText,
        isCurrentUser: false,
      };

      setMessages((prev) => {
        const alreadyRecorded = prev.some(
          (m) => m.roundNumber === round && m.speaker === "AI" && Boolean(m.content?.trim())
        );
        return alreadyRecorded ? prev : [...prev, aiResponseMsg];
      });
    },
    [aiSide]
  );

  // One AI turn = three steps, each retried on its own: (1) POST /turns, (2) record in the Backend,
  // (3) show it. Back-to-back AI turns (e.g. turns 4 and 5 when the learner is PRO) run as a chain;
  // the debate advances only when the chain ends. `generatedSpeech` resumes after step 1.
  const executeAiOpponentTurn = useCallback(
    async function runAiTurn(ctx: AiTurnContext, generatedSpeech?: string): Promise<void> {
      // Prevent duplicate concurrent AI turn requests
      if (inFlightTurnIndexRef.current === ctx.aiTurnIndex) {
        return;
      }

      inFlightTurnIndexRef.current = ctx.aiTurnIndex;
      isAiGeneratingRef.current = true;
      setIsAiGenerating(true);
      setOpponentError(null);

      let nextTurn: AiTurnContext | null = null;
      try {
        let speechText = generatedSpeech;

        if (speechText === undefined) {
          try {
            if (!opponentSessionId) {
              throw new Error("Chưa có phiên Đối thủ AI.");
            }
            // A 409 "still planning" is temporary: wait and call again instead of failing
            const turnRes = await retryWhilePlanning(
              () =>
                aiApi.generateOpponentTurn(opponentSessionId, {
                  turn_index: toOpponentTurnIndex(ctx.aiTurnIndex),
                  new_learner_speeches: ctx.learnerSpeech ? [ctx.learnerSpeech] : [],
                }),
              { isCancelled: () => unmountedRef.current }
            );
            speechText = turnRes?.speech_text?.trim();
            if (!speechText) {
              throw new Error("Đối thủ AI không trả về nội dung phản hồi hợp lệ.");
            }
          } catch (turnErr) {
            console.error("Error generating AI Opponent turn:", turnErr);
            setPendingAiRecord(null);
            if (isLearnerSpeechMismatch(turnErr)) {
              // No pending turn: the retry button stays hidden, calling again cannot change the answer.
              setPendingAiTurn(null);
              setIsOpponentSpeechMismatch(true);
              setOpponentError(OPPONENT_SPEECH_MISMATCH_ERROR);
              return;
            }
            // Keep session in waiting-for-opponent state on error/timeout — do NOT mark round or debate complete
            // and never substitute a simulated opponent speech.
            setPendingAiTurn(ctx);
            setOpponentError(
              "Không nhận được phản hồi từ Đối thủ AI (lỗi kết nối hoặc quá thời gian chờ). Vui lòng thử lại."
            );
            return;
          }
        }

        let recorded: Awaited<ReturnType<typeof recordAiArgument>>;
        try {
          recorded = await recordAiArgument({
            backendSessionId: isBackendSession ? numSessionId : null,
            turnIndex: ctx.aiTurnIndex,
            text: speechText,
          });
        } catch (recordErr) {
          console.error("Error recording AI turn:", recordErr);
          // The speech is already generated: retry ONLY this step, never /turns again
          setPendingAiTurn(null);
          setPendingAiRecord({ ctx, speechText });
          setOpponentError(
            `Không ghi được lượt của Đối thủ AI lên máy chủ: ${getDebateErrorMessage(recordErr, "vui lòng thử lại")}`
          );
          return;
        }

        setPendingAiTurn(null);
        setPendingAiRecord(null);
        appendOpponentMessage(ctx.aiTurnIndex, speechText);

        // Whose turn is next comes from the Backend (currentTurn.turnIndex); the table is only a fallback
        const backendState = readBackendTurnState(recorded?.session);
        const followingAiTurns = backendState
          ? getAiTurnsFromBackendState(backendState, aiSide)
          : ctx.remainingAiTurns;

        if (followingAiTurns.length > 0) {
          nextTurn = {
            learnerRound: ctx.learnerRound,
            aiTurnIndex: followingAiTurns[0],
            remainingAiTurns: followingAiTurns.slice(1),
          };
        } else {
          advanceToNextRoundOrComplete(ctx.learnerRound);
        }
      } finally {
        inFlightTurnIndexRef.current = null;
        isAiGeneratingRef.current = false;
        setIsAiGenerating(false);
        setIsSubmitting(false);
        isSubmittingRef.current = false;
      }

      if (nextTurn) {
        await runAiTurn(nextTurn);
      }
    },
    [advanceToNextRoundOrComplete, aiSide, appendOpponentMessage, isBackendSession, numSessionId, opponentSessionId]
  );

  // Evaluate one submitted turn. On failure the debate is blocked (see pendingTurnEvaluation) until a retry succeeds.
  const runTurnEvaluation = useCallback(
    async (ctx: TurnEvaluationContext) => {
      setIsEvaluating(true);
      setEvaluatingMessageId(ctx.messageId ?? null);
      setEvaluatorError(null);
      try {
        const res = await aiApi.evaluateSpeechArgument({
          motion: resolvedMotion,
          side: debaterSide,
          stage: ctx.stage,
          argument_text: ctx.argumentText,
          opponent_argument_text: ctx.opponentText,
        });
        setEvaluationResult(res);
        setHasNewEvaluation(true);
        setPendingTurnEvaluation(null);
      } catch (evalErr) {
        console.error("Error evaluating turn:", evalErr);
        setPendingTurnEvaluation(ctx);
        setEvaluatorError(
          `${TURN_EVALUATION_ERROR} (${getErrorMessage(evalErr, "lỗi không xác định")})`
        );
      } finally {
        setEvaluatingMessageId(null);
        setIsEvaluating(false);
      }
    },
    [debaterSide, resolvedMotion]
  );

  // `auto`: called by the timeout handler at 00:00 — the time checks are skipped, every other guard still applies
  const handleSendArgument = async (opts: { auto?: boolean } = {}) => {
    const isAutoSubmit = opts.auto === true;
    if (
      isSubmittingRef.current ||
      isAiGeneratingRef.current ||
      !argumentText.trim() ||
      (isAutoSubmit && Boolean(pendingTurnEvaluation)) ||
      (!isAutoSubmit && (!canSpeak || EffectiveExpired || secondsRemaining <= 0))
    ) {
      if (!isAutoSubmit && (EffectiveExpired || secondsRemaining <= 0)) {
        setRoomFeedback({ text: "Đã hết thời gian phát biểu cho lượt này.", type: "error" });
      }
      return;
    }

    if (isP2pOr2v2 && !isMyP2pTurn) {
      setRoomFeedback({ text: "Chưa tới lượt phát biểu của bạn hoặc phe của bạn!", type: "error" });
      return;
    }

    // Prevent duplicate submission in the same round in AI mode
    if (!isP2pOr2v2 && (submittedRoundsRef.current.has(currentRound) || hasDebaterSpokenInCurrentRound)) {
      return;
    }

    isSubmittingRef.current = true;
    if (!isP2pOr2v2) {
      submittedRoundsRef.current.add(currentRound);
    }
    setIsSubmitting(true);
    setIsRecording(false);
    setRoomFeedback(null);

    // Clear the active turn deadline so the timer cannot fire a timeout while awaiting response
    const deadlineStorageKey = DEADLINE_STORAGE_PREFIX + activeTurnKey;
    const previousDeadlineMs = readStoredNumber(deadlineStorageKey);
    removeStoredValue(deadlineStorageKey);

    const roundAtSubmission = currentRound;
    const currentText = argumentText.trim();
    const stage: DebateRoundType =
      roundAtSubmission === 1 ? "opening" : roundAtSubmission === 2 ? "rebuttal" : "closing";

    // The Backend rejected (or could not receive) the argument: nothing was submitted, the user keeps
    // their text and the same turn (including its remaining time).
    const abortSubmission = (message: string) => {
      if (!isP2pOr2v2) {
        submittedRoundsRef.current.delete(roundAtSubmission);
      }
      if (previousDeadlineMs) {
        writeStoredValue(deadlineStorageKey, String(previousDeadlineMs));
      }
      setRoomFeedback({ text: message, type: "error" });
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    };

    // 1. Persist the argument to Backend .NET DebateController BEFORE touching local state
    let submittedSession: DebateSessionResponse | undefined;
    if (isBackendSession && !argumentsSubmittedRoundsRef.current.has(roundAtSubmission)) {
      try {
        const res = await debateApi.submitArgument(numSessionId, { content: currentText });
        if (!res?.success) {
          abortSubmission(getDebateErrorMessage(res, "Máy chủ từ chối lập luận của bạn. Vui lòng thử lại."));
          return;
        }
        argumentsSubmittedRoundsRef.current.add(roundAtSubmission);
        if (res.data) {
          submittedSession = res.data;
          setSessionDetails(res.data);
        }
      } catch (submitErr) {
        console.error("Error submitting argument:", submitErr);
        abortSubmission(getDebateErrorMessage(submitErr, "Lỗi khi nộp bài tranh biện. Vui lòng thử lại."));
        return;
      }
    }

    // The learner's own turn comes from the shared TURN_ORDER table (CON speaks first in the closing round);
    // the AI turns that follow come from the Backend's currentTurn, with the table as a fallback.
    const debaterTurnIndex = getTurnIndex(roundAtSubmission, debaterSide);
    const backendState = readBackendTurnState(submittedSession);
    const aiTurnsAfter = backendState
      ? getAiTurnsFromBackendState(backendState, aiSide)
      : getAiTurnsAfterLearnerTurn(debaterTurnIndex, aiSide);

    const newDebaterMsg: DebateRoomMessage = {
      id: `msg-debater-r${roundAtSubmission}-${Date.now()}`,
      speaker: "Debater",
      speakerName: "Bạn",
      side: debaterSide === "pro" ? "Ủng hộ" : "Phản đối",
      stage: roundAtSubmission === 1 ? "Mở đầu" : roundAtSubmission === 2 ? "Phản biện" : "Kết luận",
      roundNumber: roundAtSubmission,
      timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      content: currentText,
      isCurrentUser: true,
      speakerUserId: currentUserId ?? undefined,
    };

    setMessages((prev) => [...prev, newDebaterMsg]);
    setArgumentText("");

    if (isP2pOr2v2) {
      try {
        await loadBackendTranscript(numSessionId);
      } finally {
        setIsSubmitting(false);
        isSubmittingRef.current = false;
      }
      return;
    }

    setOpponentError(null);

    // 2. Call AI Evaluator Microservice (POST /evaluate) — independent of AI Opponent turn state
    const opponentRecentSpeech =
      messages
        .filter((m) => m.speaker === "AI")
        .slice(-1)[0]?.content || null;

    void runTurnEvaluation({
      messageId: newDebaterMsg.id,
      stage,
      argumentText: currentText,
      opponentText: opponentRecentSpeech,
    });

    // 3. Call AI Opponent Microservice (POST /opponent/sessions/{id}/turns) for every AI turn that follows.
    // It can be none: the learner speaks again next round, or this was the last turn of the debate.
    if (aiTurnsAfter.length === 0) {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      advanceToNextRoundOrComplete(roundAtSubmission);
      return;
    }

    await executeAiOpponentTurn({
      learnerRound: roundAtSubmission,
      aiTurnIndex: aiTurnsAfter[0],
      remainingAiTurns: aiTurnsAfter.slice(1),
      learnerSpeech: {
        turn_index: toOpponentTurnIndex(debaterTurnIndex),
        round_type: stage,
        text: currentText,
      },
    });
  };

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    argumentTextRef.current = argumentText;
    sendArgumentRef.current = handleSendArgument;
  });

  // Convert evaluation suggestions to coaching advice if available
  const coachingAdvice: CoachingAdvice[] = evaluationResult
    ? [
        ...(evaluationResult.weaknesses?.map((w) => ({
          type: "weakness" as const,
          label: "Điểm yếu cần khắc phục",
          content: w,
        })) || []),
        ...(evaluationResult.suggestions?.map((s) => ({
          type: "strategy" as const,
          label: "Gợi ý chiến lược tiếp theo",
          content: s,
        })) || []),
      ]
    : [];

  // Manual "evaluate my latest speech" from the side panel (advisory — does not block the debate)
  const handleRequestEvaluation = useCallback(() => {
    const latestDebaterMsg = messages.filter((m) => getEvaluatorSpeaker(m) === "learner").slice(-1)[0];
    if (!latestDebaterMsg) return;
    const msgRound = latestDebaterMsg.roundNumber;
    setIsEvaluating(true);
    setEvaluatorError(null);
    aiApi
      .evaluateSpeechArgument({
        motion: resolvedMotion,
        side: debaterSide,
        stage: msgRound === 1 ? "opening" : msgRound === 2 ? "rebuttal" : "closing",
        argument_text: latestDebaterMsg.content,
        opponent_argument_text:
          messages.filter((m) => getEvaluatorSpeaker(m) === "opponent").slice(-1)[0]?.content || null,
      })
      .then((res) => {
        setEvaluationResult(res);
      })
      .catch((evalErr: unknown) => {
        console.error("Error evaluating latest speech:", evalErr);
        setEvaluatorError(`AI Evaluator: ${getErrorMessage(evalErr, "Lỗi không xác định")}`);
      })
      .finally(() => {
        setIsEvaluating(false);
      });
  }, [messages, resolvedMotion, debaterSide, getEvaluatorSpeaker]);

  // The final turn can still be on its way when the session flips to Completed: reads the Backend until
  // the transcript holds every turn, so grading never runs on a partial debate.
  const loadCompleteP2pTranscript = async (): Promise<DebateRoomMessage[]> => {
    for (let attempt = 0; attempt < TRANSCRIPT_CHECK_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, TRANSCRIPT_CHECK_DELAY_MS));
      }
      const [session, transcript] = await Promise.all([
        loadBackendSession(numSessionId),
        loadBackendTranscript(numSessionId),
      ]);
      if (session && transcript && isTranscriptComplete(session, transcript.length)) {
        return transcript;
      }
    }
    throw new Error("bản ghi phiên tranh biện chưa đủ lượt");
  };

  const handleFinishDebate = async () => {
    if (
      isFinishingRef.current ||
      isGradingBlocked ||
      !EffectiveDebateCompleted ||
      isAiGeneratingRef.current ||
      isSubmittingRef.current ||
      pendingTurnEvaluation
    ) {
      return;
    }
    isFinishingRef.current = true;
    setIsEvaluating(true);
    setEvaluatorError(null);
    setFinishEvaluationFailed(false);
    try {
      // Until the Backend session has loaded a P2P room looks like an AI one, where every human is the learner.
      // Polling has stopped by now (the debate is over), so this also fetches it for the retry.
      if (isBackendSession && !sessionDetails) {
        void loadBackendSession(numSessionId);
        throw new Error("chưa tải xong thông tin phiên tranh biện");
      }

      // Without the account every speech looks unidentifiable, which must not count as a data error.
      if (isP2pOr2v2 && currentUserId === null) {
        throw new Error("chưa tải xong thông tin tài khoản");
      }

      let gradedMessages = messages;
      if (isP2pOr2v2) {
        setGradingMessage("Đang kiểm tra bản ghi phiên tranh biện...");
        gradedMessages = await loadCompleteP2pTranscript();
      }

      // A speech that cannot be pinned on one person may be the user's own: dropping it would silently
      // change the score (or report "no speech"), so grading stops instead.
      if (
        isP2pOr2v2 &&
        gradedMessages.some((m) => getSpeakerRelation(m, participants ?? [], currentUserId) === "unknown")
      ) {
        throw new UnattributedSpeechError();
      }

      // The evaluator rejects a round without a learner turn: only rounds the user spoke in are graded,
      // the others are reported to it as skipped.
      const roundStages: Array<{ stage: DebateRoundType; round: number }> = [
        { stage: "opening", round: 1 },
        { stage: "rebuttal", round: 2 },
        { stage: "closing", round: 3 },
      ];
      const stagesWithTurns = roundStages.map((r) => ({
        ...r,
        turns: gradedMessages
          .filter((m) => m.roundNumber === r.round)
          .flatMap((m): ArgumentTurn[] => {
            const speaker = getEvaluatorSpeaker(m);
            return speaker ? [{ speaker, text: m.content }] : [];
          }),
      }));
      const hasLearnerTurn = (r: { turns: ArgumentTurn[] }) => r.turns.some((t) => t.speaker === "learner");
      const roundsToEvaluate = stagesWithTurns.filter(hasLearnerTurn);
      const skippedStages = stagesWithTurns.filter((r) => !hasLearnerTurn(r)).map((r) => r.stage);

      if (roundsToEvaluate.length === 0) {
        navigate(`/debater/debate/${sessionId}/result`, {
          state: { result: buildNoSpeechDebateResult(sessionId, motionText) },
        });
        return;
      }

      // Any evaluator failure (round or session) aborts the whole submission — no partial / invented score.
      // Steps that already succeeded are kept while their input is unchanged, so a retry only redoes the others.
      // The rounds are graded in parallel (each one also checks the learner's figures, which takes several
      // seconds). allSettled: a round that succeeded is cached even when another fails, so the retry skips it.
      const evidenceTopic = toEvidenceTopic(sessionDetails?.evidenceTopic);
      const totalRounds = roundsToEvaluate.length;
      let gradedRounds = 0;
      const showRoundProgress = () => setGradingMessage(`Đang chấm các vòng (xong ${gradedRounds}/${totalRounds})...`);
      const pendingRounds = roundsToEvaluate.map(async (r) => {
        const fingerprint = JSON.stringify({ turns: r.turns, topic: evidenceTopic ?? null });
        const cachedRound = finishRoundResultsRef.current.get(r.stage);
        if (cachedRound?.fingerprint === fingerprint) {
          gradedRounds += 1;
          return cachedRound.result;
        }
        const roundResult = await aiApi.evaluateDebateRound({
          motion: resolvedMotion,
          side: debaterSide,
          stage: r.stage,
          turns: r.turns,
          ...(evidenceTopic ? { topic: evidenceTopic } : {}),
        });
        finishRoundResultsRef.current.set(r.stage, { fingerprint, result: roundResult });
        gradedRounds += 1;
        showRoundProgress();
        return roundResult;
      });
      // Cached rounds are counted synchronously above, before the first request returns
      showRoundProgress();
      const settledRounds = await Promise.allSettled(pendingRounds);
      const failedRound = settledRounds.find((s): s is PromiseRejectedResult => s.status === "rejected");
      if (failedRound) throw failedRound.reason;
      const roundResults: RoundEvaluationResult[] = settledRounds.map(
        (s) => (s as PromiseFulfilledResult<RoundEvaluationResult>).value
      );

      const sessionFingerprint = JSON.stringify({ rounds: roundsToEvaluate.map((r) => r.turns), skippedStages });
      const cachedSession = finishSessionResultRef.current;
      let sessionResult: SessionEvaluationResult | null =
        cachedSession?.fingerprint === sessionFingerprint ? cachedSession.result : null;
      if (!sessionResult && roundResults.length > 0) {
        setGradingMessage("Đang tổng hợp kết quả...");
        sessionResult = await aiApi.evaluateDebateSession({
          motion: resolvedMotion,
          side: debaterSide,
          rounds: roundResults,
          ...(skippedStages.length > 0 ? { skipped_stages: skippedStages } : {}),
        });
        finishSessionResultRef.current = { fingerprint: sessionFingerprint, result: sessionResult };
      }

      const debateResultPayload = buildDebateResult({
        sessionId,
        topicTitle: motionText,
        sessionResult,
        roundResults,
        lastTurnEvaluation: evaluationResult,
        skippedStages,
      });
      if (!debateResultPayload) {
        throw new Error("AI Evaluator không trả về điểm tổng kết.");
      }

      finishRoundResultsRef.current.clear();
      finishSessionResultRef.current = null;
      navigate(`/debater/debate/${sessionId}/result`, {
        state: { result: debateResultPayload },
      });
    } catch (finishErr) {
      console.error("Error evaluating debate session:", finishErr);
      if (finishErr instanceof UnattributedSpeechError) {
        setIsGradingBlocked(true);
        return;
      }
      setFinishEvaluationFailed(true);
      setEvaluatorError(
        `${FINISH_EVALUATION_ERROR} (${getErrorMessage(finishErr, "lỗi không xác định")})`
      );
    } finally {
      isFinishingRef.current = false;
      setGradingMessage(null);
      setIsEvaluating(false);
    }
  };

  // Closing / refreshing the tab while the final grading runs would lose it: ask for confirmation.
  // (The route guard of the debate room is for a debate in progress; this one only covers the grading.)
  const isGrading = gradingMessage !== null;
  useEffect(() => {
    if (!isGrading) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isGrading]);

  // Team Roster Groups for DebateSidebar (when in 1v1 / 2v2 / competition mode)
  const proTeamGroup: DebateTeamGroup = {
    teamName: "Đội Ủng hộ (PRO)",
    members:
      proParticipants.length > 0
        ? proParticipants.map((p, idx) => ({
            speakerName: p.speakerName || `Debater PRO ${idx + 1}`,
            isCurrentUser: isSameUserId(p.userId, currentUserId),
            roleTag: isSameUserId(p.userId, sessionDetails?.createdByUserId) ? "Chủ phòng" : `PRO ${idx + 1}`,
            isAI: p.isAI,
          }))
        : [
            {
              speakerName: debaterSide === "pro" ? "Bạn" : "Đối thủ AI",
              isCurrentUser: debaterSide === "pro",
              roleTag: "PRO 1",
              isAI: debaterSide !== "pro",
            },
          ],
  };

  const conTeamGroup: DebateTeamGroup = {
    teamName: "Đội Phản đối (CON)",
    members:
      conParticipants.length > 0
        ? conParticipants.map((p, idx) => ({
            speakerName: p.speakerName || `Debater CON ${idx + 1}`,
            isCurrentUser: isSameUserId(p.userId, currentUserId),
            roleTag: isSameUserId(p.userId, sessionDetails?.createdByUserId) ? "Chủ phòng" : `CON ${idx + 1}`,
            isAI: p.isAI,
          }))
        : [
            {
              speakerName: debaterSide === "con" ? "Bạn" : "Đối thủ AI",
              isCurrentUser: debaterSide === "con",
              roleTag: "CON 1",
              isAI: debaterSide !== "con",
            },
          ],
  };


  // Blocking failures keep a banner on screen even after the transient message was dismissed
  const bannerText =
    roomFeedback?.text ||
    (isGradingBlocked ? GRADING_BLOCKED_ERROR : null) ||
    (EffectiveDebateCompleted ? null : opponentError) ||
    evaluatorError ||
    (opponentInitFailed && !EffectiveDebateCompleted ? "Chưa kết nối được Đối thủ AI. Vui lòng thử lại." : null) ||
    (pendingTurnEvaluation ? TURN_EVALUATION_ERROR : null) ||
    (finishEvaluationFailed ? FINISH_EVALUATION_ERROR : null);

  if (sessionId.startsWith("session-comp-")) {
    return (
      <div className="min-h-[500px] bg-slate-50 flex flex-col items-center justify-center p-6 text-center rounded-2xl border border-slate-200 shadow-xs m-4">
        <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mb-4 shadow-xs">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-900 mb-2">Định danh phòng thi không hợp lệ</h2>
        <p className="text-xs sm:text-sm text-slate-600 max-w-md mb-6 leading-relaxed">
          Đường dẫn dạng <code className="px-1.5 py-0.5 bg-slate-200 rounded font-mono">{sessionId}</code> là định danh cũ không còn sử dụng.
          Mỗi trận đấu trong giải đấu có một phiên tranh biện (DebateSession ID) riêng biệt. 
          Vui lòng quay lại trang Giải đấu để xem nhánh đấu và tham gia đúng trận của bạn.
        </p>
        <button
          onClick={() => navigate("/debater/competitions")}
          className="px-5 py-2.5 bg-[#008A64] hover:bg-[#007457] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          Trở về Danh sách Giải đấu
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-5.5rem)] min-h-[580px] bg-white dark:bg-[#0B1813] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
      {/* 1. COMPACT STICKY HEADER */}
      <DebateHeader
        motionText={motionText}
        mode={roomMode}
        userRoleInRoom={userRoleInRoom}
        debaterSide={debaterSide}
        currentRound={currentRound}
        secondsRemaining={secondsRemaining}
        canSpeak={canSpeak}
        isTurnExpired={EffectiveExpired}
        isAiGenerating={isAiGenerating || isWaitingForAiFirstTurn}
        isSubmitting={isSubmitting}
        isWaitingForOpponent={
          isP2pOr2v2
            ? !isMyP2pTurn
            : isWaitingForOpponentInAiMode && !isAiGenerating && !isWaitingForAiFirstTurn
        }
        isEvaluating={isEvaluating}
        isDebateCompleted={EffectiveDebateCompleted}
        canSubmitDebate={EffectiveDebateCompleted && !isGradingBlocked}
        onExit={() => requestExit("/debater/dashboard")}
        onSubmitDebate={handleFinishDebate}
      />

      {/* Reconnecting Indicator */}
      {isReconnecting && isDebateActivelyInProgress && (
        <div
          data-testid="debate-reconnecting-indicator"
          className="px-4 py-1.5 bg-amber-50/90 dark:bg-amber-950/40 border-b border-amber-200/80 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center justify-center gap-2 shrink-0"
        >
          <Loader2 size={13} className="animate-spin text-amber-600" />
          <span>Đang kết nối lại phiên tranh biện... Thời gian và nội dung tranh biện được giữ nguyên.</span>
        </div>
      )}

      {isSessionCancelled && (
        <div
          role="status"
          data-testid="debate-cancelled-notice"
          className="px-4 py-2 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200/80 dark:border-rose-800/50 text-xs font-semibold text-rose-700 dark:text-rose-300"
        >
          Phiên tranh biện này đã bị huỷ vì có người rời trận. Không thể tiếp tục.
        </div>
      )}

      {/* Compact Toast / Timeout / Error Strip */}
      {bannerText && (
        <div
          data-testid="debate-feedback-banner"
          className={`px-4 py-2 border-b text-xs flex items-center justify-between gap-2 shrink-0 ${
            roomFeedback?.type === "success"
              ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200/70 dark:border-emerald-800/50"
              : "bg-rose-50/80 dark:bg-rose-950/30 border-rose-200/70 dark:border-rose-800/50"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle
              size={14}
              className={
                roomFeedback?.type === "success"
                  ? "text-[#008A64] shrink-0"
                  : "text-rose-600 dark:text-rose-400 shrink-0"
              }
            />
            <span className="text-slate-800 dark:text-slate-200 font-medium truncate">
              {bannerText}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {opponentError && pendingAiTurn && !isAiGenerating && (
              <button
                type="button"
                data-testid="retry-ai-turn-btn"
                onClick={() => executeAiOpponentTurn(pendingAiTurn)}
                className="px-2.5 py-1 rounded-lg bg-[#008A64] hover:bg-[#007457] text-white font-semibold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RefreshCw size={11} />
                <span>Thử lại</span>
              </button>
            )}

            {opponentError && pendingAiRecord && !isAiGenerating && (
              <button
                type="button"
                data-testid="retry-ai-record-btn"
                onClick={() => executeAiOpponentTurn(pendingAiRecord.ctx, pendingAiRecord.speechText)}
                className="px-2.5 py-1 rounded-lg bg-[#008A64] hover:bg-[#007457] text-white font-semibold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RefreshCw size={11} />
                <span>Thử lại</span>
              </button>
            )}

            {opponentInitFailed && !isAiGenerating && (
              <button
                type="button"
                data-testid="retry-opponent-init-btn"
                onClick={() => setOpponentInitNonce((n) => n + 1)}
                className="px-2.5 py-1 rounded-lg bg-[#008A64] hover:bg-[#007457] text-white font-semibold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RefreshCw size={11} />
                <span>Thử lại</span>
              </button>
            )}

            {pendingTurnEvaluation && !isEvaluating && (
              <button
                type="button"
                data-testid="retry-turn-evaluation-btn"
                onClick={() => runTurnEvaluation(pendingTurnEvaluation)}
                className="px-2.5 py-1 rounded-lg bg-[#008A64] hover:bg-[#007457] text-white font-semibold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RefreshCw size={11} />
                <span>Thử lại</span>
              </button>
            )}

            {finishEvaluationFailed && !isEvaluating && (
              <button
                type="button"
                data-testid="retry-finish-evaluation-btn"
                onClick={handleFinishDebate}
                className="px-2.5 py-1 rounded-lg bg-[#008A64] hover:bg-[#007457] text-white font-semibold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RefreshCw size={11} />
                <span>Thử lại</span>
              </button>
            )}

            {!isP2pOr2v2 &&
              !isBackendSession &&
              EffectiveExpired &&
              !EffectiveDebateCompleted &&
              currentRound < 3 && (
                <button
                  type="button"
                  onClick={handleAdvanceTimedOutRound}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>
                    Sang Vòng {currentRound + 1} (
                    {currentRound === 1 ? "Phản biện" : "Kết luận"})
                  </span>
                  <ArrowRight size={12} />
                </button>
              )}

            <button
              type="button"
              onClick={() => {
                setRoomFeedback(null);
                setOpponentError(null);
                setEvaluatorError(null);
              }}
              className="text-slate-400 hover:text-slate-600 cursor-pointer shrink-0"
              aria-label="Đóng thông báo"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── LOBBY / WAITING ROOM (Khi phòng P2P / 2v2 chưa bắt đầu) ── */}
      {isLoadingBackendSession ? (
        <div
          data-testid="debate-lobby-loading"
          className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3"
        >
          <Loader2 size={28} className="animate-spin text-[#008A64]" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
            Đang kết nối vào phòng chờ tranh biện...
          </p>
        </div>
      ) : isWaitingInLobby && sessionDetails ? (
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>Phòng chờ (Waiting)</span>
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {is2v2 ? "Tranh biện 2 vs 2" : "Đối kháng 1 vs 1 P2P"}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-[#F8FAFC]">
                {sessionDetails.title || motionText}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Kiến nghị:{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  &ldquo;{sessionDetails.topic || motionText}&rdquo;
                </span>
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-[#091713] rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center gap-3 shrink-0">
              <div>
                <p className="text-[11px] text-slate-400 font-medium">Mã phòng tranh biện</p>
                <p className="text-xl font-black font-mono text-[#008A64] dark:text-[#34D399]">
                  #{sessionDetails.sessionId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(String(sessionDetails.sessionId));
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                }}
                className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-[#12231C] border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1"
              >
                {copiedCode ? <Check size={14} className="text-[#008A64]" /> : <Copy size={14} />}
                <span>{copiedCode ? "Đã chép!" : "Copy mã"}</span>
              </button>
            </div>
          </div>

          {pendingSwapRequests.length > 0 && (
            <div className="space-y-2">
              {pendingSwapRequests.map((req, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm animate-fade-in"
                >
                  <div className="space-y-0.5">
                    <p className="font-bold text-purple-950 dark:text-purple-200">
                      Yêu cầu đổi phe từ {req.requesterName} (Phe {req.requesterSide})
                    </p>
                    <p className="text-purple-700 dark:text-purple-400 text-xs">
                      Thời gian còn lại: <strong>{req.expiresInSeconds}s</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRespondSwapRequest(req.requesterUserId, true)}
                      className="px-3 py-1.5 bg-[#008A64] text-white rounded-lg font-bold text-xs hover:bg-[#007457] transition-colors cursor-pointer"
                    >
                      Đồng ý đổi phe
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRespondSwapRequest(req.requesterUserId, false)}
                      className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-bold text-xs hover:bg-slate-300 transition-colors cursor-pointer"
                    >
                      Từ chối
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-[rgba(16,185,129,0.08)] border border-emerald-200/70 dark:border-emerald-800/40 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-emerald-100 dark:border-slate-800">
                <div className="flex items-center gap-2 font-bold text-[#008A64] dark:text-[#34D399] text-sm">
                  <Shield size={16} />
                  <span>Phe Ủng Hộ (PRO)</span>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                  {proParticipants.length}/{is2v2 ? 2 : 1}
                </span>
              </div>
              <div className="space-y-2">
                {proParticipants.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white dark:bg-[#12231C] rounded-xl border border-emerald-100 dark:border-slate-800 flex items-center justify-between text-xs sm:text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#008A64] text-white font-bold flex items-center justify-center text-xs">
                        {p.isAI ? "AI" : p.speakerName?.slice(0, 2).toUpperCase() || "U"}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-[#F8FAFC]">
                          {p.speakerName} {isSameUserId(p.userId, currentUserId) && "(Bạn)"}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {isSameUserId(p.userId, sessionDetails.createdByUserId)
                            ? "Chủ phòng (Host)"
                            : `Debater PRO ${idx + 1}`}
                        </p>
                      </div>
                    </div>
                    {is2v2 && mySide === 2 && p.userId !== undefined && p.userId !== null && (
                      <button
                        type="button"
                        onClick={() => handleSendSwapRequest(p.userId!)}
                        className="text-[11px] px-2.5 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg font-semibold transition-colors cursor-pointer"
                      >
                        Mời tráo phe
                      </button>
                    )}
                  </div>
                ))}
                {proParticipants.length < (is2v2 ? 2 : 1) && (
                  <div className="p-3 rounded-xl border border-dashed border-emerald-300 text-center text-xs text-emerald-700/70 py-4">
                    Đang chờ Debater tham gia slot PRO...
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-rose-50/60 dark:bg-[rgba(244,63,94,0.08)] border border-rose-200/70 dark:border-rose-800/40 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-rose-100 dark:border-slate-800">
                <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-400 text-sm">
                  <Flame size={16} />
                  <span>Phe Phản Đối (CON)</span>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                  {conParticipants.length}/{is2v2 ? 2 : 1}
                </span>
              </div>
              <div className="space-y-2">
                {conParticipants.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white dark:bg-[#12231C] rounded-xl border border-rose-100 dark:border-slate-800 flex items-center justify-between text-xs sm:text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-rose-600 text-white font-bold flex items-center justify-center text-xs">
                        {p.isAI ? "AI" : p.speakerName?.slice(0, 2).toUpperCase() || "U"}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 dark:text-[#F8FAFC]">
                          {p.speakerName} {isSameUserId(p.userId, currentUserId) && "(Bạn)"}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {isSameUserId(p.userId, sessionDetails.createdByUserId)
                            ? "Chủ phòng (Host)"
                            : `Debater CON ${idx + 1}`}
                        </p>
                      </div>
                    </div>
                    {is2v2 && mySide === 1 && p.userId !== undefined && p.userId !== null && (
                      <button
                        type="button"
                        onClick={() => handleSendSwapRequest(p.userId!)}
                        className="text-[11px] px-2.5 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg font-semibold transition-colors cursor-pointer"
                      >
                        Mời tráo phe
                      </button>
                    )}
                  </div>
                ))}
                {conParticipants.length < (is2v2 ? 2 : 1) && (
                  <div className="p-3 rounded-xl border border-dashed border-rose-300 text-center text-xs text-rose-700/70 py-4">
                    Đang chờ Debater tham gia slot CON...
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {is2v2 && (
                <button
                  type="button"
                  onClick={handleSwitchSide}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-[#CBD5E1] rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw size={14} />
                  <span>Đổi sang phe đối diện</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              {isHost ? (
                <button
                  type="button"
                  onClick={handleStartDebateSession}
                  disabled={!canHostStart || isStarting}
                  className="w-full sm:w-auto px-6 py-3 bg-[#008A64] hover:bg-[#007457] text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-[#008A64]/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isStarting ? <Loader2 size={16} className="animate-spin" /> : <Swords size={16} />}
                  <span>
                    {canHostStart
                      ? "Bắt đầu trận tranh biện ngay"
                      : `Chờ đủ người (${sessionDetails.participants.length}/${is2v2 ? 4 : 2})`}
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Bạn đã vào phòng. Đang chờ chủ phòng bắt đầu trận đấu...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ── MAIN CONVERSATION + COLLAPSIBLE AI ASSISTANCE PANEL ── */
        <div className="flex-1 flex min-h-0 relative overflow-hidden">
          {/* Primary Centered Chat Column */}
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <DebateChat
              messages={messages}
              mode={roomMode}
              debaterSide={debaterSide}
              currentRound={currentRound}
              isAiGenerating={isAiGenerating || isWaitingForAiFirstTurn}
              aiSide={aiSide}
              timedOutRounds={timedOutRounds}
              isTurnExpired={EffectiveExpired}
              isDebateCompleted={EffectiveDebateCompleted}
              canSubmitDebate={EffectiveDebateCompleted && !isGrading && !isGradingBlocked}
              evaluatingMessageId={evaluatingMessageId}
              isP2pOr2v2={isP2pOr2v2}
              onAdvanceTimedOutRound={isBackendSession ? undefined : handleAdvanceTimedOutRound}
              onSubmitDebate={handleFinishDebate}
            />

            <DebateComposer
              argumentText={argumentText}
              isAiGenerating={isAiGenerating || isWaitingForAiFirstTurn}
              isSubmitting={isSubmitting}
              isRecording={isRecording}
              isTurnExpired={EffectiveExpired}
              isDebateCompleted={EffectiveDebateCompleted}
              canSpeak={canSpeak && !isSessionCancelled}
              cannotSpeakReason={isSessionCancelled ? "Phiên tranh biện đã bị huỷ." : cannotSpeakReason}
              userRoleInRoom={userRoleInRoom}
              activeSidebarTab={isSidebarOpen ? sidebarTab : null}
              hasNewEvaluation={hasNewEvaluation}
              latestScore={evaluationResult?.overall_score ?? null}
              onArgumentChange={setArgumentText}
              onSend={handleSendArgument}
              onToggleRecording={() => setIsRecording((prev) => !prev)}
              onToggleAssistantTab={handleToggleAssistantTab}
            />
          </div>

          {/* Single Collapsible Right-Side Panel for AI Hints, Case Plan, and Evaluation */}
          <DebateSidebar
            isOpen={isSidebarOpen}
            mode={roomMode}
            userRoleInRoom={userRoleInRoom}
            activeTab={sidebarTab}
            proTeam={proTeamGroup}
            conTeam={conTeamGroup}
            currentRound={currentRound}
            casePlan={casePlan}
            evaluationResult={evaluationResult}
            isEvaluating={isEvaluating}
            evaluatorError={evaluatorError}
            coachingAdvice={coachingAdvice}
            onTabChange={(tab) => {
              setSidebarTab(tab);
              if (tab === "evaluator") setHasNewEvaluation(false);
            }}
            onClose={() => setIsSidebarOpen(false)}
            onRequestCoaching={handleRequestEvaluation}
          />
        </div>
      )}

      {gradingMessage !== null && <GradingOverlay message={gradingMessage} />}

      {/* Active-Debate Navigation Protection Confirmation Modal */}
      <LeaveDebateConfirmModal
        isOpen={isLeaveConfirmOpen}
        isLeaving={isLeaving}
        onStay={cancelLeave}
        onConfirmLeave={confirmLeave}
        {...(isDebateLeaveEnabled() && isBackendSession
          ? {
              title: isWaitingInLobby ? "Bạn có chắc muốn rời phòng chờ?" : "Bạn có chắc muốn rời trận tranh biện?",
              description: isP2pOr2v2
                ? "Nếu rời đi, phiên này sẽ bị huỷ cho tất cả người chơi và không thể tiếp tục."
                : "Nếu rời đi, phiên này sẽ bị huỷ và không thể tiếp tục. Lần sau vào lại chủ đề sẽ là một phiên mới.",
            }
          : {})}
      />
    </div>
  );
};

export default DebateRoom;

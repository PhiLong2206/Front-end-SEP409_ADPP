import React, { useState, useEffect, useCallback, useRef } from "react";
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
import { aiApi, debateApi } from "../../../api";
import { useAuth } from "../../../hooks/useAuth";
import {
  useDebateNavigationGuard,
  saveActiveDebateSession,
  clearActiveDebateSession,
} from "../../../hooks/useDebateNavigationGuard";
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
}

const ROUND_1_DEFAULT_SECONDS = 135; // 02:15
const SUBSEQUENT_ROUND_SECONDS = 120; // 02:00
const DEADLINE_STORAGE_PREFIX = "adpp_turn_deadline_";
const EXPIRED_STORAGE_PREFIX = "adpp_turn_expired_";
const TIMED_OUT_ROUNDS_PREFIX = "adpp_timed_out_rounds_";
const CURRENT_ROUND_PREFIX = "adpp_current_round_";
const COMPLETED_STORAGE_PREFIX = "adpp_debate_completed_";
const MESSAGES_STORAGE_PREFIX = "adpp_messages_";

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

const getFallbackAiSpeech = (round: number, aiSideStr: string, motion: string) => {
  if (round === 1) {
    return aiSideStr === "Ủng hộ"
      ? `Chào bạn, đối với kiến nghị "${motion}", phe chúng tôi khẳng định sự ủng hộ mạnh mẽ. Thứ nhất, việc triển khai chính sách này mang lại giải pháp căn cơ, thúc đẩy tiến bộ xã hội và giải quyết triệt để các hạn chế hiện hữu. Thứ hai, các nghiên cứu và kinh nghiệm thực tiễn đều chứng minh lợi ích dài hạn vượt trội hơn nhiều so với chi phí ban đầu.`
      : `Chào bạn, đối với kiến nghị "${motion}", phe phản đối chúng tôi cho rằng đây là một đề xuất chưa khả thi và tiềm ẩn rủi ro lớn. Thứ nhất, gánh nặng tài chính và áp lực hạ tầng là quá lớn. Thứ hai, chúng ta còn rất nhiều giải pháp thay thế an toàn, hiệu quả hơn chưa được khai thác. Do đó, chúng tôi phản đối kiến nghị này.`;
  } else if (round === 2) {
    return `Tôi ghi nhận những điểm bạn vừa trình bày, tuy nhiên lập luận đó chưa đủ tính thuyết phục. Thứ nhất, bạn chưa giải quyết được bài toán về tính khả thi và tác động thực tế đối với các bên liên quan. Thứ hai, việc quá nhấn mạnh vào lợi ích trước mắt mà bỏ qua rủi ro hệ thống sẽ gây ra những hệ quả khó lường. Phe chúng tôi kiên định giữ vững lập trường phản bác.`;
  } else {
    return `Tổng kết lại phiên tranh biện về kiến nghị "${motion}", điểm then chốt nằm ở việc cân bằng giữa lợi ích phát triển và mức độ kiểm soát rủi ro. Phe chúng tôi đã chứng minh tính nhất quán xuyên suốt 3 vòng rằng góc nhìn của chúng tôi mang lại giải pháp bền vững nhất. Cảm ơn bạn vì một lượt tranh biện rất kịch tính!`;
  }
};

const getFallbackEvaluation = (text: string, round: number, motion: string): ArgumentEvaluationResult => {
  const wordCount = text.trim().split(/\s+/).length;
  const isTooShort = wordCount < 5;
  const score = isTooShort ? 5.5 : Math.min(8.8, 7.2 + (wordCount > 15 ? 1.0 : 0.4));

  return {
    overall_score: score,
    overall_reasoning: isTooShort
      ? `Bài phát biểu còn quá ngắn (${wordCount} từ). Cần diễn giải luận điểm chi tiết hơn xoay quanh kiến nghị "${motion}".`
      : `Lập luận vòng ${round} thể hiện rõ quan điểm cá nhân, cấu trúc phản biện tương đối tốt. Cần bổ sung thêm dẫn chứng số liệu để tăng tính thuyết phục.`,
    criteria: [
      { name: "Logic & Cấu trúc", score: isTooShort ? 5.0 : 8.0, reasoning: isTooShort ? "Chưa đủ nội dung để đánh giá logic." : "Luận điểm rõ ràng, các ý liên kết mạch lạc." },
      { name: "Dẫn chứng thực tiễn", score: isTooShort ? 4.5 : 7.0, reasoning: "Cần dẫn chứng số liệu hoặc tiền lệ thực tế cụ thể hơn." },
      { name: "Kỹ năng phản biện", score: isTooShort ? 5.5 : 8.2, reasoning: "Nhận diện đúng trọng tâm luận đề tranh luận." },
    ],
    strengths: isTooShort ? ["Có nỗ lực tham gia lượt nói."] : ["Xác định đúng trọng tâm kiến nghị.", "Ngôn ngữ diễn đạt tự nhiên, tự tin."],
    weaknesses: isTooShort ? ["Nội dung quá ngắn, thiếu luận cứ."] : ["Chưa trích dẫn nguồn số liệu cụ thể.", "Cần phân tích sâu hơn về hệ quả lâu dài."],
    suggestions: [
      "Áp dụng cấu trúc PEEL (Point - Luận điểm, Explanation - Giải thích, Evidence - Bằng chứng, Link - Liên kết).",
      "Dự đoán trước phản biện của đối phương để chủ động rào đón.",
    ],
  };
};

const DebateRoom: React.FC = () => {
  const { sessionId = "demo-session" } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const roleParam = searchParams.get("role") || "PRO";
  const normalizedRole = roleParam.trim().toUpperCase();
  const difficultyParam = searchParams.get("difficulty") || "Trung bình";
  const motionParam = searchParams.get("motion") || "Mạng xã hội có gây hại nhiều hơn lợi ích?";
  const [motionText, setMotionText] = useState(motionParam);

  const debaterSide: BackendDebateSide =
    normalizedRole === "CON" || normalizedRole === "PHẢN ĐỐI" || normalizedRole === "2"
      ? "con"
      : "pro";
  const aiSide: BackendDebateSide = debaterSide === "pro" ? "con" : "pro";
  const difficulty: BackendDifficulty =
    difficultyParam === "Khó" ? "hard" : difficultyParam === "Dễ" ? "easy" : "medium";

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
  const isOpponentServiceAvailableRef = useRef<boolean>(true);

  const [pendingAiTurn, setPendingAiTurn] = useState<{
    roundNumber: number;
    stage: DebateRoundType;
    debaterTurnIndex: number;
    aiTurnIndex: number;
    debaterText: string;
  } | null>(null);

  // Microservice & Assistant Panel states
  const [, setAiOpponentStatus] = useState<string>("init");
  const [opponentError, setOpponentError] = useState<string | null>(null);
  const [evaluatorError, setEvaluatorError] = useState<string | null>(null);
  const [casePlan, setCasePlan] = useState<CaseFileResponse | null>(null);
  const [evaluationResult, setEvaluationResult] = useState<ArgumentEvaluationResult | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [sidebarTab, setSidebarTab] = useState<string>("evaluator");
  const [hasNewEvaluation, setHasNewEvaluation] = useState<boolean>(false);
  const [isAiOfflineMode, setIsAiOfflineMode] = useState<boolean>(false);

  // Auth & Backend Session Details State
  const { user } = useAuth();
  const currentUserId = user?.userId || (user?.id ? parseInt(String(user.id), 10) : 0);

  const [sessionDetails, setSessionDetails] = useState<DebateSessionResponse | null>(null);
  const [pendingSwapRequests, setPendingSwapRequests] = useState<SideSwapRequestResponse[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [roomFeedback, setRoomFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const numSessionId = parseInt(sessionId, 10);
  const isBackendSession = !isNaN(numSessionId) && numSessionId > 0;
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
  const myParticipant = sessionDetails?.participants.find((p) => p.userId === currentUserId);
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

  const isHost = Boolean(sessionDetails && sessionDetails.createdByUserId === currentUserId);
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
  const isMyP2pTurn =
    !isP2pOr2v2 || !sessionDetails
      ? true
      : sessionDetails.currentTurnSide === mySide ||
        (String(sessionDetails.currentTurnSide) === "PRO" &&
          (mySide === 1 || String(mySide) === "PRO")) ||
        (String(sessionDetails.currentTurnSide) === "CON" &&
          (mySide === 2 || String(mySide) === "CON"));

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
      (hasDebaterSpokenInCurrentRound && !hasOpponentSpokenInCurrentRound));

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
    !hasDebaterSpokenInCurrentRound;

  const canSpeak =
    userRoleInRoom === "Debater" &&
    (isP2pOr2v2
      ? isMyP2pTurn && !isSubmitting && !EffectiveDebateCompleted && !EffectiveExpired
      : isDebaterTurnInAiMode);

  const cannotSpeakReason =
    userRoleInRoom === "Judge"
      ? "Bạn đang ở chế độ Giám khảo theo dõi trận đấu (Read-only)."
      : userRoleInRoom === "Spectator"
      ? "Bạn đang ở chế độ Giám sát/Khán giả theo dõi trận đấu (Read-only)."
      : EffectiveDebateCompleted
      ? "Đã hoàn thành 3 vòng tranh biện. Nhấn 'Nộp bài' ở góc trên để xem kết quả."
      : isAiGenerating || isWaitingForAiFirstTurn
      ? "Đối thủ AI đang phản hồi..."
      : isSubmitting
      ? "Đang gửi lập luận..."
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

  const loadBackendSession = useCallback(async (numId: number) => {
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

        if (serverHasAi && (res.data.status === 1 || String(res.data.status) === "Waiting")) {
          debateApi.startDebateSession(numId).catch(() => {});
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
      }
    } catch (e) {
      if (isP2pOr2v2) {
        setIsReconnecting(true);
      }
      console.warn("Error fetching session details:", e);
    }
  }, [isP2pOr2v2]);

  const loadBackendTranscript = useCallback(
    async (numId: number) => {
      try {
        const res = await debateApi.getTranscript(numId);
        if (res?.success && res.data?.arguments && res.data.arguments.length > 0) {
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
                !arg.isAI && (!user?.fullName || arg.speakerName === user.fullName || !isP2pOr2v2),
            };
          });
          setMessages(loadedMsgs);
        }
      } catch (e) {
        console.warn("Error fetching transcript:", e);
      }
    },
    [user?.fullName, isP2pOr2v2]
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

      // AI Practice Mode: enforce round timeout & final round completion without fake AI speeches
      if (currentRound >= 3) {
        setIsDebateCompleted(true);
        setRoomFeedback({
          text: "Đã hết thời gian phát biểu ở Vòng 3 (Kết luận). Phiên tranh biện đã hoàn tất — nhấn 'Nộp bài' để xem kết quả.",
          type: "error",
        });
      } else {
        const nextRoundLabel = currentRound === 1 ? "Phản biện" : "Kết luận";
        setRoomFeedback({
          text: `Đã hết thời gian phát biểu ở Vòng ${currentRound} (${roundLabel}). Nhấn "Sang Vòng ${currentRound + 1} (${nextRoundLabel})" để tiếp tục.`,
          type: "error",
        });
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
    when: isDebateActivelyInProgress,
    defaultExitPath: "/debater/dashboard",
    onBeforeLeave: () => {
      clearActiveDebateSession(sessionId);
    },
  });

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
        if (isP2pOr2v2) {
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
    (isP2pOr2v2 || !hasDebaterSpokenInCurrentRound);

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
    if (isP2pOr2v2) {
      loadBackendTranscript(numSessionId);
    }

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
  }, [isBackendSession, isP2pOr2v2, numSessionId, sessionDetails?.status, loadBackendSession, loadBackendTranscript]);

  // Initialize session with AI Opponent Service on mount (only for AI mode when debate is active)
  useEffect(() => {
    if (!isAiSession) return;
    if (isP2pOr2v2) return;
    if (isWaitingInLobby || isLoadingBackendSession) return;

    let isMounted = true;
    const initOpponent = async () => {
      try {
        setOpponentError(null);
        setAiOpponentStatus("planning");
        const res = await aiApi.createOpponentSession({
          external_session_id: sessionId,
          motion: motionParam,
          learner_side: debaterSide,
          ai_side: aiSide,
          difficulty,
          language: "vi",
        });
        if (isMounted) {
          isOpponentServiceAvailableRef.current = true;
          setIsAiOfflineMode(false);
          setAiOpponentStatus(res.status || "ready");
        }

        // Fetch Case Plan from AI service
        try {
          const plan = await aiApi.getOpponentCasePlan(sessionId);
          if (isMounted && plan) {
            setCasePlan(plan);
          }
        } catch {
          // Case plan might still be generating
        }

        if (aiSide === "pro" && isMounted) {
          isAiGeneratingRef.current = true;
          setIsAiGenerating(true);
          try {
            const firstTurnRes = await aiApi.generateOpponentTurn(sessionId, {
              turn_index: 1,
              new_learner_speeches: [],
            });

            if (isMounted && firstTurnRes?.speech_text?.trim()) {
              const aiFirstMsg: DebateRoomMessage = {
                id: `msg-${Date.now()}`,
                speaker: "AI",
                speakerName: "Đối thủ AI",
                side: "Ủng hộ",
                stage: "Mở đầu",
                roundNumber: 1,
                timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
                content: firstTurnRes.speech_text,
                isCurrentUser: false,
              };
              setMessages((prev) => (prev.length === 0 ? [aiFirstMsg] : prev));
            }
          } catch {
            const fallbackSpeech = getFallbackAiSpeech(1, "Ủng hộ", motionParam);
            const aiFirstMsg: DebateRoomMessage = {
              id: `msg-${Date.now()}`,
              speaker: "AI",
              speakerName: "Đối thủ AI",
              side: "Ủng hộ",
              stage: "Mở đầu",
              roundNumber: 1,
              timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
              content: fallbackSpeech,
              isCurrentUser: false,
            };
            if (isMounted) {
              setMessages((prev) => (prev.length === 0 ? [aiFirstMsg] : prev));
              isOpponentServiceAvailableRef.current = false;
              setIsAiOfflineMode(true);
            }
          } finally {
            isAiGeneratingRef.current = false;
            if (isMounted) setIsAiGenerating(false);
          }
        }
      } catch {
        if (isMounted) {
          isOpponentServiceAvailableRef.current = false;
          setAiOpponentStatus("ready (mô phỏng)");
          setIsAiOfflineMode(true);
          setCasePlan({
            id: `case-${sessionId}`,
            session_id: sessionId,
            prompt_version: "v5",
            llm_provider: "local-simulation",
            llm_model: "fallback",
            temperature: 0.7,
            created_at: new Date().toISOString(),
            content: {
              case_summary: `Chiến lược tranh biện cho phe ${aiSide === "pro" ? "Ủng hộ" : "Phản đối"} kiến nghị: "${motionParam}".`,
              main_points: [
                { title: "Luận điểm trọng tâm", description: "Tập trung vào tính khả thi, hiệu quả thực tế và bảo đảm an toàn hệ thống." },
                { title: "Luận điểm bổ trợ", description: "Củng cố bằng các bài học kinh nghiệm quốc tế và mục tiêu phát triển bền vững." },
              ],
              predicted_learner_arguments: [
                { point: "Quan ngại về chi phí và tính rủi ro", planned_rebuttal: "Chứng minh rằng việc chủ động triển khai với quy chuẩn kiểm soát nghiêm ngặt sẽ mang lại giá trị cao hơn nhiều." },
              ],
            } as any,
          });

          if (aiSide === "pro") {
            const fallbackSpeech = getFallbackAiSpeech(1, "Ủng hộ", motionParam);
            const aiFirstMsg: DebateRoomMessage = {
              id: `msg-${Date.now()}`,
              speaker: "AI",
              speakerName: "Đối thủ AI",
              side: "Ủng hộ",
              stage: "Mở đầu",
              roundNumber: 1,
              timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
              content: fallbackSpeech,
              isCurrentUser: false,
            };
            setMessages((prev) => (prev.length === 0 ? [aiFirstMsg] : prev));
          }
        }
      }
    };

    initOpponent();
    return () => {
      isMounted = false;
    };
  }, [
    sessionId,
    motionParam,
    debaterSide,
    aiSide,
    difficulty,
    isAiSession,
    isP2pOr2v2,
    isWaitingInLobby,
    isLoadingBackendSession,
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
        writeStoredValue(DEADLINE_STORAGE_PREFIX + nextTurnKey, String(nextDeadlineMs));
        removeStoredValue(EXPIRED_STORAGE_PREFIX + nextTurnKey);

        handledTimeoutKeyRef.current = null;
        setIsTurnExpired(false);
        setSecondsRemaining(SUBSEQUENT_ROUND_SECONDS);
        setCurrentRound(nextRound);
      }
    },
    [debaterSide, sessionId]
  );

  const appendOpponentMessageAndAdvance = useCallback(
    (roundBeingCompleted: number, speechText: string) => {
      const aiResponseRound =
        debaterSide === "con" ? Math.min(3, roundBeingCompleted + 1) : roundBeingCompleted;
      const aiResponseStage =
        aiResponseRound === 1 ? "Mở đầu" : aiResponseRound === 2 ? "Phản biện" : "Kết luận";

      const aiResponseMsg: DebateRoomMessage = {
        id: `msg-ai-r${aiResponseRound}-${Date.now()}`,
        speaker: "AI",
        speakerName: "Đối thủ AI",
        side: aiSide === "pro" ? "Ủng hộ" : "Phản đối",
        stage: aiResponseStage,
        roundNumber: aiResponseRound,
        timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        content: speechText,
        isCurrentUser: false,
      };

      setMessages((prev) => {
        const alreadyRecorded = prev.some(
          (m) => m.roundNumber === aiResponseRound && m.speaker === "AI" && Boolean(m.content?.trim())
        );
        return alreadyRecorded ? prev : [...prev, aiResponseMsg];
      });
      setPendingAiTurn(null);
      setOpponentError(null);
      advanceToNextRoundOrComplete(roundBeingCompleted);
    },
    [advanceToNextRoundOrComplete, aiSide, debaterSide]
  );

  const executeAiOpponentTurn = useCallback(
    async (ctx: {
      roundNumber: number;
      stage: DebateRoundType;
      debaterTurnIndex: number;
      aiTurnIndex: number;
      debaterText: string;
    }) => {
      // Prevent duplicate concurrent AI turn requests
      if (inFlightTurnIndexRef.current === ctx.aiTurnIndex) {
        return;
      }

      inFlightTurnIndexRef.current = ctx.aiTurnIndex;
      isAiGeneratingRef.current = true;
      setIsAiGenerating(true);
      setOpponentError(null);

      try {
        // If AI Opponent service was already unavailable at session start (offline simulation mode)
        if (isAiOfflineMode || !isOpponentServiceAvailableRef.current) {
          const aiResponseRound =
            debaterSide === "con" ? Math.min(3, ctx.roundNumber + 1) : ctx.roundNumber;
          const fallbackSpeech = getFallbackAiSpeech(
            aiResponseRound,
            aiSide === "pro" ? "Ủng hộ" : "Phản đối",
            motionText
          );
          appendOpponentMessageAndAdvance(ctx.roundNumber, fallbackSpeech);
          return;
        }

        const turnRes = await aiApi.generateOpponentTurn(sessionId, {
          turn_index: ctx.aiTurnIndex,
          new_learner_speeches: [
            {
              turn_index: ctx.debaterTurnIndex,
              round_type: ctx.stage,
              text: ctx.debaterText,
            },
          ],
        });

        const speechText = turnRes?.speech_text?.trim();
        if (!speechText) {
          throw new Error("Đối thủ AI không trả về nội dung phản hồi hợp lệ.");
        }

        appendOpponentMessageAndAdvance(ctx.roundNumber, speechText);
      } catch {
        // Keep session in waiting-for-opponent state on error/timeout — do NOT mark round or debate complete
        setPendingAiTurn(ctx);
        setOpponentError(
          "Không nhận được phản hồi từ Đối thủ AI (lỗi kết nối hoặc quá thời gian chờ). Vui lòng thử lại hoặc dùng phản hồi mô phỏng."
        );
      } finally {
        inFlightTurnIndexRef.current = null;
        isAiGeneratingRef.current = false;
        setIsAiGenerating(false);
        setIsSubmitting(false);
        isSubmittingRef.current = false;
      }
    },
    [
      aiSide,
      appendOpponentMessageAndAdvance,
      debaterSide,
      isAiOfflineMode,
      motionText,
      sessionId,
    ]
  );

  const handleFallbackAiTurn = useCallback(() => {
    if (!pendingAiTurn) return;
    isOpponentServiceAvailableRef.current = false;
    setIsAiOfflineMode(true);
    const aiResponseRound =
      debaterSide === "con"
        ? Math.min(3, pendingAiTurn.roundNumber + 1)
        : pendingAiTurn.roundNumber;
    const fallbackSpeech = getFallbackAiSpeech(
      aiResponseRound,
      aiSide === "pro" ? "Ủng hộ" : "Phản đối",
      motionText
    );
    appendOpponentMessageAndAdvance(pendingAiTurn.roundNumber, fallbackSpeech);
  }, [aiSide, appendOpponentMessageAndAdvance, debaterSide, motionText, pendingAiTurn]);

  const handleSendArgument = async () => {
    if (
      isSubmittingRef.current ||
      isAiGeneratingRef.current ||
      !argumentText.trim() ||
      !canSpeak ||
      EffectiveExpired ||
      secondsRemaining <= 0
    ) {
      if (EffectiveExpired || secondsRemaining <= 0) {
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
    removeStoredValue(DEADLINE_STORAGE_PREFIX + activeTurnKey);

    const roundAtSubmission = currentRound;
    const currentText = argumentText.trim();
    const stage: DebateRoundType =
      roundAtSubmission === 1 ? "opening" : roundAtSubmission === 2 ? "rebuttal" : "closing";

    // Precise turn indexing according to match_format (6 turns total)
    const debaterTurnIndex =
      debaterSide === "pro"
        ? roundAtSubmission === 1
          ? 1
          : roundAtSubmission === 2
          ? 3
          : 5
        : roundAtSubmission === 1
        ? 2
        : roundAtSubmission === 2
        ? 4
        : 6;

    const aiTurnIndex =
      debaterSide === "con" && roundAtSubmission === 3 ? 5 : debaterTurnIndex + 1;

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
    };

    setMessages((prev) => [...prev, newDebaterMsg]);
    setArgumentText("");

    // Persist argument to Backend .NET DebateController
    if (isBackendSession) {
      if (isP2pOr2v2) {
        try {
          const res = await debateApi.submitArgument(numSessionId, { content: currentText });
          if (res?.success && res.data) {
            setSessionDetails(res.data);
          } else if (res?.message) {
            setRoomFeedback({ text: res.message, type: "error" });
          }
          await loadBackendTranscript(numSessionId);
        } catch (err: unknown) {
          const e = err as { message?: string };
          setRoomFeedback({ text: e.message || "Lỗi khi nộp bài tranh biện.", type: "error" });
        } finally {
          setIsSubmitting(false);
          isSubmittingRef.current = false;
        }
        return;
      }

      debateApi.submitArgument(numSessionId, { content: currentText }).catch((err) => {
        console.warn("Backend submitArgument warning:", err);
      });
    }

    setIsEvaluating(true);
    setOpponentError(null);
    setEvaluatorError(null);

    // 1. Call AI Evaluator Microservice (POST /evaluate) — independent of AI Opponent turn state
    const opponentRecentSpeech =
      messages
        .filter((m) => m.speaker === "AI")
        .slice(-1)[0]?.content || null;

    aiApi
      .evaluateSpeechArgument({
        motion: motionParam,
        side: debaterSide,
        stage,
        argument_text: currentText,
        opponent_argument_text: opponentRecentSpeech,
      })
      .then((res) => {
        setEvaluationResult(res);
        setHasNewEvaluation(true);
      })
      .catch(() => {
        const fallbackEval = getFallbackEvaluation(currentText, roundAtSubmission, motionText);
        setEvaluationResult(fallbackEval);
        setHasNewEvaluation(true);
      })
      .finally(() => {
        setIsEvaluating(false);
      });

    // 2. Call AI Opponent Microservice (POST /opponent/sessions/{id}/turns)
    // If debater is CON and at Round 3 (Turn 6), complete ONLY if AI (PRO) has already spoken in Round 3 (Turn 5)
    if (debaterSide === "con" && roundAtSubmission === 3 && hasOpponentSpokenInRound(3)) {
      isAiGeneratingRef.current = false;
      setIsAiGenerating(false);
      setIsSubmitting(false);
      setIsTurnExpired(false);
      setIsDebateCompleted(true);
      setSecondsRemaining(0);
      isSubmittingRef.current = false;
      return;
    }

    await executeAiOpponentTurn({
      roundNumber: roundAtSubmission,
      stage,
      debaterTurnIndex,
      aiTurnIndex,
      debaterText: currentText,
    });
  };

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

  const handleRequestEvaluation = useCallback(() => {
    const latestDebaterMsg = messages.filter((m) => m.speaker === "Debater").slice(-1)[0];
    if (!latestDebaterMsg) return;
    setIsEvaluating(true);
    setEvaluatorError(null);
    aiApi
      .evaluateSpeechArgument({
        motion: motionParam,
        side: debaterSide,
        stage: currentRound === 1 ? "opening" : currentRound === 2 ? "rebuttal" : "closing",
        argument_text: latestDebaterMsg.content,
        opponent_argument_text: messages.filter((m) => m.speaker === "AI").slice(-1)[0]?.content || null,
      })
      .then((res) => {
        setEvaluationResult(res);
      })
      .catch((err: unknown) => {
        const errorObj = err as { response?: { status?: number; data?: { detail?: string } }; message?: string };
        setEvaluatorError(
          `AI Evaluator (${errorObj.response?.status || "Lỗi"}): ${errorObj.response?.data?.detail || errorObj.message}`
        );
      })
      .finally(() => {
        setIsEvaluating(false);
      });
  }, [messages, motionParam, debaterSide, currentRound]);

  const handleFinishDebate = async () => {
    if (!EffectiveDebateCompleted || isAiGeneratingRef.current || isSubmittingRef.current) {
      return;
    }
    setIsEvaluating(true);
    try {
      const round1Msgs = messages.filter((m) => m.roundNumber === 1);
      const round2Msgs = messages.filter((m) => m.roundNumber === 2);
      const round3Msgs = messages.filter((m) => m.roundNumber === 3);

      const roundsToEvaluate: Array<{ stage: DebateRoundType; msgs: DebateRoomMessage[] }> = [
        { stage: "opening", msgs: round1Msgs },
        { stage: "rebuttal", msgs: round2Msgs },
        { stage: "closing", msgs: round3Msgs },
      ].filter((r) => r.msgs.length > 0) as Array<{ stage: DebateRoundType; msgs: DebateRoomMessage[] }>;

      const roundResults: RoundEvaluationResult[] = [];
      for (const r of roundsToEvaluate) {
        const turns: ArgumentTurn[] = r.msgs.map((m) => ({
          speaker: (m.speaker === "Debater" ? "learner" : "opponent") as TurnSpeaker,
          text: m.content,
        }));
        if (turns.length > 0) {
          try {
            const res = await aiApi.evaluateDebateRound({
              motion: motionParam,
              side: debaterSide,
              stage: r.stage,
              turns,
            });
            roundResults.push(res);
          } catch (roundErr) {
            console.warn("AI Evaluator round error:", roundErr);
          }
        }
      }

      let sessionResult: SessionEvaluationResult | null = null;
      if (roundResults.length > 0) {
        try {
          sessionResult = await aiApi.evaluateDebateSession({
            motion: motionParam,
            side: debaterSide,
            rounds: roundResults,
          });
        } catch (sessionErr) {
          console.warn("AI Evaluator session error:", sessionErr);
        }
      }

      const overallScore100 = sessionResult
        ? Math.round(sessionResult.overall_score * 10)
        : evaluationResult
        ? Math.round(evaluationResult.overall_score * 10)
        : hasDebaterSpoken
        ? 75
        : 0;

      const criteriaScores = evaluationResult?.criteria || roundResults[0]?.criteria || [];
      const getCriteriaScore = (name: string) => {
        const found = criteriaScores.find((c: { name: string; score: number }) =>
          c.name.toLowerCase().includes(name.toLowerCase())
        );
        return found ? found.score * 20 : hasDebaterSpoken ? 70 : 0;
      };

      const debateResultPayload = {
        sessionId,
        topicTitle: motionText,
        overallScore: overallScore100,
        ratingText:
          overallScore100 >= 80 ? "Xuất sắc" : overallScore100 >= 65 ? "Khá tốt" : "Cần cải thiện",
        scores: {
          logic: getCriteriaScore("logic"),
          evidence: getCriteriaScore("evidence"),
          relevance: getCriteriaScore("relevance"),
          structure: getCriteriaScore("structure"),
          persuasiveness: getCriteriaScore("persuasiveness"),
        },
        strengths:
          sessionResult?.overall_strengths?.length
            ? sessionResult.overall_strengths
            : evaluationResult?.strengths?.length
            ? evaluationResult.strengths
            : hasDebaterSpoken
            ? ["Luận điểm bám sát trọng tâm kiến nghị tranh biện."]
            : ["Chưa ghi nhận lập luận hoàn chỉnh do hết thời gian phát biểu."],
        improvements:
          sessionResult?.overall_weaknesses?.length
            ? sessionResult.overall_weaknesses
            : evaluationResult?.weaknesses?.length
            ? evaluationResult.weaknesses
            : ["Cần quản lý thời gian tốt hơn và củng cố số liệu, ví dụ minh họa thực tế."],
        progressTrend: sessionResult?.progress_trend || evaluationResult?.overall_reasoning,
        stageBreakdown: sessionResult?.stage_breakdown,
        criteriaList: criteriaScores,
      };

      navigate(`/debater/debate/${sessionId}/result`, {
        state: { result: debateResultPayload },
      });
    } catch {
      navigate(`/debater/debate/${sessionId}/result`);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Team Roster Groups for DebateSidebar (when in 1v1 / 2v2 / competition mode)
  const proTeamGroup: DebateTeamGroup = {
    teamName: "Đội Ủng hộ (PRO)",
    members:
      proParticipants.length > 0
        ? proParticipants.map((p, idx) => ({
            speakerName: p.speakerName || `Debater PRO ${idx + 1}`,
            isCurrentUser: p.userId === currentUserId,
            roleTag: p.userId === sessionDetails?.createdByUserId ? "Chủ phòng" : `PRO ${idx + 1}`,
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
            isCurrentUser: p.userId === currentUserId,
            roleTag: p.userId === sessionDetails?.createdByUserId ? "Chủ phòng" : `CON ${idx + 1}`,
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

  const hasDebaterSpoken = messages.some((m) => m.speaker === "Debater");

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
        canSubmitDebate={EffectiveDebateCompleted}
        isAiOfflineMode={isAiOfflineMode}
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

      {/* Compact Toast / Timeout / Error Strip */}
      {(roomFeedback || opponentError || (!isAiOfflineMode && evaluatorError)) && (
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
              {roomFeedback?.text || opponentError || evaluatorError}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {opponentError && pendingAiTurn && !isAiGenerating && (
              <>
                <button
                  type="button"
                  data-testid="retry-ai-turn-btn"
                  onClick={() => executeAiOpponentTurn(pendingAiTurn)}
                  className="px-2.5 py-1 rounded-lg bg-[#008A64] hover:bg-[#007457] text-white font-semibold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RefreshCw size={11} />
                  <span>Thử lại</span>
                </button>
                <button
                  type="button"
                  data-testid="fallback-ai-turn-btn"
                  onClick={handleFallbackAiTurn}
                  className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-800 text-white font-semibold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Phản hồi mô phỏng</span>
                </button>
              </>
            )}

            {!isP2pOr2v2 &&
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
                          {p.speakerName} {p.userId === currentUserId && "(Bạn)"}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {p.userId === sessionDetails.createdByUserId
                            ? "Chủ phòng (Host)"
                            : `Debater PRO ${idx + 1}`}
                        </p>
                      </div>
                    </div>
                    {is2v2 && mySide === 2 && p.userId && (
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
                          {p.speakerName} {p.userId === currentUserId && "(Bạn)"}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {p.userId === sessionDetails.createdByUserId
                            ? "Chủ phòng (Host)"
                            : `Debater CON ${idx + 1}`}
                        </p>
                      </div>
                    </div>
                    {is2v2 && mySide === 1 && p.userId && (
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
              canSubmitDebate={EffectiveDebateCompleted}
              isP2pOr2v2={isP2pOr2v2}
              onAdvanceTimedOutRound={handleAdvanceTimedOutRound}
              onSubmitDebate={handleFinishDebate}
            />

            <DebateComposer
              argumentText={argumentText}
              isAiGenerating={isAiGenerating || isWaitingForAiFirstTurn}
              isSubmitting={isSubmitting}
              isRecording={isRecording}
              isTurnExpired={EffectiveExpired}
              isDebateCompleted={EffectiveDebateCompleted}
              canSpeak={canSpeak}
              cannotSpeakReason={cannotSpeakReason}
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

      {/* Active-Debate Navigation Protection Confirmation Modal */}
      <LeaveDebateConfirmModal
        isOpen={isLeaveConfirmOpen}
        isLeaving={isLeaving}
        onStay={cancelLeave}
        onConfirmLeave={confirmLeave}
      />
    </div>
  );
};

export default DebateRoom;

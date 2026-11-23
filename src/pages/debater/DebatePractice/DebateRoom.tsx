import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  Shield,
  Flame,
  Swords,
  RefreshCw,
  Copy,
  Check,
  X,
  Loader2,
  ArrowRight,
  Volume2,
  VolumeX,
} from "lucide-react";
import DebateHeader from "../../../components/debate/DebateHeader";
import DebateChat from "../../../components/debate/DebateChat";
import DebateComposer from "../../../components/debate/DebateComposer";
import DebateSidebar from "../../../components/debate/DebateSidebar";
import { CoachingAdvice } from "../../../components/debate/AICoachingPanel";
import LeaveDebateConfirmModal from "../../../components/debate/LeaveDebateConfirmModal";
import { aiApi, debateApi } from "../../../api";
import { AI_MULTIMODAL_BASE_URL, isAiTurnStreamEnabled } from "../../../api/aiApi";
import {
  AudioSentenceSpeaker,
  fetchServerVoices,
  getSpeechSynthesis,
  loadVietnameseVoice,
  makeServerAudioFetcher,
  pickServerVoice,
  readStoredReadAloud,
  readStoredVoice,
  SentenceQueue,
  SentenceSpeaker,
  storeReadAloud,
  type ServerVoiceOption,
  voiceOptionLabel,
} from "../../../services/speechOut";
import { debateHubService } from "../../../services/debateHub";
import type { RoundStartedEvent } from "../../../types/debate.types";
import PreparationPanel from "../../../components/debate/room/PreparationPanel";
import RoomLoadingPanel from "../../../components/debate/room/RoomLoadingPanel";
import { useSharedDeviceStream } from "./useSharedDeviceStream";
import RoundStatusBar from "../../../components/debate/room/RoundStatusBar";
import {
  DEFAULT_TOTAL_ROUNDS,
  hasShownRoundBanner,
  markRoundBannerShown,
  roundLabelOf,
  secondsUntilServerTime,
  serverClockOffsetMs,
  serverTimeToLocalMs,
} from "../../../utils/debatePreparation";
import {
  pickSupportedAudioMimeType,
  RealtimeSttClient,
  RealtimeSttStatus,
  resolveTurnSpeechInput,
} from "../../../services/realtimeStt";
import { useAuth } from "../../../hooks/useAuth";
import { getSpeakerRelation, isSameUserId } from "../../../utils/debateSpeaker";
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
  TurnSpeaker,
  DebateSessionResponse,
  SideSwapRequestResponse,
  DebateRoomMode,
  DebateRoleInRoom,
  DebateTeamGroup,
  DeliveryAnalytics,
  EmotionSample,
  FrameAnalysisResult,
  MultimodalTurnResult,
  CoachingResult,
} from "../../../types";
import type { CreateTurnRequest, TurnResponse } from "../../../types";
import { getErrorMessage } from "../../../utils/debateScoring";
import { recordAiArgument } from "../../../utils/recordAiArgument";
import { getDebateErrorMessage, isPreparationInProgressError, PREPARATION_IN_PROGRESS_MESSAGE } from "../../../utils/debateErrors";
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
  opponentTurnErrorMessage,
  isPlanningConflict,
  isSessionDataConflict,
  normalizeMotion,
  retryWhilePlanning,
  waitUntilOpponentReady,
  parseDifficulty,
} from "../../../utils/opponentReadiness";

/** The AI turn a reader speaks: `turn` is the marker object of that request, `stage` 1-3 (opening, rebuttal, closing). */
interface ReaderMeta {
  turn: object;
  turnIndex: number | null;
  stage: number;
}

const STAGE_NAMES = ["", "Mở đầu", "Phản biện", "Kết luận"];

/** One AI turn of a chain that follows a learner turn (see getAiTurnsAfterLearnerTurn). */
interface AiTurnContext {
  /** Round of the learner turn that triggered the chain; the debate advances from it when the chain ends. */
  learnerRound: number;
  /** Backend turnIndex (0-based) the AI speaks now. */
  aiTurnIndex: number;
  /** Fallback only (no Backend session): AI turns that follow back-to-back. Otherwise the Backend decides. */
  remainingAiTurns: number[];
  /** Learner speech sent with the FIRST AI turn of the chain only (`turn_index` is the opponent service's, 1-based). */
  learnerSpeech?: { turn_index: number; round_type: DebateRoundType; text: string; skipped?: boolean };
}

/** Everything needed to (re)run the evaluation of one submitted turn. */
/**
 * handleSendArgument options. A recording that just stopped sends its speech, analysis and length directly: the
 * matching state (argumentText, multimodalResult, recordedDurationSeconds) is set in the same tick and not read yet.
 */
interface SendArgumentOptions {
  auto?: boolean;
  fallbackText?: string;
  text?: string;
  multimodal?: MultimodalTurnResult | null;
  durationSeconds?: number;
}

interface TurnEvaluationContext {
  /** The learner message being evaluated (shows the small "grading this turn" indicator). */
  messageId?: string;
  stage: DebateRoundType;
  argumentText: string;
  opponentText: string | null;
  durationSeconds?: number;
  deliveryAnalytics?: DeliveryAnalytics | null;
  multimodalResult?: MultimodalTurnResult | null;
}

const TURN_EVALUATION_ERROR = "Chưa chấm được lượt phát biểu này. Vui lòng thử lại.";

const FINISH_EVALUATION_ERROR = "Chưa chấm được kết quả tranh biện. Vui lòng thử lại.";
const OPPONENT_SPEECH_MISMATCH_ERROR =
  "Đối thủ AI đã tạo lượt này từ một bài nói khác nên phiên này không thể tiếp tục. Thử lại sẽ không khắc phục được, vui lòng quay lại và tạo phiên tranh biện mới.";
const OPPONENT_SESSION_ID_ERROR =
  "Không thể khởi tạo Đối thủ AI vì máy chủ không trả về thời điểm tạo phiên tranh biện. Vui lòng liên hệ quản trị viên.";

export interface DebateRoomMessage {
  id: string;
  argumentId?: number;
  speaker: "Debater" | "AI";
  speakerName: string;
  side: "Ủng hộ" | "Phản đối" | "PRO" | "CON";
  stage: "Mở đầu" | "Phản biện" | "Kết luận";
  roundNumber: number;
  timestamp: string;
  content: string;
  isCurrentUser?: boolean;
  isAI?: boolean;
  /** The transcript's userId, or the account id on a speech this client just submitted. */
  speakerUserId?: string | number;
  wordCount?: number | null;
  durationSeconds?: number | null;
  deliveryAnalytics?: DeliveryAnalytics | null;
}

const normalizeDeliveryAnalytics = (raw?: DeliveryAnalytics | null): DeliveryAnalytics | undefined => {
  if (!raw) return undefined;
  return {
    dominantEmotion: raw.dominantEmotion ?? raw.dominant_emotion ?? "neutral",
    eyeContactRate: raw.eyeContactRate ?? raw.eye_contact_rate ?? 0,
    composureScore: raw.composureScore ?? raw.composure_score ?? 0,
    confidenceScore: raw.confidenceScore ?? raw.confidence_score ?? 0,
    wpm: raw.wpm ?? 0,
    paceEvaluation: raw.paceEvaluation ?? raw.pace_evaluation ?? "",
    paceScore: raw.paceScore ?? raw.pace_score ?? 0,
    fillerCount: raw.fillerCount ?? raw.filler_count ?? 0,
    fluencyScore: raw.fluencyScore ?? raw.fluency_score ?? 100,
    overallDemeanorScore: raw.overallDemeanorScore ?? raw.overall_demeanor_score ?? 0,
    emotionBreakdown: raw.emotionBreakdown ?? raw.emotion_breakdown ?? {},
    dominant_emotion: raw.dominant_emotion ?? raw.dominantEmotion ?? "neutral",
    eye_contact_rate: raw.eye_contact_rate ?? raw.eyeContactRate ?? 0,
    composure_score: raw.composure_score ?? raw.composureScore ?? 0,
    confidence_score: raw.confidence_score ?? raw.confidenceScore ?? 0,
    pace_evaluation: raw.pace_evaluation ?? raw.paceEvaluation ?? "",
    pace_score: raw.pace_score ?? raw.paceScore ?? 0,
    filler_count: raw.filler_count ?? raw.fillerCount ?? 0,
    fluency_score: raw.fluency_score ?? raw.fluencyScore ?? 100,
    overall_demeanor_score: raw.overall_demeanor_score ?? raw.overallDemeanorScore ?? 0,
    emotion_breakdown: raw.emotion_breakdown ?? raw.emotionBreakdown ?? {},
  };
};

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

  // Preparation before Round 1: its clock is the server's (offset = server time - local time, from each response)
  const [prepSecondsLeft, setPrepSecondsLeft] = useState(0);
  const [prepClockExpired, setPrepClockExpired] = useState(false);
  const [isSkippingPreparation, setIsSkippingPreparation] = useState(false);
  const isSkippingPreparationRef = useRef(false);
  const serverOffsetRef = useRef(0);
  // The start of Round 1 on the server clock, kept after the preparation is over (the Round 1 deadline counts from it)
  const roundOneStartIsoRef = useRef<string | null>(null);
  const [roundBanner, setRoundBanner] = useState<{ round: number; label: string } | null>(null);
  const [lastRoundEvent, setLastRoundEvent] = useState<{ round: number; label: string; totalRounds: number } | null>(null);

  // Synchronous locks to prevent duplicate sends, concurrent AI turns & premature timeout triggers
  const isSubmittingRef = useRef(false);
  const isAiGeneratingRef = useRef(false);

  // AI turn streaming + reading aloud: Azure voice through the multimodal service, else the browser Vietnamese voice;
  // neither -> no read-aloud toggle
  const [liveAiSpeech, setLiveAiSpeech] = useState<string | null>(null);
  const [viVoice, setViVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [serverVoices, setServerVoices] = useState<ServerVoiceOption[]>([]);
  const hasServerVoice = serverVoices.length > 0;
  // Picked before the room on the topic page (AiVoicePicker); shown here, not changed
  const [aiVoice, setAiVoice] = useState<string | null>(null);
  const aiVoiceRef = useRef<string | null>(null);
  const currentVoice = serverVoices.find((v) => v.id === aiVoice);
  const currentVoiceLabel = currentVoice ? voiceOptionLabel(currentVoice) : aiVoice || "mặc định";
  const [readAloud, setReadAloud] = useState<boolean>(() => readStoredReadAloud());
  const readAloudRef = useRef(readAloud);
  const viVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const hasServerVoiceRef = useRef(false);
  // Settles once both voices are known (browser voice list, multimodal /tts/config): a turn that starts earlier
  // creates its reader then, and catches up with the text already streamed
  const voicesReadyRef = useRef<Promise<void>>(Promise.resolve());
  const currentAiTurnRef = useRef<object | null>(null);
  const speakerRef = useRef<SentenceQueue | null>(null);
  // Every reader still speaking (an AI turn read out while the next AI turn already streams), to stop them all at once
  // (a Map: insertion order is reading order; each reader knows which AI turn it reads)
  const activeReadersRef = useRef<Map<SentenceQueue, ReaderMeta>>(new Map());
  // The turn the reader being heard belongs to (its stage names the "skip" button)
  const [readingStage, setReadingStage] = useState<number | null>(null);
  // Which AI turn owns the live text (and so the reader a late-started or re-enabled voice creates)
  const liveTurnMetaRef = useRef<ReaderMeta | null>(null);
  // The AI is reading a turn aloud: the learner's clock waits, and starts afresh once the reading is over
  const [isAiReadingAloud, setIsAiReadingAloud] = useState(false);
  // Why the AI reading last stopped: only a reading that ends by itself, or that the learner skips, restarts the
  // preparation clock (a learner who starts recording, or turns read-aloud off, did not wait for the AI)
  const stopReasonRef = useRef<"recording" | "skip" | "toggle" | null>(null);
  // The AI just ended a round: the preparation minute restarts once its speech has been read (or skipped)
  const [restartCandidate, setRestartCandidate] = useState<{ key: string } | null>(null);
  const restartedKeysRef = useRef<Set<string>>(new Set());
  // The restart-preparation request is in flight: the clock shows again once it answers
  const [isRestartingPreparation, setIsRestartingPreparation] = useState(false);
  // The AI's record was refused while the preparation runs (older Backend): it is sent again after the minute
  const [isWaitingToRecordAi, setIsWaitingToRecordAi] = useState(false);
  const recordWaitedKeysRef = useRef<Set<string>>(new Set());
  const recordRetryTimerRef = useRef<number | null>(null);
  const preparationEndsAtRef = useRef<string | null>(null);
  const isAiPresentingRef = useRef(false);
  // Text of the AI turn streaming right now (null: none), so read-aloud turned on mid-turn can catch up
  const liveAiSpeechRef = useRef<string | null>(null);
  // The turn that owns the live text on screen: an older turn that ends late must not touch the newer turn's text
  const liveTurnRef = useRef<object | null>(null);
  // A new attempt of the AI turn: the old text stays (dimmed) until the first words of the new one arrive
  const [isAiRewriting, setIsAiRewriting] = useState(false);

  useEffect(() => {
    let alive = true;
    const browserVoice = loadVietnameseVoice().then((v) => {
      if (alive) {
        viVoiceRef.current = v;
        setViVoice(v);
      }
    });
    const serverVoice = fetchServerVoices(AI_MULTIMODAL_BASE_URL).then((offered) => {
      if (!alive || !offered) return;
      const voice = pickServerVoice(readStoredVoice(), offered);
      hasServerVoiceRef.current = true;
      aiVoiceRef.current = voice;
      setAiVoice(voice);
      setServerVoices(offered.voices);
    });
    voicesReadyRef.current = Promise.all([browserVoice, serverVoice]).then(() => undefined);
    return () => {
      alive = false;
      stopAllReading(); // only touches refs
      getSpeechSynthesis()?.cancel();
    };
  }, []);

  /** Stops every AI reading: the current turn and any earlier turn still being read out. */
  function stopAllReading() {
    for (const reader of activeReadersRef.current.keys()) reader.abort();
    activeReadersRef.current.clear();
    speakerRef.current = null;
    setIsAiReadingAloud(false);
    setReadingStage(null);
  }

  /** Mirrors the reader list into state: is the AI being heard, and which part. */
  function syncReadingState() {
    if (unmountedRef.current) return;
    const first = activeReadersRef.current.values().next().value as ReaderMeta | undefined;
    setIsAiReadingAloud(Boolean(first));
    setReadingStage(first ? first.stage : null);
  }

  /**
   * The learner has read the part the AI is reading: skip only that part. The next one (the closing after the
   * rebuttal) is held by its own reader and starts at once, because aborting a reader settles its whenDone().
   */
  const skipAiReading = useCallback(() => {
    const first = activeReadersRef.current.entries().next().value as [SentenceQueue, ReaderMeta] | undefined;
    if (!first) {
      // No voice yet (still loading): drop the turn marker so it does not start to read afterwards
      stopReasonRef.current = "skip";
      currentAiTurnRef.current = null;
      stopAllReading();
      return;
    }
    const [reader, meta] = first;
    reader.abort();
    activeReadersRef.current.delete(reader);
    if (speakerRef.current === reader) speakerRef.current = null;
    // The marker of a turn that is still being written (the closing) must stay: its voice is still to come
    if (currentAiTurnRef.current === meta.turn) currentAiTurnRef.current = null;
    // Only when nothing is left to read or write is this "the learner skipped it all"
    if (activeReadersRef.current.size === 0 && !isAiGeneratingRef.current) stopReasonRef.current = "skip";
    syncReadingState();
  }, []);

  /** Remembers a reader until it is done, so stopAllReading can reach it, and so the clock waits for it. */
  function trackReader(reader: SentenceQueue, meta: ReaderMeta) {
    activeReadersRef.current.set(reader, meta);
    stopReasonRef.current = null;
    syncReadingState();
    void reader.whenDone().then(() => {
      if (!activeReadersRef.current.delete(reader)) return;
      syncReadingState();
    });
  }

  /** A new reader for one AI turn: server voice with the browser voice as fallback, or the browser voice alone. */
  const makeSpeaker = useCallback((): SentenceQueue | null => {
    const synth = getSpeechSynthesis();
    const browser = synth && viVoiceRef.current ? new SentenceSpeaker(synth, viVoiceRef.current) : null;
    if (hasServerVoiceRef.current) {
      return new AudioSentenceSpeaker(
        makeServerAudioFetcher(AI_MULTIMODAL_BASE_URL, fetch, () => aiVoiceRef.current),
        browser
      );
    }
    return browser;
  }, []);

  /** Reads a speech that is already complete (the opening written ahead) after the voices are known. */
  const readPreparedSpeech = useCallback(
    async (text: string, meta: ReaderMeta) => {
      if (!readAloudRef.current) return;
      await voicesReadyRef.current;
      if (!readAloudRef.current || unmountedRef.current) return;
      const speaker = makeSpeaker();
      if (!speaker) return;
      speaker.push(text);
      speaker.finish(text);
      speakerRef.current = speaker;
      trackReader(speaker, meta);
    },
    [makeSpeaker]
  );

  const toggleReadAloud = useCallback(() => {
    const next = !readAloudRef.current;
    readAloudRef.current = next;
    setReadAloud(next);
    storeReadAloud(next);
    if (!next) {
      stopReasonRef.current = "toggle";
      stopAllReading();
      return;
    }
    // Turned on while the AI is speaking: read this turn too, from what is already written, after any reading left
    const speaker = liveAiSpeechRef.current !== null ? makeSpeaker() : null;
    if (speaker && liveAiSpeechRef.current !== null) {
      const stillReading = [...activeReadersRef.current.keys()];
      if (stillReading.length > 0) {
        speaker.startAfter(Promise.all(stillReading.map((r) => r.whenDone())).then(() => undefined));
      }
      speaker.push(liveAiSpeechRef.current);
      speakerRef.current = speaker;
      trackReader(speaker, liveTurnMetaRef.current ?? { turn: {}, turnIndex: null, stage: 1 });
    }
  }, [makeSpeaker]);

  /**
   * Asks the AI opponent for a turn. Streaming (default): the speech shows up as it is written and, with a
   * Vietnamese voice and read-aloud on, is spoken sentence by sentence. A new attempt replaces the text so far.
   */
  const requestOpponentTurn = useCallback(
    async (
      opponentId: string,
      request: CreateTurnRequest,
      opts?: { silent?: boolean }
    ): Promise<TurnResponse> => {
      if (!isAiTurnStreamEnabled()) {
        return aiApi.generateOpponentTurn(opponentId, request);
      }
      // Written ahead of its time (the opening, while the room loads): nothing is shown or read until it is recorded
      if (opts?.silent) return aiApi.streamOpponentTurn(opponentId, request, {});
      // Read through a function: the reader changes while the turn streams (voices known, toggle)
      const reader = (): SentenceQueue | null => speakerRef.current;
      // The previous AI turn (rebuttal right before the closing) keeps reading; this turn's voice starts after it
      const previousDone = speakerRef.current?.whenDone() ?? Promise.resolve();
      speakerRef.current = null;
      const turn = {};
      // The opponent turn index is 1-based: turns 1-2 are the opening, 3-4 the rebuttal, 5-6 the closing
      const meta: ReaderMeta = {
        turn,
        turnIndex: request.turn_index,
        stage: Math.min(3, Math.max(1, Math.ceil(request.turn_index / 2))),
      };
      liveTurnMetaRef.current = meta;
      currentAiTurnRef.current = turn;
      // speakerRef (not a local): created once the voices are known, and the read-aloud toggle may drop or create it
      void voicesReadyRef.current.then(() => {
        if (currentAiTurnRef.current !== turn || liveAiSpeechRef.current === null) return;
        if (!readAloudRef.current || speakerRef.current) return;
        const speaker = makeSpeaker();
        if (!speaker) return;
        speaker.startAfter(previousDone);
        if (liveAiSpeechRef.current) speaker.push(liveAiSpeechRef.current);
        speakerRef.current = speaker;
        trackReader(speaker, meta);
      });
      // Only the turn that owns the live text may change it (a slow older turn ends after the newer one began)
      liveTurnRef.current = turn;
      const isCurrent = () => liveTurnRef.current === turn;
      const showLive = (text: string | null) => {
        if (!isCurrent()) return;
        liveAiSpeechRef.current = text;
        setLiveAiSpeech(text);
      };
      showLive("");
      setIsAiRewriting(false);
      try {
        const res = await aiApi.streamOpponentTurn(opponentId, request, {
          onAttempt: () => {
            if (!isCurrent()) return;
            // The text of the new attempt starts empty, but what is on screen stays until its first words arrive
            const hadText = Boolean(liveAiSpeechRef.current);
            liveAiSpeechRef.current = "";
            if (hadText) setIsAiRewriting(true);
            reader()?.cancel();
          },
          onDelta: (text) => {
            if (!isCurrent()) return;
            setIsAiRewriting(false);
            showLive((liveAiSpeechRef.current ?? "") + text);
            reader()?.push(text);
          },
        });
        reader()?.finish(res?.speech_text ?? "");
        return res;
      } catch (err) {
        // A failed turn is never "read out": stop its reader for good so a retry or the next turn does not wait for it
        reader()?.abort();
        throw err;
      } finally {
        if (isCurrent()) {
          showLive(null);
          setIsAiRewriting(false);
          liveTurnRef.current = null;
        }
      }
    },
    [makeSpeaker]
  );
  const handledTimeoutKeyRef = useRef<string | null>(null);
  const submittedRoundsRef = useRef<Set<number>>(new Set());
  const inFlightTurnIndexRef = useRef<number | null>(null);
  // Backend "start" must be requested at most once per session (StrictMode double effects + 3s polling)
  const startRequestedSessionRef = useRef<number | null>(null);
  const isFinishingRef = useRef(false);
  const messagesRef = useRef<DebateRoomMessage[]>([]);
  // Latest input text and submit function, read by the timeout handler (which runs from a timer)
  const argumentTextRef = useRef("");
  const sendArgumentRef = useRef<(opts?: SendArgumentOptions) => Promise<void>>(async () => {});
  const opponentReadyRef = useRef<{ sessionId: string; promise: Promise<void> } | null>(null);
  const casePlanRequestedRef = useRef<string | null>(null);
  // The AI's opening is asked for once per opponent session; reset when it fails so the retry button can ask again
  const openingRequestedRef = useRef<string | null>(null);
  const unmountedRef = useRef(false);
  const clearedOnLeaveRef = useRef(false);
  // Rounds whose argument the Backend already accepted: a retry must never submit them again
  const argumentsSubmittedRoundsRef = useRef<Set<number>>(new Set());

  const [pendingAiTurn, setPendingAiTurn] = useState<AiTurnContext | null>(null);

  // Microservice & Assistant Panel states
  const [aiOpponentStatus, setAiOpponentStatus] = useState<string>("init");
  const [opponentError, setOpponentError] = useState<string | null>(null);
  const [evaluatorError, setEvaluatorError] = useState<string | null>(null);
  const [casePlan, setCasePlan] = useState<CaseFileResponse | null>(null);
  const [evaluationResult, setEvaluationResult] = useState<ArgumentEvaluationResult | null>(null);
  const [coachingResult, setCoachingResult] = useState<CoachingResult | null>(null);
  const [isCoachingLoading, setIsCoachingLoading] = useState<boolean>(false);
  const [multimodalResult, setMultimodalResult] = useState<MultimodalTurnResult | null>(null);
  const [recordedDurationSeconds, setRecordedDurationSeconds] = useState<number | null>(null);
  const [isAnalyzingMultimodal, setIsAnalyzingMultimodal] = useState<boolean>(false);
  // The analysis already attached to a sent turn: it stays shown in the sidebar but never rides along a later turn
  const consumedMultimodalRef = useRef<MultimodalTurnResult | null>(null);
  const [liveFrameAnalysis, setLiveFrameAnalysis] = useState<FrameAnalysisResult | null>(null);
  const [hasActiveCamera, setHasActiveCamera] = useState<boolean>(false);
  const [liveInterimTranscript, setLiveInterimTranscript] = useState<string>("");
  const [liveSttStatus, setLiveSttStatus] = useState<RealtimeSttStatus>("idle");
  const [micLevel, setMicLevel] = useState<number>(0);
  const [micLabel, setMicLabel] = useState<string>("");
  const [remoteLiveTranscript, setRemoteLiveTranscript] = useState<{
    userId: number | null;
    fullName: string;
    confirmedText: string;
    interimText: string;
  } | null>(null);

  // Multimodal Webcam + Microphone Refs
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const frameIntervalRef = useRef<number | null>(null);
  const emotionTimelineRef = useRef<EmotionSample[]>([]);
  const totalFramesCapturedRef = useRef<number>(0);
  const recordingStartTimeRef = useRef<number>(0);
  const realtimeSttRef = useRef<RealtimeSttClient | null>(null);
  const liveSeqRef = useRef<number>(0);
  // Final text of the live STT for the current recording (what was spoken, without typed text)
  const liveSpokenTextRef = useRef<string>("");
  // The live STT failed during this recording: its text may be partial, so Whisper transcribes the audio instead
  const liveSttFailedRef = useRef<boolean>(false);
  // Audio chunks are read and sent one after another: keeps WebM order, and stop waits for the last chunk
  const sttSendChainRef = useRef<Promise<void>>(Promise.resolve());
  const lastInterimBroadcastRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micMeterIntervalRef = useRef<number | null>(null);

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
  const [roomFeedback, setRoomFeedback] = useState<{
    text: string;
    type: "success" | "error" | "warning" | "info";
  } | null>(null);
  const [remoteSpeakingUser, setRemoteSpeakingUser] = useState<{
    userId: number;
    fullName: string;
  } | null>(null);

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
  // The server says whether Round 1 has begun: the room stays locked until a response says so, not by its own clock
  const isPreparing = Boolean(sessionDetails?.isPreparing);
  // The init effect only needs to know the session has loaded, not to run again on every poll of it
  const hasSessionDetails = Boolean(sessionDetails);
  const preparationEndsAt = sessionDetails?.preparationEndsAt ?? null;
  preparationEndsAtRef.current = preparationEndsAt;
  // AI practice, between rounds: while the AI is still writing or reading (also a second AI turn that follows at once)
  // the minute has not started, so the room shows "AI đang trình bày…", has no clock and does not read the session
  // (the old end of the minute passing must not start the next round). It shows again when restart-preparation answers.
  const isAiPresenting =
    isAiSession &&
    isPreparing &&
    (isAiGenerating ||
      isAiReadingAloud ||
      liveAiSpeech !== null ||
      restartCandidate !== null ||
      isRestartingPreparation ||
      isWaitingToRecordAi);
  isAiPresentingRef.current = isAiPresenting;
  // The round shown in the header: this side's round, or the one the server announced if that is further on
  const totalRounds = sessionDetails?.totalRounds ?? lastRoundEvent?.totalRounds ?? DEFAULT_TOTAL_ROUNDS;
  const displayRound = Math.min(Math.max(currentRound, lastRoundEvent?.round ?? 0), totalRounds);
  const displayRoundLabel =
    lastRoundEvent && lastRoundEvent.round === displayRound
      ? lastRoundEvent.label
      : sessionDetails?.currentTurn?.roundLabel && sessionDetails.currentTurn.turnOrder === displayRound
      ? sessionDetails.currentTurn.roundLabel
      : roundLabelOf(displayRound);
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
        (m) =>
          m.roundNumber === round &&
          Boolean(m.content?.trim()) &&
          (m.isCurrentUser ||
            (debaterSide === "pro"
              ? m.side === "Ủng hộ" || m.side === "PRO"
              : m.side === "Phản đối" || m.side === "CON") ||
            (m.speaker === "Debater" && !m.isAI))
      ),
    [messages, debaterSide]
  );

  const hasOpponentSpokenInRound = useCallback(
    (round: number) =>
      messages.some(
        (m) =>
          m.roundNumber === round &&
          Boolean(m.content?.trim()) &&
          (!m.isCurrentUser ||
            m.speaker === "AI" ||
            m.isAI ||
            (debaterSide === "pro"
              ? m.side === "Phản đối" || m.side === "CON"
              : m.side === "Ủng hộ" || m.side === "PRO"))
      ),
    [messages, debaterSide]
  );

  const hasBothSidesSpokenInRound = useCallback(
    (round: number) => {
      const roundMsgs = messages.filter((m) => m.roundNumber === round && Boolean(m.content?.trim()));
      if (roundMsgs.length >= 2) return true;
      const proSpoke = roundMsgs.some((m) => m.side === "Ủng hộ" || m.side === "PRO");
      const conSpoke = roundMsgs.some((m) => m.side === "Phản đối" || m.side === "CON");
      return Boolean(proSpoke && conSpoke);
    },
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
    !isCurrentRoundTimedOut &&
    // Not while the learner prepares: the AI opens only once Round 1 has begun
    !isPreparing;

  // Keep session in waiting-for-opponent state after Debater speaks until AI Opponent response is recorded
  const isWaitingForOpponentInAiMode =
    !isP2pOr2v2 &&
    (isWaitingForAiFirstTurn ||
      isAiGenerating ||
      (hasDebaterSpokenInCurrentRound && !hasOpponentSpokenInCurrentRound) ||
      Boolean(pendingAiTurn) ||
      Boolean(pendingAiRecord));

  const isBackendCompleted = Boolean(
    sessionDetails &&
      (sessionDetails.status === 3 ||
        String(sessionDetails.status) === "Completed" ||
        Boolean(sessionDetails.endedAt))
  );

  // Round 3 is genuinely complete when both PRO and CON have spoken in Round 3, or Round 3 timed out before Debater spoke
  const isRound3GenuinelyComplete =
    isBackendCompleted ||
    hasBothSidesSpokenInRound(3) ||
    (hasDebaterSpokenInRound(3) && hasOpponentSpokenInRound(3)) ||
    (timedOutRounds.includes(3) &&
      !hasDebaterSpokenInRound(3) &&
      !isSubmitting);

  const EffectiveDebateCompleted =
    isBackendCompleted ||
    isDebateCompleted ||
    (isP2pOr2v2 ? isDebateCompleted : isRound3GenuinelyComplete);

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
    }
  }, [sessionId, EffectiveDebateCompleted]);

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
    !isPreparing &&
    (isP2pOr2v2
      ? isMyP2pTurn && !isSubmitting && !EffectiveDebateCompleted && !EffectiveExpired
      : isDebaterTurnInAiMode);

  const cannotSpeakReason = userRoleInRoom === "Judge"
    ? "Bạn đang ở chế độ Giám khảo theo dõi trận đấu (Read-only)."
    : userRoleInRoom === "Spectator"
    ? "Bạn đang ở chế độ Giám sát/Khán giả theo dõi trận đấu (Read-only)."
    : EffectiveDebateCompleted
    ? "Đã hoàn thành 3 vòng tranh biện. Nhấn 'Nộp bài' ở góc trên để xem kết quả."
    : isPreparing
    ? "Đang trong thời gian chuẩn bị. Vòng 1 sẽ bắt đầu khi hết giờ chuẩn bị."
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

  /** Takes the server clock offset and the start of Round 1 from a session response. */
  const syncServerClock = useCallback((data: DebateSessionResponse) => {
    const offset = serverClockOffsetMs(data.serverTime);
    if (offset !== null) serverOffsetRef.current = offset;
    if (data.preparationEndsAt) {
      // Preparation over while its planned end is still ahead of the server time: it was skipped, so Round 1 began
      // when this response was built, not at the planned end
      const skipped =
        !data.isPreparing &&
        Boolean(data.serverTime) &&
        Date.parse(data.preparationEndsAt) > Date.parse(data.serverTime as string);
      roundOneStartIsoRef.current = skipped ? (data.serverTime as string) : data.preparationEndsAt;
    }
  }, []);

  // One microphone/camera stream for the whole room: opened on entry, reused by every round, stopped on leaving
  const devices = useSharedDeviceStream(isBackendSession);
  // Read by loadBackendSession (a ref, so the callback and the effects built on it do not change with the devices)
  // The AI speaks first (it is PRO): its opening is written while the room loads, and recorded when the minute ends
  const [openingPrep, setOpeningPrep] = useState<"idle" | "writing" | "ready" | "error">("idle");
  const preGeneratedOpeningRef = useRef<{ sessionId: string; text: string } | null>(null);
  const preOpeningRequestedRef = useRef<string | null>(null);
  const aiNeedsPreparedOpening = isAiSession && aiSide === "pro";
  // The room is ready when the microphone is (or was skipped), the AI opponent has its plan and, if it speaks first,
  // its opening is written: only then does the session (and its preparation minute) start
  const roomReady = devices.devicesReady && opponentReady && (!aiNeedsPreparedOpening || openingPrep === "ready");
  const roomReadyRef = useRef(false);
  roomReadyRef.current = roomReady;

  // Raised when the preparation clock is restarted: a session read started before then must not overwrite it
  const sessionClockEpochRef = useRef(0);

  const loadBackendSession = useCallback(async (numId: number): Promise<DebateSessionResponse | null> => {
    try {
      const epochAtRequest = sessionClockEpochRef.current;
      const res = await debateApi.getSessionDetails(numId);
      // The preparation clock was restarted while this request was in flight: its answer is older, drop it
      if (epochAtRequest !== sessionClockEpochRef.current) return null;
      if (res?.success && res.data) {
        setIsReconnecting(false);
        syncServerClock(res.data);
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
          // The server's preparation clock runs from the start: begin only once the room is ready
          roomReadyRef.current &&
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
  }, [isP2pOr2v2, syncServerClock]);

  // The devices became ready (or the learner chose to go on without a microphone): the session may start now
  // (a load that finds the session already started by an earlier one does nothing, so this never starts it twice)
  const isAiAwaitingStart =
    isBackendSession &&
    Boolean(sessionDetails?.participants?.some((p) => p.isAI)) &&
    (sessionDetails?.status === 1 || String(sessionDetails?.status) === "Waiting");
  useEffect(() => {
    if (roomReady && isAiAwaitingStart) void loadBackendSession(numSessionId);
  }, [roomReady, isAiAwaitingStart, numSessionId, loadBackendSession]);
  const isAiAwaitingStartRef = useRef(false);
  isAiAwaitingStartRef.current = isAiAwaitingStart;

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
              argumentId: arg.argumentId,
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
              wordCount: arg.wordCount ?? (arg.content ? arg.content.trim().split(/\s+/).length : null),
              durationSeconds: arg.durationSeconds ?? null,
              deliveryAnalytics: normalizeDeliveryAnalytics(arg.deliveryAnalytics) ?? null,
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

      // Time is up: auto-submit either what the speaker wrote, or a default timeout notice if empty (for AI, P2P, 2v2, Challenge, Competition)
      const isMyTurnToSpeak = (!isP2pOr2v2 || isMyP2pTurn) && userRoleInRoom === "Debater";
      if (isMyTurnToSpeak) {
        setIsRecording(false);
        const hasWritten = Boolean(argumentTextRef.current.trim());
        const fallbackText = hasWritten ? undefined : "(Thí sinh không đưa ra phát biểu - Hết thời gian)";
        void sendArgumentRef.current({ auto: true, fallbackText });
        setRoomFeedback({
          text: hasWritten
            ? "Hết giờ, đã tự động nộp phần bạn đã viết."
            : "Hết thời gian phát biểu! Hệ thống tự động chuyển lượt.",
          type: hasWritten ? "success" : "warning",
        });
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
    },
    [
      EffectiveDebateCompleted,
      currentRound,
      hasDebaterSpokenInCurrentRound,
      isAiGenerating,
      isBackendSession,
      isMyP2pTurn,
      isP2pOr2v2,
      isSubmitting,
      isWaitingForOpponentInAiMode,
      loadBackendSession,
      loadBackendTranscript,
      numSessionId,
      userRoleInRoom,
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

  // AI practice not started yet: the room first opens the microphone and camera, then starts the session
  const isAiDeviceSetup =
    isBackendSession &&
    Boolean(sessionDetails) &&
    isAiSession &&
    (sessionDetails?.status === 1 || String(sessionDetails?.status) === "Waiting");

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
    // The preparation has its own clock: the speaking clock starts with Round 1
    !isPreparing &&
    !EffectiveDebateCompleted &&
    !isSubmitting &&
    !isAiGenerating &&
    !isAiReadingAloud &&
    // The learner has stopped speaking: the time the analysis takes is not theirs (a timeout here would send an
    // empty turn and lose the recording)
    !isAnalyzingMultimodal &&
    !isWaitingForOpponentInAiMode &&
    (isP2pOr2v2 || (opponentReady && !hasDebaterSpokenInCurrentRound));

  // While the AI reads aloud, the learner's turn has not really begun: when the reading ends (or is stopped), the turn
  // gets its full time from that moment instead of the deadline written when the AI turn arrived
  const wasAiReadingRef = useRef(false);
  useEffect(() => {
    const wasReading = wasAiReadingRef.current;
    wasAiReadingRef.current = isAiReadingAloud;
    if (!wasReading || isAiReadingAloud || isP2pOr2v2 || EffectiveDebateCompleted) return;
    if (hasDebaterSpokenInCurrentRound || unmountedRef.current) return;
    // Only when it really is the learner's turn now (not while sending, nor while the AI writes its next turn)
    if (isSubmittingRef.current || isAiGenerating || isWaitingForOpponentInAiMode || !opponentReady) return;
    if (sessionStorage.getItem(EXPIRED_STORAGE_PREFIX + activeTurnKey) === "1") return;
    const fullSeconds = currentRound === 1 ? ROUND_1_DEFAULT_SECONDS : SUBSEQUENT_ROUND_SECONDS;
    writeStoredValue(DEADLINE_STORAGE_PREFIX + activeTurnKey, String(Date.now() + fullSeconds * 1000));
    setSecondsRemaining(fullSeconds);
  }, [
    isAiReadingAloud,
    isP2pOr2v2,
    EffectiveDebateCompleted,
    hasDebaterSpokenInCurrentRound,
    activeTurnKey,
    currentRound,
    isAiGenerating,
    isWaitingForOpponentInAiMode,
    opponentReady,
  ]);

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
      // The learner's Round 1 turn began when the preparation ended (on the server clock), not when this page opened.
      // When the AI speaks first, the turn only begins after the AI has finished: that stays counted from now.
      const roundOneStartMs =
        currentRound === 1 && roundOneStartIsoRef.current && (isP2pOr2v2 || aiSide !== "pro")
          ? serverTimeToLocalMs(roundOneStartIsoRef.current, serverOffsetRef.current)
          : null;
      deadlineMs = (roundOneStartMs ?? Date.now()) + defaultDurationSec * 1000;
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
      if (isAiPresentingRef.current) return;
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

  // Auto-dismiss transient roomFeedback after 6 seconds
  useEffect(() => {
    if (!roomFeedback) return;
    const timer = setTimeout(() => {
      setRoomFeedback(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [roomFeedback]);

  // ── Round announcements: one banner per (session, round), also after a reload ──
  // announceRound only marks the round as new; the banner itself waits until the AI has finished writing and reading
  const [pendingRoundBanner, setPendingRoundBanner] = useState<{ round: number; label: string } | null>(null);
  const announceRound = useCallback(
    (round: number, label?: string) => {
      if (hasShownRoundBanner(sessionId, round)) return;
      setPendingRoundBanner((prev) =>
        prev && prev.round === round
          ? { round, label: label || prev.label }
          : { round, label: label || roundLabelOf(round) }
      );
    },
    [sessionId]
  );

  const isAiBusy = isAiReadingAloud || isAiGenerating || liveAiSpeech !== null;
  useEffect(() => {
    if (!pendingRoundBanner || isAiBusy) return;
    setPendingRoundBanner(null);
    // Marked only now that it really shows: a repeat (second event, reload) never shows it again
    if (hasShownRoundBanner(sessionId, pendingRoundBanner.round)) return;
    markRoundBannerShown(sessionId, pendingRoundBanner.round);
    setRoundBanner(pendingRoundBanner);
  }, [pendingRoundBanner, isAiBusy, sessionId]);

  useEffect(() => {
    if (!roundBanner) return;
    const timer = setTimeout(() => setRoundBanner(null), 3000);
    return () => clearTimeout(timer);
  }, [roundBanner]);

  // Round 1 begins when the preparation ends (the countdown, "Bắt đầu ngay", or the server saying so)
  const wasPreparingRef = useRef(false);
  useEffect(() => {
    if (wasPreparingRef.current && !isPreparing) announceRound(1, roundLabelOf(1));
    wasPreparingRef.current = isPreparing;
  }, [isPreparing, announceRound]);

  // The round changed on this side (AI practice moves on by itself; P2P follows the server)
  const previousRoundRef = useRef(currentRound);
  useEffect(() => {
    const previous = previousRoundRef.current;
    previousRoundRef.current = currentRound;
    if (currentRound > previous && !isPreparing) announceRound(currentRound);
  }, [currentRound, isPreparing, announceRound]);

  // The reading is over (by itself, or skipped), or there is none: ask the server to count the minute from now.
  // A reading stopped by the learner recording, or by turning read-aloud off, does not restart it.
  useEffect(() => {
    if (!restartCandidate || isAiReadingAloud || isAiGenerating) return;
    const { key } = restartCandidate;
    setRestartCandidate(null);
    const reason = stopReasonRef.current;
    stopReasonRef.current = null;
    if (reason === "recording" || reason === "toggle") return;
    if (restartedKeysRef.current.has(key) || !isBackendSession || unmountedRef.current) return;
    restartedKeysRef.current.add(key);
    setIsRestartingPreparation(true);
    void (async () => {
      try {
        // A request that never answers must not hide the clock for ever
        const res = await Promise.race([
          debateApi.restartPreparation(numSessionId),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("restart-preparation timed out")), 10_000)),
        ]);
        if (unmountedRef.current || !res?.success || !res.data) return;
        sessionClockEpochRef.current += 1;
        syncServerClock(res.data);
        setSessionDetails(res.data);
      } catch (restartErr) {
        // The clock simply stays as the server last reported it
        console.warn("Could not restart the preparation clock:", restartErr);
      } finally {
        if (!unmountedRef.current) setIsRestartingPreparation(false);
      }
    })();
  }, [restartCandidate, isAiReadingAloud, isAiGenerating, isBackendSession, numSessionId, syncServerClock]);

  // ── Preparation before Round 1, counted on the server clock ──
  useEffect(() => {
    if (!isPreparing || !preparationEndsAt || isAiPresenting) {
      setPrepClockExpired(false);
      return;
    }
    const tick = () => {
      const left = secondsUntilServerTime(preparationEndsAt, serverOffsetRef.current);
      setPrepSecondsLeft(left);
      setPrepClockExpired(left <= 0);
    };
    tick();
    const intervalId = setInterval(tick, 250);
    return () => clearInterval(intervalId);
  }, [isPreparing, preparationEndsAt, isAiPresenting]);

  // The countdown is over: read the session again (it now has the Active turn) and keep asking until the server
  // says Round 1 has begun, even when this machine's clock runs ahead of the server's
  useEffect(() => {
    if (!isPreparing || !prepClockExpired || !isBackendSession) return;
    let inFlight = false;
    const refresh = () => {
      if (inFlight) return; // a slow answer must not pile up requests
      inFlight = true;
      void loadBackendSession(numSessionId).finally(() => {
        inFlight = false;
      });
    };
    refresh();
    const intervalId = setInterval(refresh, 1000);
    return () => clearInterval(intervalId);
  }, [isPreparing, prepClockExpired, isBackendSession, numSessionId, loadBackendSession]);

  // Another session in the same room component: nothing of the previous one's rounds carries over
  useEffect(() => {
    setLastRoundEvent(null);
    setRoundBanner(null);
    setPendingRoundBanner(null);
  }, [sessionId]);

  const handleSkipPreparation = useCallback(async () => {
    if (!isBackendSession || isSkippingPreparationRef.current) return;
    isSkippingPreparationRef.current = true;
    setIsSkippingPreparation(true);
    try {
      const res = await debateApi.skipPreparation(numSessionId);
      if (res?.success && res.data) {
        syncServerClock(res.data);
        setSessionDetails(res.data);
      } else {
        setRoomFeedback({ text: getDebateErrorMessage(res, "Không thể bỏ qua thời gian chuẩn bị."), type: "error" });
      }
    } catch (skipErr) {
      setRoomFeedback({ text: getDebateErrorMessage(skipErr, "Không thể bỏ qua thời gian chuẩn bị."), type: "error" });
      void loadBackendSession(numSessionId);
    } finally {
      isSkippingPreparationRef.current = false;
      setIsSkippingPreparation(false);
    }
  }, [isBackendSession, numSessionId, syncServerClock, loadBackendSession]);

  // Real-time synchronization via SignalR for debate rooms
  useEffect(() => {
    if (!isBackendSession) return;

    debateHubService.connect(numSessionId, {
      onUserJoined: (data) => {
        if (!isSameUserId(data.userId, currentUserId)) {
          setRoomFeedback({
            text: `${data.fullName} vừa tham gia phòng tranh biện.`,
            type: "info",
          });
        }
        loadBackendSession(numSessionId);
      },
      onUserLeft: (data) => {
        if (!isSameUserId(data.userId, currentUserId)) {
          setRoomFeedback({
            text: `${data.fullName} đã rời phòng tranh biện.`,
            type: "warning",
          });
        }
        loadBackendSession(numSessionId);
      },
      onSpeakingStatusChanged: (data) => {
        if (!isSameUserId(data.userId, currentUserId)) {
          if (data.isSpeaking) {
            setRemoteSpeakingUser({ userId: data.userId, fullName: data.fullName });
          } else {
            setRemoteSpeakingUser((prev) => (prev?.userId === data.userId ? null : prev));
            setRemoteLiveTranscript((prev) => (prev?.userId === data.userId ? null : prev));
          }
        }
      },
      onLiveTranscriptUpdated: (data) => {
        if (!isSameUserId(data.userId, currentUserId)) {
          setRemoteLiveTranscript((prev) => {
            const sameUser = prev && prev.userId === data.userId;
            const baseConfirmed = sameUser ? prev.confirmedText : "";
            if (data.isFinal) {
              const nextConfirmed = data.text.trim()
                ? `${baseConfirmed} ${data.text.trim()}`.trim()
                : baseConfirmed;
              return {
                userId: data.userId,
                fullName: data.fullName,
                confirmedText: nextConfirmed,
                interimText: "",
              };
            }
            return {
              userId: data.userId,
              fullName: data.fullName,
              confirmedText: baseConfirmed,
              interimText: data.text,
            };
          });
        }
      },
      onArgumentSubmitted: (data) => {
        setRemoteSpeakingUser(null);
        setRemoteLiveTranscript(null);
        loadBackendTranscript(numSessionId);
        loadBackendSession(numSessionId);
        if (!isSameUserId(data.argument.userId, currentUserId)) {
          setRoomFeedback({
            text: `${data.argument.speakerName || "Đối thủ"} vừa gửi bài tranh biện.`,
            type: "info",
          });
        }
      },
      onSessionStarted: () => {
        loadBackendSession(numSessionId);
        setRoomFeedback({
          text: "Trận tranh biện đã chính thức bắt đầu!",
          type: "success",
        });
      },
      onRoundStarted: (data: RoundStartedEvent) => {
        setLastRoundEvent({ round: data.roundNumber, label: data.roundLabel, totalRounds: data.totalRounds });
        announceRound(data.roundNumber, data.roundLabel);
        loadBackendSession(numSessionId);
      },
      onSessionStatusChanged: (data) => {
        loadBackendSession(numSessionId);
        if (data.status === "Completed") {
          setIsDebateCompleted(true);
        }
      },
    });

    return () => {
      debateHubService.disconnect();
    };
  }, [
    isBackendSession,
    numSessionId,
    currentUserId,
    loadBackendSession,
    loadBackendTranscript,
    announceRound,
  ]);

  // Broadcast current user's live speaking status to other debaters in real-time
  useEffect(() => {
    if (isBackendSession) {
      debateHubService.sendSpeakingStatus(isRecording);
    }
  }, [isRecording, isBackendSession]);

  // Clear stale opponent live banner/transcript whenever it becomes our turn to speak
  useEffect(() => {
    if (canSpeak) {
      setRemoteSpeakingUser(null);
      setRemoteLiveTranscript(null);
    }
  }, [canSpeak]);

  // Attach MediaStream to <video> after DebateComposer mounts the recording banner
  useEffect(() => {
    if (isRecording && hasActiveCamera && videoPreviewRef.current && mediaStreamRef.current) {
      const videoEl = videoPreviewRef.current;
      if (videoEl.srcObject !== mediaStreamRef.current) {
        videoEl.srcObject = mediaStreamRef.current;
      }
      void videoEl.play().catch(() => {
        // Ignore autoplay restriction if muted attribute already handles it
      });
    }
  }, [isRecording, hasActiveCamera]);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (recordRetryTimerRef.current !== null) window.clearTimeout(recordRetryTimerRef.current);
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
    if (isBackendSession && !hasSessionDetails) return;
    // A finished debate never (re)creates an opponent session
    if (EffectiveDebateCompleted || isTerminalBackendStatus) return;
    // Each poll of the session runs this effect again: a conflict must not call the service every time
    if (isOpponentDataConflict) return;

    let isMounted = true;
    // The AI's opening failed in this run: its error is shown even if a newer run of the effect has begun since
    let openingFailed = false;
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
        // The AI speaks first: while the session has not started, or the learner prepares, the opening is only
        // written (kept in preGeneratedOpeningRef); it is recorded and shown once the minute is over
        if (
          aiSide === "pro" &&
          isMounted &&
          !aiAlreadyOpened &&
          (isPreparing || isAiAwaitingStartRef.current) &&
          preOpeningRequestedRef.current !== opponentSessionId &&
          preGeneratedOpeningRef.current?.sessionId !== opponentSessionId
        ) {
          preOpeningRequestedRef.current = opponentSessionId;
          setOpeningPrep("writing");
          try {
            const writtenRes = await retryWhilePlanning(
              () =>
                requestOpponentTurn(
                  opponentSessionId,
                  { turn_index: toOpponentTurnIndex(0), new_learner_speeches: [] },
                  { silent: true }
                ),
              { isCancelled: () => unmountedRef.current }
            );
            const written = writtenRes?.speech_text?.trim();
            if (!written) throw new Error("Đối thủ AI không trả về nội dung phản hồi hợp lệ.");
            preGeneratedOpeningRef.current = { sessionId: opponentSessionId, text: written };
            if (!unmountedRef.current) setOpeningPrep("ready");
            // The minute may have ended while it was being written (a reload in the middle of the preparation):
            // run the effect again so the opening is recorded now
            if (!unmountedRef.current && !isAiAwaitingStartRef.current) setOpponentInitNonce((n) => n + 1);
          } catch (writeErr) {
            if (preOpeningRequestedRef.current === opponentSessionId) preOpeningRequestedRef.current = null;
            if (!unmountedRef.current) setOpeningPrep("error");
            openingFailed = true;
            throw writeErr;
          }
          return;
        }
        // ...and not while the learner prepares (the Backend refuses a speech before Round 1 with 409)
        // ...and not twice: this effect runs again whenever the session is read, while the first request still streams
        if (
          aiSide === "pro" &&
          isMounted &&
          !aiAlreadyOpened &&
          !isPreparing &&
          !isAiAwaitingStartRef.current &&
          openingRequestedRef.current !== opponentSessionId &&
          !isAiGeneratingRef.current
        ) {
          openingRequestedRef.current = opponentSessionId;
          isAiGeneratingRef.current = true;
          setIsAiGenerating(true);
          // A newer run of the effect may have started while this one streams: it left this run the work, so the
          // result is shown unless the room is gone or another opponent session took over
          const stillThisOpening = () => !unmountedRef.current && openingRequestedRef.current === opponentSessionId;
          try {
            // Written ahead while the room loaded: use it, /turns is not called again
            const written =
              preGeneratedOpeningRef.current?.sessionId === opponentSessionId
                ? preGeneratedOpeningRef.current.text
                : null;
            const firstTurnRes = written
              ? { speech_text: written }
              : await retryWhilePlanning(
                  () =>
                    requestOpponentTurn(opponentSessionId, {
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

            if (stillThisOpening()) {
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
              setMessages((prev) =>
                prev.some((m) => m.speaker === "AI" && m.roundNumber === 1) ? prev : prev.length === 0 ? [aiFirstMsg] : prev
              );
              if (written) void readPreparedSpeech(speechText, { turn: {}, turnIndex: 1, stage: 1 });
            }
          } catch (openingErr) {
            if (openingRequestedRef.current === opponentSessionId) openingRequestedRef.current = null;
            openingFailed = true;
            throw openingErr;
          } finally {
            isAiGeneratingRef.current = false;
            if (!unmountedRef.current) setIsAiGenerating(false);
          }
        }
      } catch (initErr) {
        console.error("Error initialising AI Opponent:", initErr);
        if (isMounted || (openingFailed && !unmountedRef.current)) {
          setAiOpponentStatus("error");
          if (isSessionDataConflict(initErr)) {
            setIsOpponentDataConflict(true);
          } else {
            setOpponentInitFailed(true);
          }
          setOpponentError(
            openingFailed
              ? opponentTurnErrorMessage(initErr, getOpponentErrorMessage(initErr))
              : getOpponentErrorMessage(initErr)
          );
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
    hasSessionDetails,
    isPreparing,
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
      stopReasonRef.current = null;
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
                requestOpponentTurn(opponentSessionId, {
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
            setOpponentError(opponentTurnErrorMessage(turnErr));
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
          // Older Backend: the AI's turn is refused while the preparation runs. Not an error: wait for the end of the
          // minute (server clock + 1 s) and record again, once
          const waitKey = `${numSessionId}:${ctx.aiTurnIndex}`;
          if (isPreparationInProgressError(recordErr) && !recordWaitedKeysRef.current.has(waitKey)) {
            recordWaitedKeysRef.current.add(waitKey);
            const endsAt = preparationEndsAtRef.current;
            const waitMs =
              (endsAt ? Math.max(0, secondsUntilServerTime(endsAt, serverOffsetRef.current)) * 1000 : 0) + 1000;
            setPendingAiTurn(null);
            setPendingAiRecord({ ctx, speechText });
            setIsWaitingToRecordAi(true);
            if (recordRetryTimerRef.current !== null) window.clearTimeout(recordRetryTimerRef.current);
            recordRetryTimerRef.current = window.setTimeout(() => {
              recordRetryTimerRef.current = null;
              if (unmountedRef.current) return;
              setIsWaitingToRecordAi(false);
              void runAiTurn(ctx, speechText);
            }, waitMs);
            return;
          }
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
        // The Backend session after this turn (as for the learner's own turn): its status says when the debate ended
        if (recorded?.session) {
          setSessionDetails(recorded.session);
        }

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
          // A round ended with this AI speech (not the whole debate): its minute of preparation starts after the reading
          if (isBackendSession && ctx.learnerRound < 3) {
            setRestartCandidate({ key: `${numSessionId}:${ctx.aiTurnIndex}` });
          }
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
    [
      advanceToNextRoundOrComplete,
      aiSide,
      appendOpponentMessage,
      isBackendSession,
      numSessionId,
      opponentSessionId,
      requestOpponentTurn,
    ]
  );

  // Stop media streams & frame intervals cleanly
  const stopMediaCaptureResources = useCallback(() => {
    if (frameIntervalRef.current) {
      window.clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (micMeterIntervalRef.current) {
      window.clearInterval(micMeterIntervalRef.current);
      micMeterIntervalRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    // The tracks belong to the shared device stream (useSharedDeviceStream): only this recording lets go of them
    mediaStreamRef.current = null;
    if (realtimeSttRef.current) {
      realtimeSttRef.current.disconnectImmediate();
      realtimeSttRef.current = null;
    }
    setHasActiveCamera(false);
    setLiveFrameAnalysis(null);
    setLiveInterimTranscript("");
    setLiveSttStatus("idle");
    setMicLevel(0);
    setMicLabel("");
  }, []);

  useEffect(() => {
    return () => {
      stopMediaCaptureResources();
    };
  }, [stopMediaCaptureResources]);

  // The debate is over: give the microphone and camera back
  const releaseDevices = devices.release;
  useEffect(() => {
    if (EffectiveDebateCompleted) releaseDevices();
  }, [EffectiveDebateCompleted, releaseDevices]);

  // A device vanished mid-debate (unplugged, permission revoked): the next recording opens it again
  useEffect(() => {
    if (devices.deviceLost) {
      setRoomFeedback({
        text: "Micro hoặc camera vừa bị ngắt. Lần ghi âm tiếp theo sẽ mở lại thiết bị.",
        type: "warning",
      });
    }
  }, [devices.deviceLost]);

  const captureAndAnalyzeWebcamFrame = useCallback(async () => {
    const video = videoPreviewRef.current;
    if (!video || video.readyState < 2) return;

    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageBase64 = canvas.toDataURL("image/jpeg", 0.65);
    const elapsedSec = (Date.now() - recordingStartTimeRef.current) / 1000;

    totalFramesCapturedRef.current += 1;

    try {
      const res = await aiApi.analyzeFrame({
        image_base64: imageBase64,
        timestamp: elapsedSec,
      });

      setLiveFrameAnalysis(res);

      const overlay = overlayCanvasRef.current;
      if (overlay) {
        const oCtx = overlay.getContext("2d");
        if (oCtx) {
          oCtx.clearRect(0, 0, overlay.width, overlay.height);
          if (res.face_detected && res.region) {
            oCtx.strokeStyle = "#10B981";
            oCtx.lineWidth = 2;
            oCtx.strokeRect(res.region.x, res.region.y, res.region.w, res.region.h);
            oCtx.fillStyle = "rgba(16, 185, 129, 0.85)";
            oCtx.font = "bold 11px sans-serif";
            oCtx.fillText(
              `${res.dominant_emotion.toUpperCase()} (${res.dominant_score}%)`,
              res.region.x,
              Math.max(14, res.region.y - 4)
            );
          }
        }
      }

      if (res.face_detected) {
        emotionTimelineRef.current.push({
          time: elapsedSec,
          dominant: res.dominant_emotion,
          scores: res.emotion_scores,
          face_detected: true,
        });
      }
    } catch {
      // Ignore single frame errors during realtime streaming
    }
  }, []);

  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      // "Dừng & Gửi": stop, run /multimodal/analyze-turn (speech to text when there is no live text + delivery), then
      // send the turn at once so the AI answers without a second click
      setIsRecording(false);
      if (frameIntervalRef.current) {
        window.clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }

      const durationSec = Math.max(1, Math.round((Date.now() - recordingStartTimeRef.current) / 1000));
      setRecordedDurationSeconds(durationSec);

      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        const audioBlobPromise = new Promise<Blob>((resolve) => {
          recorder.onstop = () => {
            const mimeType = recorder.mimeType || "audio/webm";
            resolve(new Blob(audioChunksRef.current, { type: mimeType }));
          };
        });
        recorder.stop();
        const audioBlob = await audioBlobPromise;
        await sttSendChainRef.current;
        await realtimeSttRef.current?.stopAndFinalize();
        stopMediaCaptureResources();

        setIsAnalyzingMultimodal(true);
        let analysis: MultimodalTurnResult | null = null;
        try {
          const { audioBase64, spokenText } = await resolveTurnSpeechInput(
            liveSttFailedRef.current ? "" : liveSpokenTextRef.current,
            () =>
              new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(String(reader.result || ""));
                reader.onerror = reject;
                reader.readAsDataURL(audioBlob);
              })
          );

          const turnRes = await aiApi.analyzeTurn({
            audio_base64: audioBase64,
            emotion_timeline: emotionTimelineRef.current,
            total_frames_captured: totalFramesCapturedRef.current,
            duration_seconds: durationSec,
            transcript_override: spokenText ?? (argumentTextRef.current.trim() || null),
            include_report_chart: true,
          });

          analysis = turnRes;
          setMultimodalResult(turnRes);
          setIsSidebarOpen(true);
          setSidebarTab("evaluator");
        } catch (err) {
          console.error("Error analyzing multimodal turn:", err);
          setRoomFeedback({
            text: `Không thể phân tích giọng nói/biểu cảm: ${getErrorMessage(err, "Vui lòng kiểm tra AI Multimodal Service (port 8003)")}`,
            type: "error",
          });
        } finally {
          setIsAnalyzingMultimodal(false);
        }

        // The written text (typed + live text) wins; without it, the transcript of the recording is the speech
        const speech = argumentTextRef.current.trim() || analysis?.voice?.transcript_text?.trim() || "";
        if (!speech) {
          if (analysis) {
            setRoomFeedback({ text: "Không nghe được nội dung nào trong đoạn ghi âm. Hãy nói lại hoặc gõ lập luận.", type: "warning" });
          }
          return;
        }
        setArgumentText(speech);
        if (analysis) {
          setRoomFeedback({
            text: `Đã gửi lượt nói (Điểm phong thái: ${analysis.overall_demeanor_score}/100, tốc độ: ${analysis.voice.wpm} WPM).`,
            type: "success",
          });
        }
        await sendArgumentRef.current({ text: speech, multimodal: analysis, durationSeconds: durationSec });
      } else {
        // Nothing was recorded (the recorder never started): send what is written, or say why nothing was sent
        stopMediaCaptureResources();
        const written = argumentTextRef.current.trim();
        if (written) {
          await sendArgumentRef.current({ text: written, multimodal: null, durationSeconds: durationSec });
        } else {
          setRoomFeedback({ text: "Không có bản ghi âm nào để gửi. Hãy ghi âm lại hoặc gõ lập luận.", type: "warning" });
        }
      }
      return;
    }

    // Start recording (Webcam + Microphone, fallback to Microphone-only if camera unavailable)
    // The AI must not keep talking into the learner's microphone
    stopReasonRef.current = "recording";
    stopAllReading();
    try {
      // The shared stream opened on entering the room; opened again only when it is missing or its tracks ended
      const { stream, hasVideo, reopened } = await devices.acquire();
      if (reopened) {
        setRoomFeedback({ text: "Micro hoặc camera đã được mở lại cho lần ghi âm này.", type: "warning" });
      }

      mediaStreamRef.current = stream;
      setHasActiveCamera(hasVideo);
      emotionTimelineRef.current = [];
      totalFramesCapturedRef.current = 0;
      audioChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();
      liveSeqRef.current = 0;
      liveSpokenTextRef.current = "";
      liveSttFailedRef.current = false;
      lastInterimBroadcastRef.current = 0;
      setLiveInterimTranscript("");
      setIsRecording(true);

      if (hasVideo && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }

      const sttClient = new RealtimeSttClient({
        onStatusChange: (status) => {
          if (status === "error") liveSttFailedRef.current = true;
          setLiveSttStatus(status);
        },
        onTranscript: ({ transcript, isFinal, speechFinal }) => {
          const cleanText = transcript.trim();
          if (isFinal) {
            setLiveInterimTranscript("");
            if (cleanText) {
              liveSpokenTextRef.current = `${liveSpokenTextRef.current} ${cleanText}`.trim();
              setArgumentText((prev) => (prev.trim() ? `${prev.trim()} ${cleanText}` : cleanText));
              if (isBackendSession) {
                liveSeqRef.current += 1;
                void debateHubService.sendLiveTranscript(cleanText, true, speechFinal, liveSeqRef.current);
              }
            }
          } else {
            setLiveInterimTranscript(transcript);
            if (isBackendSession && cleanText) {
              const now = Date.now();
              if (now - lastInterimBroadcastRef.current >= 250) {
                lastInterimBroadcastRef.current = now;
                liveSeqRef.current += 1;
                void debateHubService.sendLiveTranscript(transcript, false, false, liveSeqRef.current);
              }
            }
          }
        },
        onError: (code, message) => {
          console.warn(`Realtime STT fallback (${code}): ${message}`);
        },
      });
      sttClient.connect();
      realtimeSttRef.current = sttClient;

      const audioOnlyStream = new MediaStream(stream.getAudioTracks());
      const activeAudioTrack = stream.getAudioTracks()[0];
      setMicLabel(activeAudioTrack?.label || "Microphone");

      try {
        const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextCtor && activeAudioTrack) {
          const audioCtx = new AudioContextCtor();
          audioCtxRef.current = audioCtx;
          const src = audioCtx.createMediaStreamSource(audioOnlyStream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          src.connect(analyser);
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          micMeterIntervalRef.current = window.setInterval(() => {
            analyser.getByteTimeDomainData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i += 1) {
              const v = (dataArray[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / dataArray.length);
            setMicLevel(Math.min(100, Math.round(rms * 350)));
          }, 100);
        }
      } catch {
        // Ignore AudioContext meter errors
      }

      const mimeType = pickSupportedAudioMimeType();
      const recorder = new MediaRecorder(audioOnlyStream, mimeType ? { mimeType } : undefined);
      sttSendChainRef.current = Promise.resolve();
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          const chunk = e.data;
          sttSendChainRef.current = sttSendChainRef.current.then(async () => {
            try {
              const buf = await chunk.arrayBuffer();
              realtimeSttRef.current?.sendAudioChunk(buf);
            } catch {
              // Ignore streaming chunk read errors; Whisper batch fallback remains intact
            }
          });
        }
      };
      recorder.start(100);
      mediaRecorderRef.current = recorder;

      if (hasVideo) {
        frameIntervalRef.current = window.setInterval(() => {
          void captureAndAnalyzeWebcamFrame();
        }, 600);
      }
    } catch (mediaErr) {
      console.warn("Media device access unavailable, running demo sample audio fallback:", mediaErr);
      // If browser has no hardware microphone/camera attached (e.g. headless/desktop PC without mic),
      // run the real Multimodal service sample audio + DeepFace pipeline so the user can still test!
      setIsAnalyzingMultimodal(true);
      try {
        const sampleRes = await aiApi.runDemoSampleAudio();
        setMultimodalResult(sampleRes);
        setRecordedDurationSeconds(Math.round(sampleRes.voice.duration_seconds || 16));
        if (sampleRes.voice?.transcript_text?.trim() && !argumentTextRef.current.trim()) {
          setArgumentText(sampleRes.voice.transcript_text.trim());
        }
        setIsSidebarOpen(true);
        setSidebarTab("evaluator");
        setRoomFeedback({
          text: `Không tìm thấy thiết bị Mic/Camera vật lý — đã chạy phân tích từ file âm thanh mẫu trên AI Multimodal Service (Điểm phong thái: ${sampleRes.overall_demeanor_score}/100).`,
          type: "success",
        });
      } catch (sampleErr) {
        setRoomFeedback({
          text: `Không thể truy cập Microphone/Camera: ${getErrorMessage(sampleErr, "Vui lòng cấp quyền trình duyệt.")}`,
          type: "error",
        });
      } finally {
        setIsAnalyzingMultimodal(false);
      }
    }
  }, [captureAndAnalyzeWebcamFrame, devices.acquire, isRecording, stopMediaCaptureResources]);

  const handleRunSampleMultimodal = useCallback(async () => {
    stopMediaCaptureResources();
    setIsRecording(false);
    setIsAnalyzingMultimodal(true);
    try {
      const sampleRes = await aiApi.runDemoSampleAudio();
      setMultimodalResult(sampleRes);
      setRecordedDurationSeconds(Math.round(sampleRes.voice.duration_seconds || 16));
      if (sampleRes.voice?.transcript_text?.trim()) {
        setArgumentText(sampleRes.voice.transcript_text.trim());
      }
      setIsSidebarOpen(true);
      setSidebarTab("evaluator");
      setRoomFeedback({
        text: `Đã phân tích mẫu giọng nói & biểu cảm (Điểm phong thái: ${sampleRes.overall_demeanor_score}/100, WPM: ${sampleRes.voice.wpm}).`,
        type: "success",
      });
    } catch (err) {
      setRoomFeedback({
        text: `Lỗi khi chạy mẫu Multimodal: ${getErrorMessage(err, "Lỗi không xác định")}`,
        type: "error",
      });
    } finally {
      setIsAnalyzingMultimodal(false);
    }
  }, [stopMediaCaptureResources]);

  // Evaluate one submitted turn. On failure the debate is blocked (see pendingTurnEvaluation) until a retry succeeds.
  const runTurnEvaluation = useCallback(
    async (ctx: TurnEvaluationContext) => {
      setIsEvaluating(true);
      setEvaluatingMessageId(ctx.messageId ?? null);
      setEvaluatorError(null);
      try {
        // Use Integrated Multimodal + Content Evaluator pipeline when multimodal turn data exists,
        // or call AI Evaluator directly with delivery_analytics attached.
        let res: ArgumentEvaluationResult | null = null;
        if (ctx.multimodalResult) {
          try {
            const integrated = await aiApi.evaluateSpeechMultimodal({
              motion: resolvedMotion,
              side: debaterSide,
              stage: ctx.stage,
              opponent_argument_text: ctx.opponentText,
              turn_data: {
                transcript_override: ctx.argumentText,
                duration_seconds: ctx.durationSeconds,
              },
              existing_multimodal_result: ctx.multimodalResult,
            });
            if (integrated?.content_evaluation) {
              res = integrated.content_evaluation;
            }
          } catch (multiEvalErr) {
            console.warn("Fallback to direct /evaluate after multimodal pipeline warning:", multiEvalErr);
          }
        }

        if (!res) {
          res = await aiApi.evaluateSpeechArgument({
            motion: resolvedMotion,
            side: debaterSide,
            stage: ctx.stage,
            argument_text: ctx.argumentText,
            opponent_argument_text: ctx.opponentText,
            delivery_analytics: ctx.deliveryAnalytics ?? undefined,
          });
        }

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
  const handleSendArgument = async (opts: SendArgumentOptions = {}) => {
    const isAutoSubmit = opts.auto === true;
    const currentText = opts.text?.trim() || argumentText.trim() || opts.fallbackText?.trim() || "";
    // Nothing said or written: the fallback notice stands in for the speech, and the AI is told it was a skipped turn
    const skippedTurn = !opts.text?.trim() && !argumentText.trim() && Boolean(opts.fallbackText?.trim());
    if (isPreparing) {
      setRoomFeedback({ text: PREPARATION_IN_PROGRESS_MESSAGE, type: "info" });
      return;
    }
    if (
      isSubmittingRef.current ||
      isAiGeneratingRef.current ||
      !currentText ||
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
    if (realtimeSttRef.current) {
      realtimeSttRef.current.disconnectImmediate();
      realtimeSttRef.current = null;
    }
    setLiveInterimTranscript("");
    setLiveSttStatus("idle");
    setRoomFeedback(null);

    // Clear the active turn deadline so the timer cannot fire a timeout while awaiting response
    const deadlineStorageKey = DEADLINE_STORAGE_PREFIX + activeTurnKey;
    const previousDeadlineMs = readStoredNumber(deadlineStorageKey);
    removeStoredValue(deadlineStorageKey);

    const roundAtSubmission = currentRound;
    const stage: DebateRoundType =
      roundAtSubmission === 1 ? "opening" : roundAtSubmission === 2 ? "rebuttal" : "closing";

    const defaultTurnSec =
      roundAtSubmission === 1 ? ROUND_1_DEFAULT_SECONDS : SUBSEQUENT_ROUND_SECONDS;
    const elapsedTurnSec = Math.max(1, defaultTurnSec - Math.max(0, secondsRemaining));
    const recordedSec = opts.durationSeconds ?? recordedDurationSeconds;
    const turnDurationSec = recordedSec ?? elapsedTurnSec;
    const currentMultimodal =
      opts.multimodal !== undefined
        ? opts.multimodal
        : multimodalResult !== consumedMultimodalRef.current
        ? multimodalResult
        : null;
    const normalizedAnalytics = normalizeDeliveryAnalytics(currentMultimodal?.delivery_analytics);
    const computedWordCount = currentText ? currentText.split(/\s+/).length : 0;

    // The Backend rejected (or could not receive) the argument: nothing was submitted, the user keeps
    // their text and the same turn (including its remaining time).
    const abortSubmission = (message: string, type: "error" | "info" = "error") => {
      if (!isP2pOr2v2) {
        submittedRoundsRef.current.delete(roundAtSubmission);
      }
      if (previousDeadlineMs) {
        writeStoredValue(deadlineStorageKey, String(previousDeadlineMs));
      }
      setRoomFeedback({ text: message, type });
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    };

    // 1. Persist the argument to Backend .NET DebateController BEFORE touching local state
    let submittedSession: DebateSessionResponse | undefined;
    if (isBackendSession && !argumentsSubmittedRoundsRef.current.has(roundAtSubmission)) {
      try {
        const res = await debateApi.submitArgument(numSessionId, {
          content: currentText,
          ...(recordedSec !== null && recordedSec !== undefined ? { durationSeconds: recordedSec } : {}),
          ...(normalizedAnalytics ? { deliveryAnalytics: normalizedAnalytics } : {}),
        });
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
        if (isPreparationInProgressError(submitErr)) {
          // Not a network error: Round 1 has not begun on the server. Keep the text and resync the session
          abortSubmission(PREPARATION_IN_PROGRESS_MESSAGE, "info");
          void loadBackendSession(numSessionId);
          return;
        }
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
      wordCount: computedWordCount,
      durationSeconds: turnDurationSec,
      deliveryAnalytics: normalizedAnalytics ?? null,
    };

    setMessages((prev) => [...prev, newDebaterMsg]);
    setArgumentText("");
    setRecordedDurationSeconds(null);
    if (currentMultimodal) consumedMultimodalRef.current = currentMultimodal;

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

    // 2. Call AI Evaluator Microservice (POST /evaluate or /multimodal/evaluate-speech) — independent of AI Opponent turn state
    const opponentRecentSpeech =
      messages
        .filter((m) => m.speaker === "AI")
        .slice(-1)[0]?.content || null;

    void runTurnEvaluation({
      messageId: newDebaterMsg.id,
      stage,
      argumentText: currentText,
      opponentText: opponentRecentSpeech,
      durationSeconds: turnDurationSec,
      deliveryAnalytics: normalizedAnalytics ?? null,
      multimodalResult: currentMultimodal,
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
        ...(skippedTurn ? { skipped: true } : {}),
      },
    });
  };

  const handlePassTurn = useCallback(() => {
    if (!canSpeak || isSubmitting || isAiGenerating || EffectiveExpired || secondsRemaining <= 0 || EffectiveDebateCompleted) return;
    void handleSendArgument({ auto: true, fallbackText: "(Thí sinh chủ động bỏ lượt)" });
    setRoomFeedback({ text: "Bạn đã bỏ lượt. Đang chuyển lượt sang Đối thủ AI...", type: "warning" });
  }, [canSpeak, isSubmitting, isAiGenerating, EffectiveExpired, secondsRemaining, EffectiveDebateCompleted]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    argumentTextRef.current = argumentText;
    sendArgumentRef.current = handleSendArgument;
  });

  // Convert evaluation suggestions & AI Coaching result (/coaching/argument) to coaching advice cards
  const coachingAdvice: CoachingAdvice[] = [
    ...(coachingResult
      ? [
          ...(coachingResult.focus_area
            ? [
                {
                  type: "weakness" as const,
                  label: "Trọng tâm cần cải thiện (AI Coach)",
                  content: `${coachingResult.focus_area} — ${coachingResult.summary}`,
                },
              ]
            : []),
          ...(coachingResult.rewritten_example
            ? [
                {
                  type: "evidence" as const,
                  label: "Ví dụ viết lại mẫu từ AI Coach",
                  content: coachingResult.rewritten_example,
                },
              ]
            : []),
          ...(coachingResult.drills?.map((d) => ({
            type: "strategy" as const,
            label: "Bài tập rèn luyện lập luận",
            content: d,
          })) || []),
          ...(coachingResult.next_turn_advice?.map((a) => ({
            type: "strategy" as const,
            label: "Chiến thuật lượt tiếp theo",
            content: a,
          })) || []),
        ]
      : []),
    ...(evaluationResult
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
      : []),
  ];

  // Request AI Coaching (/coaching/argument) & Evaluation from the side panel
  const handleRequestEvaluation = useCallback(async () => {
    const latestDebaterMsg = messages.filter((m) => getEvaluatorSpeaker(m) === "learner").slice(-1)[0];
    if (!latestDebaterMsg) return;
    const msgRound = latestDebaterMsg.roundNumber;
    const stage: DebateRoundType = msgRound === 1 ? "opening" : msgRound === 2 ? "rebuttal" : "closing";
    const opponentText =
      messages.filter((m) => getEvaluatorSpeaker(m) === "opponent").slice(-1)[0]?.content || null;

    setIsCoachingLoading(true);
    setEvaluatorError(null);
    try {
      let evalRes = evaluationResult;
      if (!evalRes) {
        evalRes = await aiApi.evaluateSpeechArgument({
          motion: resolvedMotion,
          side: debaterSide,
          stage,
          argument_text: latestDebaterMsg.content,
          opponent_argument_text: opponentText,
          delivery_analytics: latestDebaterMsg.deliveryAnalytics ?? undefined,
        });
        setEvaluationResult(evalRes);
      }

      const coachRes = await aiApi.coachArgument({
        motion: resolvedMotion,
        side: debaterSide,
        stage,
        argument_text: latestDebaterMsg.content,
        opponent_argument_text: opponentText,
        evaluation: evalRes,
      });
      setCoachingResult(coachRes);
    } catch (evalErr: unknown) {
      console.error("Error requesting AI coaching:", evalErr);
      setEvaluatorError(`AI Coaching: ${getErrorMessage(evalErr, "Lỗi không xác định")}`);
    } finally {
      setIsCoachingLoading(false);
    }
  }, [messages, resolvedMotion, debaterSide, getEvaluatorSpeaker, evaluationResult]);

  const handleFinishDebate = async () => {
    if (
      isFinishingRef.current ||
      (!EffectiveDebateCompleted && !isDebateCompleted && !isBackendCompleted) ||
      isSubmittingRef.current
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

      // The user's seat (so the side whose result is shown) needs the account: temporary, the retry fixes it.
      if (isBackendSession && currentUserId === null) {
        throw new Error("chưa tải xong thông tin tài khoản");
      }
      // Without a seat in the session the URL's side would only be a guess: no result shown.
      if (isBackendSession && !myParticipant && userRoleInRoom !== "Judge" && userRoleInRoom !== "Spectator") {
        const hasMyMessages = messages.some((m) => m.isCurrentUser);
        if (!hasMyMessages && sessionDetails?.participants && sessionDetails.participants.length > 0) {
          console.warn("User not in session participants, but proceeding to result page.");
        }
      }

      // The official result is the Backend's: it started grading the debate in the background when the last turn
      // was submitted. The result page waits for it (GET /evaluation) behind the "Đang tổng hợp kết quả" overlay.
      navigate(`/debater/debate/${sessionId}/result`);
    } catch (finishErr) {
      console.error("Error evaluating debate session:", finishErr);
      setFinishEvaluationFailed(true);
      setEvaluatorError(
        `${FINISH_EVALUATION_ERROR} (${getErrorMessage(finishErr, "lỗi không xác định")})`
      );
    } finally {
      isFinishingRef.current = false;
      setIsEvaluating(false);
    }
  };

  // A Backend debate that ends DURING this visit (my last turn, the AI's last turn, or the other side's last turn
  // seen by polling) goes straight to the result page. One opened already completed (history) stays here.
  const finishDebateRef = useRef(handleFinishDebate);
  useEffect(() => {
    finishDebateRef.current = handleFinishDebate; // runs before the effect below (declaration order)
  });
  const openedCompletedRef = useRef<boolean | null>(null);
  // One automatic attempt per visit: if it stops on a guard (account / session not loaded), the retry button takes over
  const autoFinishTriedRef = useRef(false);
  const backendCompleted = sessionDetails ? sessionDetails.status === 3 || String(sessionDetails.status) === "Completed" : null;
  useEffect(() => {
    if (!isBackendSession || backendCompleted === null) return;
    if (openedCompletedRef.current === null) {
      openedCompletedRef.current = backendCompleted;
      return;
    }
    // The Backend says Completed only once the last turn is recorded (and the evaluation has started)
    if (!openedCompletedRef.current && backendCompleted && EffectiveDebateCompleted && !isSubmitting && !isAiGenerating
        && !autoFinishTriedRef.current) {
      autoFinishTriedRef.current = true;
      void finishDebateRef.current();
    }
  }, [isBackendSession, backendCompleted, EffectiveDebateCompleted, isSubmitting, isAiGenerating]);

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
    (EffectiveDebateCompleted ? null : opponentError) ||
    evaluatorError ||
    (opponentInitFailed && !EffectiveDebateCompleted ? "Chưa kết nối được Đối thủ AI. Vui lòng thử lại." : null) ||
    (pendingTurnEvaluation ? TURN_EVALUATION_ERROR : null) ||
    (finishEvaluationFailed ? FINISH_EVALUATION_ERROR : null);

  return (
    <div className="max-w-6xl mx-auto flex flex-col h-[calc(100vh-5.5rem)] min-h-[580px] bg-white dark:bg-[#0B1813] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden">
      {/* 1. COMPACT STICKY HEADER */}
      <DebateHeader
        motionText={motionText}
        mode={roomMode}
        userRoleInRoom={userRoleInRoom}
        debaterSide={debaterSide}
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
        onExit={() => requestExit("/debater/dashboard")}
        onSubmitDebate={handleFinishDebate}
      />

      {!isAiDeviceSetup && !isWaitingInLobby && !isLoadingBackendSession && (
        <RoundStatusBar
          round={displayRound}
          totalRounds={totalRounds}
          roundLabel={displayRoundLabel}
          isPreparing={isPreparing}
          isPrepStarting={prepClockExpired}
          prepSecondsLeft={prepSecondsLeft}
          secondsRemaining={secondsRemaining}
          isAiWriting={!isP2pOr2v2 && (isAiGenerating || isWaitingForAiFirstTurn || liveAiSpeech !== null)}
          isAiPresenting={isAiPresenting}
          canSpeak={canSpeak}
          isExpired={EffectiveExpired}
          isCompleted={EffectiveDebateCompleted}
          isWaitingForOpponent={isP2pOr2v2 ? !isMyP2pTurn : isWaitingForOpponentInAiMode}
          canSkipPreparation={Boolean(sessionDetails?.canSkipPreparation) && userRoleInRoom === "Debater"}
          isSkippingPreparation={isSkippingPreparation}
          onSkipPreparation={() => void handleSkipPreparation()}
          readingPartName={
            !isP2pOr2v2 && isAiReadingAloud ? (readingStage ? STAGE_NAMES[readingStage] : "AI đọc") : null
          }
          onSkipReading={skipAiReading}
          announcedRound={roundBanner}
        />
      )}

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
              : roomFeedback?.type === "warning"
              ? "bg-amber-50/80 dark:bg-amber-950/30 border-amber-200/70 dark:border-amber-800/50"
              : roomFeedback?.type === "info"
              ? "bg-sky-50/80 dark:bg-sky-950/30 border-sky-200/70 dark:border-sky-800/50"
              : "bg-rose-50/80 dark:bg-rose-950/30 border-rose-200/70 dark:border-rose-800/50"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle
              size={14}
              className={
                roomFeedback?.type === "success"
                  ? "text-[#008A64] shrink-0"
                  : roomFeedback?.type === "warning"
                  ? "text-amber-600 dark:text-amber-400 shrink-0"
                  : roomFeedback?.type === "info"
                  ? "text-sky-600 dark:text-sky-400 shrink-0"
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
            {(remoteSpeakingUser || remoteLiveTranscript) && (
              <div className="mx-4 mt-2 px-3.5 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 space-y-1 text-xs text-purple-700 dark:text-purple-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-600 animate-ping shrink-0" />
                    <span>
                      <strong className="font-bold">
                        {remoteSpeakingUser?.fullName || remoteLiveTranscript?.fullName}
                      </strong>{" "}
                      đang phát biểu trực tiếp...
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 tracking-wide uppercase">
                    Live
                  </span>
                </div>
                {remoteLiveTranscript &&
                  (remoteLiveTranscript.confirmedText || remoteLiveTranscript.interimText) && (
                    <p className="text-xs text-purple-900 dark:text-purple-100 bg-white/70 dark:bg-purple-900/30 rounded-lg px-2.5 py-1.5 leading-relaxed">
                      <span>{remoteLiveTranscript.confirmedText}</span>
                      {remoteLiveTranscript.interimText && (
                        <span className="italic opacity-75">
                          {remoteLiveTranscript.confirmedText ? " " : ""}
                          {remoteLiveTranscript.interimText}
                        </span>
                      )}
                    </p>
                  )}
              </div>
            )}

            {isAiDeviceSetup && (
              <RoomLoadingPanel
                phase={devices.phase}
                stream={devices.stream}
                hasVideo={devices.hasVideo}
                micError={devices.micError}
                cameraError={devices.cameraError}
                softTimedOut={devices.softTimedOut}
                onRetryDevices={devices.retry}
                onContinueWithoutMic={devices.skip}
                opponentState={
                  opponentReady
                    ? "done"
                    : aiOpponentStatus === "error"
                    ? "error"
                    : aiOpponentStatus === "planning"
                    ? "loading"
                    : "waiting"
                }
                openingState={
                  !aiNeedsPreparedOpening
                    ? null
                    : openingPrep === "ready"
                    ? "done"
                    : openingPrep === "error"
                    ? "error"
                    : openingPrep === "writing"
                    ? "loading"
                    : "waiting"
                }
                onRetryOpponent={() => setOpponentInitNonce((n) => n + 1)}
              />
            )}

            {isPreparing && (
              <PreparationPanel
                motion={motionText}
                side={userRoleInRoom === "Debater" && isParticipant ? debaterSide : null}
              />
            )}

            {!isP2pOr2v2 && (hasServerVoice || viVoice) && isAiTurnStreamEnabled() && (
              <div className="mx-4 mt-2 flex flex-wrap items-center justify-end gap-2">
                {hasServerVoice && aiVoice !== null && (
                  // Picked on the topic page before the room; shown so the learner knows which voice is used
                  <span data-testid="ai-voice-current" className="text-xs text-slate-500 dark:text-slate-400">
                    Giọng: {currentVoiceLabel}
                  </span>
                )}
                <button
                  type="button"
                  onClick={toggleReadAloud}
                  aria-pressed={readAloud}
                  data-testid="ai-read-aloud-toggle"
                  title={`Đọc to bài nói của Đối thủ AI bằng giọng ${hasServerVoice ? "Azure (tiếng Việt) đã chọn" : viVoice?.name ?? ""}`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#008A64]/30"
                >
                  {readAloud ? <Volume2 size={14} aria-hidden="true" /> : <VolumeX size={14} aria-hidden="true" />}
                  {readAloud ? "AI đọc to: bật" : "AI đọc to: tắt"}
                </button>
              </div>
            )}

            <DebateChat
              messages={messages}
              mode={roomMode}
              debaterSide={debaterSide}
              currentRound={currentRound}
              isAiGenerating={isAiGenerating || isWaitingForAiFirstTurn}
              liveAiSpeech={liveAiSpeech}
              isAiRewriting={isAiRewriting}
              aiSide={aiSide}
              timedOutRounds={timedOutRounds}
              isTurnExpired={EffectiveExpired}
              isDebateCompleted={EffectiveDebateCompleted}
              canSubmitDebate={EffectiveDebateCompleted}
              isEvaluating={isEvaluating}
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
              isAnalyzingMultimodal={isAnalyzingMultimodal}
              liveInterimTranscript={liveInterimTranscript}
              liveSttStatus={liveSttStatus}
              micLevel={micLevel}
              micLabel={micLabel}
              liveFrameAnalysis={liveFrameAnalysis}
              videoPreviewRef={videoPreviewRef}
              overlayCanvasRef={overlayCanvasRef}
              hasActiveCamera={hasActiveCamera}
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
              onPassTurn={handlePassTurn}
              onToggleRecording={handleToggleRecording}
              onRunSampleMultimodal={handleRunSampleMultimodal}
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
            multimodalResult={multimodalResult}
            isEvaluating={isEvaluating}
            isCoachingLoading={isCoachingLoading}
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

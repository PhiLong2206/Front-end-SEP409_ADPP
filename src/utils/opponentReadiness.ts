import type { BackendDifficulty } from "../types/ai.types";

/**
 * Helpers for the AI Opponent Service lifecycle (ai-opponent-service, `SessionStatus`):
 *   created | planning | ready | failed
 * `POST /opponent/sessions` may return while the case plan is still being generated (status=planning);
 * `POST /opponent/sessions/{id}/turns` answers 409 "Session chua san sang (status=planning)..." until READY.
 * `GET /opponent/sessions/{id}` returns the session `status` (and the case file once READY).
 */

export const OPPONENT_POLL_INTERVAL_MS = 2000;
/** Case planning budget on the service is 240s (CASE_PLAN_TOTAL_BUDGET_SECONDS); leave a margin. */
export const OPPONENT_PLANNING_TIMEOUT_MS = 300_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 409 coming from a session that is still planning — a temporary state, not an error. */
export function isPlanningConflict(error: unknown): boolean {
  const e = error as { detail?: unknown; message?: unknown } | null;
  const text = String(e?.detail ?? e?.message ?? "");
  return /status=planning|dang chuan bi case/i.test(text);
}

interface WaitOptions {
  isCancelled: () => boolean;
  /** Called every time we are about to wait because the service is still planning. */
  onWaiting?: () => void;
  timeoutMs?: number;
  intervalMs?: number;
}

/** Polls `getStatus` until the opponent session is READY. Throws on `failed`, timeout or cancellation. */
export async function waitUntilOpponentReady(
  getStatus: () => Promise<string>,
  { isCancelled, onWaiting, timeoutMs = OPPONENT_PLANNING_TIMEOUT_MS, intervalMs = OPPONENT_POLL_INTERVAL_MS }: WaitOptions
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const status = await getStatus();
    if (status === "ready") return;
    if (status === "failed") {
      throw new Error("Đối thủ AI không lập được kế hoạch tranh biện.");
    }
    if (isCancelled()) throw new Error("Đã huỷ chờ Đối thủ AI.");
    if (Date.now() >= deadline) {
      throw new Error("Đối thủ AI chuẩn bị quá lâu (quá thời gian chờ).");
    }
    onWaiting?.();
    await sleep(intervalMs);
  }
}

/** Runs `fn`, waiting and calling it again while the service answers "still planning" (409). */
export async function retryWhilePlanning<T>(
  fn: () => Promise<T>,
  { isCancelled, onWaiting, timeoutMs = OPPONENT_PLANNING_TIMEOUT_MS, intervalMs = OPPONENT_POLL_INTERVAL_MS }: WaitOptions
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      return await fn();
    } catch (error) {
      if (!isPlanningConflict(error) || isCancelled() || Date.now() >= deadline) throw error;
      onWaiting?.();
      await sleep(intervalMs);
    }
  }
}

/**
 * Canonical form of a motion: the opponent service compares motions byte for byte, so the same text in
 * another Unicode form (NFD vs NFC) or with stray spaces would be a "different" session.
 */
export const normalizeMotion = (motion: string): string => motion.normalize("NFC").trim();

const DIFFICULTY_BY_LABEL: Record<string, BackendDifficulty> = {
  easy: "easy",
  medium: "medium",
  hard: "hard",
  "dễ": "easy",
  "trung bình": "medium",
  "khó": "hard",
};

/** Accepts the labels of the Backend and of the UI; anything else is null, so the next source is used. */
export const parseDifficulty = (value: unknown): BackendDifficulty | null =>
  DIFFICULTY_BY_LABEL[String(value ?? "").normalize("NFC").trim().toLowerCase()] ?? null;

/**
 * The opponent session of a Backend session. Deterministic, so a reload reconnects to the same opponent
 * session; `createdAt` keeps a reused numeric id (the Backend DB was reset) from reaching an old debate's
 * session. Without it there is no safe id: null, and the caller must not start.
 */
export const buildBackendOpponentSessionId = (sessionId: number, createdAt?: string | null): string | null =>
  createdAt ? `be-${sessionId}-${createdAt.replace(/[^0-9A-Za-z]/g, "")}` : null;

const LOCAL_OPPONENT_SESSION_PREFIX = "adpp_opponent_session_";
// Used only when sessionStorage is unavailable: the id then lasts as long as the page
const localOpponentSessionFallback = new Map<string, string>();

const newUuid = (): string => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // randomUUID exists only in secure contexts
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/**
 * The opponent session of a room with no Backend session (session-N, session-comp-N): their route id is
 * shared by every practice of that topic, so each tab gets its own UUID, kept across reloads.
 */
export const getLocalOpponentSessionId = (roomId: string): string => {
  const key = LOCAL_OPPONENT_SESSION_PREFIX + roomId;
  try {
    const stored = sessionStorage.getItem(key);
    if (stored) return stored;
  } catch {
    // Falls through to the in-memory id
  }
  const remembered = localOpponentSessionFallback.get(key);
  if (remembered) return remembered;

  const created = newUuid();
  try {
    sessionStorage.setItem(key, created);
  } catch {
    localOpponentSessionFallback.set(key, created);
  }
  return created;
};

/** Leaving a room ends its opponent session: the next entry gets a new one. */
export const clearLocalOpponentSessionId = (roomId: string): void => {
  const key = LOCAL_OPPONENT_SESSION_PREFIX + roomId;
  localOpponentSessionFallback.delete(key);
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Nothing else holds the id
  }
};

type OpponentError = { status?: number; statusCode?: number; detail?: unknown; message?: unknown } | null | undefined;

const errorStatus = (error: unknown): number | undefined => {
  const e = error as OpponentError;
  return e?.status ?? e?.statusCode;
};

const errorText = (error: unknown): string => {
  const e = error as OpponentError;
  return String(e?.detail ?? e?.message ?? "");
};

/** 409 "external_session_id '..' da ton tai voi du lieu khac: motion" — the session exists with other data. */
export function isSessionDataConflict(error: unknown): boolean {
  return errorStatus(error) === 409 && /da ton tai voi du lieu khac/i.test(errorText(error));
}

/** 409 LEARNER_SPEECH_MISMATCH: this AI turn was generated from another speech, so calling again cannot help. */
export function isLearnerSpeechMismatch(error: unknown): boolean {
  return errorStatus(error) === 409 && (error as { code?: unknown } | null)?.code === "LEARNER_SPEECH_MISMATCH";
}

/** Vietnamese message for a failure of the AI Opponent Service, chosen by what the failure really is. */
export function getOpponentErrorMessage(error: unknown, fallbackDetail = "lỗi không xác định"): string {
  if (isSessionDataConflict(error)) {
    return "Dữ liệu phiên Đối thủ AI không khớp với phiên đã tạo trước đó (kiến nghị, phe hoặc độ khó). Thử lại sẽ không khắc phục được, vui lòng quay lại và tạo phiên tranh biện mới.";
  }
  switch (errorStatus(error)) {
    case 400:
      return "Thiết lập phiên Đối thủ AI không hợp lệ (hai phe phải khác nhau). Vui lòng thử lại.";
    case 502:
      return "Đối thủ AI trả về kết quả không hợp lệ. Vui lòng thử lại.";
    case 503:
      return "Dịch vụ Đối thủ AI chưa được cấu hình. Vui lòng liên hệ quản trị viên.";
    case 504:
      return "Đối thủ AI chuẩn bị quá lâu. Vui lòng thử lại.";
    default: {
      const detail = errorText(error) || fallbackDetail;
      return `Không kết nối được Đối thủ AI: ${detail}. Vui lòng thử lại.`;
    }
  }
}

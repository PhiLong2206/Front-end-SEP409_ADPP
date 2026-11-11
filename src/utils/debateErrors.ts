/** Error codes returned by the debate Backend in `errors.code` (/arguments and /ai-arguments). */
const DEBATE_ERROR_MESSAGES: Record<string, string> = {
  INVALID_REQUEST: "Dữ liệu gửi lên không hợp lệ.",
  NOT_AI_SESSION: "Đây không phải phiên luyện tập với AI.",
  NOT_AI_TURN: "Chưa tới lượt của Đối thủ AI.",
  NOT_YOUR_TURN: "Chưa tới lượt của bạn.",
  NOT_PARTICIPANT: "Bạn không phải người tham gia phiên tranh biện này.",
  SESSION_NOT_FOUND: "Không tìm thấy phiên tranh biện.",
  TURN_OUT_OF_ORDER: "Lượt phát biểu không đúng thứ tự — hệ thống đang chờ một lượt khác.",
  SESSION_NOT_IN_PROGRESS: "Phiên tranh biện hiện không diễn ra.",
  SESSION_COMPLETED: "Phiên tranh biện đã kết thúc.",
  CONCURRENT_SUBMISSION: "Hệ thống đang xử lý một lượt khác, vui lòng thử lại.",
};

type ErrorLike = { message?: unknown; errors?: unknown } | null | undefined;

export function getDebateErrorCode(error: unknown): string | null {
  const errors = (error as ErrorLike)?.errors as { code?: unknown } | undefined;
  return typeof errors?.code === "string" ? errors.code : null;
}

/** Vietnamese message for a debate Backend error, chosen by `errors.code` (never the raw Backend text). */
export function getDebateErrorMessage(error: unknown, fallback: string): string {
  const code = getDebateErrorCode(error);
  if (code && Object.prototype.hasOwnProperty.call(DEBATE_ERROR_MESSAGES, code)) {
    return DEBATE_ERROR_MESSAGES[code];
  }
  return fallback;
}

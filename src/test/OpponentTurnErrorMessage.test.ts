import { describe, it, expect } from "vitest";
import { opponentTurnErrorMessage, OPPONENT_TURN_DEFAULT_ERROR } from "../utils/opponentReadiness";

describe("opponentTurnErrorMessage", () => {
  it("explains a side flip", () => {
    expect(opponentTurnErrorMessage({ status: 502, code: "side_flip" })).toBe(
      "Đối thủ AI viết lệch phe nhiều lần. Vui lòng bấm Thử lại."
    );
  });

  it("explains a timeout by budget_exceeded or status 504", () => {
    const slow = "Đối thủ AI phản hồi quá lâu. Vui lòng thử lại.";
    expect(opponentTurnErrorMessage({ status: 504, code: "budget_exceeded" })).toBe(slow);
    expect(opponentTurnErrorMessage({ status: 504 })).toBe(slow);
  });

  it.each(["truncated_max_tokens", "banned_phrase", "schema_validation", "invalid_json"])(
    "explains an invalid speech (%s)",
    (code) => {
      expect(opponentTurnErrorMessage({ status: 502, code })).toBe(
        "Đối thủ AI chưa tạo được bài nói hợp lệ. Vui lòng thử lại."
      );
    }
  );

  it("keeps the generic message for network errors and unknown codes", () => {
    expect(opponentTurnErrorMessage(new Error("Failed to fetch"))).toBe(OPPONENT_TURN_DEFAULT_ERROR);
    expect(opponentTurnErrorMessage({ status: 502, code: "other" })).toBe(OPPONENT_TURN_DEFAULT_ERROR);
    expect(opponentTurnErrorMessage(null)).toBe(OPPONENT_TURN_DEFAULT_ERROR);
  });
});

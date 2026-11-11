import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { recordAiArgument } from "../utils/recordAiArgument";

const mockSubmitAiArgument = vi.fn();

vi.mock("../api", () => ({
  debateApi: {
    submitAiArgument: (...args: unknown[]) => mockSubmitAiArgument(...args),
  },
}));

const session = { sessionId: 123, status: 2, currentTurn: { turnIndex: 2 } };
const okResponse = (alreadyRecorded = false) => ({
  success: true,
  message: "ok",
  data: { turnIndex: 1, alreadyRecorded, argument: {}, session },
});
const apiError = (code: string, status = 409) => ({ success: false, message: "raw", errors: { code }, status });

describe("recordAiArgument", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("posts the content and the 0-based turnIndex and returns the Backend session", async () => {
    mockSubmitAiArgument.mockResolvedValue(okResponse());

    const result = await recordAiArgument({ backendSessionId: 123, turnIndex: 1, text: "Lập luận AI" });

    expect(mockSubmitAiArgument).toHaveBeenCalledWith(123, { content: "Lập luận AI", turnIndex: 1 });
    expect(result).toEqual({ session, alreadyRecorded: false });
  });

  it("treats alreadyRecorded: true as a success", async () => {
    mockSubmitAiArgument.mockResolvedValue(okResponse(true));

    await expect(recordAiArgument({ backendSessionId: 123, turnIndex: 1, text: "x" })).resolves.toEqual({
      session,
      alreadyRecorded: true,
    });
    expect(mockSubmitAiArgument).toHaveBeenCalledTimes(1);
  });

  it("retries a 409 CONCURRENT_SUBMISSION with a short backoff, then succeeds", async () => {
    mockSubmitAiArgument
      .mockRejectedValueOnce(apiError("CONCURRENT_SUBMISSION"))
      .mockRejectedValueOnce(apiError("CONCURRENT_SUBMISSION"))
      .mockResolvedValueOnce(okResponse());

    const promise = recordAiArgument({ backendSessionId: 123, turnIndex: 1, text: "x" });
    await vi.advanceTimersByTimeAsync(2000);

    await expect(promise).resolves.toMatchObject({ alreadyRecorded: false });
    expect(mockSubmitAiArgument).toHaveBeenCalledTimes(3);
  });

  it("gives up and throws when CONCURRENT_SUBMISSION keeps happening", async () => {
    mockSubmitAiArgument.mockRejectedValue(apiError("CONCURRENT_SUBMISSION"));

    const promise = recordAiArgument({ backendSessionId: 123, turnIndex: 1, text: "x" });
    const assertion = expect(promise).rejects.toMatchObject({ errors: { code: "CONCURRENT_SUBMISSION" } });
    await vi.advanceTimersByTimeAsync(5000);

    await assertion;
    expect(mockSubmitAiArgument).toHaveBeenCalledTimes(3); // first call + 2 retries
  });

  it("throws immediately on any other error code (the UI blocks and offers a retry)", async () => {
    mockSubmitAiArgument.mockRejectedValue(apiError("TURN_OUT_OF_ORDER"));

    await expect(recordAiArgument({ backendSessionId: 123, turnIndex: 4, text: "x" })).rejects.toMatchObject({
      errors: { code: "TURN_OUT_OF_ORDER" },
    });
    expect(mockSubmitAiArgument).toHaveBeenCalledTimes(1);
  });

  it("throws when the Backend answers success: false", async () => {
    mockSubmitAiArgument.mockResolvedValue({ success: false, message: "no", errors: { code: "NOT_AI_TURN" } });

    await expect(recordAiArgument({ backendSessionId: 123, turnIndex: 1, text: "x" })).rejects.toMatchObject({
      errors: { code: "NOT_AI_TURN" },
    });
  });

  it("does nothing for a session that is not in the Backend", async () => {
    await expect(recordAiArgument({ backendSessionId: null, turnIndex: 0, text: "x" })).resolves.toBeNull();
    expect(mockSubmitAiArgument).not.toHaveBeenCalled();
  });
});

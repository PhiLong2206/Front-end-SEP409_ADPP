import { debateApi } from "../api";
import type { DebateSessionResponse } from "../types";
import { getDebateErrorCode } from "./debateErrors";

export interface AiArgumentRecord {
  /** Numeric Backend (.NET) session id, or `null` for a local / non-Backend session (nothing to record). */
  backendSessionId: number | null;
  /** 0-based Backend turn index of the AI turn (0..5). */
  turnIndex: number;
  text: string;
}

export interface AiArgumentRecordResult {
  /** The Backend session after the turn: `currentTurn.turnIndex` says whose turn comes next. */
  session: DebateSessionResponse;
  /** true when the turn had already been recorded by an earlier attempt. */
  alreadyRecorded: boolean;
}

/** Delays before re-calling after a 409 CONCURRENT_SUBMISSION (short backoff, then give up). */
export const CONCURRENT_SUBMISSION_BACKOFF_MS = [300, 700];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Records the AI opponent's argument in the Backend transcript (POST /debate/{id}/ai-arguments), right after
 * the AI Opponent Service produced the turn. It is retried on its own (see `runAiTurn` in DebateRoom) — never
 * together with `/arguments` or `/turns`.
 *
 * - `alreadyRecorded: true` is a success (idempotent retry).
 * - 409 CONCURRENT_SUBMISSION is retried here a couple of times with a short backoff.
 * - Any other failure throws, so the UI blocks and offers a retry.
 * - Returns `null` for sessions that do not live in the Backend.
 */
export async function recordAiArgument(turn: AiArgumentRecord): Promise<AiArgumentRecordResult | null> {
  if (turn.backendSessionId === null) return null;

  for (let attempt = 0; ; attempt++) {
    try {
      const res = await debateApi.submitAiArgument(turn.backendSessionId, {
        content: turn.text,
        turnIndex: turn.turnIndex,
      });
      if (!res?.success || !res.data) {
        throw res ?? new Error("Backend did not accept the AI argument.");
      }
      return { session: res.data.session, alreadyRecorded: res.data.alreadyRecorded };
    } catch (error) {
      const retryDelay = CONCURRENT_SUBMISSION_BACKOFF_MS[attempt];
      if (getDebateErrorCode(error) !== "CONCURRENT_SUBMISSION" || retryDelay === undefined) {
        throw error;
      }
      await sleep(retryDelay);
    }
  }
}

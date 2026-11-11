import type { BackendDebateSide, DebateRoundType } from "../types";

export interface TurnOrderEntry {
  /** 0-based index used by the Backend (`currentTurn.turnIndex`, `/ai-arguments` `turnIndex`). */
  turnIndex: number;
  /** Round number shown in the UI (1 = opening, 2 = rebuttal, 3 = closing). */
  round: 1 | 2 | 3;
  stage: DebateRoundType;
  side: BackendDebateSide;
}

/**
 * Turn order shared with the Backend (DebateTurnOrder.cs). It is NOT "pro always first":
 * in the closing round CON speaks first, so a side can speak two turns in a row.
 * Used to DISPLAY rounds/sides and as a fallback only — whose turn comes next is read from the
 * Backend's `session.currentTurn.turnIndex` (see readBackendTurnState).
 */
export const TURN_ORDER: readonly TurnOrderEntry[] = [
  { turnIndex: 0, round: 1, stage: "opening", side: "pro" },
  { turnIndex: 1, round: 1, stage: "opening", side: "con" },
  { turnIndex: 2, round: 2, stage: "rebuttal", side: "pro" },
  { turnIndex: 3, round: 2, stage: "rebuttal", side: "con" },
  { turnIndex: 4, round: 3, stage: "closing", side: "con" },
  { turnIndex: 5, round: 3, stage: "closing", side: "pro" },
];

/**
 * The ONLY place that converts between the Backend's 0-based `turnIndex` and the AI Opponent
 * Service's 1-based `turn_index` (turn_index = turnIndex + 1).
 */
export const toOpponentTurnIndex = (turnIndex: number): number => turnIndex + 1;

export function getTurnEntry(turnIndex: number): TurnOrderEntry {
  const entry = TURN_ORDER.find((t) => t.turnIndex === turnIndex);
  if (!entry) throw new Error(`Unknown turn index ${turnIndex}`);
  return entry;
}

/** The `turnIndex` of `side`'s turn in `round`. */
export function getTurnIndex(round: number, side: BackendDebateSide): number {
  const entry = TURN_ORDER.find((t) => t.round === round && t.side === side);
  if (!entry) throw new Error(`No turn for ${side} in round ${round}`);
  return entry.turnIndex;
}

/**
 * Fallback (no Backend session, e.g. local demo sessions): the AI turns that follow the learner's turn
 * `learnerTurn` — every following turn of the AI side up to the next learner turn or the end.
 *
 *   learner PRO / AI CON : after 0 → [1] · after 2 → [3, 4] · after 5 → []
 *   learner CON / AI PRO : after 1 → [2] · after 3 → []     · after 4 → [5]
 */
export function getAiTurnsAfterLearnerTurn(learnerTurn: number, aiSide: BackendDebateSide): number[] {
  const turns: number[] = [];
  for (const entry of TURN_ORDER) {
    if (entry.turnIndex <= learnerTurn) continue;
    if (entry.side !== aiSide) break;
    turns.push(entry.turnIndex);
  }
  return turns;
}

/** What the Backend says about the session right after a turn was recorded. */
export interface BackendTurnState {
  completed: boolean;
  /** Turn waiting to be played (0-based); `null` when the session is completed. */
  nextTurnIndex: number | null;
}

interface SessionLike {
  status?: unknown;
  currentTurn?: { turnIndex?: number | null } | null;
}

/**
 * Reads the next turn from a Backend `DebateSessionResponse` (`/arguments` and `/ai-arguments` both return one).
 * Returns `null` when the response does not say (no session, or no `currentTurn.turnIndex`), in which case
 * callers fall back to the fixed table.
 */
export function readBackendTurnState(session: SessionLike | null | undefined): BackendTurnState | null {
  if (!session) return null;
  const completed = session.status === 3 || String(session.status) === "Completed";
  if (completed) return { completed: true, nextTurnIndex: null };
  const next = session.currentTurn?.turnIndex;
  if (typeof next === "number" && Number.isInteger(next) && next >= 0 && next < TURN_ORDER.length) {
    return { completed: false, nextTurnIndex: next };
  }
  return null;
}

/** AI turns to play now, given the Backend's state: just the waiting turn when it belongs to the AI. */
export function getAiTurnsFromBackendState(state: BackendTurnState, aiSide: BackendDebateSide): number[] {
  if (state.completed || state.nextTurnIndex === null) return [];
  return getTurnEntry(state.nextTurnIndex).side === aiSide ? [state.nextTurnIndex] : [];
}

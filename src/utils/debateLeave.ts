import { debateApi } from "../api";
import { clearActiveDebateSession } from "../hooks/useDebateNavigationGuard";
import { clearLocalOpponentSessionId } from "./opponentReadiness";

export const DEADLINE_STORAGE_PREFIX = "adpp_turn_deadline_";
export const EXPIRED_STORAGE_PREFIX = "adpp_turn_expired_";
export const TIMED_OUT_ROUNDS_PREFIX = "adpp_timed_out_rounds_";
export const CURRENT_ROUND_PREFIX = "adpp_current_round_";
export const COMPLETED_STORAGE_PREFIX = "adpp_debate_completed_";
export const MESSAGES_STORAGE_PREFIX = "adpp_messages_";
export const DIFFICULTY_STORAGE_PREFIX = "adpp_difficulty_";

/** Off until the Backend has POST /debate/{id}/leave: see .env.example. */
export const isDebateLeaveEnabled = (): boolean => import.meta.env.VITE_DEBATE_LEAVE_ENABLED === "true";

/** Everything saved for one room, so entering it again starts clean. A reload does not come through here. */
export const clearDebateRoomStorage = (roomId: string): void => {
  clearActiveDebateSession(roomId);
  clearLocalOpponentSessionId(roomId);
  try {
    [
      TIMED_OUT_ROUNDS_PREFIX,
      CURRENT_ROUND_PREFIX,
      COMPLETED_STORAGE_PREFIX,
      MESSAGES_STORAGE_PREFIX,
      DIFFICULTY_STORAGE_PREFIX,
    ].forEach((prefix) => sessionStorage.removeItem(prefix + roomId));
    // Turn keys are `${roomId}_...`: the separator keeps room 1 from matching room 11
    const turnKeyPrefixes = [DEADLINE_STORAGE_PREFIX, EXPIRED_STORAGE_PREFIX].map((prefix) => `${prefix}${roomId}_`);
    Object.keys(sessionStorage)
      .filter((key) => turnKeyPrefixes.some((prefix) => key.startsWith(prefix)))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Ignore storage errors
  }
};

/**
 * What confirming "leave" does. The Backend call comes first: an AI reply arriving while it is pending would write
 * the room's messages again. If it fails the user still leaves, and the session stays open on the Backend.
 * Rooms with no Backend session (session-comp-N) have nothing to cancel, so their state is cleared right away.
 * Returns whether the room's state was cleared.
 */
export const leaveDebateRoom = async (roomId: string, backendSessionId: number | null): Promise<boolean> => {
  if (backendSessionId === null) {
    clearDebateRoomStorage(roomId);
    return true;
  }
  if (!isDebateLeaveEnabled()) {
    clearActiveDebateSession(roomId);
    return false;
  }
  try {
    await debateApi.leaveSession(backendSessionId);
  } catch (err) {
    console.warn("Could not cancel the debate session:", err);
  }
  clearDebateRoomStorage(roomId);
  return true;
};

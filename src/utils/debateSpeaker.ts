import type { ParticipantDto } from "../types";

/** How the author of a speech relates to the user being graded. */
export type SpeakerRelation = "self" | "teammate" | "opponent" | "unknown";

/**
 * A speech cannot be attributed to one person. This is a data problem: retrying gives the same answer,
 * so it is reported differently from a temporary failure.
 */
export class UnattributedSpeechError extends Error {
  constructor() {
    super("Không xác định được người nói của một số lượt.");
    this.name = "UnattributedSpeechError";
  }
}

type UserId = string | number | null | undefined;

/** Ids are compared as text: an account id may be a string, or not numeric at all. A missing id matches nothing. */
export const isSameUserId = (a: UserId, b: UserId): boolean =>
  a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b);

const toSideCode = (side: unknown): 1 | 2 | null => {
  if (side === 1 || side === "PRO" || side === "Ủng hộ") return 1;
  if (side === 2 || side === "CON" || side === "Phản đối") return 2;
  return null;
};

/**
 * Works out who wrote a speech in a P2P session.
 *
 * `speakerUserId` is authoritative when present: the Backend transcript's `userId`, or a speech this client
 * has just submitted. Otherwise the author is inferred through the participant list: the other side is always
 * an opponent; on my side a single player is me, and with several players the name must match exactly one of
 * them. A speech that cannot be pinned on one person is "unknown" and must never be graded as the user's own.
 */
export const getSpeakerRelation = (
  speech: { side: unknown; speakerName?: string; speakerUserId?: UserId },
  participants: (Pick<ParticipantDto, "side" | "speakerName"> & { userId?: number | null })[],
  currentUserId: UserId
): SpeakerRelation => {
  const me = participants.find((p) => isSameUserId(p.userId, currentUserId));
  const mySide = toSideCode(me?.side);

  if (speech.speakerUserId !== undefined && speech.speakerUserId !== null) {
    if (isSameUserId(speech.speakerUserId, currentUserId)) return "self";
    const author = participants.find((p) => isSameUserId(p.userId, speech.speakerUserId));
    const authorSide = toSideCode(author?.side);
    if (mySide === null || authorSide === null) return "unknown";
    return authorSide === mySide ? "teammate" : "opponent";
  }

  const speechSide = toSideCode(speech.side);
  if (mySide === null || speechSide === null) return "unknown";
  if (speechSide !== mySide) return "opponent";

  const sameSide = participants.filter((p) => toSideCode(p.side) === mySide);
  const candidates =
    sameSide.length === 1 ? sameSide : sameSide.filter((p) => p.speakerName === speech.speakerName);
  if (candidates.length !== 1) return "unknown";
  return isSameUserId(candidates[0].userId, currentUserId) ? "self" : "teammate";
};

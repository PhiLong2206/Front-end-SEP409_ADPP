/** What the session says about being a team (2v2) debate; the title is only a guess for Backends that do not say. */
export interface TeamDebateInfo {
  isTeamDebate?: boolean;
  maxParticipants?: number;
  title?: string | null;
  participantCount?: number;
}

/**
 * Is this a 2v2 debate? The Backend's `isTeamDebate` decides when it sends it (a new room has one participant and a
 * title without "2v2": guessing would call it 1v1). Only an older Backend (field missing) gets the old guess.
 */
export function isTeamDebateSession(info: TeamDebateInfo): boolean {
  if (typeof info.isTeamDebate === "boolean") return info.isTeamDebate;
  if (typeof info.maxParticipants === "number") return info.maxParticipants > 2;
  const title = info.title?.toLowerCase() ?? "";
  return (info.participantCount ?? 0) > 2 || title.includes("2 vs 2") || title.includes("2v2");
}

/** Seats in the room: the Backend's number, else 4 for 2v2 and 2 otherwise. */
export function roomSeatCount(info: TeamDebateInfo): number {
  if (typeof info.maxParticipants === "number" && info.maxParticipants > 0) return info.maxParticipants;
  return isTeamDebateSession(info) ? 4 : 2;
}

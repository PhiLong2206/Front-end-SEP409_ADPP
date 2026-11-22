/** The Backend gives every debate a preparation before Round 1; its clock is the SERVER's (the machine's may differ). */

export const ROUND_LABELS: Record<number, string> = { 1: "Mở đầu", 2: "Phản biện", 3: "Kết luận" };
export const DEFAULT_TOTAL_ROUNDS = 3;

export const roundLabelOf = (round: number): string => ROUND_LABELS[round] ?? `Vòng ${round}`;

/** server time - local time, taken when a response arrives: add it to Date.now() to read the server clock. */
export function serverClockOffsetMs(serverTime: string | undefined | null, localNow: number = Date.now()): number | null {
  const server = Date.parse(serverTime ?? "");
  return Number.isNaN(server) ? null : server - localNow;
}

/** Whole seconds left until `endIso` on the server clock (never negative). */
export function secondsUntilServerTime(endIso: string, offsetMs: number, localNow: number = Date.now()): number {
  const end = Date.parse(endIso);
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.ceil((end - (localNow + offsetMs)) / 1000));
}

/** A server instant on this machine's clock. */
export function serverTimeToLocalMs(iso: string, offsetMs: number): number | null {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms - offsetMs;
}

export const formatMinutesSeconds = (totalSeconds: number): string => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
};

/** The round banner shows once per (session, round), also after a reload. */
export const ROUND_BANNER_PREFIX = "adpp_round_banner_";

const readShownRounds = (sessionId: string): number[] => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(ROUND_BANNER_PREFIX + sessionId) || "[]");
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
};

export const hasShownRoundBanner = (sessionId: string, round: number): boolean => readShownRounds(sessionId).includes(round);

export const markRoundBannerShown = (sessionId: string, round: number): void => {
  try {
    const shown = readShownRounds(sessionId);
    if (!shown.includes(round)) sessionStorage.setItem(ROUND_BANNER_PREFIX + sessionId, JSON.stringify([...shown, round]));
  } catch {
    // Storage may be unavailable: the banner can then show again, which is harmless
  }
};

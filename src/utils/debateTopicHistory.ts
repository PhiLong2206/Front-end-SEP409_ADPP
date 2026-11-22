import { DebateHistoryItemDto, Topic } from "../types";
import { normalizeTopicCategory } from "../constants/topicCategories";

export type PracticeSide = "PRO" | "CON";

export interface PracticedTopic {
  key: string;
  title: string;
  /** The motion the session was created with. */
  motion: string;
  /** Finished AI practice sessions on this topic. */
  count: number;
  lastSessionId: number;
  lastPracticedAt: string;
  lastSide: PracticeSide | null;
}

const isAiPractice = (type: DebateHistoryItemDto["debateType"]) => type === 1 || String(type) === "AiPractice";
const isCompleted = (status: DebateHistoryItemDto["status"]) => status === 3 || String(status) === "Completed";

export const toPracticeSide = (side: DebateHistoryItemDto["userSide"]): PracticeSide | null =>
  side === 1 || String(side) === "PRO" ? "PRO" : side === 2 || String(side) === "CON" ? "CON" : null;

/** Text compared across the history and the topic list: Unicode form, spacing and case ignored. */
export const normalizeText = (value: string | null | undefined): string =>
  (value ?? "").normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();

const topicKey = (item: DebateHistoryItemDto) => normalizeText(item.topic || item.title);

const parseTime = (iso: string | undefined) => {
  const ms = Date.parse(iso || "");
  return Number.isNaN(ms) ? 0 : ms;
};
const timeOf = (item: DebateHistoryItemDto) => parseTime(item.endedAt || item.createdAt);

/**
 * Groups the finished AI practice sessions by topic (the history carries no topicId yet), newest topic first.
 * Unfinished sessions are left to the "resume" banner; 1v1 and 2v2 sessions are not AI practice.
 */
export function groupPracticedTopics(history: DebateHistoryItemDto[]): PracticedTopic[] {
  const byKey = new Map<string, { latest: DebateHistoryItemDto; count: number }>();

  for (const item of history) {
    if (!isAiPractice(item.debateType) || !isCompleted(item.status)) continue;
    const key = topicKey(item);
    if (!key) continue;
    const entry = byKey.get(key);
    if (!entry) {
      byKey.set(key, { latest: item, count: 1 });
    } else {
      entry.count += 1;
      if (timeOf(item) > timeOf(entry.latest)) entry.latest = item;
    }
  }

  return Array.from(byKey.entries())
    .map(([key, { latest, count }]) => ({
      key,
      title: latest.title || latest.topic,
      motion: latest.topic || latest.title,
      count,
      lastSessionId: latest.sessionId,
      lastPracticedAt: latest.endedAt || latest.createdAt,
      lastSide: toPracticeSide(latest.userSide),
    }))
    .sort((a, b) => parseTime(b.lastPracticedAt) - parseTime(a.lastPracticedAt));
}

/** Every text a topic can be recorded under in the history: the Backend debates its description, else its title. */
const topicTexts = (topic: Topic): string[] =>
  [topic.motion, topic.description, topic.title].map(normalizeText).filter(Boolean);

/** The listed topic a practised one came from (needed to start it again by its id), if it is still listed. */
export function findListedTopic(practiced: PracticedTopic, listed: Topic[]): Topic | undefined {
  const wanted = new Set([practiced.key, normalizeText(practiced.title)].filter(Boolean));
  return listed.find((topic) => topic.isActive !== false && topicTexts(topic).some((text) => wanted.has(text)));
}

/** The listed topics of a known category the learner has not practised yet, in the order of the list. */
export function suggestTopics(listed: Topic[], practiced: PracticedTopic[]): Topic[] {
  const done = new Set(practiced.flatMap((p) => [p.key, normalizeText(p.title)]));
  return listed.filter(
    (topic) =>
      topic.isActive !== false &&
      normalizeTopicCategory(topic.category) !== null &&
      !topicTexts(topic).some((text) => done.has(text))
  );
}

export const topicIdOf = (topic: Topic): number | null => {
  const id = Number(topic.topicId ?? topic.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

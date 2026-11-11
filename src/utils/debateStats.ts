import { DebateHistoryItemDto } from "../types";

/** A session only counts in statistics once it is finished, not while waiting, in progress or cancelled. */
export const isCompletedDebate = (item: Pick<DebateHistoryItemDto, "status">): boolean =>
  item.status === 3 || String(item.status) === "Completed";

export const countCompletedDebates = (history: Array<Pick<DebateHistoryItemDto, "status">>): number =>
  history.filter(isCompletedDebate).length;

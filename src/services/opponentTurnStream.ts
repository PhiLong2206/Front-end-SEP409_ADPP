import type { CreateTurnRequest, TurnResponse } from "../types";

/**
 * POST /opponent/sessions/{id}/turns/stream (turn_full_v4_stream). Server-Sent Events while generating:
 *   attempt {attempt, previous_failure} — a new attempt REPLACES the text of the previous one;
 *   delta {text} — next piece of the speech; done {status, turn}; error {status, detail, code?}.
 * Errors before generating (404 / 400 / 409 / 503) and an already generated turn come back as plain JSON.
 * Rejections have the shape of the axios opponent client ({...body, status}) so the room's 409 / mismatch
 * handling works unchanged.
 */
export interface OpponentTurnStreamHandlers {
  onAttempt?: (attempt: number | null, previousFailure: string | null) => void;
  onDelta?: (text: string) => void;
}

type StreamEvent =
  | { type: "attempt"; attempt: number | null; previous_failure: string | null }
  | { type: "delta"; text: string }
  | { type: "done"; status: number; turn: TurnResponse }
  | { type: "error"; status: number; detail: string; code?: string };

function parseEventBlock(block: string): StreamEvent | null {
  const data = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data) return null;
  try {
    return JSON.parse(data) as StreamEvent;
  } catch {
    return null;
  }
}

export async function streamOpponentTurn(
  baseUrl: string,
  externalSessionId: string,
  body: CreateTurnRequest,
  handlers: OpponentTurnStreamHandlers = {},
  fetchImpl: typeof fetch = fetch
): Promise<TurnResponse> {
  const res = await fetchImpl(`${baseUrl}/sessions/${encodeURIComponent(externalSessionId)}/turns/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
  });

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    const text = await res.text();
    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {
      // not JSON: keep the text as detail
    }
    if (!res.ok) {
      throw typeof data === "object" && data !== null
        ? { ...(data as object), status: res.status }
        : { detail: String(data || res.statusText), status: res.status };
    }
    return data as TurnResponse;
  }

  if (!res.body) throw { detail: "Luồng phản hồi rỗng", status: res.status };
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    // At the end, a last event without its closing blank line still counts
    if (done) buffer += decoder.decode() + "\n\n";
    buffer = buffer.replace(/\r\n/g, "\n");
    let sep = buffer.indexOf("\n\n");
    while (sep !== -1) {
      const event = parseEventBlock(buffer.slice(0, sep));
      buffer = buffer.slice(sep + 2);
      sep = buffer.indexOf("\n\n");
      if (!event) continue;
      if (event.type === "attempt") handlers.onAttempt?.(event.attempt, event.previous_failure);
      else if (event.type === "delta") handlers.onDelta?.(event.text);
      else if (event.type === "done") {
        void reader.cancel().catch(() => {});
        return event.turn;
      } else if (event.type === "error") {
        void reader.cancel().catch(() => {});
        throw { detail: event.detail, status: event.status, ...(event.code ? { code: event.code } : {}) };
      }
    }
    if (done) break;
  }
  throw { detail: "Luồng phản hồi của Đối thủ AI kết thúc trước khi có bài nói", status: 502 };
}

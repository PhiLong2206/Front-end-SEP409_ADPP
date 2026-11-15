import { describe, it, expect, vi } from "vitest";
import { streamOpponentTurn } from "../services/opponentTurnStream";

const sse = (events: object[]) =>
  events.map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join("");

/** Splits the body into small chunks, like the network does (events cut in the middle). */
const streamResponse = (body: string, chunk = 7) =>
  new Response(
    new ReadableStream({
      start(controller) {
        const bytes = new TextEncoder().encode(body);
        for (let i = 0; i < bytes.length; i += chunk) controller.enqueue(bytes.slice(i, i + chunk));
        controller.close();
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } }
  );

const turn = { turn_index: 1, round_type: "opening", mode: "opening_first", speech_text: "Xin chào bạn." };

describe("streamOpponentTurn", () => {
  it("passes pieces and attempts on, resolves with the final turn", async () => {
    const fetchImpl = vi.fn(async () =>
      streamResponse(
        sse([
          { type: "attempt", attempt: 1, previous_failure: null },
          { type: "delta", text: "Bản " },
          { type: "delta", text: "lỗi." },
          { type: "attempt", attempt: 2, previous_failure: "banned_phrase" },
          { type: "delta", text: "Xin chào " },
          { type: "delta", text: "bạn." },
          { type: "done", status: 201, turn },
        ])
      )
    );
    const log: string[] = [];

    const res = await streamOpponentTurn("/opponent", "s-1", { turn_index: 1, new_learner_speeches: [] }, {
      onAttempt: (n, why) => log.push(`attempt ${n} ${why}`),
      onDelta: (t) => log.push(t),
    }, fetchImpl as unknown as typeof fetch);

    expect(res).toEqual(turn);
    expect(log).toEqual(["attempt 1 null", "Bản ", "lỗi.", "attempt 2 banned_phrase", "Xin chào ", "bạn."]);
    expect(fetchImpl).toHaveBeenCalledWith("/opponent/sessions/s-1/turns/stream", expect.objectContaining({ method: "POST" }));
  });

  it("an error event rejects like the axios client ({detail, status, code})", async () => {
    const fetchImpl = async () => streamResponse(sse([
      { type: "attempt", attempt: 1, previous_failure: null },
      { type: "error", status: 504, detail: "budget_exceeded" },
    ]));
    await expect(streamOpponentTurn("/opponent", "s", { turn_index: 1, new_learner_speeches: [] }, {},
      fetchImpl as unknown as typeof fetch)).rejects.toEqual({ detail: "budget_exceeded", status: 504 });
  });

  it("plain JSON: a replayed turn resolves, an early error keeps status and code", async () => {
    const replay = async () => new Response(JSON.stringify(turn), { status: 200, headers: { "content-type": "application/json" } });
    expect(await streamOpponentTurn("/o", "s", { turn_index: 1, new_learner_speeches: [] }, {},
      replay as unknown as typeof fetch)).toEqual(turn);

    const conflict = async () => new Response(JSON.stringify({ detail: "khac ban da luu", code: "LEARNER_SPEECH_MISMATCH" }),
      { status: 409, headers: { "content-type": "application/json" } });
    await expect(streamOpponentTurn("/o", "s", { turn_index: 1, new_learner_speeches: [] }, {},
      conflict as unknown as typeof fetch)).rejects.toEqual({ detail: "khac ban da luu", code: "LEARNER_SPEECH_MISMATCH", status: 409 });
  });

  it("a last event without the closing blank line is not dropped", async () => {
    const body = sse([{ type: "attempt", attempt: 1, previous_failure: null }])
      + `event: done\ndata: ${JSON.stringify({ type: "done", status: 201, turn })}`;
    const fetchImpl = async () => streamResponse(body);
    expect(await streamOpponentTurn("/o", "s", { turn_index: 1, new_learner_speeches: [] }, {},
      fetchImpl as unknown as typeof fetch)).toEqual(turn);
  });

  it("a stream that ends without done is an error", async () => {
    const fetchImpl = async () => streamResponse(sse([{ type: "delta", text: "dở dang" }]));
    await expect(streamOpponentTurn("/o", "s", { turn_index: 1, new_learner_speeches: [] }, {},
      fetchImpl as unknown as typeof fetch)).rejects.toMatchObject({ status: 502 });
  });
});

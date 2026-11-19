import { describe, it, expect, vi, beforeAll } from "vitest";
import {
  AudioSentenceSpeaker,
  isServerVoiceConfigured,
  makeServerAudioFetcher,
  pickVietnameseVoice,
  SentenceSpeaker,
} from "../services/speechOut";

class FakeUtterance {
  public voice: SpeechSynthesisVoice | null = null;
  public lang = "";
  public rate = 1;
  constructor(public text: string) {}
}

const voice = (lang: string, localService = false, name = lang) =>
  ({ lang, localService, name, voiceURI: name, default: false }) as SpeechSynthesisVoice;

const fakeSynth = () => {
  const spoken: string[] = [];
  const synth = {
    speak: vi.fn((u: FakeUtterance) => spoken.push(u.text)),
    cancel: vi.fn(),
  } as unknown as SpeechSynthesis;
  return { synth, spoken };
};

beforeAll(() => {
  (globalThis as unknown as { SpeechSynthesisUtterance: typeof FakeUtterance }).SpeechSynthesisUtterance = FakeUtterance;
});

describe("pickVietnameseVoice", () => {
  it("only picks a Vietnamese voice, preferring a local one", () => {
    expect(pickVietnameseVoice([voice("en-US"), voice("ja-JP")])).toBeNull();
    const online = voice("vi-VN", false, "HoaiMy Online");
    const local = voice("vi_VN", true, "An");
    expect(pickVietnameseVoice([voice("en-US"), online, local])).toBe(local);
    expect(pickVietnameseVoice([online])).toBe(online);
  });
});

describe("SentenceSpeaker", () => {
  it("speaks each sentence as soon as it is complete, the rest at the end", () => {
    const { synth, spoken } = fakeSynth();
    const s = new SentenceSpeaker(synth, voice("vi-VN"));

    s.push("Kính thưa ban giám ");
    expect(spoken).toEqual([]);
    s.push("khảo. Mình phản đối");
    expect(spoken).toEqual(["Kính thưa ban giám khảo."]);
    s.push(" kiến nghị! Vì sao? Bởi");
    expect(spoken).toEqual(["Kính thưa ban giám khảo.", "Mình phản đối kiến nghị!", "Vì sao?"]);
    s.finish();
    expect(spoken[spoken.length - 1]).toBe("Bởi");
  });

  it("a replaced attempt is cancelled; a different final text is spoken from the start", () => {
    const { synth, spoken } = fakeSynth();
    const s = new SentenceSpeaker(synth, voice("vi-VN"));

    s.push("Bản nháp bị loại. Còn nữa");
    s.cancel();
    expect(synth.cancel).toHaveBeenCalledTimes(1);
    s.push("Bản mới. ");
    s.finish("Bản khác được giữ lại. Hết.");
    expect(spoken).toEqual(["Bản nháp bị loại.", "Bản mới.", "Bản khác được giữ lại.", "Hết."]);
  });

  it("the same final text as streamed is not spoken twice", () => {
    const { synth, spoken } = fakeSynth();
    const s = new SentenceSpeaker(synth, voice("vi-VN"));
    s.push("Câu một. Câu hai");
    s.finish("Câu một. Câu hai");
    expect(spoken).toEqual(["Câu một.", "Câu hai"]);
    expect(synth.cancel).not.toHaveBeenCalled();
  });
});

describe("AudioSentenceSpeaker (server voice)", () => {
  /** Fake <audio>: records what plays; the test ends it by calling onended. */
  class FakeAudio {
    static all: FakeAudio[] = [];
    /** true: play() rejects, like a browser refusing autoplay before any user gesture */
    static refuse = false;
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    paused = false;
    constructor(public src: string) {
      FakeAudio.all.push(this);
    }
    play = vi.fn(async () => {
      if (FakeAudio.refuse) throw new Error("NotAllowedError");
    });
    pause = vi.fn(() => {
      this.paused = true;
    });
  }

  const deferred = () => {
    let resolve!: (b: Blob) => void;
    let reject!: (e: Error) => void;
    const promise = new Promise<Blob>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  const setup = (fallback: { push: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn> } | null = null) => {
    FakeAudio.all = [];
    const requests: Array<{ text: string; signal: AbortSignal; d: ReturnType<typeof deferred> }> = [];
    const fetchAudio = vi.fn((text: string, signal: AbortSignal) => {
      const d = deferred();
      requests.push({ text, signal, d });
      return d.promise;
    });
    let n = 0;
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:${++n}`);
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const speaker = new AudioSentenceSpeaker(fetchAudio, fallback as never, (url) => new FakeAudio(url) as never);
    return { speaker, requests };
  };
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it("plays sentences in order and fetches at most two ahead", async () => {
    const { speaker, requests } = setup();
    speaker.push("Một. Hai. Ba. ");
    expect(requests.map((r) => r.text)).toEqual(["Một.", "Hai."]); // not "Ba." yet

    requests[1].d.resolve(new Blob(["2"])); // the second arrives first: still waits for the first
    await flush();
    expect(FakeAudio.all).toHaveLength(0);

    requests[0].d.resolve(new Blob(["1"]));
    await flush();
    expect(FakeAudio.all.map((a) => a.src)).toEqual(["blob:1"]);

    FakeAudio.all[0].onended?.();
    await flush();
    expect(requests.map((r) => r.text)).toEqual(["Một.", "Hai.", "Ba."]);
    expect(FakeAudio.all).toHaveLength(2);
  });

  it("cancel stops the sound and aborts the pending requests", async () => {
    const { speaker, requests } = setup();
    speaker.push("Một. Hai. ");
    requests[0].d.resolve(new Blob(["1"]));
    await flush();

    speaker.cancel();
    expect(FakeAudio.all[0].pause).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:1"); // no onended after pause: freed by cancel
    expect(requests[1].signal.aborted).toBe(true);
    requests[1].d.resolve(new Blob(["2"]));
    await flush();
    expect(FakeAudio.all).toHaveLength(1); // nothing plays after cancel
  });

  it("a sentence that cannot be fetched sends it and the rest to the browser voice, in order", async () => {
    const fallback = { push: vi.fn(), cancel: vi.fn() };
    const { speaker, requests } = setup(fallback);
    speaker.push("Một. Hai. ");
    requests[0].d.reject(new Error("TTS HTTP 429"));
    await flush();

    speaker.push("Ba. ");
    speaker.finish();
    expect(fallback.push.mock.calls.map(([t]) => t.trim())).toEqual(["Một.", "Hai.", "Ba."]);
    expect(FakeAudio.all).toHaveLength(0);
  });

  it("autoplay refused: the browser voice takes over", async () => {
    const fallback = { push: vi.fn(), cancel: vi.fn() };
    const { speaker, requests } = setup(fallback);
    FakeAudio.refuse = true;
    try {
      speaker.push("Một. ");
      requests[0].d.resolve(new Blob(["1"]));
      await flush();
    } finally {
      FakeAudio.refuse = false;
    }
    expect(FakeAudio.all[0].play).toHaveBeenCalled();
    expect(fallback.push.mock.calls.map(([t]) => t.trim())).toEqual(["Một."]);
  });
});

describe("server voice helpers", () => {
  it("isServerVoiceConfigured is false on any error", async () => {
    const ok = async () => new Response(JSON.stringify({ configured: true }), { status: 200 });
    const off = async () => new Response(JSON.stringify({ configured: false }), { status: 200 });
    const boom = async () => {
      throw new TypeError("network");
    };
    expect(await isServerVoiceConfigured("/multimodal", ok as unknown as typeof fetch)).toBe(true);
    expect(await isServerVoiceConfigured("/multimodal", off as unknown as typeof fetch)).toBe(false);
    expect(await isServerVoiceConfigured("/multimodal", boom as unknown as typeof fetch)).toBe(false);

    // A request that never answers gives up after the timeout
    const stalled = (_url: string, init?: RequestInit) =>
      new Promise<Response>((_res, rej) => init?.signal?.addEventListener("abort", () => rej(new Error("aborted"))));
    expect(await isServerVoiceConfigured("/multimodal", stalled as unknown as typeof fetch, 20)).toBe(false);
  });

  it("the fetcher posts one sentence and fails on a non-200", async () => {
    const fetchImpl = vi.fn(async () => new Response("x", { status: 503 }));
    const fetcher = makeServerAudioFetcher("/multimodal", fetchImpl as unknown as typeof fetch);
    await expect(fetcher("Xin chào.", new AbortController().signal)).rejects.toThrow("503");
    expect(fetchImpl).toHaveBeenCalledWith("/multimodal/tts", expect.objectContaining({
      method: "POST", body: JSON.stringify({ text: "Xin chào." }),
    }));
  });
});

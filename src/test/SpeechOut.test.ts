import { describe, it, expect, vi, beforeAll } from "vitest";
import {
  AudioSentenceSpeaker,
  fetchServerVoices,
  isServerVoiceConfigured,
  makeServerAudioFetcher,
  pickServerVoice,
  pickVietnameseVoice,
  SentenceSpeaker,
  voiceOptionLabel,
} from "../services/speechOut";

class FakeUtterance {
  public voice: SpeechSynthesisVoice | null = null;
  public lang = "";
  public rate = 1;
  public onend: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

const voice = (lang: string, localService = false, name = lang) =>
  ({ lang, localService, name, voiceURI: name, default: false }) as SpeechSynthesisVoice;

const fakeSynth = () => {
  const spoken: string[] = [];
  const queued: FakeUtterance[] = [];
  const synth = {
    speak: vi.fn((u: FakeUtterance) => {
      spoken.push(u.text);
      queued.push(u);
    }),
    cancel: vi.fn(),
  } as unknown as SpeechSynthesis;
  /** The browser finished saying everything queued so far */
  const endAll = () => queued.splice(0).forEach((u) => u.onend?.());
  return { synth, spoken, endAll };
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
    const fallback = { push: vi.fn(), setProgressListener: vi.fn(), setRate: vi.fn(), cancel: vi.fn(), finish: vi.fn(), abort: vi.fn(), whenDone: () => Promise.resolve() };
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
    const fallback = { push: vi.fn(), setProgressListener: vi.fn(), setRate: vi.fn(), cancel: vi.fn(), finish: vi.fn(), abort: vi.fn(), whenDone: () => Promise.resolve() };
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

describe("server voice list", () => {
  const json = (body: object) => async () => new Response(JSON.stringify(body), { status: 200 });
  const six = [
    { id: "vi-VN-NamMinhNeural", label: "Nam Minh", gender: "male", tier: "neural" },
    { id: "vi-VN-HoaiMyNeural", label: "Hoài My", gender: "female", tier: "neural" },
    { id: "vi-VN-Grant:MAI-Voice-2.1", label: "Grant HD", gender: "male", tier: "hd" },
  ];

  it("reads the offered voices, an old id-only list, or none", async () => {
    expect(await fetchServerVoices("/m", json({ configured: true, voice: "vi-VN-NamMinhNeural", voices: six }) as unknown as typeof fetch))
      .toEqual({ defaultVoice: "vi-VN-NamMinhNeural", voices: six });
    expect((await fetchServerVoices("/m", json({ configured: true, voices: ["a", "b"] }) as unknown as typeof fetch))?.voices.map((v) => v.id))
      .toEqual(["a", "b"]);
    expect(await fetchServerVoices("/m", json({ configured: true }) as unknown as typeof fetch))
      .toEqual({ defaultVoice: "", voices: [{ id: "", label: "Giọng mặc định", gender: "", tier: "" }] });
    expect(await fetchServerVoices("/m", json({ configured: false, voices: six }) as unknown as typeof fetch)).toBeNull();
    // A malformed entry is skipped, not shown as "undefined"
    expect((await fetchServerVoices("/m", json({ configured: true, voices: [{ label: "x" }, six[0]] }) as unknown as typeof fetch))?.voices)
      .toEqual([six[0]]);
  });

  it("keeps the remembered voice only while the service still offers it", () => {
    const offered = { defaultVoice: "vi-VN-NamMinhNeural", voices: six };
    expect(pickServerVoice("vi-VN-HoaiMyNeural", offered)).toBe("vi-VN-HoaiMyNeural");
    expect(pickServerVoice("vi-VN-Gone", offered)).toBe("vi-VN-NamMinhNeural");
    expect(pickServerVoice(null, offered)).toBe("vi-VN-NamMinhNeural");
  });

  it("labels say who speaks and which voice is slower", () => {
    expect(six.map(voiceOptionLabel)).toEqual(["Nam Minh (nam)", "Hoài My (nữ)", "Grant HD (nam, chậm hơn)"]);
  });

  it("the fetcher sends the voice picked at the time of each sentence", async () => {
    const bodies: string[] = [];
    const fetchImpl = vi.fn(async (_u: string, init?: RequestInit) => {
      bodies.push(String(init?.body));
      return new Response("mp3", { status: 200 });
    });
    let voice: string | null = "vi-VN-NamMinhNeural";
    const fetcher = makeServerAudioFetcher("/m", fetchImpl as unknown as typeof fetch, () => voice);
    await fetcher("Một.", new AbortController().signal);
    voice = "vi-VN-HoaiMyNeural";
    await fetcher("Hai.", new AbortController().signal);
    voice = null;
    await fetcher("Ba.", new AbortController().signal);
    expect(bodies.map((b) => JSON.parse(b))).toEqual([
      { text: "Một.", voice: "vi-VN-NamMinhNeural" },
      { text: "Hai.", voice: "vi-VN-HoaiMyNeural" },
      { text: "Ba." },
    ]);
  });
});

describe("two AI turns in a row (rebuttal, then closing)", () => {
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it("the second turn waits for the first one to be read out, and never cuts it", async () => {
    const { synth, spoken, endAll } = fakeSynth();
    const rebuttal = new SentenceSpeaker(synth, voice("vi-VN"));
    rebuttal.push("Phản biện một. Phản biện hai. ");
    rebuttal.finish();

    const closing = new SentenceSpeaker(synth, voice("vi-VN"));
    closing.startAfter(rebuttal.whenDone());
    closing.push("Kết luận một. ");
    closing.cancel(); // a new attempt of the closing: must not cut the rebuttal still being read
    closing.push("Kết luận mới. ");
    closing.finish();
    await flush();

    expect(spoken).toEqual(["Phản biện một.", "Phản biện hai."]);
    expect(synth.cancel).not.toHaveBeenCalled();

    endAll(); // the rebuttal is read out
    await flush();
    expect(spoken).toEqual(["Phản biện một.", "Phản biện hai.", "Kết luận mới."]);

    let closed = false;
    void closing.whenDone().then(() => (closed = true));
    await flush();
    expect(closed).toBe(false);
    endAll();
    await flush();
    expect(closed).toBe(true);
  });

  it("abort settles the turn at once, so the next one does not wait for it", async () => {
    const { synth, spoken } = fakeSynth();
    const first = new SentenceSpeaker(synth, voice("vi-VN"));
    first.push("Đang nói dở. ");
    const second = new SentenceSpeaker(synth, voice("vi-VN"));
    second.startAfter(first.whenDone());
    second.push("Lượt sau. ");

    first.abort();
    await flush();
    expect(synth.cancel).toHaveBeenCalled();
    expect(spoken).toEqual(["Đang nói dở.", "Lượt sau."]);
  });
});

describe("browser voice that misbehaves", () => {
  it("an utterance that never ends counts as said after its estimated length, so the next turn is not stuck", async () => {
    vi.useFakeTimers();
    try {
      const { synth, spoken } = fakeSynth(); // never fires onend
      const first = new SentenceSpeaker(synth, voice("vi-VN"));
      first.push("Câu bị treo. ");
      first.finish();
      const second = new SentenceSpeaker(synth, voice("vi-VN"));
      second.startAfter(first.whenDone());
      second.push("Lượt sau. ");

      await vi.advanceTimersByTimeAsync(4000);
      expect(spoken).toEqual(["Câu bị treo."]);
      await vi.advanceTimersByTimeAsync(3000); // 12 chars / (8 × 1.05) cps + 5 s ≈ 6.4 s
      expect(spoken).toEqual(["Câu bị treo.", "Lượt sau."]);

      // The first sentence may still be playing: stopping the first turn must still silence the browser
      (synth.cancel as unknown as ReturnType<typeof vi.fn>).mockClear();
      first.abort();
      expect(synth.cancel).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("onend and onerror for the same utterance count it once", async () => {
    const utterances: FakeUtterance[] = [];
    const synth = {
      speak: vi.fn((u: FakeUtterance) => utterances.push(u)),
      cancel: vi.fn(),
    } as unknown as SpeechSynthesis;
    const s = new SentenceSpeaker(synth, voice("vi-VN"));
    s.push("Một. Hai. ");
    s.finish();
    let done = false;
    void s.whenDone().then(() => (done = true));

    utterances[0].onend?.();
    utterances[0].onerror?.(); // fired as well: must not count "Hai." as said
    await new Promise((r) => setTimeout(r, 0));
    expect(done).toBe(false);
    utterances[1].onend?.();
    await new Promise((r) => setTimeout(r, 0));
    expect(done).toBe(true);
  });
});


describe("server voice that hangs", () => {
  it("a sound that never ends counts as played after its estimated length, so the turn is read out", async () => {
    vi.useFakeTimers();
    try {
      vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:s");
      vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
      const audio = { onended: null, onerror: null, play: vi.fn(async () => {}), pause: vi.fn() };
      const speaker = new AudioSentenceSpeaker(async () => new Blob(["1"]), null, () => audio as never);
      speaker.push("Âm thanh bị treo. ");
      speaker.finish();
      let done = false;
      void speaker.whenDone().then(() => (done = true));

      await vi.advanceTimersByTimeAsync(4000);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(4000); // 17 chars / 8 cps + 5 s ≈ 7.1 s
      expect(done).toBe(true);
      expect(audio.pause).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });

  it("a request that never answers fails after the timeout", async () => {
    const stalled = (_u: string, init?: RequestInit) =>
      new Promise<Response>((_res, rej) => init?.signal?.addEventListener("abort", () => rej(new Error("aborted"))));
    const fetcher = makeServerAudioFetcher("/m", stalled as unknown as typeof fetch, () => null, 20);
    await expect(fetcher("Xin chào.", new AbortController().signal)).rejects.toThrow();
  });
});

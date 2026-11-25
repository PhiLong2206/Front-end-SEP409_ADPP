import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { AudioSentenceSpeaker, SentenceSpeaker, clampReadRate } from "../services/speechOut";

class FakeUtterance {
  public voice: SpeechSynthesisVoice | null = null;
  public lang = "";
  public rate = 1;
  public onend: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  public onstart: (() => void) | null = null;
  public onboundary: ((e: { charIndex: number; charLength?: number }) => void) | null = null;
  constructor(public text: string) {}
}

const voice = { lang: "vi-VN", localService: true, name: "vi", voiceURI: "vi", default: false } as SpeechSynthesisVoice;

const fakeSynth = () => {
  const queued: FakeUtterance[] = [];
  const synth = {
    speak: vi.fn((u: FakeUtterance) => {
      queued.push(u);
    }),
    cancel: vi.fn(),
  } as unknown as SpeechSynthesis;
  return { synth, queued };
};

beforeAll(() => {
  (globalThis as unknown as { SpeechSynthesisUtterance: typeof FakeUtterance }).SpeechSynthesisUtterance = FakeUtterance;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const last = <T,>(items: T[]): T => items[items.length - 1];

const TEXT = "Câu một dài. Câu hai ngắn. ";
const FIRST = "Câu một dài.";
const SECOND = "Câu hai ngắn.";
const SECOND_OFFSET = TEXT.indexOf(SECOND);

describe("reading progress: browser voice", () => {
  it("word boundaries report the characters spoken so far in the whole text", () => {
    const { synth, queued } = fakeSynth();
    const s = new SentenceSpeaker(synth, voice);
    const seen: Array<[number, boolean]> = [];
    s.setProgressListener((n, done) => seen.push([n, done]));
    s.push(TEXT);

    queued[0].onboundary?.({ charIndex: 4, charLength: 3 });
    expect(last(seen)).toEqual([7, false]);
    queued[0].onend?.();
    expect(last(seen)).toEqual([FIRST.length, false]);

    // The second sentence starts after the first sentence and the space
    queued[1].onboundary?.({ charIndex: 4, charLength: 2 });
    expect(last(seen)).toEqual([SECOND_OFFSET + 6, false]);
  });

  it("an engine without boundaries jumps by sentence when each one ends", () => {
    const { synth, queued } = fakeSynth();
    const s = new SentenceSpeaker(synth, voice);
    const seen: number[] = [];
    s.setProgressListener((n, done) => {
      if (!done) seen.push(n);
    });
    s.push(TEXT);
    s.finish();

    queued[0].onend?.();
    queued[1].onend?.();
    expect(seen).toEqual([FIRST.length, SECOND_OFFSET + SECOND.length]);
  });

  it("an abort reports done, so the room shows everything in the main colour", async () => {
    const { synth } = fakeSynth();
    const s = new SentenceSpeaker(synth, voice);
    const seen: Array<[number, boolean]> = [];
    s.setProgressListener((n, done) => seen.push([n, done]));
    s.push(TEXT);
    s.abort();
    expect(last(seen)?.[1]).toBe(true);
  });

  it("text in later pushes keeps counting from the start of the whole text", () => {
    const { synth, queued } = fakeSynth();
    const s = new SentenceSpeaker(synth, voice);
    const seen: number[] = [];
    s.setProgressListener((n, done) => {
      if (!done) seen.push(n);
    });
    s.push("Câu một dài. Câu hai");
    s.push(" ngắn. ");
    queued[1].onend?.();
    expect(last(seen)).toBe(SECOND_OFFSET + SECOND.length);
  });
});

class FakeAudio {
  static all: FakeAudio[] = [];
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeupdate: (() => void) | null = null;
  paused = false;
  duration = 10;
  currentTime = 0;
  playbackRate = 1;
  preservesPitch = false;
  constructor(public src: string) {
    FakeAudio.all.push(this);
  }
  play = vi.fn(async () => {});
  pause = vi.fn(() => {
    this.paused = true;
  });
}

const makeServerSpeaker = (fallback: SentenceSpeaker | null = null) => {
  FakeAudio.all = [];
  let n = 0;
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:${++n}`);
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  return new AudioSentenceSpeaker(async () => new Blob(["x"]), fallback, (url) => new FakeAudio(url) as never);
};
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("reading progress: server voice", () => {
  it("half of the sound played = half of the sentence read; the end of the sentence is exact", async () => {
    const s = makeServerSpeaker();
    const seen: number[] = [];
    s.setProgressListener((n, done) => {
      if (!done) seen.push(n);
    });
    s.push(TEXT);
    s.finish();
    await flush();

    const first = FakeAudio.all[0];
    first.currentTime = 5; // 50 %
    first.ontimeupdate?.();
    expect(last(seen)).toBe(Math.round(FIRST.length / 2));

    first.currentTime = 10;
    first.onended?.();
    expect(last(seen)).toBe(FIRST.length);
    await flush();

    const second = FakeAudio.all[1];
    second.currentTime = 5;
    second.ontimeupdate?.();
    expect(last(seen)).toBe(SECOND_OFFSET + Math.round(SECOND.length / 2));
    second.onended?.();
    expect(last(seen)).toBe(SECOND_OFFSET + SECOND.length);
  });

  it("while playing, requestAnimationFrame keeps the progress smooth", async () => {
    vi.useFakeTimers();
    const s = makeServerSpeaker();
    const seen: number[] = [];
    s.setProgressListener((n, done) => {
      if (!done) seen.push(n);
    });
    s.push(FIRST + " ");
    s.finish();
    await vi.advanceTimersByTimeAsync(1);

    const audio = FakeAudio.all[0];
    audio.currentTime = 2.5;
    await vi.advanceTimersByTimeAsync(50);
    expect(last(seen)).toBe(Math.round(FIRST.length * 0.25));
  });

  it("when the server voice fails, the browser voice's progress is mapped back to the original text", async () => {
    const { synth, queued } = fakeSynth();
    const fallback = new SentenceSpeaker(synth, voice);
    const s = new AudioSentenceSpeaker(
      async () => {
        throw new Error("no audio");
      },
      fallback,
      (url) => new FakeAudio(url) as never
    );
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:x");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const seen: number[] = [];
    s.setProgressListener((n, done) => {
      if (!done) seen.push(n);
    });
    s.push(TEXT);
    s.finish();
    await flush();
    await flush();

    queued[0].onend?.();
    expect(last(seen)).toBe(FIRST.length);
    queued[1].onboundary?.({ charIndex: 0, charLength: 4 });
    expect(last(seen)).toBe(SECOND_OFFSET + 4);
  });
});

describe("reading speed", () => {
  it("is clamped to 0.5 - 1.5", () => {
    expect(clampReadRate(0.1)).toBe(0.5);
    expect(clampReadRate(3)).toBe(1.5);
    expect(clampReadRate(1.25)).toBe(1.25);
    expect(clampReadRate(Number.NaN)).toBe(1);
  });

  it("server voice: the sound being played changes speed at once, and every later sound starts at that speed", async () => {
    const s = makeServerSpeaker();
    s.push(TEXT);
    s.finish();
    await flush();
    const first = FakeAudio.all[0];
    expect(first.playbackRate).toBe(1);

    s.setRate(1.5);
    expect(first.playbackRate).toBe(1.5);
    expect(first.preservesPitch).toBe(true);

    first.onended?.();
    await flush();
    expect(FakeAudio.all[1].playbackRate).toBe(1.5);
  });

  it("browser voice: the next sentences use 1.05 x the chosen speed", () => {
    const { synth, queued } = fakeSynth();
    const s = new SentenceSpeaker(synth, voice);
    s.push("Câu một. ");
    expect(queued[0].rate).toBeCloseTo(1.05);
    s.setRate(1.5);
    s.push("Câu hai. ");
    expect(queued[1].rate).toBeCloseTo(1.05 * 1.5);
    expect(queued[0].rate).toBeCloseTo(1.05); // the one being said keeps its own
  });

  it("browser voice at 0.5x: the stall watchdog does not count a slow reading as stuck", async () => {
    vi.useFakeTimers();
    const { synth } = fakeSynth();
    const s = new SentenceSpeaker(synth, voice);
    s.setRate(0.5);
    let done = false;
    void s.whenDone().then(() => (done = true));
    const sentence = `${"a".repeat(79)}.`; // 80 characters
    s.push(`${sentence} `);
    s.finish();

    // At normal speed it would be given up after 80/(8x1.05)+5 = 14.5 s; at 0.5x it takes 80/(8x0.525)+5 = 24 s
    await vi.advanceTimersByTimeAsync(20_000);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(done).toBe(true);
  });

  it("server voice at 0.5x: a slow sound is not cut as stuck at the normal-speed estimate", async () => {
    vi.useFakeTimers();
    const s = makeServerSpeaker();
    s.setRate(0.5);
    let done = false;
    void s.whenDone().then(() => (done = true));
    s.push(`${"a".repeat(79)}. `); // 80 characters: 10 s + 5 s at 1x, 20 s + 5 s at 0.5x
    s.finish();
    await vi.advanceTimersByTimeAsync(1);

    await vi.advanceTimersByTimeAsync(20_000);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(6_000);
    expect(done).toBe(true);
  });
});

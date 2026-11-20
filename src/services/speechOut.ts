/**
 * Reads the AI opponent's speech aloud, one sentence at a time, as it streams in.
 * - AudioSentenceSpeaker: Azure AI Speech through the multimodal service (POST /multimodal/tts), same voice on every
 *   browser. Falls back to the browser voice for the rest of the turn when a sentence cannot be fetched or played.
 * - SentenceSpeaker: the browser's own Vietnamese voice (Web Speech API). Chrome on Windows usually has none; Edge has
 *   online ones. Without either, reading is unavailable and the room hides the toggle.
 */

export function pickVietnameseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const vi = voices.filter((v) => v.lang?.toLowerCase().replace("_", "-").startsWith("vi"));
  return vi.find((v) => v.localService) ?? vi[0] ?? null;
}

export function getSpeechSynthesis(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

/** Voices load asynchronously in Chrome / Edge: resolves on `voiceschanged`, or after `timeoutMs` with what exists. */
export function loadVietnameseVoice(
  synth: SpeechSynthesis | null = getSpeechSynthesis(),
  timeoutMs = 1500
): Promise<SpeechSynthesisVoice | null> {
  if (!synth) return Promise.resolve(null);
  const now = pickVietnameseVoice(synth.getVoices());
  if (now) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener?.("voiceschanged", done);
      window.clearTimeout(timer);
      resolve(pickVietnameseVoice(synth.getVoices()));
    };
    const timer = window.setTimeout(done, timeoutMs);
    synth.addEventListener?.("voiceschanged", done);
  });
}

// A sentence ends with . ! ? … (possibly repeated) followed by whitespace
const SENTENCE_END = /^([\s\S]*?[.!?…]+)\s+/;

/**
 * Common part: cuts streamed text into sentences and hands each finished one to `speak`.
 * One reader = one AI turn. Two AI turns in a row (rebuttal then closing) must not cut each other: the second
 * reader is started with `startAfter(first.whenDone())` and holds its sentences until the first one is done.
 */
export abstract class SentenceQueue {
  private buffer = "";
  private received = "";
  private gate: Promise<void> | null = null;
  private held: string[] = [];
  /** finish() was called: no more text will come for this turn */
  protected finalized = false;
  private settled = false;
  private resolveDone!: () => void;
  private readonly done = new Promise<void>((resolve) => {
    this.resolveDone = resolve;
  });

  /** Holds every sentence until `previous` resolves (the previous AI turn has been read out). */
  startAfter(previous: Promise<void>): void {
    const gate: Promise<void> = previous.then(
      () => this.openGate(gate),
      () => this.openGate(gate)
    );
    this.gate = gate;
  }

  /**
   * Resolves once this turn is read out: finish() was called and every sentence was spoken (or handed to a fallback
   * that finished too), or the reader was aborted. Never rejects.
   */
  whenDone(): Promise<void> {
    return this.done;
  }

  /** Adds streamed text; speaks every sentence that is now complete. */
  push(piece: string): void {
    this.received += piece;
    this.buffer += piece;
    let m = SENTENCE_END.exec(this.buffer);
    while (m) {
      this.speakClean(m[1]);
      this.buffer = this.buffer.slice(m[0].length);
      m = SENTENCE_END.exec(this.buffer);
    }
  }

  /**
   * The speech is final. Same text as streamed: speak what is left. Different text (the service kept another
   * attempt): start over with the final one.
   */
  finish(finalText?: string): void {
    if (finalText !== undefined && finalText.trim() !== this.received.trim()) {
      this.cancel();
      this.push(`${finalText} `);
    }
    this.speakClean(this.buffer);
    this.buffer = "";
    this.finalized = true;
    this.onFinalized();
    this.checkDone();
  }

  /**
   * Forgets the text of this attempt and stops what it was saying (a new attempt of the same turn replaces it).
   * The reader stays usable and still waits for the previous turn.
   */
  cancel(): void {
    this.buffer = "";
    this.received = "";
    this.held = [];
    this.finalized = false;
    this.stop();
  }

  /** Stops for good (the learner records, read-aloud off, voice preview, leaving the room, the turn failed). */
  abort(): void {
    this.gate = null;
    this.cancel();
    this.settle();
  }

  private speakClean(text: string): void {
    const clean = text.trim();
    if (!clean || this.settled) return;
    if (this.gate) this.held.push(clean);
    else this.speak(clean);
  }

  private openGate(gate: Promise<void>): void {
    if (this.gate !== gate) return; // aborted, or another gate replaced it
    this.gate = null;
    const held = this.held;
    this.held = [];
    for (const sentence of held) this.speak(sentence);
    this.checkDone();
  }

  /** Subclasses call it when their own queue may have drained. */
  protected checkDone(): void {
    if (this.finalized && !this.gate && this.held.length === 0 && this.isIdle()) this.settle();
  }

  protected settle(): void {
    if (this.settled) return;
    this.settled = true;
    this.resolveDone();
  }

  /** Called once finish() has queued the last sentence. */
  protected onFinalized(): void {}

  protected abstract speak(sentence: string): void;
  protected abstract stop(): void;
  /** Nothing queued or playing. */
  protected abstract isIdle(): boolean;
}

/** Browser voice: the Web Speech API queues utterances itself. Short utterances avoid Chrome cutting off long ones. */
/** Slow estimate of Vietnamese TTS speed at rate 1 (real voices say ~12-15 characters a second) */
const CHARS_PER_SECOND = 8;
/** Slack on top of the estimate before an utterance that never ends counts as said */
const STALL_MARGIN_MS = 5000;

interface QueuedUtterance {
  text: string;
  done: boolean;
}

/**
 * Browser voice: the Web Speech API queues utterances itself. Short utterances avoid Chrome cutting off long ones.
 * The browser may never fire onend (hidden tab, stuck engine): a watchdog on the utterance being said counts it as
 * said after its estimated length + STALL_MARGIN_MS, so a stuck voice cannot keep the next AI turn silent forever.
 */
export class SentenceSpeaker extends SentenceQueue {
  private queue: QueuedUtterance[] = [];
  /** Utterances the browser still holds: only a real onend / onerror lowers it, never the watchdog */
  private inSynth = 0;
  private generation = 0;
  private watchdog: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly synth: SpeechSynthesis,
    private readonly voice: SpeechSynthesisVoice,
    private readonly rate = 1.05
  ) {
    super();
  }

  protected speak(sentence: string): void {
    const u = new SpeechSynthesisUtterance(sentence);
    u.voice = this.voice;
    u.lang = this.voice.lang;
    u.rate = this.rate;
    const gen = this.generation;
    const item: QueuedUtterance = { text: sentence, done: false };
    // onend and onerror can both fire (or fire twice): count the utterance once
    let released = false;
    const ended = () => {
      if (gen !== this.generation) return; // cancelled by stop()
      if (!released) {
        released = true;
        this.inSynth = Math.max(0, this.inSynth - 1);
      }
      if (!item.done) this.markDone(item); // the watchdog may have counted it already
    };
    u.onend = ended;
    u.onerror = ended;
    u.onstart = () => {
      if (gen === this.generation && this.queue[0] === item) this.armWatchdog(); // restart the clock when it starts
    };
    this.queue.push(item);
    this.inSynth += 1;
    if (this.queue.length === 1) this.armWatchdog();
    this.synth.speak(u);
  }

  protected stop(): void {
    this.generation += 1;
    // speechSynthesis has one queue for the page: cancel only when this reader has something in it, so a reader
    // still waiting for the previous turn does not cut that turn
    // inSynth too: a sentence the watchdog counted as said may still be playing
    if (this.queue.length > 0 || this.inSynth > 0) this.synth.cancel();
    this.queue = [];
    this.inSynth = 0;
    this.clearWatchdog();
  }

  protected isIdle(): boolean {
    return this.queue.length === 0;
  }

  private markDone(item: QueuedUtterance): void {
    item.done = true;
    this.queue = this.queue.filter((q) => q !== item);
    this.clearWatchdog();
    if (this.queue.length > 0) this.armWatchdog();
    this.checkDone();
  }

  /** Clock for the utterance at the head of the queue (the one being said). */
  private armWatchdog(): void {
    this.clearWatchdog();
    const head = this.queue[0];
    if (!head) return;
    const gen = this.generation;
    const ms = (head.text.length / (CHARS_PER_SECOND * this.rate)) * 1000 + STALL_MARGIN_MS;
    this.watchdog = setTimeout(() => {
      if (gen === this.generation && !head.done) this.markDone(head);
    }, ms);
  }

  private clearWatchdog(): void {
    if (this.watchdog !== null) {
      clearTimeout(this.watchdog);
      this.watchdog = null;
    }
  }
}

export type FetchSentenceAudio = (sentence: string, signal: AbortSignal) => Promise<Blob>;

interface PendingSentence {
  text: string;
  audio?: Promise<Blob | null>;
  controller?: AbortController;
}

/**
 * Server voice: each sentence is fetched as audio and played in order. Up to `prefetch` sentences are fetched ahead,
 * so the next one is ready when the current one ends (no gap) without flooding the Free tier's request limit.
 * The first sentence that cannot be fetched or played sends it and everything after it to `fallback` (browser voice),
 * or drops it when there is none.
 */
export class AudioSentenceSpeaker extends SentenceQueue {
  private pending: PendingSentence[] = [];
  private playing: HTMLAudioElement | null = null;
  private playingUrl: string | null = null;
  private generation = 0;
  private failed = false;

  constructor(
    private readonly fetchAudio: FetchSentenceAudio,
    private readonly fallback: SentenceQueue | null,
    private readonly createAudio: (url: string) => HTMLAudioElement = (url) => new Audio(url),
    private readonly prefetch = 2
  ) {
    super();
  }

  protected speak(sentence: string): void {
    if (this.failed) {
      this.fallback?.push(`${sentence} `);
      return;
    }
    this.pending.push({ text: sentence });
    this.startFetches();
    void this.playNext();
  }

  protected stop(): void {
    this.generation += 1;
    for (const p of this.pending) p.controller?.abort();
    this.pending = [];
    if (this.playing) {
      this.playing.pause();
      this.playing = null;
    }
    if (this.playingUrl) {
      URL.revokeObjectURL(this.playingUrl); // onended never fires after pause()
      this.playingUrl = null;
    }
    this.failed = false;
    this.fallback?.cancel();
  }

  abort(): void {
    this.fallback?.abort();
    super.abort();
  }

  private startFetches(): void {
    for (const p of this.pending.slice(0, this.prefetch)) {
      if (p.audio) continue;
      p.controller = new AbortController();
      p.audio = this.fetchAudio(p.text, p.controller.signal).catch(() => null);
    }
  }

  private async playNext(): Promise<void> {
    if (this.playing || this.pending.length === 0) return;
    const gen = this.generation;
    const head = this.pending[0];
    this.startFetches();
    const blob = await head.audio;
    if (gen !== this.generation || this.pending[0] !== head || this.playing) return;
    if (!blob) {
      this.giveUp();
      return;
    }
    const url = URL.createObjectURL(blob);
    const audio = this.createAudio(url);
    this.playing = audio;
    this.playingUrl = url;
    const release = () => {
      URL.revokeObjectURL(url);
      if (this.playingUrl === url) this.playingUrl = null;
    };
    const next = () => {
      release();
      if (gen !== this.generation || this.playing !== audio) return;
      this.playing = null;
      this.pending.shift();
      void this.playNext();
      this.checkDone();
    };
    audio.onended = next;
    audio.onerror = () => {
      release();
      if (gen !== this.generation || this.playing !== audio) return;
      this.playing = null;
      this.giveUp();
    };
    try {
      await audio.play();
    } catch {
      // Autoplay refused (no user gesture yet) or the browser cannot play it
      if (gen !== this.generation || this.playing !== audio) return;
      release();
      this.playing = null;
      this.giveUp();
    }
  }

  /** Server voice unusable for this turn: the rest goes to the browser voice, in order. */
  private giveUp(): void {
    this.failed = true;
    const rest = this.pending;
    this.pending = [];
    for (const p of rest) {
      p.controller?.abort();
      this.fallback?.push(`${p.text} `);
    }
    if (this.finalized) this.finishFallback();
    this.checkDone();
  }

  protected onFinalized(): void {
    if (this.failed) this.finishFallback();
  }

  /** The browser voice took over: this turn is read out when it is. */
  private finishFallback(): void {
    if (!this.fallback) return;
    this.fallback.finish();
    void this.fallback.whenDone().then(() => this.settle());
  }

  protected isIdle(): boolean {
    // After a failure the fallback decides (finishFallback); without one there is nothing left to wait for
    return this.pending.length === 0 && !this.playing && (!this.failed || !this.fallback);
  }
}

/**
 * POST {base}/tts — one sentence of MP3 from Azure AI Speech (multimodal service). `getVoice` is read for every
 * sentence, so a voice picked mid-turn applies from the next sentence on.
 */
export function makeServerAudioFetcher(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  getVoice: () => string | null = () => null
): FetchSentenceAudio {
  return async (sentence, signal) => {
    const voice = getVoice();
    const res = await fetchImpl(`${baseUrl}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(voice ? { text: sentence, voice } : { text: sentence }),
      signal,
    });
    if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
    return res.blob();
  };
}

/** One voice the multimodal service can read with (GET /tts/config). */
export interface ServerVoiceOption {
  id: string;
  label: string;
  gender: "male" | "female" | string;
  tier: "neural" | "flash" | "hd" | string;
}

export interface ServerVoices {
  defaultVoice: string;
  voices: ServerVoiceOption[];
}

/** "Hoài My (nữ)", "Grant HD (nam, chậm hơn)" */
export function voiceOptionLabel(v: ServerVoiceOption): string {
  const who = v.gender === "male" ? "nam" : v.gender === "female" ? "nữ" : "";
  const extra = [who, v.tier === "hd" ? "chậm hơn" : ""].filter(Boolean).join(", ");
  return extra ? `${v.label} (${extra})` : v.label;
}

/**
 * GET {base}/tts/config: the voices of the service, or null when it has no Azure Speech key. Any error means "no
 * server voice". Older services answer `voices` as a list of ids: shown by id.
 */
export async function fetchServerVoices(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 3000
): Promise<ServerVoices | null> {
  // A stalled request must not keep the room waiting to know its voices
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${baseUrl}/tts/config`, { signal: controller.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { configured?: boolean; voice?: string; voices?: unknown[] };
    if (data.configured !== true) return null;
    const voices = (data.voices ?? []).flatMap((v): ServerVoiceOption[] => {
      if (typeof v === "string") return [{ id: v, label: v, gender: "", tier: "" }];
      const o = v as Partial<ServerVoiceOption> | null;
      if (!o || typeof o.id !== "string") return []; // malformed entry: skip it
      return [{ id: o.id, label: typeof o.label === "string" ? o.label : o.id, gender: o.gender ?? "", tier: o.tier ?? "" }];
    });
    const defaultVoice = data.voice ?? voices[0]?.id ?? "";
    // A key but no list (older service): one entry, the service's own default ("" = let the service choose)
    if (voices.length === 0) voices.push({ id: defaultVoice, label: defaultVoice || "Giọng mặc định", gender: "", tier: "" });
    return { defaultVoice, voices };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** True when the service has an Azure Speech key. */
export async function isServerVoiceConfigured(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 3000
): Promise<boolean> {
  return (await fetchServerVoices(baseUrl, fetchImpl, timeoutMs)) !== null;
}

/** The voice to use: the remembered one if the service still offers it, else the service default. */
export function pickServerVoice(remembered: string | null, offered: ServerVoices): string {
  return remembered && offered.voices.some((v) => v.id === remembered) ? remembered : offered.defaultVoice;
}

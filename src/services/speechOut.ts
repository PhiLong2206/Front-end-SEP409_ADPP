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

/** Common part: cuts streamed text into sentences and hands each finished one to `speak`. */
export abstract class SentenceQueue {
  private buffer = "";
  private received = "";

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
  }

  /** Stops speaking and forgets the text (a new attempt replaces it, or the learner starts talking). */
  cancel(): void {
    this.buffer = "";
    this.received = "";
    this.stop();
  }

  private speakClean(text: string): void {
    const clean = text.trim();
    if (clean) this.speak(clean);
  }

  protected abstract speak(sentence: string): void;
  protected abstract stop(): void;
}

/** Browser voice: the Web Speech API queues utterances itself. Short utterances avoid Chrome cutting off long ones. */
export class SentenceSpeaker extends SentenceQueue {
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
    this.synth.speak(u);
  }

  protected stop(): void {
    this.synth.cancel();
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
  }
}

/** POST {base}/tts — one sentence of MP3 from Azure AI Speech (multimodal service). */
export function makeServerAudioFetcher(baseUrl: string, fetchImpl: typeof fetch = fetch): FetchSentenceAudio {
  return async (sentence, signal) => {
    const res = await fetchImpl(`${baseUrl}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: sentence }),
      signal,
    });
    if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
    return res.blob();
  };
}

/** GET {base}/tts/config: true when the service has an Azure Speech key. Any error means "no server voice". */
export async function isServerVoiceConfigured(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 3000
): Promise<boolean> {
  // A stalled request must not keep the room waiting to know its voices
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${baseUrl}/tts/config`, { signal: controller.signal });
    if (!res.ok) return false;
    const data = (await res.json()) as { configured?: boolean };
    return data.configured === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

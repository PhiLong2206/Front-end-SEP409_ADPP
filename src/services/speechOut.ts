/**
 * Reads the AI opponent's speech aloud with the browser's own Vietnamese voice (Web Speech API, no backend, no cost).
 * Chrome on Windows usually has no Vietnamese voice; Edge has online ones. Without a vi voice, reading is unavailable
 * and the room hides the toggle instead of reading Vietnamese text with an English voice.
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
 * Speaks text that arrives in pieces, one sentence at a time: the first sentence starts as soon as it is complete
 * (no wait for the whole speech), and short utterances avoid Chrome cutting off long ones after ~15 s.
 */
export class SentenceSpeaker {
  private buffer = "";
  private received = "";

  constructor(
    private readonly synth: SpeechSynthesis,
    private readonly voice: SpeechSynthesisVoice,
    private readonly rate = 1.05
  ) {}

  /** Adds streamed text; speaks every sentence that is now complete. */
  push(piece: string): void {
    this.received += piece;
    this.buffer += piece;
    let m = SENTENCE_END.exec(this.buffer);
    while (m) {
      this.speak(m[1]);
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
    this.speak(this.buffer);
    this.buffer = "";
  }

  /** Stops speaking and forgets the text (a new attempt replaces it, or the learner starts talking). */
  cancel(): void {
    this.buffer = "";
    this.received = "";
    this.synth.cancel();
  }

  private speak(text: string): void {
    const clean = text.trim();
    if (!clean) return;
    const u = new SpeechSynthesisUtterance(clean);
    u.voice = this.voice;
    u.lang = this.voice.lang;
    u.rate = this.rate;
    this.synth.speak(u);
  }
}

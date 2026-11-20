import { describe, it, expect, vi } from "vitest";
import { resolveTurnSpeechInput } from "../services/realtimeStt";

describe("resolveTurnSpeechInput", () => {
  it("live text present: sends no audio, so the service skips Whisper", async () => {
    const readAudio = vi.fn(async () => "data:audio/webm;base64,AAAA");
    const res = await resolveTurnSpeechInput("  Kính thưa ban giám khảo ", readAudio);

    expect(res).toEqual({ audioBase64: null, spokenText: "Kính thưa ban giám khảo" });
    expect(readAudio).not.toHaveBeenCalled();
  });

  it("no live text (no Deepgram key, STT failed): sends the audio to Whisper", async () => {
    const readAudio = vi.fn(async () => "data:audio/webm;base64,AAAA");
    const res = await resolveTurnSpeechInput("   ", readAudio);

    expect(res).toEqual({ audioBase64: "data:audio/webm;base64,AAAA", spokenText: null });
    expect(readAudio).toHaveBeenCalledTimes(1);
  });
});

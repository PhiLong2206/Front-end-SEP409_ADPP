import { describe, it, expect, vi, beforeAll } from "vitest";
import { pickVietnameseVoice, SentenceSpeaker } from "../services/speechOut";

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

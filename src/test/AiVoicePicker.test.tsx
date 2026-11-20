import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import AiVoicePicker from "../components/debate/AiVoicePicker";

const VOICES = [
  { id: "vi-VN-NamMinhNeural", label: "Nam Minh", gender: "male", tier: "neural" },
  { id: "vi-VN-HoaiMyNeural", label: "Hoài My", gender: "female", tier: "neural" },
  { id: "vi-VN-Grant:MAI-Voice-2.1", label: "Grant HD", gender: "male", tier: "hd" },
];

describe("AiVoicePicker (topic page): the AI's voice is chosen before the room", () => {
  let config: object;
  const ttsBodies: Array<{ text: string; voice?: string }> = [];
  const audios: Array<{ pause: ReturnType<typeof vi.fn> }> = [];
  const flush = () => act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

  beforeEach(() => {
    localStorage.clear();
    ttsBodies.length = 0;
    audios.length = 0;
    config = { configured: true, voice: "vi-VN-NamMinhNeural", voices: VOICES };
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let n = 0;
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:${++n}`);
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/tts/config")) return new Response(JSON.stringify(config), { status: 200 });
      if (url.endsWith("/tts")) {
        ttsBodies.push(JSON.parse(String(init?.body)));
        return new Response("mp3", { status: 200 });
      }
      return new Response("{}", { status: 404 });
    }));
    vi.stubGlobal("Audio", class {
      onended: (() => void) | null = null;
      play = async () => {};
      pause = vi.fn();
      constructor() {
        audios.push(this as unknown as { pause: ReturnType<typeof vi.fn> });
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lists the service's voices with clear labels; the choice is remembered for the room", async () => {
    render(<AiVoicePicker />);
    await flush();
    const select = screen.getByTestId("ai-voice-select") as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual([
      "Nam Minh (nam)", "Hoài My (nữ)", "Grant HD (nam, chậm hơn)",
    ]);
    expect(select.value).toBe("vi-VN-NamMinhNeural");

    fireEvent.change(select, { target: { value: "vi-VN-HoaiMyNeural" } });
    expect(localStorage.getItem("adpp.aiVoice")).toBe("vi-VN-HoaiMyNeural");
  });

  it("a remembered voice is selected again; one the service no longer offers falls back to its default", async () => {
    localStorage.setItem("adpp.aiVoice", "vi-VN-HoaiMyNeural");
    const { unmount } = render(<AiVoicePicker />);
    await flush();
    expect((screen.getByTestId("ai-voice-select") as HTMLSelectElement).value).toBe("vi-VN-HoaiMyNeural");
    unmount();

    localStorage.setItem("adpp.aiVoice", "vi-VN-Gone");
    render(<AiVoicePicker />);
    await flush();
    expect((screen.getByTestId("ai-voice-select") as HTMLSelectElement).value).toBe("vi-VN-NamMinhNeural");
  });

  it("read-aloud can be turned off here; the voice list is then disabled", async () => {
    render(<AiVoicePicker />);
    await flush();
    const box = screen.getByTestId("ai-voice-read-aloud") as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    expect(localStorage.getItem("adpp.aiReadAloud")).toBe("off");
    expect(screen.getByTestId("ai-voice-select")).toBeDisabled();
    expect(screen.getByTestId("ai-voice-preview")).toBeDisabled();
  });

  it("Nghe thử plays a sample with the picked voice, frees the previous one, and nothing keeps playing after leaving", async () => {
    const { unmount } = render(<AiVoicePicker />);
    await flush();
    fireEvent.change(screen.getByTestId("ai-voice-select"), { target: { value: "vi-VN-HoaiMyNeural" } });

    await act(async () => {
      fireEvent.click(screen.getByTestId("ai-voice-preview"));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(ttsBodies).toEqual([{ text: "Xin chào, mình là đối thủ của bạn trong trận tranh biện này.", voice: "vi-VN-HoaiMyNeural" }]);

    await act(async () => {
      fireEvent.click(screen.getByTestId("ai-voice-preview"));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:1");
    expect(audios[0].pause).toHaveBeenCalled();

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:2");
  });

  it("without an Azure key only the read-aloud switch shows (the room uses the browser voice)", async () => {
    config = { configured: false };
    render(<AiVoicePicker />);
    await flush();
    expect(screen.getByTestId("ai-voice-read-aloud")).toBeInTheDocument();
    expect(screen.queryByTestId("ai-voice-select")).not.toBeInTheDocument();
  });
});

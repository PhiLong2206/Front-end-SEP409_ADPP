import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import DebateRoom from "../pages/debater/DebatePractice/DebateRoom";
import type { OpponentTurnStreamHandlers } from "../services/opponentTurnStream";

window.HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { userId: 1, id: 1, fullName: "Debater Test", role: "Debater" },
    isAuthenticated: true,
  }),
}));

const mockCreateOpponentSession = vi.fn();
const mockStreamOpponentTurn = vi.fn();
const mockGenerateOpponentTurn = vi.fn();

vi.mock("../api", () => ({
  aiApi: {
    createOpponentSession: (...args: unknown[]) => mockCreateOpponentSession(...args),
    getOpponentCasePlan: vi.fn(async () => null),
    generateOpponentTurn: (...args: unknown[]) => mockGenerateOpponentTurn(...args),
    streamOpponentTurn: (...args: unknown[]) => mockStreamOpponentTurn(...args),
    evaluateSpeechArgument: vi.fn(async () => ({
      overall_score: 8, overall_reasoning: "", criteria: [], strengths: [], weaknesses: [], suggestions: [],
    })),
    evaluateDebateRound: vi.fn(),
    evaluateDebateSession: vi.fn(),
  },
  debateApi: { getSessionDetails: vi.fn(), getTranscript: vi.fn(), submitArgument: vi.fn() },
}));

class FakeUtterance {
  public voice: SpeechSynthesisVoice | null = null;
  public lang = "";
  public rate = 1;
  public onend: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

/** Utterances not yet "said". autoEnd: the fake browser finishes each one on the next tick, like a real one would. */
const queuedUtterances: FakeUtterance[] = [];
let autoEnd = true;
const endSpeech = () => queuedUtterances.splice(0).forEach((u) => u.onend?.());

const spoken: string[] = [];
const synth = {
  getVoices: () => [{ lang: "vi-VN", name: "HoaiMy", localService: false } as SpeechSynthesisVoice],
  speak: vi.fn((u: FakeUtterance) => {
    spoken.push(u.text);
    queuedUtterances.push(u);
    if (autoEnd) setTimeout(endSpeech, 0);
  }),
  cancel: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

const renderRoom = async () => {
  render(
    <MemoryRouter initialEntries={["/debater/debate/stream-1?role=CON"]}>
      <Routes>
        <Route path="/debater/debate/:sessionId" element={<DebateRoom />} />
      </Routes>
    </MemoryRouter>
  );
  await act(async () => {});
};

describe("DebateRoom: the AI opponent's turn streams in and is read aloud", () => {
  let finishTurn: (text: string) => void;
  let handlers: OpponentTurnStreamHandlers;

  beforeEach(() => {
    vi.stubEnv("VITE_AI_TURN_STREAM", "true");
    sessionStorage.clear();
    localStorage.clear();
    spoken.length = 0;
    queuedUtterances.length = 0;
    autoEnd = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    (window as unknown as { speechSynthesis: typeof synth }).speechSynthesis = synth;
    (globalThis as unknown as { SpeechSynthesisUtterance: typeof FakeUtterance }).SpeechSynthesisUtterance = FakeUtterance;
    mockCreateOpponentSession.mockResolvedValue({ opponent_session_id: "opp-1", status: "ready" });
    mockStreamOpponentTurn.mockImplementation(
      (_id: string, body: { turn_index: number }, h: OpponentTurnStreamHandlers) =>
        new Promise((resolve) => {
          handlers = h;
          finishTurn = (text) =>
            resolve({ turn_index: body.turn_index, round_type: "opening", mode: "opening_first", speech_text: text });
        })
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("VITE_AI_TURN_STREAM", "false"); // back to the suite default (setup.ts)
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("shows the text while it is written, speaks each finished sentence, then posts the final message", async () => {
    await renderRoom();
    expect(mockStreamOpponentTurn).toHaveBeenCalledTimes(1);
    expect(mockGenerateOpponentTurn).not.toHaveBeenCalled();

    await act(async () => {
      handlers.onAttempt?.(1, null);
      handlers.onDelta?.("Kính thưa ban giám khảo. ");
      handlers.onDelta?.("Mình ủng hộ kiến nghị.");
    });
    expect(screen.getByTestId("ai-live-speech")).toHaveTextContent("Kính thưa ban giám khảo. Mình ủng hộ kiến nghị.");
    expect(spoken).toEqual(["Kính thưa ban giám khảo."]);

    await act(async () => finishTurn("Kính thưa ban giám khảo. Mình ủng hộ kiến nghị."));

    expect(screen.queryByTestId("ai-live-speech")).not.toBeInTheDocument();
    expect(screen.getByText("Kính thưa ban giám khảo. Mình ủng hộ kiến nghị.")).toBeInTheDocument();
    expect(spoken).toEqual(["Kính thưa ban giám khảo.", "Mình ủng hộ kiến nghị."]);
  });

  it("tells the learner the AI wrote for the wrong side when the service reports side_flip", async () => {
    await renderRoom();
    await act(async () => {
      handlers.onAttempt?.(1, null);
      finishTurn("Mở màn.");
    });
    mockStreamOpponentTurn.mockRejectedValueOnce({ status: 502, code: "side_flip", detail: "side flip" });

    fireEvent.change(screen.getByLabelText("Lập luận của bạn"), { target: { value: "Mình phản đối." } });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Gửi lập luận"));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.getByTestId("debate-feedback-banner")).toHaveTextContent("Đối thủ AI viết lệch phe nhiều lần");
    expect(screen.getByTestId("retry-ai-turn-btn")).toBeInTheDocument();
  });

  it("a turn that starts once the voices are known is read aloud too (the learner's reply, then the AI)", async () => {
    await renderRoom();
    await act(async () => {
      handlers.onAttempt?.(1, null);
      handlers.onDelta?.("Mở màn. ");
      finishTurn("Mở màn.");
    });
    spoken.length = 0;

    fireEvent.change(screen.getByLabelText("Lập luận của bạn"), { target: { value: "Mình phản đối." } });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Gửi lập luận"));
    });
    expect(mockStreamOpponentTurn).toHaveBeenCalledTimes(2);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0)); // the reader of this turn is created (voices already known)
      handlers.onAttempt?.(1, null);
      handlers.onDelta?.("Phản bác của AI. ");
    });
    expect(spoken).toEqual(["Phản bác của AI."]);
  });

  it("AI CON speaks rebuttal then closing back to back: the closing waits for the rebuttal to be read out", async () => {
    render(
      <MemoryRouter initialEntries={["/debater/debate/stream-2?role=PRO"]}>
        <Routes>
          <Route path="/debater/debate/:sessionId" element={<DebateRoom />} />
        </Routes>
      </MemoryRouter>
    );
    await act(async () => {});
    const submit = async (text: string) => {
      fireEvent.change(screen.getByLabelText("Lập luận của bạn"), { target: { value: text } });
      await act(async () => {
        fireEvent.click(screen.getByLabelText("Gửi lập luận"));
        await new Promise((r) => setTimeout(r, 0));
      });
    };
    const speakTurn = async (text: string) => {
      await act(async () => {
        handlers.onAttempt?.(1, null);
        handlers.onDelta?.(`${text} `);
        finishTurn(text);
        await new Promise((r) => setTimeout(r, 0));
      });
    };

    await submit("PRO mở đầu.");
    await speakTurn("AI mở đầu.");
    autoEnd = false; // from here the test decides when the browser has finished speaking
    spoken.length = 0;
    await submit("PRO phản biện.");
    expect(mockStreamOpponentTurn).toHaveBeenCalledTimes(2);

    await speakTurn("AI phản biện.");
    expect(mockStreamOpponentTurn).toHaveBeenCalledTimes(3); // the closing starts right away (turns 4 and 5)
    synth.cancel.mockClear();
    await speakTurn("AI kết luận.");

    expect(spoken).toEqual(["AI phản biện."]); // the closing is shown but not spoken over the rebuttal
    expect(synth.cancel).not.toHaveBeenCalled();
    await act(async () => {
      endSpeech();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(spoken).toEqual(["AI phản biện.", "AI kết luận."]);
  });

  it("the learner's clock waits while the AI reads its turn aloud, then starts with the full time", async () => {
    autoEnd = false;
    await renderRoom(); // learner CON: the AI (PRO) opens
    const deadlineKey = "adpp_turn_deadline_stream-1_ai_r1_con";
    await act(async () => {
      handlers.onAttempt?.(1, null);
      handlers.onDelta?.("AI mở đầu. ");
      finishTurn("AI mở đầu.");
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(spoken).toEqual(["AI mở đầu."]);
    expect(sessionStorage.getItem(deadlineKey)).toBeNull(); // still being read: the turn has not started

    const before = Date.now();
    await act(async () => {
      endSpeech();
      await new Promise((r) => setTimeout(r, 0));
    });
    const deadline = Number(sessionStorage.getItem(deadlineKey));
    expect(deadline).toBeGreaterThanOrEqual(before + 135 * 1000 - 50); // 02:15 from the end of the reading
    expect(deadline).toBeLessThanOrEqual(Date.now() + 135 * 1000);
  });

  it("a new attempt replaces the text and stops the voice", async () => {
    await renderRoom();
    await act(async () => {
      handlers.onAttempt?.(1, null);
      handlers.onDelta?.("Bản bị loại. ");
      handlers.onAttempt?.(2, "banned_phrase");
      handlers.onDelta?.("Bản mới");
    });

    expect(screen.getByTestId("ai-live-speech")).toHaveTextContent(/^Bản mới$/);
    expect(synth.cancel).toHaveBeenCalled();
  });

  it("read-aloud can be turned off, and stays off", async () => {
    await renderRoom();
    const toggle = screen.getByTestId("ai-read-aloud-toggle");
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(localStorage.getItem("adpp.aiReadAloud")).toBe("off");

    await act(async () => {
      handlers.onDelta?.("Không đọc câu này. ");
      finishTurn("Không đọc câu này.");
    });
    // The turn had started with read-aloud on: turning it off drops that speaker too
    expect(spoken).toEqual([]);
  });

  it("a new attempt keeps the old text (dimmed, 'AI đang viết lại...') until the first words of the new one", async () => {
    await renderRoom();
    await act(async () => {
      handlers.onAttempt?.(1, null);
      handlers.onDelta?.("Bản bị loại. ");
    });
    expect(screen.queryByTestId("ai-rewriting-label")).not.toBeInTheDocument();

    await act(async () => {
      handlers.onAttempt?.(2, "banned_phrase");
    });
    expect(screen.getByTestId("ai-live-speech")).toHaveTextContent("Bản bị loại.");
    expect(screen.getByTestId("ai-rewriting-label")).toHaveTextContent("AI đang viết lại...");

    await act(async () => {
      handlers.onDelta?.("Bản mới");
    });
    expect(screen.getByTestId("ai-live-speech")).toHaveTextContent(/^Bản mới$/);
    expect(screen.queryByTestId("ai-rewriting-label")).not.toBeInTheDocument();
  });

  describe("the banner of a new round waits for the AI to finish reading", () => {
    const renderLearnerPro = async (id: string) => {
      render(
        <MemoryRouter initialEntries={[`/debater/debate/${id}?role=PRO`]}>
          <Routes>
            <Route path="/debater/debate/:sessionId" element={<DebateRoom />} />
          </Routes>
        </MemoryRouter>
      );
      await act(async () => {});
    };
    /** The learner speaks (Round 1), the AI answers; Round 2 begins once that answer is done. */
    const playRoundOne = async () => {
      fireEvent.change(screen.getByLabelText("Lập luận của bạn"), { target: { value: "PRO mở đầu." } });
      await act(async () => {
        fireEvent.click(screen.getByLabelText("Gửi lập luận"));
        await new Promise((r) => setTimeout(r, 0));
      });
      await act(async () => {
        handlers.onAttempt?.(1, null);
        handlers.onDelta?.("AI mở đầu. ");
        finishTurn("AI mở đầu.");
        await new Promise((r) => setTimeout(r, 0));
      });
    };

    it("does not show while the AI is still reading; skipping the reading shows it once", async () => {
      autoEnd = false; // the voice is still reading when Round 2 begins
      await renderLearnerPro("banner-1");
      await playRoundOne();

      expect(screen.getByText(/Vòng 2\/3/)).toBeInTheDocument(); // the label follows the data at once
      expect(screen.queryByTestId("round-banner")).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByTestId("skip-ai-reading-btn"));
      });
      expect(screen.getAllByTestId("round-banner")).toHaveLength(1);
      expect(screen.getByTestId("round-banner")).toHaveTextContent("Vòng 2 – Phản biện");
    });

    it("shows when the reading ends by itself", async () => {
      autoEnd = false;
      await renderLearnerPro("banner-2");
      await playRoundOne();
      expect(screen.queryByTestId("round-banner")).not.toBeInTheDocument();

      await act(async () => {
        endSpeech();
        await new Promise((r) => setTimeout(r, 0));
      });
      expect(screen.getAllByTestId("round-banner")).toHaveLength(1);
      expect(screen.getByTestId("round-banner")).toHaveTextContent("Vòng 2 – Phản biện");
    });

    it("with read-aloud off it shows as soon as the AI has finished writing", async () => {
      localStorage.setItem("adpp.aiReadAloud", "off");
      await renderLearnerPro("banner-3");
      await playRoundOne();

      expect(screen.getByTestId("round-banner")).toHaveTextContent("Vòng 2 – Phản biện");
    });
  });

  it("the learner can skip the AI's reading: the voice stops and the button goes away", async () => {
    autoEnd = false; // the voice is still in the middle of a sentence when the learner skips
    await renderRoom();

    await act(async () => {
      handlers.onAttempt?.(1, null);
      handlers.onDelta?.("Câu thứ nhất. Câu thứ hai ");
    });
    const skip = await screen.findByTestId("skip-ai-reading-btn");

    synth.cancel.mockClear();
    fireEvent.click(skip);

    expect(synth.cancel).toHaveBeenCalled();
    expect(screen.queryByTestId("skip-ai-reading-btn")).not.toBeInTheDocument();

    // The rest of the turn is shown but never read after a skip
    const spokenBefore = spoken.length;
    await act(async () => {
      handlers.onDelta?.("vẫn đang viết. ");
      finishTurn("Câu thứ nhất. Câu thứ hai vẫn đang viết.");
    });
    expect(spoken.length).toBe(spokenBefore);
  });

  it("skipping the reading once the AI turn is written starts the learner's clock with the full time at once", async () => {
    autoEnd = false; // the voice would still be reading
    await renderRoom(); // learner CON: the AI (PRO) opens
    const deadlineKey = "adpp_turn_deadline_stream-1_ai_r1_con";
    await act(async () => {
      handlers.onAttempt?.(1, null);
      handlers.onDelta?.("AI mở đầu. ");
      finishTurn("AI mở đầu.");
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(sessionStorage.getItem(deadlineKey)).toBeNull(); // still being read: the learner's turn has not started

    const before = Date.now();
    await act(async () => {
      fireEvent.click(screen.getByTestId("skip-ai-reading-btn"));
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.queryByTestId("skip-ai-reading-btn")).not.toBeInTheDocument();
    const deadline = Number(sessionStorage.getItem(deadlineKey));
    expect(deadline).toBeGreaterThanOrEqual(before + 135 * 1000 - 50);
    expect(deadline).toBeLessThanOrEqual(Date.now() + 135 * 1000);
    expect(screen.getByTestId("debate-countdown-timer")).toHaveTextContent("02:15");
  });

  it("skipping while the AI is still writing: the clock starts with the full time when the turn is done, and it is not read again", async () => {
    autoEnd = false;
    await renderRoom();
    const deadlineKey = "adpp_turn_deadline_stream-1_ai_r1_con";
    await act(async () => {
      handlers.onAttempt?.(1, null);
      handlers.onDelta?.("Câu thứ nhất. Câu thứ hai ");
    });
    await act(async () => {
      fireEvent.click(await screen.findByTestId("skip-ai-reading-btn"));
    });
    expect(sessionStorage.getItem(deadlineKey)).toBeNull(); // the AI is still writing: no learner turn yet
    const spokenAfterSkip = spoken.length;

    const before = Date.now();
    await act(async () => {
      handlers.onDelta?.("vẫn đang viết. ");
      finishTurn("Câu thứ nhất. Câu thứ hai vẫn đang viết.");
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(spoken.length).toBe(spokenAfterSkip);
    const deadline = Number(sessionStorage.getItem(deadlineKey));
    expect(deadline).toBeGreaterThanOrEqual(before + 135 * 1000 - 50); // counted from the end of the turn, not earlier
    expect(screen.getByTestId("debate-countdown-timer")).toHaveTextContent("02:15");
  });

  it("turning read-aloud on during the AI's turn reads that turn, from what is already written", async () => {
    localStorage.setItem("adpp.aiReadAloud", "off");
    await renderRoom();
    await act(async () => {
      handlers.onAttempt?.(1, null);
      handlers.onDelta?.("Câu đã viết. Câu đang ");
    });
    expect(spoken).toEqual([]);

    fireEvent.click(screen.getByTestId("ai-read-aloud-toggle"));
    expect(spoken).toEqual(["Câu đã viết."]);

    await act(async () => {
      handlers.onDelta?.("viết.");
      finishTurn("Câu đã viết. Câu đang viết.");
    });
    expect(spoken).toEqual(["Câu đã viết.", "Câu đang viết."]);
  });
});

describe("DebateRoom: with the Azure voice configured on the multimodal service", () => {
  let handlers: OpponentTurnStreamHandlers;
  let finishTurn: (text: string) => void;
  const played: string[] = [];
  const playedVoices: Array<string | null> = [];
  let ttsConfig: object = { configured: true };

  beforeEach(() => {
    playedVoices.length = 0;
    ttsConfig = { configured: true };
    vi.stubEnv("VITE_AI_TURN_STREAM", "true");
    sessionStorage.clear();
    localStorage.clear();
    played.length = 0;
    spoken.length = 0;
    vi.spyOn(console, "error").mockImplementation(() => {});
    (window as unknown as { speechSynthesis: typeof synth }).speechSynthesis = synth;
    (globalThis as unknown as { SpeechSynthesisUtterance: typeof FakeUtterance }).SpeechSynthesisUtterance = FakeUtterance;
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:x");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/tts/config")) return new Response(JSON.stringify(ttsConfig), { status: 200 });
      if (url.endsWith("/tts")) {
        const body = JSON.parse(String(init?.body));
        played.push(body.text);
        playedVoices.push(body.voice ?? null);
        return new Response("mp3", { status: 200 });
      }
      return new Response("{}", { status: 404 });
    }));
    vi.stubGlobal("Audio", class {
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      play = async () => {};
      pause = () => {};
    });
    mockCreateOpponentSession.mockResolvedValue({ opponent_session_id: "opp-1", status: "ready" });
    mockStreamOpponentTurn.mockImplementation(
      (_id: string, body: { turn_index: number }, h: OpponentTurnStreamHandlers) =>
        new Promise((resolve) => {
          handlers = h;
          finishTurn = (text) =>
            resolve({ turn_index: body.turn_index, round_type: "opening", mode: "opening_first", speech_text: text });
        })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.stubEnv("VITE_AI_TURN_STREAM", "false");
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("asks the service for each finished sentence instead of the browser voice", async () => {
    await renderRoom();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0)); // config request resolves
    });
    expect(screen.getByTestId("ai-read-aloud-toggle")).toHaveAttribute("title", expect.stringContaining("Azure"));

    await act(async () => {
      handlers.onAttempt?.(1, null);
      handlers.onDelta?.("Kính thưa ban giám khảo. Mình ");
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(played).toEqual(["Kính thưa ban giám khảo."]);
    expect(spoken).toEqual([]); // the browser voice is only the fallback

    await act(async () => {
      handlers.onDelta?.("ủng hộ.");
      finishTurn("Kính thưa ban giám khảo. Mình ủng hộ.");
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getByText("Kính thưa ban giám khảo. Mình ủng hộ.")).toBeInTheDocument();
  });

  it("reads every sentence with the voice picked on the topic page, and shows which one", async () => {
    localStorage.setItem("adpp.aiVoice", "vi-VN-HoaiMyNeural");
    ttsConfig = {
      configured: true,
      voice: "vi-VN-NamMinhNeural",
      voices: [
        { id: "vi-VN-NamMinhNeural", label: "Nam Minh", gender: "male", tier: "neural" },
        { id: "vi-VN-HoaiMyNeural", label: "Hoài My", gender: "female", tier: "neural" },
      ],
    };
    await renderRoom();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getByTestId("ai-voice-current")).toHaveTextContent("Giọng: Hoài My (nữ)");
    expect(screen.queryByTestId("ai-voice-select")).not.toBeInTheDocument(); // picked before the room, not here

    await act(async () => {
      handlers.onAttempt?.(1, null);
      handlers.onDelta?.("Câu một. Câu hai. ");
      finishTurn("Câu một. Câu hai.");
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(played).toEqual(["Câu một.", "Câu hai."]);
    expect(playedVoices).toEqual(["vi-VN-HoaiMyNeural", "vi-VN-HoaiMyNeural"]);
  });

  it("read-aloud turned off on the topic page: the room does not read", async () => {
    localStorage.setItem("adpp.aiReadAloud", "off");
    await renderRoom();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(screen.getByTestId("ai-read-aloud-toggle")).toHaveAttribute("aria-pressed", "false");
    await act(async () => {
      handlers.onAttempt?.(1, null);
      handlers.onDelta?.("Không đọc. ");
      finishTurn("Không đọc.");
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(played).toEqual([]);
  });
});

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
  constructor(public text: string) {}
}

const spoken: string[] = [];
const synth = {
  getVoices: () => [{ lang: "vi-VN", name: "HoaiMy", localService: false } as SpeechSynthesisVoice],
  speak: vi.fn((u: FakeUtterance) => spoken.push(u.text)),
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

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DebateChat from "../components/debate/room/DebateChat";
import type { DebateMessageData } from "../components/debate/room/DebateMessageItem";

window.HTMLElement.prototype.scrollIntoView = () => {};

const aiMessage = (content: string, roundNumber = 2): DebateMessageData => ({
  id: `m-${roundNumber}`,
  speaker: "AI",
  speakerName: "Đối thủ AI",
  side: "Phản đối",
  stage: roundNumber === 1 ? "Mở đầu" : roundNumber === 2 ? "Phản biện" : "Kết luận",
  roundNumber,
  timestamp: "10:00",
  content,
  isCurrentUser: false,
});

const renderChat = (props: Partial<React.ComponentProps<typeof DebateChat>> = {}) =>
  render(
    <DebateChat
      messages={[aiMessage("Câu một. Câu hai.")]}
      mode="ai"
      debaterSide="pro"
      currentRound={2}
      {...props}
    />
  );

describe("the AI text turns from grey to the main colour as the voice reads it", () => {
  it("the part read is in the main colour, the rest is grey (light and dark colours, a 150 ms colour change only)", () => {
    renderChat({ readProgressByRound: { 2: 8 } });

    const spoken = screen.getByTestId("read-spoken");
    const unspoken = screen.getByTestId("read-unspoken");
    expect(spoken).toHaveTextContent("Câu một.");
    expect(unspoken.textContent).toBe(" Câu hai.");
    expect(spoken.className).toContain("text-slate-900");
    expect(spoken.className).toContain("dark:text-white");
    expect(unspoken.className).toContain("text-slate-500");
    expect(unspoken.className).toContain("dark:text-slate-400");
    for (const el of [spoken, unspoken]) {
      expect(el.className).toContain("transition-colors");
      expect(el.className).toContain("duration-150");
      expect(el.className).toContain("motion-reduce:transition-none"); // reduced motion: no transition
      expect(el.className).not.toMatch(/font-(bold|semibold|medium)/); // only the colour changes, the layout cannot jump
    }
    // The paragraph keeps its own text and line breaks: both parts live in the same <p>
    expect(spoken.parentElement).toBe(unspoken.parentElement);
    expect(spoken.parentElement?.textContent).toBe("Câu một. Câu hai.");
  });

  it("a message that is not being read (no progress for its round) has no grey part", () => {
    renderChat({ readProgressByRound: { 1: 5 } }); // another round is being read
    expect(screen.queryByTestId("read-unspoken")).not.toBeInTheDocument();
    expect(screen.getByText("Câu một. Câu hai.")).toBeInTheDocument();
  });

  it("a message that is read in full is all in the main colour", () => {
    renderChat({ readProgressByRound: { 2: 17 } });
    expect(screen.getByTestId("read-unspoken").textContent).toBe("");
    expect(screen.getByTestId("read-spoken")).toHaveTextContent("Câu một. Câu hai.");
  });

  it("the text that streams in beyond the voice stays grey; without reading it is all the main colour", () => {
    const { rerender } = renderChat({ messages: [], isAiGenerating: true, liveAiSpeech: "Đã đọc. Mới tới.", liveReadProgress: 7 });
    expect(screen.getByTestId("read-spoken")).toHaveTextContent("Đã đọc.");
    expect(screen.getByTestId("read-unspoken").textContent).toBe(" Mới tới.");

    rerender(
      <DebateChat
        messages={[]}
        mode="ai"
        debaterSide="pro"
        currentRound={2}
        isAiGenerating
        liveAiSpeech="Đã đọc. Mới tới."
        liveReadProgress={null}
      />
    );
    expect(screen.queryByTestId("read-unspoken")).not.toBeInTheDocument();
    expect(screen.getByTestId("ai-live-speech")).toHaveTextContent("Đã đọc. Mới tới.");
  });

  it("a learner message is never greyed", () => {
    renderChat({
      messages: [{ ...aiMessage("Lời của tôi.", 2), speaker: "Debater", isCurrentUser: true }],
      readProgressByRound: { 2: 3 },
    });
    expect(screen.queryByTestId("read-unspoken")).not.toBeInTheDocument();
  });
});

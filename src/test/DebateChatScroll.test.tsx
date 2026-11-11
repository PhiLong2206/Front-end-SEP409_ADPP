import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DebateChat from "../components/debate/DebateChat";
import type { DebateMessageData } from "../components/debate/DebateMessageItem";

const scrollSpy = vi.fn();

const message = (id: string, speaker: "AI" | "Debater", round = 1): DebateMessageData => ({
  id,
  speaker,
  speakerName: speaker === "AI" ? "Đối thủ AI" : "Bạn",
  side: speaker === "AI" ? "Phản đối" : "Ủng hộ",
  stage: "Mở đầu",
  roundNumber: round,
  timestamp: "10:00",
  content: `Nội dung ${id}`,
  isCurrentUser: speaker === "Debater",
});

const baseProps = {
  mode: "ai" as const,
  debaterSide: "pro" as const,
  currentRound: 1,
};

/** jsdom has no layout: describe how far the user is from the end of the conversation. */
const setScrollPosition = (distanceFromBottom: number) => {
  const el = screen.getByTestId("debate-chat-scroll");
  Object.defineProperty(el, "scrollHeight", { value: 2000, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: 500, configurable: true });
  Object.defineProperty(el, "scrollTop", { value: 1500 - distanceFromBottom, configurable: true, writable: true });
  fireEvent.scroll(el);
};

describe("DebateChat auto-scroll", () => {
  beforeEach(() => {
    scrollSpy.mockClear();
    window.HTMLElement.prototype.scrollIntoView = scrollSpy;
  });

  it("scrolls to the end once when the page is entered", () => {
    render(<DebateChat {...baseProps} messages={[message("m1", "Debater"), message("m2", "AI")]} />);

    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });

  it("follows a new message when the user is at the bottom", () => {
    const first = [message("m1", "Debater")];
    const { rerender } = render(<DebateChat {...baseProps} messages={first} />);
    setScrollPosition(0);
    scrollSpy.mockClear();

    rerender(<DebateChat {...baseProps} messages={[...first, message("m2", "AI")]} />);

    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });

  it("does not follow a new message while the user is reading above, and offers a 'new message' button", () => {
    const first = [message("m1", "Debater"), message("m2", "AI")];
    const { rerender } = render(<DebateChat {...baseProps} messages={first} />);
    setScrollPosition(1400); // scrolled up (well over 120px from the end)
    scrollSpy.mockClear();

    rerender(<DebateChat {...baseProps} messages={[...first, message("m3", "AI", 2)]} />);

    expect(scrollSpy).not.toHaveBeenCalled();
    const button = screen.getByRole("button", { name: /Tin nhắn mới/ });
    fireEvent.click(button);
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /Tin nhắn mới/ })).not.toBeInTheDocument();
  });

  it("does not scroll on a re-render that brings no new message (same ids, new array)", () => {
    const { rerender } = render(<DebateChat {...baseProps} messages={[message("m1", "Debater"), message("m2", "AI")]} />);
    setScrollPosition(0);
    scrollSpy.mockClear();

    rerender(<DebateChat {...baseProps} isAiGenerating={false} messages={[message("m1", "Debater"), message("m2", "AI")]} />);
    rerender(<DebateChat {...baseProps} currentRound={2} isTurnExpired messages={[message("m1", "Debater"), message("m2", "AI")]} />);

    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("a finished debate never pulls the user back down while re-reading the transcript", () => {
    const messages = [message("m1", "Debater"), message("m2", "AI")];
    const { rerender } = render(<DebateChat {...baseProps} isDebateCompleted messages={messages} />);
    scrollSpy.mockClear();

    // The user scrolls up: that must not trigger any scroll back (the former bug), nor will later re-renders
    setScrollPosition(1400);
    rerender(<DebateChat {...baseProps} isDebateCompleted messages={[...messages]} />);
    rerender(<DebateChat {...baseProps} isDebateCompleted isTurnExpired messages={[...messages]} />);
    expect(scrollSpy).not.toHaveBeenCalled();

    // Even at the bottom, a finished debate does not auto-scroll for a late message
    setScrollPosition(0);
    scrollSpy.mockClear();
    rerender(<DebateChat {...baseProps} isDebateCompleted messages={[...messages, message("m3", "AI", 3)]} />);
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("shows the completion card when the debate ends while the user is following along", () => {
    const messages = [message("m1", "Debater"), message("m2", "AI")];
    const { rerender } = render(<DebateChat {...baseProps} messages={messages} />);
    setScrollPosition(0);
    scrollSpy.mockClear();

    rerender(<DebateChat {...baseProps} isDebateCompleted messages={messages} />);

    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });
});

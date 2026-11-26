import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import RoundStatusBar, { roundClockTone } from "../components/debate/room/RoundStatusBar";
import DebateHeader from "../components/debate/room/DebateHeader";

type BarProps = React.ComponentProps<typeof RoundStatusBar>;

const baseProps: BarProps = {
  round: 2,
  totalRounds: 3,
  roundLabel: "Phản biện",
  isPreparing: false,
  isPrepStarting: false,
  prepSecondsLeft: 0,
  secondsRemaining: 100,
  isAiWriting: false,
  isAiPresenting: false,
  canSpeak: true,
  isExpired: false,
  isCompleted: false,
  isWaitingForOpponent: false,
  canSkipPreparation: false,
  isSkippingPreparation: false,
  onSkipPreparation: () => {},
  readingPartName: null,
  onSkipReading: () => {},
  announcedRound: null,
};

const renderBar = (over: Partial<BarProps> = {}) => render(<RoundStatusBar {...baseProps} {...over} />);

describe("RoundStatusBar: one status line and one clock", () => {
  it("preparation: shows the preparation seconds (blue) with the label and 'Bắt đầu ngay'", () => {
    const onSkipPreparation = vi.fn();
    renderBar({ isPreparing: true, prepSecondsLeft: 42, secondsRemaining: 135, canSkipPreparation: true, onSkipPreparation });

    expect(screen.getByTestId("round-label")).toHaveTextContent("Vòng 2/3 · Phản biện");
    expect(screen.getByTestId("round-status-text")).toHaveTextContent("Thời gian chuẩn bị");
    const clock = screen.getByTestId("preparation-countdown");
    expect(clock).toHaveTextContent("00:42");
    expect(clock).toHaveAttribute("role", "timer");
    expect(clock).toHaveAttribute("data-tone", "prep");
    expect(clock.className).toContain("font-mono");
    expect(screen.queryByTestId("debate-countdown-timer")).not.toBeInTheDocument(); // never two clocks
    fireEvent.click(screen.getByTestId("skip-preparation-btn"));
    expect(onSkipPreparation).toHaveBeenCalledTimes(1);
  });

  it("the learner's turn: shows secondsRemaining, green, then amber under 30 s, then red under 10 s", () => {
    const { rerender } = renderBar({ secondsRemaining: 95 });
    expect(screen.getByTestId("round-status-text")).toHaveTextContent("Lượt của bạn");
    expect(screen.getByTestId("debate-countdown-timer")).toHaveTextContent("01:35");
    expect(screen.getByTestId("debate-countdown-timer")).toHaveAttribute("data-tone", "ok");
    expect(screen.getByTestId("debate-countdown-timer").className).toContain("text-[#0B5ED7]");

    rerender(<RoundStatusBar {...baseProps} secondsRemaining={29} />);
    expect(screen.getByTestId("debate-countdown-timer")).toHaveAttribute("data-tone", "warn");
    expect(screen.getByTestId("debate-countdown-timer").className).toContain("text-amber-600");

    rerender(<RoundStatusBar {...baseProps} secondsRemaining={9} />);
    expect(screen.getByTestId("debate-countdown-timer")).toHaveAttribute("data-tone", "danger");
    expect(screen.getByTestId("debate-countdown-timer").className).toContain("text-rose-600");
    expect(screen.getByTestId("debate-countdown-timer")).toHaveTextContent("00:09");
  });

  it("the thresholds are exactly 30 s and 10 s", () => {
    expect(roundClockTone("turn", 30, false)).toBe("ok");
    expect(roundClockTone("turn", 29, false)).toBe("warn");
    expect(roundClockTone("turn", 10, false)).toBe("warn");
    expect(roundClockTone("turn", 9, false)).toBe("danger");
    expect(roundClockTone("turn", 50, true)).toBe("danger");
  });

  it("the AI writes: no counting, a dash, and the status says it is composing", () => {
    renderBar({ isAiWriting: true, secondsRemaining: 135, canSpeak: false });
    expect(screen.getByTestId("round-status-text")).toHaveTextContent("Đối thủ AI đang soạn…");
    expect(screen.getByTestId("ai-waiting-clock")).toHaveTextContent("—");
    expect(screen.queryByTestId("debate-countdown-timer")).not.toBeInTheDocument();
    expect(screen.queryByText("02:15")).not.toBeInTheDocument();
  });

  it("the AI reads: no counting, the status says it is presenting, and the button names the part and skips it", () => {
    const onSkipReading = vi.fn();
    renderBar({ readingPartName: "Phản biện", canSpeak: false, onSkipReading });
    expect(screen.getByTestId("round-status-text")).toHaveTextContent("Đối thủ AI đang trình bày");
    expect(screen.getByTestId("ai-waiting-clock")).toHaveTextContent("—");
    expect(screen.getByTestId("skip-ai-reading-btn")).toHaveTextContent("Bỏ qua phần Phản biện");
    fireEvent.click(screen.getByTestId("skip-ai-reading-btn"));
    expect(onSkipReading).toHaveBeenCalledTimes(1);
  });

  it("while the AI presents during the preparation there is no 'Bắt đầu ngay' and no number", () => {
    renderBar({ isPreparing: true, isAiPresenting: true, prepSecondsLeft: 60, canSkipPreparation: true, canSpeak: false });
    expect(screen.queryByTestId("skip-preparation-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("preparation-countdown")).not.toBeInTheDocument();
    expect(screen.getByTestId("ai-waiting-clock")).toHaveTextContent("—");
  });

  it("the status line is a polite live region, and the steps mark the current round", () => {
    renderBar();
    expect(screen.getByTestId("round-status-text")).toHaveAttribute("aria-live", "polite");
    const steps = screen.getByTestId("round-steps").querySelectorAll("li");
    expect(steps).toHaveLength(3);
    expect(steps[1]).toHaveAttribute("aria-current", "step");
  });

  it("a new round glows for one second", async () => {
    vi.useFakeTimers();
    try {
      const { rerender } = renderBar();
      expect(screen.getByTestId("round-status-bar")).toHaveAttribute("data-glow", "false");
      rerender(<RoundStatusBar {...baseProps} announcedRound={{ round: 2, label: "Phản biện" }} />);
      expect(screen.getByTestId("round-status-bar")).toHaveAttribute("data-glow", "true");
      expect(screen.getByTestId("round-banner")).toHaveTextContent("Vòng 2 – Phản biện");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(screen.getByTestId("round-status-bar")).toHaveAttribute("data-glow", "false");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("DebateHeader no longer has a clock", () => {
  it("shows no countdown and no round label", () => {
    render(
      <DebateHeader
        motionText="Kiến nghị"
        mode="ai"
        debaterSide="pro"
        secondsRemaining={120}
        canSpeak
        onExit={() => {}}
        onSubmitDebate={() => {}}
      />
    );
    expect(screen.queryByTestId("debate-countdown-timer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("round-label")).not.toBeInTheDocument();
    expect(screen.queryByText("02:00")).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import DebateRoom from "../pages/debater/DebatePractice/DebateRoom";
import { ACTIVE_DEBATE_SESSION_KEY } from "../hooks/useDebateNavigationGuard";
import { clearDebateRoomStorage, leaveDebateRoom } from "../utils/debateLeave";
import { getLocalOpponentSessionId } from "../utils/opponentReadiness";

window.HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { userId: 1, id: 1, fullName: "Debater Test", role: "Debater" },
    isAuthenticated: true,
  }),
}));

const mockLeaveSession = vi.fn();
const mockGetSessionDetails = vi.fn();

vi.mock("../api", () => ({
  aiApi: {
    createOpponentSession: vi.fn().mockResolvedValue({ opponent_session_id: "opp-1", status: "ready" }),
    getOpponentCasePlan: vi.fn().mockResolvedValue(null),
    generateOpponentTurn: vi.fn().mockResolvedValue({ turn_index: 2, round_type: "opening", mode: "opening_reply", speech_text: "AI." }),
    evaluateSpeechArgument: vi.fn(),
    evaluateDebateRound: vi.fn(),
    evaluateDebateSession: vi.fn(),
  },
  debateApi: {
    getSessionDetails: (...args: unknown[]) => mockGetSessionDetails(...args),
    getTranscript: vi.fn().mockResolvedValue({ success: true, data: { arguments: [] } }),
    getPendingSwapRequests: vi.fn().mockResolvedValue({ success: true, data: [] }),
    submitArgument: vi.fn().mockResolvedValue({ success: true }),
    startDebateSession: vi.fn().mockResolvedValue({ success: true }),
    leaveSession: (...args: unknown[]) => mockLeaveSession(...args),
  },
}));

const seedRoom = (roomId: string) => {
  sessionStorage.setItem(`adpp_messages_${roomId}`, "[]");
  sessionStorage.setItem(`adpp_current_round_${roomId}`, "2");
  sessionStorage.setItem(`adpp_timed_out_rounds_${roomId}`, "[]");
  sessionStorage.setItem(`adpp_debate_completed_${roomId}`, "1");
  sessionStorage.setItem(`adpp_turn_deadline_${roomId}_ai_r2_pro`, "1");
  sessionStorage.setItem(`adpp_turn_expired_${roomId}_ai_r1_pro`, "1");
  sessionStorage.setItem(`adpp_opponent_session_${roomId}`, "old-opponent");
  sessionStorage.setItem(ACTIVE_DEBATE_SESSION_KEY, JSON.stringify({ sessionId: roomId, url: `/debater/debate/${roomId}` }));
};

const roomKeys = (roomId: string) =>
  Object.keys(sessionStorage).filter((key) => key.includes(`_${roomId}`) || key === ACTIVE_DEBATE_SESSION_KEY);

describe("clearDebateRoomStorage", () => {
  beforeEach(() => sessionStorage.clear());

  it("removes every key of the room, and only of that room", () => {
    seedRoom("1");
    sessionStorage.setItem("adpp_messages_11", "[]");
    sessionStorage.setItem("adpp_turn_deadline_11_ai_r1_pro", "1");
    sessionStorage.setItem("adpp_token", "keep");

    clearDebateRoomStorage("1");

    expect(Object.keys(sessionStorage).sort()).toEqual(["adpp_messages_11", "adpp_token", "adpp_turn_deadline_11_ai_r1_pro"]);
  });

  it("gives the room a new opponent session next time", () => {
    const first = getLocalOpponentSessionId("session-comp-5");
    expect(getLocalOpponentSessionId("session-comp-5")).toBe(first);

    clearDebateRoomStorage("session-comp-5");

    expect(getLocalOpponentSessionId("session-comp-5")).not.toBe(first);
  });
});

describe("leaveDebateRoom", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockLeaveSession.mockReset();
    mockLeaveSession.mockResolvedValue({ success: true });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("does not call the Backend and keeps the room's state until the endpoint is enabled", async () => {
    seedRoom("42");

    await leaveDebateRoom("42", 42);

    expect(mockLeaveSession).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("adpp_messages_42")).toBe("[]");
    expect(sessionStorage.getItem(ACTIVE_DEBATE_SESSION_KEY)).toBeNull();
  });

  it("clears the state only after the Backend call has finished", async () => {
    vi.stubEnv("VITE_DEBATE_LEAVE_ENABLED", "true");
    seedRoom("42");
    let finishCall: (value: unknown) => void = () => {};
    mockLeaveSession.mockReturnValue(new Promise((resolve) => (finishCall = resolve)));

    const leaving = leaveDebateRoom("42", 42);
    expect(mockLeaveSession).toHaveBeenCalledWith(42);
    expect(sessionStorage.getItem("adpp_messages_42")).toBe("[]");

    // A late AI reply saved while the call is pending must not survive
    sessionStorage.setItem("adpp_messages_42", '[{"id":"late"}]');
    finishCall({ success: true });
    await leaving;

    expect(roomKeys("42")).toEqual([]);
  });

  it("still clears the state and lets the user leave when the Backend fails", async () => {
    vi.stubEnv("VITE_DEBATE_LEAVE_ENABLED", "true");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    seedRoom("42");
    mockLeaveSession.mockRejectedValue(new Error("500"));

    await expect(leaveDebateRoom("42", 42)).resolves.toBe(true);

    expect(roomKeys("42")).toEqual([]);
  });

  it("clears a competition room right away: it has no Backend session to cancel", async () => {
    seedRoom("session-comp-5");

    await leaveDebateRoom("session-comp-5", null);

    expect(mockLeaveSession).not.toHaveBeenCalled();
    expect(roomKeys("session-comp-5")).toEqual([]);
  });
});

const session = (overrides: Record<string, unknown>) => ({
  success: true,
  data: {
    sessionId: 42,
    title: "Phòng",
    topic: "Kiến nghị",
    debateType: 2,
    currentStage: 1,
    currentTurnSide: 1,
    status: 2,
    createdByUserId: 1,
    createdAt: "2026-11-03T00:00:00Z",
    participants: [
      { participantId: 1, userId: 1, speakerName: "Debater Test", isAI: false, side: 1 },
      { participantId: 2, userId: 2, speakerName: "Đối thủ", isAI: false, side: 2 },
    ],
    ...overrides,
  },
});

const renderRoom = async (entry: string) => {
  const utils = render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/debater/dashboard" element={<div data-testid="dashboard-page" />} />
        <Route path="/debater/debate/:sessionId" element={<DebateRoom />} />
      </Routes>
    </MemoryRouter>
  );
  await act(async () => {});
  await act(async () => {});
  return utils;
};

const confirmLeaving = async () => {
  fireEvent.click(screen.getByLabelText("Rời phòng tranh biện"));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Rời trận" }));
  });
};

describe("DebateRoom: leaving", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockLeaveSession.mockReset();
    mockLeaveSession.mockResolvedValue({ success: true });
    mockGetSessionDetails.mockReset();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("confirming cancels the session on the Backend, clears its state and leaves", async () => {
    vi.stubEnv("VITE_DEBATE_LEAVE_ENABLED", "true");
    mockGetSessionDetails.mockResolvedValue(session({ status: 2 }));
    await renderRoom("/debater/debate/42");
    expect(sessionStorage.getItem("adpp_current_round_42")).not.toBeNull();

    await confirmLeaving();

    expect(mockLeaveSession).toHaveBeenCalledWith(42);
    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
    expect(roomKeys("42")).toEqual([]);
  });

  it("while the session is loading, leaving asks nothing and cancels nothing: it may be a running AI debate", async () => {
    vi.stubEnv("VITE_DEBATE_LEAVE_ENABLED", "true");
    mockGetSessionDetails.mockReturnValue(new Promise(() => {})); // never resolves
    sessionStorage.setItem("adpp_messages_42", '[{"id":"kept"}]');
    await renderRoom("/debater/debate/42");
    expect(screen.getByTestId("debate-lobby-loading")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Rời phòng tranh biện"));
    });

    expect(screen.queryByRole("button", { name: "Rời trận" })).not.toBeInTheDocument();
    expect(mockLeaveSession).not.toHaveBeenCalled();
    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
    expect(sessionStorage.getItem("adpp_messages_42")).toBe('[{"id":"kept"}]');
  });

  it("state saved between the clear and the room unmounting does not survive", async () => {
    vi.stubEnv("VITE_DEBATE_LEAVE_ENABLED", "true");
    mockGetSessionDetails.mockResolvedValue(session({ status: 2 }));
    await renderRoom("/debater/debate/42");
    // Right after the first clear, the still-mounted room saves its messages again
    const removeItem = Storage.prototype.removeItem;
    let rewritten = false;
    const spy = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (this: Storage, key: string) {
      removeItem.call(this, key);
      if (key === "adpp_messages_42" && !rewritten) {
        rewritten = true;
        this.setItem(key, '[{"id":"late"}]');
      }
    });

    await confirmLeaving();
    spy.mockRestore();

    expect(rewritten).toBe(true);
    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
    expect(sessionStorage.getItem("adpp_messages_42")).toBeNull();
  });

  it("choosing to stay calls nothing and keeps everything", async () => {
    vi.stubEnv("VITE_DEBATE_LEAVE_ENABLED", "true");
    mockGetSessionDetails.mockResolvedValue(session({ status: 2 }));
    await renderRoom("/debater/debate/42");

    fireEvent.click(screen.getByLabelText("Rời phòng tranh biện"));
    fireEvent.click(screen.getByRole("button", { name: "Ở lại trận đấu" }));

    expect(mockLeaveSession).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("adpp_current_round_42")).not.toBeNull();
  });

  it("a reload clears nothing, so the debate can continue", async () => {
    vi.stubEnv("VITE_DEBATE_LEAVE_ENABLED", "true");
    mockGetSessionDetails.mockResolvedValue(session({ status: 2 }));
    const { unmount } = await renderRoom("/debater/debate/42");

    unmount();

    expect(mockLeaveSession).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("adpp_current_round_42")).not.toBeNull();
    expect(sessionStorage.getItem(ACTIVE_DEBATE_SESSION_KEY)).not.toBeNull();
  });

  it("the waiting lobby asks for confirmation and cancels the room", async () => {
    vi.stubEnv("VITE_DEBATE_LEAVE_ENABLED", "true");
    mockGetSessionDetails.mockResolvedValue(session({ status: 1 }));
    await renderRoom("/debater/debate/42");
    expect(screen.getByText("Phòng chờ (Waiting)")).toBeInTheDocument();

    await confirmLeaving();

    expect(mockLeaveSession).toHaveBeenCalledWith(42);
    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
  });

  it("with the endpoint off, confirming keeps the Backend session and its state", async () => {
    mockGetSessionDetails.mockResolvedValue(session({ status: 2 }));
    await renderRoom("/debater/debate/42");

    await confirmLeaving();

    expect(mockLeaveSession).not.toHaveBeenCalled();
    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
    expect(sessionStorage.getItem("adpp_current_round_42")).not.toBeNull();
    expect(sessionStorage.getItem(ACTIVE_DEBATE_SESSION_KEY)).toBeNull();
  });

  it("a competition room clears its state even with the endpoint off", async () => {
    await renderRoom("/debater/debate/session-comp-5");

    await confirmLeaving();

    expect(mockLeaveSession).not.toHaveBeenCalled();
    expect(roomKeys("session-comp-5")).toEqual([]);
  });

  it("the other player sees that the session was cancelled and cannot speak", async () => {
    mockGetSessionDetails.mockResolvedValue(session({ status: 4 }));
    await renderRoom("/debater/debate/42");

    expect(screen.getByTestId("debate-cancelled-notice")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Phiên tranh biện đã bị huỷ.")).toBeDisabled();
    expect(sessionStorage.getItem(ACTIVE_DEBATE_SESSION_KEY)).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import DebateRoom from "../pages/debater/DebatePractice/DebateRoom";
import { isTeamDebateSession, roomSeatCount } from "../utils/debateRoomMode";

window.HTMLElement.prototype.scrollIntoView = vi.fn();

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { userId: 1, id: 1, fullName: "Debater Test", role: "Debater" },
    isAuthenticated: true,
  }),
}));

let hubCallbacks: { onUserJoined?: (e: unknown) => void } = {};
vi.mock("../services/debateHub", () => ({
  debateHubService: {
    connect: vi.fn(async (_id: number, callbacks: typeof hubCallbacks) => {
      hubCallbacks = callbacks;
    }),
    disconnect: vi.fn(async () => {}),
    sendSpeakingStatus: vi.fn(),
    sendLiveTranscript: vi.fn(),
    sendTeamCallSignal: vi.fn(async () => ({ ok: true, code: null })),
  },
}));

const mockGetSessionDetails = vi.fn();
vi.mock("../api", () => ({
  aiApi: {},
  debateApi: {
    getSessionDetails: (...a: unknown[]) => mockGetSessionDetails(...a),
    getTranscript: vi.fn().mockResolvedValue({ success: true, data: { arguments: [] } }),
    getPendingSwapRequests: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getIceServers: vi.fn().mockRejectedValue({ status: 403 }),
  },
}));

/** A room that was just created by topic: one participant, still waiting, and a title that never says "2v2". */
const waitingRoom = (extra: Record<string, unknown>, participants = 1, title = "Mạng xã hội có hại hơn lợi?") => ({
  sessionId: 123,
  title,
  topic: "Mạng xã hội có hại hơn lợi?",
  status: 1,
  debateType: 2,
  createdByUserId: 1,
  createdAt: "2026-11-20T09:55:00Z",
  currentStage: 1,
  currentTurnSide: 1,
  participants: Array.from({ length: participants }, (_, i) => ({
    userId: i + 1,
    side: i % 2 === 0 ? 1 : 2,
    isAI: false,
    speakerName: i === 0 ? "Debater Test" : `Người ${i + 1}`,
  })),
  totalRounds: 3,
  serverTime: new Date().toISOString(),
  ...extra,
});

const renderLobby = async (data: Record<string, unknown>) => {
  mockGetSessionDetails.mockResolvedValue({ success: true, data });
  render(
    <MemoryRouter initialEntries={["/debater/debate/123?role=PRO"]}>
      <Routes>
        <Route path="/debater/debate/:sessionId" element={<DebateRoom />} />
      </Routes>
    </MemoryRouter>
  );
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
};

describe("the room mode comes from isTeamDebate, not from a guess on the title", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("isTeamDebate true, one participant, a title without 2v2 -> a 2v2 room with 4 seats", async () => {
    await renderLobby(waitingRoom({ isTeamDebate: true, maxParticipants: 4 }));
    expect(await screen.findByText("Tranh biện 2 vs 2")).toBeInTheDocument();
    expect(screen.getByText("1/2", { selector: "span" })).toBeInTheDocument(); // PRO side: seats per side
    expect(screen.getByText(/Chờ đủ người \(1\/4\)/)).toBeInTheDocument();
  });

  it("isTeamDebate false -> a 1v1 room with 2 seats, even if the title says 2v2", async () => {
    await renderLobby(waitingRoom({ isTeamDebate: false, maxParticipants: 2 }, 1, "[2v2] Đề cũ"));
    expect(await screen.findByText("Đối kháng 1 vs 1 P2P")).toBeInTheDocument();
    expect(screen.queryByText("Tranh biện 2 vs 2")).not.toBeInTheDocument();
    expect(screen.getByText(/Chờ đủ người \(1\/2\)/)).toBeInTheDocument();
  });

  it("an older Backend (no field): the old guess from the title and the number of participants", async () => {
    await renderLobby(waitingRoom({}, 1, "[2v2] Phòng cũ"));
    expect(await screen.findByText("Tranh biện 2 vs 2")).toBeInTheDocument();
    expect(screen.getByText(/Chờ đủ người \(1\/4\)/)).toBeInTheDocument();
  });

  it("an older Backend, plain title, one participant: 1v1", async () => {
    await renderLobby(waitingRoom({}));
    expect(await screen.findByText("Đối kháng 1 vs 1 P2P")).toBeInTheDocument();
  });
});

describe("isTeamDebateSession / roomSeatCount", () => {
  it("the Backend's field wins, then maxParticipants, then the old guess", () => {
    expect(isTeamDebateSession({ isTeamDebate: true, title: "x", participantCount: 1 })).toBe(true);
    expect(isTeamDebateSession({ isTeamDebate: false, title: "[2v2] x", participantCount: 4 })).toBe(false);
    expect(isTeamDebateSession({ maxParticipants: 4 })).toBe(true);
    expect(isTeamDebateSession({ maxParticipants: 2, title: "2v2" })).toBe(false);
    expect(isTeamDebateSession({ title: "Trận 2 vs 2", participantCount: 1 })).toBe(true);
    expect(isTeamDebateSession({ title: "x", participantCount: 3 })).toBe(true);
    expect(isTeamDebateSession({ title: "x", participantCount: 2 })).toBe(false);
  });

  it("seats: the Backend's number, else 4 for 2v2 and 2 otherwise", () => {
    expect(roomSeatCount({ maxParticipants: 4 })).toBe(4);
    expect(roomSeatCount({ isTeamDebate: true })).toBe(4);
    expect(roomSeatCount({ isTeamDebate: false })).toBe(2);
    expect(roomSeatCount({})).toBe(2);
  });
});

describe("the task of my side in the room (Nhiệm vụ của bạn)", () => {
  const PRO = "Chứng minh kiến nghị đúng bằng ba luận điểm.";
  const CON = "Chỉ ra điểm yếu của kiến nghị.";
  const guides = { proGuide: PRO, conGuide: CON };

  beforeEach(() => {
    sessionStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const me = (side: number) => ({ userId: 1, side, isAI: false, speakerName: "Debater Test" });
  const other = (userId: number, side: number) => ({ userId, side, isAI: false, speakerName: `Người ${userId}` });

  it("waiting room, PRO: shows the PRO task, highlighted, and the CON task in a fold", async () => {
    await renderLobby(waitingRoom({ ...guides, participants: [me(1)] }));
    const panel = await screen.findByTestId("task-guide-panel");
    expect(panel).toHaveAttribute("data-side", "pro");
    expect(screen.getByTestId("task-guide-mine")).toHaveTextContent(PRO);
    expect(screen.getByTestId("task-guide-other")).toHaveTextContent(CON);
  });

  it("waiting room, CON: shows the CON task", async () => {
    await renderLobby(waitingRoom({ ...guides, participants: [other(2, 1), me(2)] }));
    expect(await screen.findByTestId("task-guide-mine")).toHaveTextContent(CON);
    expect(screen.getByTestId("task-guide-panel")).toHaveAttribute("data-side", "con");
  });

  it("2v2: a team reads one task, the one of its side", async () => {
    await renderLobby(
      waitingRoom({ ...guides, isTeamDebate: true, maxParticipants: 4, participants: [other(2, 1), other(3, 1), me(2), other(4, 2)] })
    );
    expect(await screen.findByTestId("task-guide-mine")).toHaveTextContent(CON);
  });

  it("after the swap of sides (a new session response) the task changes", async () => {
    let side = 1;
    mockGetSessionDetails.mockImplementation(async () => ({
      success: true,
      data: waitingRoom({ ...guides, participants: [me(side), other(2, side === 1 ? 2 : 1)] }),
    }));
    render(
      <MemoryRouter initialEntries={["/debater/debate/123?role=PRO"]}>
        <Routes>
          <Route path="/debater/debate/:sessionId" element={<DebateRoom />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByTestId("task-guide-mine")).toHaveTextContent(PRO);

    side = 2; // the Backend swapped the sides
    await act(async () => {
      hubCallbacks.onUserJoined?.({ userId: 2, fullName: "Người 2" });
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(await screen.findByText(CON, { selector: "[data-testid='task-guide-mine']" })).toBeInTheDocument();
    expect(screen.getByTestId("task-guide-panel")).toHaveAttribute("data-side", "con");
  });

  it("no panel when the session has no guides", async () => {
    await renderLobby(waitingRoom({ participants: [me(1)] }));
    await screen.findByText("Tranh biện 2 vs 2").catch(() => undefined);
    expect(screen.queryByTestId("task-guide-panel")).not.toBeInTheDocument();
  });

  it("the debate screen: open in the preparation minute, folded once the debate runs (and the user can open it)", async () => {
    const running = (isPreparing: boolean) => ({
      ...waitingRoom({ ...guides, participants: [me(1), other(2, 2)] }),
      status: 2,
      isPreparing,
      preparationEndsAt: new Date(Date.now() + 60_000).toISOString(),
      preparationSeconds: 60,
    });
    mockGetSessionDetails.mockResolvedValue({ success: true, data: running(true) });
    const view = render(
      <MemoryRouter initialEntries={["/debater/debate/123?role=PRO"]}>
        <Routes>
          <Route path="/debater/debate/:sessionId" element={<DebateRoom />} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByTestId("task-guide-mine")).toHaveTextContent(PRO); // open while preparing
    view.unmount();

    mockGetSessionDetails.mockResolvedValue({ success: true, data: running(false) });
    render(
      <MemoryRouter initialEntries={["/debater/debate/123?role=PRO"]}>
        <Routes>
          <Route path="/debater/debate/:sessionId" element={<DebateRoom />} />
        </Routes>
      </MemoryRouter>
    );
    const toggle = await screen.findByTestId("task-guide-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "false"); // folded: it does not take room from the debate
    fireEvent.click(toggle);
    expect(screen.getByTestId("task-guide-mine")).toHaveTextContent(PRO);
  });
});


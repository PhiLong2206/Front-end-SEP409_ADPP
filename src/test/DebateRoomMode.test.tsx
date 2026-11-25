import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
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

vi.mock("../services/debateHub", () => ({
  debateHubService: {
    connect: vi.fn(async () => {}),
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

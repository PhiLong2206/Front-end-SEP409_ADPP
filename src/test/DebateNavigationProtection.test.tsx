import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes, NavLink } from "react-router-dom";
import DebateRoom from "../pages/debater/DebatePractice/DebateRoom";

// Mock scrollIntoView for jsdom
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock useAuth hook
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { userId: 1, id: 1, fullName: "Debater Test", role: "Debater" },
    isAuthenticated: true,
  }),
}));

const mockCreateOpponentSession = vi.fn();
const mockGetOpponentCasePlan = vi.fn();
const mockGenerateOpponentTurn = vi.fn();
const mockEvaluateSpeechArgument = vi.fn();
const mockGetSessionDetails = vi.fn();
const mockGetTranscript = vi.fn();
const mockGetPendingSwapRequests = vi.fn();

vi.mock("../api", () => ({
  aiApi: {
    createOpponentSession: (...args: unknown[]) => mockCreateOpponentSession(...args),
    getOpponentCasePlan: (...args: unknown[]) => mockGetOpponentCasePlan(...args),
    generateOpponentTurn: (...args: unknown[]) => mockGenerateOpponentTurn(...args),
    evaluateSpeechArgument: (...args: unknown[]) => mockEvaluateSpeechArgument(...args),
    evaluateDebateRound: vi.fn().mockResolvedValue({ overall_score: 8, criteria: [] }),
    evaluateDebateSession: vi.fn().mockResolvedValue({ overall_score: 8 }),
  },
  debateApi: {
    getSessionDetails: (...args: unknown[]) => mockGetSessionDetails(...args),
    getTranscript: (...args: unknown[]) => mockGetTranscript(...args),
    getPendingSwapRequests: (...args: unknown[]) => mockGetPendingSwapRequests(...args),
    submitArgument: vi.fn().mockResolvedValue({ success: true }),
    startDebateSession: vi.fn().mockResolvedValue({ success: true }),
  },
}));

const renderWithSidebarAndRoutes = async (initialEntry: string) => {
  const utils = render(
    <MemoryRouter initialEntries={["/debater/dashboard", initialEntry]} initialIndex={1}>
      <div>
        <nav aria-label="Test Sidebar">
          <NavLink to="/debater/dashboard">Sidebar Dashboard</NavLink>
          <NavLink to="/debater/topics">Sidebar Topics</NavLink>
        </nav>
        <Routes>
          <Route path="/debater/dashboard" element={<div data-testid="dashboard-page">Dashboard Page</div>} />
          <Route path="/debater/topics" element={<div data-testid="topics-page">Topics Page</div>} />
          <Route path="/debater/debate/:sessionId" element={<DebateRoom />} />
          <Route path="/debater/debate/:sessionId/result" element={<div data-testid="result-page">Result Page</div>} />
        </Routes>
      </div>
    </MemoryRouter>
  );
  // The input stays locked until the AI opponent session is ready: let the init promises settle
  await act(async () => {});
  return utils;
};

describe("Active-Debate Navigation Protection (AI 1v1, P2P 1v1, P2P 2v2)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    mockCreateOpponentSession.mockResolvedValue({ opponent_session_id: "opp-1", status: "ready" });
    mockGetOpponentCasePlan.mockResolvedValue(null);
    mockGenerateOpponentTurn.mockResolvedValue({
      turn_index: 2,
      round_type: "opening",
      mode: "opening_reply",
      speech_text: "Phản hồi từ Đối thủ AI.",
    });
    mockEvaluateSpeechArgument.mockResolvedValue({
      overall_score: 8.0,
      overall_reasoning: "Tốt",
      criteria: [],
      strengths: [],
      weaknesses: [],
      suggestions: [],
    });
    mockGetTranscript.mockResolvedValue({ success: true, data: { arguments: [] } });
    mockGetPendingSwapRequests.mockResolvedValue({ success: true, data: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("1. AI Debate 1v1: intercepts Header Back button, Sidebar NavLink, and Browser Back; supports 'Ở lại trận đấu' and 'Rời trận'", async () => {
    await renderWithSidebarAndRoutes("/debater/debate/ai-session-1?role=PRO");

    // Advance timer 15s to verify timer is not reset when modal opens/cancels
    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });
    expect(screen.getByTestId("debate-countdown-timer")).toHaveTextContent("02:00");

    // A. Click Header Back button -> opens confirmation modal
    fireEvent.click(screen.getByLabelText("Rời phòng tranh biện"));
    expect(screen.getByText("Bạn có chắc muốn rời trận tranh biện?")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Trận tranh biện của bạn vẫn đang diễn ra. Nếu rời phòng, bạn có thể bị tính là bỏ cuộc theo quy định của trận đấu."
      )
    ).toBeInTheDocument();

    // Choose "Ở lại trận đấu" -> stays in room, timer preserved
    fireEvent.click(screen.getByRole("button", { name: "Ở lại trận đấu" }));
    expect(screen.queryByText("Bạn có chắc muốn rời trận tranh biện?")).not.toBeInTheDocument();
    expect(screen.getByTestId("debate-countdown-timer")).toHaveTextContent("02:00");

    // B. Click Browser Back (popstate) -> intercepted, opens confirmation modal
    await act(async () => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.getByText("Bạn có chắc muốn rời trận tranh biện?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ở lại trận đấu" }));
    expect(screen.queryByText("Bạn có chắc muốn rời trận tranh biện?")).not.toBeInTheDocument();

    // C. Click Sidebar link ("Sidebar Topics") -> intercepted, opens confirmation modal
    fireEvent.click(screen.getByText("Sidebar Topics"));
    expect(screen.getByText("Bạn có chắc muốn rời trận tranh biện?")).toBeInTheDocument();
    expect(screen.queryByTestId("topics-page")).not.toBeInTheDocument();

    // Choose "Rời trận" -> confirms departure and navigates to Topics Page
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Rời trận" }));
    });
    expect(screen.getByTestId("topics-page")).toBeInTheDocument();
  });

  it("2. Browser refresh / tab close: triggers native beforeunload without opening custom modal, and removes beforeunload when completed", async () => {
    await renderWithSidebarAndRoutes("/debater/debate/ai-session-unload?role=PRO");

    // Dispatch beforeunload while debate is active
    const activeUnloadEvent = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    const preventDefaultSpy = vi.spyOn(activeUnloadEvent, "preventDefault");
    window.dispatchEvent(activeUnloadEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
    // Must NOT open custom React modal on beforeunload
    expect(screen.queryByText("Bạn có chắc muốn rời trận tranh biện?")).not.toBeInTheDocument();

    // Complete all 3 rounds
    const textarea = screen.getByLabelText("Lập luận của bạn");
    const sendBtn = screen.getByLabelText("Gửi lập luận");
    for (let round = 1; round <= 3; round++) {
      fireEvent.change(textarea, { target: { value: `Lập luận vòng ${round}` } });
      await act(async () => {
        fireEvent.click(sendBtn);
      });
    }

    expect(screen.getByTestId("debate-completed-banner")).toBeInTheDocument();

    // Dispatch beforeunload after completion -> should NOT block
    const completedUnloadEvent = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    const completedPreventSpy = vi.spyOn(completedUnloadEvent, "preventDefault");
    window.dispatchEvent(completedUnloadEvent);
    expect(completedPreventSpy).not.toHaveBeenCalled();

    // Clicking Sidebar link after completion navigates immediately without confirmation modal
    await act(async () => {
      fireEvent.click(screen.getByText("Sidebar Topics"));
    });
    expect(screen.queryByText("Bạn có chắc muốn rời trận tranh biện?")).not.toBeInTheDocument();
    expect(screen.getByTestId("topics-page")).toBeInTheDocument();
  });

  it("3. P2P Debate 1v1: does NOT block navigation while waiting for players (status=1), blocks when active (status=2), and unblocks when completed (status=3)", async () => {
    // Step 1: Room is Waiting (status = 1) — note: Backend returns debateType=1 even for P2P, with isAI=false
    mockGetSessionDetails.mockResolvedValueOnce({
      success: true,
      data: {
        sessionId: 101,
        title: "Phòng 1v1 P2P",
        topic: "Kiến nghị 1v1",
        debateType: 1,
        currentStage: 1,
        currentTurnSide: 1,
        status: 1, // Waiting
        createdByUserId: 1,
        createdAt: new Date().toISOString(),
        participants: [{ participantId: 1, userId: 1, speakerName: "Debater Test", isAI: false, side: 1 }],
      },
    });

    const { unmount } = await renderWithSidebarAndRoutes("/debater/debate/101");
    await act(async () => {});

    expect(screen.getByText("Phòng chờ (Waiting)")).toBeInTheDocument();

    // Navigating away while in Waiting Lobby does NOT show confirmation modal
    await act(async () => {
      fireEvent.click(screen.getByText("Sidebar Dashboard"));
    });
    expect(screen.queryByText("Bạn có chắc muốn rời trận tranh biện?")).not.toBeInTheDocument();
    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
    unmount();

    // Step 2: Room is InProgress (status = 2)
    mockGetSessionDetails.mockResolvedValue({
      success: true,
      data: {
        sessionId: 102,
        title: "Phòng 1v1 Đang đấu",
        topic: "Kiến nghị 1v1",
        debateType: 2,
        currentStage: 1,
        currentTurnSide: 1,
        status: 2, // InProgress
        createdByUserId: 1,
        createdAt: new Date().toISOString(),
        participants: [
          { participantId: 1, userId: 1, speakerName: "Debater Test", isAI: false, side: 1 },
          { participantId: 2, userId: 2, speakerName: "Opponent User", isAI: false, side: 2 },
        ],
      },
    });

    await renderWithSidebarAndRoutes("/debater/debate/102");
    await act(async () => {});

    // Clicking Sidebar link while P2P 1v1 is InProgress opens confirmation modal
    fireEvent.click(screen.getByText("Sidebar Topics"));
    expect(screen.getByText("Bạn có chắc muốn rời trận tranh biện?")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Trận tranh biện của bạn vẫn đang diễn ra. Nếu rời phòng, bạn có thể bị tính là bỏ cuộc theo quy định của trận đấu."
      )
    ).toBeInTheDocument();

    // Stay in match
    fireEvent.click(screen.getByRole("button", { name: "Ở lại trận đấu" }));
    expect(screen.queryByText("Bạn có chắc muốn rời trận tranh biện?")).not.toBeInTheDocument();

    // Step 3: Server updates status to Completed (status = 3)
    mockGetSessionDetails.mockResolvedValue({
      success: true,
      data: {
        sessionId: 102,
        title: "Phòng 1v1 Đang đấu",
        topic: "Kiến nghị 1v1",
        debateType: 2,
        currentStage: 3,
        currentTurnSide: 2,
        status: 3, // Completed
        createdByUserId: 1,
        createdAt: new Date().toISOString(),
        participants: [
          { participantId: 1, userId: 1, speakerName: "Debater Test", isAI: false, side: 1 },
          { participantId: 2, userId: 2, speakerName: "Opponent User", isAI: false, side: 2 },
        ],
      },
    });

    await act(async () => {
      vi.advanceTimersByTime(3_000);
    });

    // Now completed -> navigates without warning
    await act(async () => {
      fireEvent.click(screen.getByText("Sidebar Topics"));
    });
    expect(screen.queryByText("Bạn có chắc muốn rời trận tranh biện?")).not.toBeInTheDocument();
    expect(screen.getByTestId("topics-page")).toBeInTheDocument();
  });

  it("4. P2P Debate 2v2: blocks navigation when active (status=2), preserves team state when staying, and unblocks when completed", async () => {
    mockGetSessionDetails.mockResolvedValue({
      success: true,
      data: {
        sessionId: 202,
        title: "[2v2] Trận tranh biện đồng đội",
        topic: "Kiến nghị 2v2",
        debateType: 1,
        currentStage: 1,
        currentTurnSide: 1,
        status: 2, // InProgress
        createdByUserId: 1,
        createdAt: new Date().toISOString(),
        participants: [
          { participantId: 1, userId: 1, speakerName: "Debater Test", isAI: false, side: 1 },
          { participantId: 2, userId: 2, speakerName: "PRO Teammate", isAI: false, side: 1 },
          { participantId: 3, userId: 3, speakerName: "CON Player 1", isAI: false, side: 2 },
          { participantId: 4, userId: 4, speakerName: "CON Player 2", isAI: false, side: 2 },
        ],
      },
    });

    await renderWithSidebarAndRoutes("/debater/debate/202");
    await act(async () => {});

    // Attempt to leave via Header Back button
    fireEvent.click(screen.getByLabelText("Rời phòng tranh biện"));
    expect(screen.getByText("Bạn có chắc muốn rời trận tranh biện?")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Trận tranh biện của bạn vẫn đang diễn ra. Nếu rời phòng, bạn có thể bị tính là bỏ cuộc theo quy định của trận đấu."
      )
    ).toBeInTheDocument();

    // Choose "Ở lại trận đấu"
    fireEvent.click(screen.getByRole("button", { name: "Ở lại trận đấu" }));
    expect(screen.queryByText("Bạn có chắc muốn rời trận tranh biện?")).not.toBeInTheDocument();

    // Confirm departure via "Rời trận"
    fireEvent.click(screen.getByLabelText("Rời phòng tranh biện"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Rời trận" }));
    });
    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
  });

  it("5. Session recovery & reconnection: preserves timer/messages across F5 refresh and shows reconnecting indicator on temporary disconnect", async () => {
    const { unmount } = await renderWithSidebarAndRoutes("/debater/debate/ai-session-recover?role=PRO");

    // Submit Round 1 argument and advance timer 20s in Round 2
    const textarea = screen.getByLabelText("Lập luận của bạn");
    const sendBtn = screen.getByLabelText("Gửi lập luận");
    fireEvent.change(textarea, { target: { value: "Lập luận vòng 1 đã lưu" } });
    await act(async () => {
      fireEvent.click(sendBtn);
    });

    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });
    expect(screen.getByTestId("debate-countdown-timer")).toHaveTextContent("01:40");

    // Simulate temporary network disconnect -> shows reconnecting indicator without forfeiting
    await act(async () => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByTestId("debate-reconnecting-indicator")).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByTestId("debate-reconnecting-indicator")).not.toBeInTheDocument();

    // Simulate F5 refresh (unmount & remount same route) -> preserves messages, round 2, and remaining countdown (01:40)
    unmount();
    await renderWithSidebarAndRoutes("/debater/debate/ai-session-recover?role=PRO");

    expect(screen.getByText("Lập luận vòng 1 đã lưu")).toBeInTheDocument();
    expect(screen.getByTestId("debate-countdown-timer")).toHaveTextContent("01:40");
  });
});


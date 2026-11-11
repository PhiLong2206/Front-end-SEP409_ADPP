import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import TopicDetail from "../pages/debater/Topics/TopicDetail";
import { ACTIVE_DEBATE_SESSION_KEY } from "../hooks/useDebateNavigationGuard";

const mockCreateSession = vi.fn();

vi.mock("../api", () => ({
  debateApi: {
    createAiPracticeSession: (...args: unknown[]) => mockCreateSession(...args),
  },
}));

vi.mock("../api/topicApi", () => ({
  default: { getById: vi.fn() },
}));

const topic = { topicId: 7, title: "Luật AI", motion: "AI nên được kiểm soát bởi luật quốc tế", category: "Công nghệ" };

const CurrentUrl = () => {
  const location = useLocation();
  return <div data-testid="room-url">{`${location.pathname}${location.search}`}</div>;
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[{ pathname: "/debater/topics/7", state: { topic } }]}>
      <Routes>
        <Route path="/debater/topics/:id" element={<TopicDetail />} />
        <Route path="*" element={<CurrentUrl />} />
      </Routes>
    </MemoryRouter>
  );

const start = () => fireEvent.click(screen.getByRole("button", { name: /Bắt đầu tranh biện/ }));

describe("TopicDetail: starting a debate", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockCreateSession.mockReset();
    mockCreateSession.mockResolvedValue({ success: true, data: { sessionId: 42 } });
  });

  it("creates a Backend AI session with the motion and opens it, never the shared session-N room", async () => {
    renderPage();

    start();

    await waitFor(() => expect(screen.getByTestId("room-url")).toBeInTheDocument());
    expect(mockCreateSession).toHaveBeenCalledWith({
      topicId: 7,
      title: "Luật AI",
      topic: topic.motion,
      userSide: 1,
      isAI: true,
      difficulty: "Medium",
      turnTimeLimitSeconds: 180,
    });
    const url = decodeURIComponent(screen.getByTestId("room-url").textContent ?? "");
    expect(url).toContain("/debater/debate/42?role=PRO");
    expect(url).toContain(`motion=${topic.motion}`);
    expect(url).not.toContain("session-7");
  });

  it("uses the chosen side and difficulty", async () => {
    renderPage();

    fireEvent.click(screen.getByLabelText(/Phản đối/));
    fireEvent.click(screen.getByLabelText("Khó"));
    start();

    await waitFor(() => expect(mockCreateSession).toHaveBeenCalled());
    expect(mockCreateSession.mock.calls[0][0]).toMatchObject({ userSide: 2, difficulty: "Hard" });
    await waitFor(() => expect(screen.getByTestId("room-url").textContent).toContain("role=CON"));
  });

  it("falls back to the title when the topic has no motion", async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: "/debater/topics/7", state: { topic: { ...topic, motion: undefined } } }]}>
        <Routes>
          <Route path="/debater/topics/:id" element={<TopicDetail />} />
          <Route path="*" element={<CurrentUrl />} />
        </Routes>
      </MemoryRouter>
    );

    start();

    await waitFor(() => expect(mockCreateSession).toHaveBeenCalled());
    expect(mockCreateSession.mock.calls[0][0].topic).toBe("Luật AI");
  });

  it("shows and sends the description as the motion, because that is what the Backend debates", async () => {
    const withDescription = { topicId: 7, title: "Luật AI", description: "AI cần luật quốc tế", category: "Công nghệ" };
    render(
      <MemoryRouter initialEntries={[{ pathname: "/debater/topics/7", state: { topic: withDescription } }]}>
        <Routes>
          <Route path="/debater/topics/:id" element={<TopicDetail />} />
          <Route path="*" element={<CurrentUrl />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/Kiến nghị:/)).toHaveTextContent("AI cần luật quốc tế");
    start();

    await waitFor(() => expect(mockCreateSession).toHaveBeenCalled());
    expect(mockCreateSession.mock.calls[0][0]).toMatchObject({ topicId: 7, topic: "AI cần luật quốc tế" });
  });

  it("takes the topic id from the route when the topic object has none", async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: "/debater/topics/7", state: { topic: { ...topic, topicId: undefined } } }]}>
        <Routes>
          <Route path="/debater/topics/:id" element={<TopicDetail />} />
          <Route path="*" element={<CurrentUrl />} />
        </Routes>
      </MemoryRouter>
    );

    start();

    await waitFor(() => expect(mockCreateSession).toHaveBeenCalled());
    expect(mockCreateSession.mock.calls[0][0].topicId).toBe(7);
  });

  it("sends no topic id when the route id is not a number", async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: "/debater/topics/abc", state: { topic: { ...topic, topicId: undefined } } }]}>
        <Routes>
          <Route path="/debater/topics/:id" element={<TopicDetail />} />
          <Route path="*" element={<CurrentUrl />} />
        </Routes>
      </MemoryRouter>
    );

    start();

    await waitFor(() => expect(mockCreateSession).toHaveBeenCalled());
    expect(mockCreateSession.mock.calls[0][0].topicId).toBeUndefined();
  });

  it("creates a new session every time: an old room's state cannot be reused", async () => {
    sessionStorage.setItem("adpp_messages_session-7", JSON.stringify([{ id: "old" }]));
    renderPage();

    start();

    await waitFor(() => expect(screen.getByTestId("room-url").textContent).toContain("/debater/debate/42"));
    expect(mockCreateSession).toHaveBeenCalledTimes(1);
  });

  it("stays on the page and shows the error when creating the session fails", async () => {
    mockCreateSession.mockRejectedValue({ response: { data: { message: "Máy chủ lỗi" } } });
    renderPage();

    start();

    expect(await screen.findByTestId("topic-start-error")).toHaveTextContent("Máy chủ lỗi");
    expect(screen.queryByTestId("room-url")).not.toBeInTheDocument();
  });

  it("offers to continue an unfinished debate only when there is one, and only when the user asks", async () => {
    const { unmount } = renderPage();
    expect(screen.queryByTestId("active-debate-recovery-banner")).not.toBeInTheDocument();
    unmount();

    sessionStorage.setItem(
      ACTIVE_DEBATE_SESSION_KEY,
      JSON.stringify({ sessionId: "9", url: "/debater/debate/9?role=PRO", mode: "ai", topicTitle: "Phiên dở", updatedAt: 1 })
    );
    renderPage();

    expect(screen.getByTestId("active-debate-recovery-banner")).toHaveTextContent("Phiên dở");
    expect(screen.queryByTestId("room-url")).not.toBeInTheDocument();
    expect(mockCreateSession).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("resume-active-debate-btn"));

    expect(screen.getByTestId("room-url").textContent).toBe("/debater/debate/9?role=PRO");
    expect(mockCreateSession).not.toHaveBeenCalled();
  });
});

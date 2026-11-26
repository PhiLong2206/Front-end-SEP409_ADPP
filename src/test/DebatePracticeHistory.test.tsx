import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useParams } from "react-router-dom";
import DebatePractice from "../pages/debater/DebatePractice/DebatePractice";
import { findListedTopic, groupPracticedTopics, suggestTopics } from "../utils/debateTopicHistory";
import type { DebateHistoryItemDto, Topic } from "../types";

const mockGetUserHistory = vi.fn();
const mockCreateAiPracticeSession = vi.fn();
const mockGetAllTopics = vi.fn();

vi.mock("../api", () => ({
  debateApi: {
    getUserHistory: (...a: unknown[]) => mockGetUserHistory(...a),
    createAiPracticeSession: (...a: unknown[]) => mockCreateAiPracticeSession(...a),
  },
  topicApi: { getAll: (...a: unknown[]) => mockGetAllTopics(...a) },
}));
vi.mock("../components/debate/AiVoicePicker", () => ({ default: () => null }));

const CATEGORIES = ["education", "technology", "society"];

/** A listed topic: the Backend debates its description, which is also what the history records. */
const topic = (n: number, over: Partial<Topic> = {}): Topic => ({
  topicId: n,
  title: `Chủ đề ${n}`,
  description: `Kiến nghị số ${n}`,
  category: CATEGORIES[n % 3],
  difficulty: "Easy",
  isActive: true,
  ...over,
});

const item = (n: number, over: Partial<DebateHistoryItemDto> = {}): DebateHistoryItemDto => ({
  sessionId: 100 + n,
  title: `Chủ đề ${n}`,
  topic: `Kiến nghị số ${n}`,
  debateType: 1,
  status: 3,
  userSide: 1,
  createdAt: `2026-11-${String(10 + n).padStart(2, "0")}T08:00:00Z`,
  endedAt: `2026-11-${String(10 + n).padStart(2, "0")}T08:30:00Z`,
  ...over,
});

describe("history and suggestion helpers", () => {
  it("groups finished AI sessions by topic, newest first, and ignores the rest", () => {
    const grouped = groupPracticedTopics([
      item(1),
      item(1, { sessionId: 2, endedAt: "2026-11-25T08:30:00Z", userSide: 2 }),
      item(1, { sessionId: 3, topic: "  KIẾN nghị  số 1 " }),
      item(4, { sessionId: 4 }),
      item(5, { sessionId: 5, status: 2 }),
      item(6, { sessionId: 6, debateType: 2 }),
      item(7, { sessionId: 7, status: 4 }),
    ]);
    expect(grouped.map((g) => g.title)).toEqual(["Chủ đề 1", "Chủ đề 4"]);
    expect(grouped[0]).toMatchObject({ count: 3, lastSessionId: 2, lastSide: "CON" });
  });

  it("keeps a topic with an unreadable date and sorts it last", () => {
    const grouped = groupPracticedTopics([item(1, { endedAt: undefined, createdAt: "" }), item(2)]);
    expect(grouped.map((g) => g.title)).toEqual(["Chủ đề 2", "Chủ đề 1"]);
  });

  it("finds the listed topic of a practised one by its description or title, and only an active one", () => {
    const [practiced] = groupPracticedTopics([item(1)]);
    expect(findListedTopic(practiced, [topic(2), topic(1)])?.topicId).toBe(1);
    expect(findListedTopic(practiced, [topic(1, { isActive: false })])).toBeUndefined();
    expect(findListedTopic(practiced, [topic(2)])).toBeUndefined();
  });

  it("suggests only categorised, active topics that are not practised yet", () => {
    const practiced = groupPracticedTopics([item(1)]);
    const suggested = suggestTopics(
      [topic(1), topic(2), topic(3, { category: "" }), topic(4, { category: "General" }), topic(5, { isActive: false }), topic(6)],
      practiced
    );
    expect(suggested.map((t) => t.topicId)).toEqual([2, 6]);
  });
});

/** Stands for the topic page: shows which topic it got and what the practice page handed over. */
const TopicPageProbe = () => {
  const { id } = useParams();
  const state = (useLocation().state ?? {}) as { topic?: Topic; defaultSide?: string };
  return (
    <div data-testid="topic-page" data-id={id} data-side={state.defaultSide ?? ""}>
      {state.topic?.title}
    </div>
  );
};

describe("DebatePractice: history and suggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockGetUserHistory.mockResolvedValue({ success: true, data: [] });
    mockGetAllTopics.mockResolvedValue({ success: true, data: { items: [] } });
  });

  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={["/debater/debate"]}>
        <Routes>
          <Route path="/debater/debate" element={<DebatePractice />} />
          <Route path="/debater/debate/:sessionId" element={<div>Room</div>} />
          <Route path="/debater/topics/:id" element={<TopicPageProbe />} />
        </Routes>
      </MemoryRouter>
    );

  const seed = (practicedCount: number, suggestedCount: number) => {
    const practicedTopics = Array.from({ length: practicedCount }, (_, i) => topic(i + 1));
    const freshTopics = Array.from({ length: suggestedCount }, (_, i) => topic(100 + i));
    mockGetUserHistory.mockResolvedValue({
      success: true,
      data: Array.from({ length: practicedCount }, (_, i) => item(i + 1)),
    });
    mockGetAllTopics.mockResolvedValue({ success: true, data: { items: [...practicedTopics, ...freshTopics] } });
  };

  it("shows the 5 most recent practised topics, and all of them on 'Xem toàn bộ'", async () => {
    seed(7, 0);
    renderPage();

    const rows = await screen.findAllByTestId("practiced-topic");
    expect(rows).toHaveLength(5);
    expect(within(rows[0]).getByText("Chủ đề 7")).toBeInTheDocument(); // the newest first

    fireEvent.click(screen.getByTestId("history-show-all"));
    expect(screen.getAllByTestId("practiced-topic")).toHaveLength(7);
    fireEvent.click(screen.getByTestId("history-show-all"));
    expect(screen.getAllByTestId("practiced-topic")).toHaveLength(5);
  });

  it("has no 'Xem toàn bộ' when there are 5 or fewer practised topics", async () => {
    seed(5, 0);
    renderPage();
    await screen.findAllByTestId("practiced-topic");
    expect(screen.queryByTestId("history-show-all")).not.toBeInTheDocument();
  });

  it("suggests unpracticed topics only: 6 first, all of them (filterable by category) on 'Xem toàn bộ'", async () => {
    seed(2, 8);
    renderPage();

    expect(await screen.findAllByTestId("suggested-topic")).toHaveLength(6);
    // The 2 practised topics are not suggested again
    expect(screen.queryByText("Kiến nghị số 1", { selector: "p" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("suggestions-show-all"));
    expect(screen.getAllByTestId("suggested-topic")).toHaveLength(8);

    fireEvent.click(screen.getByTestId("suggestion-filter-technology"));
    const shown = screen.getAllByTestId("suggested-topic");
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(8);
    shown.forEach((card) => expect(within(card).getByText("Công nghệ")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("suggestions-show-all"));
    expect(screen.getAllByTestId("suggested-topic")).toHaveLength(6); // collapsed, filter reset
  });

  it("'Luyện tập' on a suggested topic opens the topic page (the one the library uses), without starting a session here", async () => {
    seed(0, 2);
    renderPage();

    fireEvent.click((await screen.findAllByTestId("start-suggested-btn"))[0]);

    const page = await screen.findByTestId("topic-page");
    expect(page).toHaveAttribute("data-id", "100");
    expect(page).toHaveTextContent("Chủ đề 100");
    expect(mockCreateAiPracticeSession).not.toHaveBeenCalled();
    expect(screen.queryByTestId("start-panel")).not.toBeInTheDocument(); // no panel opens under the card
  });

  it("'Học lại' opens the topic page of that topic with the side of the last time", async () => {
    seed(1, 0);
    mockGetUserHistory.mockResolvedValue({ success: true, data: [item(1, { userSide: 2 })] });
    renderPage();

    fireEvent.click(await screen.findByTestId("retry-topic-btn"));

    const page = await screen.findByTestId("topic-page");
    expect(page).toHaveAttribute("data-id", "1");
    expect(page).toHaveAttribute("data-side", "CON");
    expect(page).toHaveTextContent("Chủ đề 1");
    expect(mockCreateAiPracticeSession).not.toHaveBeenCalled();
  });

  it("cannot practise again a topic that is no longer listed", async () => {
    mockGetUserHistory.mockResolvedValue({ success: true, data: [item(1)] });
    mockGetAllTopics.mockResolvedValue({ success: true, data: { items: [topic(2)] } });
    renderPage();

    expect(await screen.findByTestId("retry-topic-btn")).toBeDisabled();
    expect(await screen.findByText(/không còn trong danh sách/)).toBeInTheDocument();
  });

  it("says the list could not be loaded (not that the topic is gone) when the topics request failed", async () => {
    mockGetUserHistory.mockResolvedValue({ success: true, data: [item(1)] });
    mockGetAllTopics.mockRejectedValue(new Error("Mạng lỗi"));
    renderPage();

    expect(await screen.findByTestId("retry-topic-btn")).toBeDisabled();
    expect(await screen.findByText(/Chưa tải được danh sách chủ đề/)).toBeInTheDocument();
    expect(screen.queryByText(/không còn trong danh sách/)).not.toBeInTheDocument();
  });

  it("loads every page of topics, so a topic past the first page can still be practised again", async () => {
    mockGetUserHistory.mockResolvedValue({ success: true, data: [item(150)] });
    mockGetAllTopics
      .mockResolvedValueOnce({ success: true, data: { items: [topic(1)], totalPages: 2 } })
      .mockResolvedValueOnce({ success: true, data: { items: [topic(150)], totalPages: 2 } });
    renderPage();

    await waitFor(() => expect(screen.getByTestId("retry-topic-btn")).not.toBeDisabled());
    expect(mockGetAllTopics).toHaveBeenCalledTimes(2);
    expect(mockGetAllTopics).toHaveBeenLastCalledWith(expect.objectContaining({ pageNumber: 2 }));
  });

  it("shows the empty states when nothing was practised and nothing is listed", async () => {
    renderPage();
    expect(await screen.findByTestId("practiced-empty")).toBeInTheDocument();
    expect(await screen.findByTestId("suggestions-empty")).toBeInTheDocument();
  });

  it("reports a failed history or topics request with a retry, not the empty state", async () => {
    mockGetUserHistory.mockResolvedValueOnce({ success: false, data: null }).mockResolvedValueOnce({
      success: true,
      data: [item(1)],
    });
    mockGetAllTopics.mockRejectedValueOnce(new Error("Mạng lỗi")).mockResolvedValueOnce({
      success: true,
      data: { items: [topic(1), topic(2)] },
    });
    renderPage();

    expect(await screen.findByTestId("history-retry-load")).toBeInTheDocument();
    expect(await screen.findByTestId("topics-retry-load")).toBeInTheDocument();
    expect(screen.queryByTestId("practiced-empty")).not.toBeInTheDocument();
    expect(screen.queryByTestId("suggestions-empty")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("history-retry-load"));
    fireEvent.click(screen.getByTestId("topics-retry-load"));
    expect(await screen.findByTestId("practiced-topic")).toBeInTheDocument();
    expect(await screen.findByTestId("suggested-topic")).toBeInTheDocument();
  });
});

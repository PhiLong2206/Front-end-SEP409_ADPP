import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DebatePractice from "../pages/debater/DebatePractice/DebatePractice";
import { normalizeTopicCategory, topicCategoryLabel } from "../constants/topicCategories";

const mockCreate = vi.fn();
const mockGetAll = vi.fn();

vi.mock("../api", () => ({
  debateApi: {
    createAiPracticeSession: (...a: unknown[]) => mockCreate(...a),
    getUserHistory: async () => ({ success: true, data: [] }),
  },
  topicApi: { getAll: (...a: unknown[]) => mockGetAll(...a) },
}));

describe("topic categories: every topic belongs to one of the fixed categories", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    mockCreate.mockResolvedValue({ data: { sessionId: 1 } });
    mockGetAll.mockResolvedValue({
      success: true,
      data: {
        items: [
          { topicId: 5, title: "Luật AI", description: "AI nên bị kiểm soát", category: "technology", difficulty: "Hard", isActive: true },
          { topicId: 6, title: "Đề cũ", description: "Đề chưa phân loại", category: "General", difficulty: "Easy", isActive: true },
        ],
        totalPages: 1,
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 }))); // no server voice
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <DebatePractice />
      </MemoryRouter>
    );

  it("labels: codes and Vietnamese labels map to the same category; anything else is uncategorised", () => {
    expect(normalizeTopicCategory("Công nghệ")).toBe("technology");
    expect(normalizeTopicCategory(" TECHNOLOGY ")).toBe("technology");
    expect(normalizeTopicCategory("General")).toBeNull();
    expect(topicCategoryLabel("society")).toBe("Xã hội");
    expect(topicCategoryLabel("law")).toBe("Chưa phân loại");
    expect(topicCategoryLabel("General")).toBe("Chưa phân loại");
    expect(topicCategoryLabel(undefined)).toBe("Chưa phân loại");
  });

  it("a suggested topic shows its label and links to its topic page by id", async () => {
    renderPage();
    expect(await screen.findByText("Luật AI")).toBeInTheDocument();
    expect(screen.getAllByText("Công nghệ").length).toBeGreaterThan(0);
    // A topic outside the fixed categories is not suggested
    expect(screen.queryByText("Đề cũ")).not.toBeInTheDocument();

    // "Luyện tập" goes to the topic page by the topic's id; the session is created there, with no category
    expect(screen.getByTestId("start-suggested-btn")).toHaveAttribute("href", "/debater/topics/5");
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DebatePractice from "../pages/debater/DebatePractice/DebatePractice";
import { normalizeTopicCategory, topicCategoryLabel } from "../constants/topicCategories";

const mockCreate = vi.fn();
const mockGetAll = vi.fn();

vi.mock("../api", () => ({
  debateApi: { createAiPracticeSession: (...a: unknown[]) => mockCreate(...a) },
  topicApi: { getAll: (...a: unknown[]) => mockGetAll(...a) },
}));

const MOTION = "Trí tuệ nhân tạo nên được kiểm soát bởi luật pháp quốc tế.";

describe("topic categories: every topic belongs to one of the fixed categories", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    mockCreate.mockResolvedValue({ data: { sessionId: 1 } });
    mockGetAll.mockResolvedValue({
      data: [{ topicId: 5, title: "Luật AI", description: "AI nên bị kiểm soát", category: "technology", difficulty: "Hard" }],
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

  it("a custom motion cannot start without a category, and is sent with the one chosen", async () => {
    renderPage();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: MOTION } });
    fireEvent.click(screen.getByText("Bắt đầu tranh biện"));
    expect(await screen.findByText("Vui lòng chọn lĩnh vực cho chủ đề.")).toBeInTheDocument();
    expect(mockCreate).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId("custom-category"), { target: { value: "technology" } });
    fireEvent.click(screen.getByText("Bắt đầu tranh biện"));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const body = mockCreate.mock.calls[0][0];
    expect(body.category).toBe("technology");
    expect(body.topicId).toBeUndefined();
  });

  it("a quick motion comes with its category", async () => {
    renderPage();
    fireEvent.click(screen.getByText(/Nên cấm sử dụng điện thoại thông minh/));
    expect((screen.getByTestId("custom-category") as HTMLSelectElement).value).toBe("education");
    fireEvent.click(screen.getByText("Bắt đầu tranh biện"));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockCreate.mock.calls[0][0].category).toBe("education");
  });

  it("a listed topic shows its label and is sent by its id, without a category", async () => {
    renderPage();
    fireEvent.click(screen.getByText("Chọn chủ đề có sẵn"));
    fireEvent.click(await screen.findByText("Luật AI"));
    expect(screen.getAllByText("Công nghệ").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Bắt đầu tranh biện"));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    const body = mockCreate.mock.calls[0][0];
    expect(body.topicId).toBe(5);
    expect(body.category).toBeUndefined();
  });
});

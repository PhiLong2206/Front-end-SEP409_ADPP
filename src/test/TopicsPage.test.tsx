import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Topics from "../pages/debater/Topics/Topics";

const mockGetAll = vi.fn();
vi.mock("../api/topicApi", () => ({ default: { getAll: (...a: unknown[]) => mockGetAll(...a) } }));

const topic = (n: number, over: Record<string, unknown> = {}) => ({
  topicId: n,
  title: `Chủ đề ${n}`,
  description: `Kiến nghị số ${n}`,
  category: ["education", "technology", "society"][n % 3],
  difficulty: "Medium",
  isActive: true,
  ...over,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <Topics />
    </MemoryRouter>
  );

describe("Topics page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAll.mockResolvedValue({
      success: true,
      data: {
        items: [
          topic(1, { difficulty: "Easy" }),
          topic(2, { difficulty: "Hard" }),
          topic(3),
          ...Array.from({ length: 8 }, (_, i) => topic(10 + i)),
        ],
      },
    });
  });

  it("shows the title and the description in plain text, with no box around them", async () => {
    renderPage();
    const title = await screen.findByRole("heading", { level: 1, name: "Danh mục chủ đề" });
    expect(title.closest("header")).toBeNull(); // a <header> gets the dark panel of the app bar from the global CSS
    expect(screen.getByText(/Khám phá và lựa chọn các chủ đề/)).toBeInTheDocument();
  });

  it("a card links to the topic page with its category and difficulty, without borders", async () => {
    renderPage();
    const link = (await screen.findByText("Chủ đề 1")).closest("a") as HTMLAnchorElement;
    expect(link).toHaveAttribute("href", "/debater/topics/1");
    expect(link.className).not.toMatch(/\bborder\b/);
    expect(within(link).getByText("Dễ")).toBeInTheDocument();
    expect(within(link).getByText("Chi tiết")).toBeInTheDocument();

    const hard = (await screen.findByText("Chủ đề 2")).closest("a") as HTMLAnchorElement;
    expect(within(hard).getByText("Khó")).toBeInTheDocument();
  });

  it("paginates 9 per page, and the open page is marked", async () => {
    renderPage();
    await screen.findByText("Chủ đề 1");
    expect(screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/debater/topics/"))).toHaveLength(9);

    const nav = screen.getByRole("navigation", { name: "Phân trang" });
    expect(within(nav).getByRole("button", { name: "1" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(within(nav).getByRole("button", { name: "2" }));
    expect(within(nav).getByRole("button", { name: "2" })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/debater/topics/"))).toHaveLength(2);
  });

  it("filters by category and clears the filter from the empty state", async () => {
    renderPage();
    await screen.findByText("Chủ đề 1");
    fireEvent.change(screen.getByLabelText("Tìm kiếm chủ đề"), { target: { value: "không có chủ đề này" } });
    expect(await screen.findByText("Chưa có chủ đề tranh biện nào phù hợp.")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Xoá bộ lọc"));
    expect(await screen.findByText("Chủ đề 1")).toBeInTheDocument();
  });
});

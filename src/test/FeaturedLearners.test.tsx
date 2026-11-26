import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import FeaturedLearners from "../components/home/FeaturedLearners";
import learnerApi from "../api/learnerApi";

vi.mock("../api/learnerApi", () => ({
  default: { getFeaturedLearners: vi.fn() },
}));

const mockGet = learnerApi.getFeaturedLearners as unknown as ReturnType<typeof vi.fn>;

const learner = (rank: number, over: Record<string, unknown> = {}) => ({
  rank,
  userId: rank,
  fullName: `Học viên ${rank}`,
  avatarUrl: null,
  debatesCompleted: 4,
  wins: 3,
  winRate: 0.75,
  averageScore: 8.25,
  bestScore: 9.5,
  lastDebateAt: null,
  ...over,
});

describe("FeaturedLearners", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("shows the list with medals, initials, average score and win rate", async () => {
    mockGet.mockResolvedValue({ success: true, data: [learner(1), learner(4)] });
    render(<FeaturedLearners />);

    expect(await screen.findByText("Học viên 1")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Hạng nhất" })).toHaveTextContent("🥇");
    expect(screen.getAllByText("Thắng 3/4 trận (75%)")).toHaveLength(2);
    expect(screen.getAllByText("Điểm TB 8.3/10").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cao nhất 9.5").length).toBeGreaterThan(0);
    expect(mockGet).toHaveBeenCalledWith({ days: 30, limit: 5, minDebates: 2 });
  });

  it("retries with minDebates=1 when empty, then shows the empty message", async () => {
    mockGet.mockResolvedValue({ success: true, data: [] });
    render(<FeaturedLearners />);

    expect(await screen.findByText("Chưa có học sinh nổi bật")).toBeInTheDocument();
    expect(mockGet).toHaveBeenNthCalledWith(1, { days: 30, limit: 5, minDebates: 2 });
    expect(mockGet).toHaveBeenNthCalledWith(2, { days: 30, limit: 5, minDebates: 1 });
  });

  it("shows a skeleton while loading and switches to all time with days=0", async () => {
    mockGet.mockResolvedValue({ success: true, data: [learner(1)] });
    render(<FeaturedLearners />);
    expect(screen.getByTestId("featured-learners-skeleton")).toBeInTheDocument();
    await screen.findByText("Học viên 1");

    fireEvent.click(screen.getByRole("button", { name: "Mọi thời gian" }));
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith({ days: 0, limit: 5, minDebates: 2 }));
  });
});

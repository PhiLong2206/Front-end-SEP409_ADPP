import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Progress from "../pages/debater/Progress/Progress";

const mockGetUserHistory = vi.fn();

vi.mock("../api", () => ({
  debateApi: {
    getUserHistory: (...args: unknown[]) => mockGetUserHistory(...args),
  },
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <Progress />
    </MemoryRouter>
  );

describe("Progress: total debates", () => {
  beforeEach(() => {
    mockGetUserHistory.mockReset();
  });

  it("counts only completed sessions from the real history", async () => {
    mockGetUserHistory.mockResolvedValue({
      success: true,
      data: [{ status: 1 }, { status: 2 }, { status: 3 }, { status: 3 }, { status: 4 }, { status: "Completed" }],
    });
    renderPage();

    const card = await screen.findByTestId("progress-total-debates");

    expect(card).toHaveTextContent("3");
    expect(screen.queryByTestId("progress-empty-state")).not.toBeInTheDocument();
  });

  it("shows the empty state when nothing is completed", async () => {
    mockGetUserHistory.mockResolvedValue({ success: true, data: [{ status: 2 }, { status: 4 }] });
    renderPage();

    expect(await screen.findByTestId("progress-total-debates")).toHaveTextContent("0");
    expect(screen.getByTestId("progress-empty-state")).toBeInTheDocument();
  });

  it("hides the metric instead of showing 0 when the history cannot be loaded", async () => {
    mockGetUserHistory.mockRejectedValue(new Error("network"));
    renderPage();

    await waitFor(() => expect(mockGetUserHistory).toHaveBeenCalled());
    await Promise.resolve();

    expect(screen.queryByTestId("progress-total-debates")).not.toBeInTheDocument();
    expect(screen.queryByTestId("progress-empty-state")).not.toBeInTheDocument();
  });

  it("hides the metric when the response is unsuccessful", async () => {
    mockGetUserHistory.mockResolvedValue({ success: false, data: null });
    renderPage();

    await waitFor(() => expect(mockGetUserHistory).toHaveBeenCalled());
    await Promise.resolve();

    expect(screen.queryByTestId("progress-total-debates")).not.toBeInTheDocument();
  });
});

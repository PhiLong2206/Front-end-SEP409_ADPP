import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "../pages/debater/Dashboard/Dashboard";

const mockGetUserHistory = vi.fn();

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 1, fullName: "Debater Test" }, isAuthenticated: true }),
}));

vi.mock("../api", () => ({
  debateApi: {
    getUserHistory: (...args: unknown[]) => mockGetUserHistory(...args),
    leaveSession: vi.fn(),
  },
}));

vi.mock("../api/competitionApi", () => ({
  default: { getCompetitions: vi.fn().mockResolvedValue({ success: true, data: { items: [] } }) },
}));

const history = [{ status: 1 }, { status: 2 }, { status: 3 }, { status: 3 }, { status: 4 }];

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );

describe("Dashboard: debate count", () => {
  beforeEach(() => {
    mockGetUserHistory.mockResolvedValue({ success: true, data: history });
  });

  it("counts only completed sessions, not the ones still waiting, running or cancelled", async () => {
    renderDashboard();

    const label = await screen.findByText("Phiên tranh biện đã hoàn thành");

    await vi.waitFor(() => expect(label.previousElementSibling).toHaveTextContent(/^2$/));
  });
});

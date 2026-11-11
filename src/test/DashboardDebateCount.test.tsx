import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("counts only completed sessions once the Backend can cancel them", async () => {
    vi.stubEnv("VITE_DEBATE_LEAVE_ENABLED", "true");
    renderDashboard();

    const label = await screen.findByText("Phiên tranh biện đã hoàn thành");

    await vi.waitFor(() => expect(label.previousElementSibling).toHaveTextContent(/^2$/));
  });

  it("keeps the old count and label until then", async () => {
    renderDashboard();

    const label = await screen.findByText("Phiên tranh biện đã tham gia");

    await vi.waitFor(() => expect(label.previousElementSibling).toHaveTextContent(/^5$/));
  });
});

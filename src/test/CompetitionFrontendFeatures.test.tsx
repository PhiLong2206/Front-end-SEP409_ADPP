import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CompetitionChampionBanner from "../components/competition/CompetitionChampionBanner";
import MatchMonitorModal from "../components/competition/MatchMonitorModal";
import { TournamentMatch } from "../types";

describe("Competition Frontend Features (FE First Implementation)", () => {
  it("CompetitionChampionBanner displays champion information for INDIVIDUAL", () => {
    render(
      <CompetitionChampionBanner
        championName="Nguyen Van A"
        championUserId={101}
        competitionTitle="Giải Đấu Tranh Biện Mùa Xuân"
        competitionType="INDIVIDUAL"
      />
    );
    expect(screen.getByText("Vinh danh Quán quân Cuộc thi")).toBeInTheDocument();
    expect(screen.getByText("Nguyen Van A")).toBeInTheDocument();
    expect(screen.getByText("Giải Đấu Tranh Biện Mùa Xuân")).toBeInTheDocument();
  });

  it("CompetitionChampionBanner displays champion information for TEAM", () => {
    render(
      <CompetitionChampionBanner
        championName="Team Dragons"
        championTeamId={202}
        competitionTitle="Giải Đấu Đội Tuyển 2v2"
        competitionType="TEAM"
      />
    );
    expect(screen.getByText("Vinh danh Quán quân Cuộc thi")).toBeInTheDocument();
    expect(screen.getByText("Team Dragons")).toBeInTheDocument();
    expect(screen.getByText("Giải Đấu Đội Tuyển 2v2")).toBeInTheDocument();
  });

  it("MatchMonitorModal is strictly read-only and does not render text input/send buttons", () => {
    const mockMatch: TournamentMatch = {
      matchId: 99,
      competitionId: 1,
      roundNumber: 1,
      roundName: "Tứ kết",
      matchNumber: 1,
      proParticipant: { matchParticipantId: 1, matchId: 99, userName: "Team Alpha (PRO)", side: "PRO" },
      conParticipant: { matchParticipantId: 2, matchId: 99, userName: "Team Beta (CON)", side: "CON" },
      status: "Ongoing",
      debateSessionId: 505,
    };

    render(
      <MatchMonitorModal
        isOpen={true}
        onClose={vi.fn()}
        match={mockMatch}
      />
    );

    // Verify Read-Only badge and match header
    expect(screen.getByText("Trực tiếp diễn biến trận đấu")).toBeInTheDocument();
    expect(screen.getByText(/Chế độ chỉ đọc \(Read-only\)/i)).toBeInTheDocument();
    expect(screen.getByText("Team Alpha (PRO)")).toBeInTheDocument();
    expect(screen.getByText("Team Beta (CON)")).toBeInTheDocument();

    // Verify absolutely NO speech composer or send button is present
    expect(screen.queryByPlaceholderText(/nhập lập luận/i)).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText(/gửi lập luận/i)).toBeNull();
  });
});

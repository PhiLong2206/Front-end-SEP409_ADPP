import { describe, it, expect, vi, beforeEach } from "vitest";
import competitionApi from "../api/competitionApi";
import debateApi from "../api/debateApi";
import axiosClient from "../api/axiosClient";
import {
  CreateCompetitionDto,
  FinalizeMatchRequest,
  PrepareDebateRequest,
  TournamentBracketResponse,
  MatchReviewResponse,
} from "../types";

vi.mock("../api/axiosClient", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("Competition & Debate Lifecycle API Suite (16 Steps, 5 Phases)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ════════════════════════════════════════════════════════════════
  // GIAI ĐOẠN 1: TẠO GIẢI VÀ MỞ ĐĂNG KÝ
  // ════════════════════════════════════════════════════════════════
  describe("Giai đoạn 1: Tạo giải và mở đăng ký", () => {
    it("Bước 1: Tạo Competition (POST /api/Competitions) trả về competitionId và status Draft", async () => {
      const createDto: CreateCompetitionDto = {
        title: "Giải Tranh Biện Sinh Viên 2026",
        description: "Cuộc thi tranh biện thường niên dành cho sinh viên.",
        competitionType: "INDIVIDUAL",
        formatId: 1,
        maxParticipants: 16,
        registrationStart: "2026-11-01T00:00:00Z",
        registrationEnd: "2026-11-10T23:59:59Z",
        startDate: "2026-11-15T08:00:00Z",
        endDate: "2026-11-20T18:00:00Z",
        isPublic: true,
      };

      const mockResponse = {
        success: true,
        message: "Tạo cuộc thi thành công",
        data: {
          competitionId: 101,
          ...createDto,
          createdBy: 1,
          status: "Draft",
          createdAt: "2026-11-01T00:00:00Z",
        },
      };

      vi.mocked(axiosClient.post).mockResolvedValueOnce(mockResponse as never);

      const res = await competitionApi.createCompetition(createDto);

      expect(axiosClient.post).toHaveBeenCalledWith("/competitions", createDto);
      expect(res.success).toBe(true);
      expect(res.data!.competitionId).toBe(101);
      expect(res.data!.status).toBe("Draft");
    });

    it("Bước 2: Mở đăng ký (POST /api/Competitions/{competitionId}/open-registration)", async () => {
      const mockResponse = {
        success: true,
        message: "Đã mở đăng ký",
        data: {},
      };

      vi.mocked(axiosClient.post).mockResolvedValueOnce(mockResponse as never);

      const res = await competitionApi.openRegistration(101);

      expect(axiosClient.post).toHaveBeenCalledWith("/competitions/101/open-registration");
      expect(res.success).toBe(true);
    });

    it("Bước 3: Xem giải (GET /api/Competitions và GET /api/Competitions/{id})", async () => {
      const mockList = {
        success: true,
        message: "Success",
        data: [
          {
            competitionId: 101,
            title: "Giải Tranh Biện Sinh Viên 2026",
            competitionType: "INDIVIDUAL",
            status: "OpenRegistration",
          },
        ],
      };

      const mockDetail = {
        success: true,
        message: "Success",
        data: {
          competitionId: 101,
          title: "Giải Tranh Biện Sinh Viên 2026",
          competitionType: "INDIVIDUAL",
          status: "OpenRegistration",
        },
      };

      vi.mocked(axiosClient.get).mockResolvedValueOnce(mockList as never);
      vi.mocked(axiosClient.get).mockResolvedValueOnce(mockDetail as never);

      const listRes = await competitionApi.getCompetitions({ status: "OpenRegistration" });
      const detailRes = await competitionApi.getCompetitionById(101);

      expect(axiosClient.get).toHaveBeenCalledWith("/competitions", {
        params: { status: "OpenRegistration" },
      });
      expect(axiosClient.get).toHaveBeenCalledWith("/competitions/101");
      expect(listRes.data![0].competitionId).toBe(101);
      expect(detailRes.data!.competitionId).toBe(101);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // GIAI ĐOẠN 2: ĐĂNG KÝ (INDIVIDUAL 1V1 HOẶC TEAM 2V2)
  // ════════════════════════════════════════════════════════════════
  describe("Giai đoạn 2: Đăng ký (Nhánh Individual 1v1 & Team 2v2)", () => {
    describe("Nhánh Individual 1v1", () => {
      it("Bước 4A: Người chơi đăng ký (POST /api/competitions/{id}/registrations)", async () => {
        const mockResponse = {
          success: true,
          message: "Đăng ký thành công",
          data: {
            registrationId: 501,
            competitionId: 101,
            userId: 12,
            userName: "Thí sinh A",
            userEmail: "a@gmail.com",
            status: "Pending",
            registeredAt: "2026-11-02T10:00:00Z",
          },
        };

        vi.mocked(axiosClient.post).mockResolvedValueOnce(mockResponse as never);

        const res = await competitionApi.registerIndividual(101);

        expect(axiosClient.post).toHaveBeenCalledWith("/competitions/101/registrations");
        expect(res.data!.registrationId).toBe(501);
        expect(res.data!.status).toBe("Pending");
      });

      it("Bước 5A: Creator duyệt đăng ký (PUT /api/competitions/{id}/registrations/{registrationId}/approve)", async () => {
        const mockResponse = {
          success: true,
          message: "Phê duyệt thành công",
          data: {
            registrationId: 501,
            status: "Approved",
          },
        };

        vi.mocked(axiosClient.put).mockResolvedValueOnce(mockResponse as never);

        const res = await competitionApi.approveRegistration(101, 501);

        expect(axiosClient.put).toHaveBeenCalledWith(
          "/competitions/101/registrations/501/approve"
        );
        expect(res.data!.status).toBe("Approved");
      });

      it("Creator từ chối đăng ký qua reject endpoint với lý do", async () => {
        const mockResponse = {
          success: true,
          message: "Từ chối thành công",
          data: { registrationId: 502, status: "Rejected" },
        };

        vi.mocked(axiosClient.put).mockResolvedValueOnce(mockResponse as never);

        const res = await competitionApi.rejectRegistration(101, 502, "Không đủ tiêu chuẩn");

        expect(axiosClient.put).toHaveBeenCalledWith(
          "/competitions/101/registrations/502/reject",
          { reason: "Không đủ tiêu chuẩn" }
        );
        expect(res.data!.status).toBe("Rejected");
      });

      it("Người chơi hủy đăng ký trước khi tạo bracket (DELETE .../registrations/me)", async () => {
        const mockResponse = { success: true, message: "Đã hủy đăng ký", data: {} };
        vi.mocked(axiosClient.delete).mockResolvedValueOnce(mockResponse as never);

        const res = await competitionApi.cancelMyRegistration(101, "Bận việc đột xuất");

        expect(axiosClient.delete).toHaveBeenCalledWith("/competitions/101/registrations/me", {
          data: { reason: "Bận việc đột xuất" },
        });
        expect(res.success).toBe(true);
      });
    });

    describe("Nhánh Team 2v2", () => {
      it("Bước 4B: Captain tạo đội (POST /api/competitions/{id}/teams)", async () => {
        const mockResponse = {
          success: true,
          message: "Tạo đội thành công",
          data: {
            teamId: 301,
            competitionId: 101,
            teamName: "Đội Phản Biện Sấm Sét",
            captainUserId: 12,
            status: "Active",
            createdAt: "2026-11-02T10:00:00Z",
          },
        };

        vi.mocked(axiosClient.post).mockResolvedValueOnce(mockResponse as never);

        const res = await competitionApi.createTeam(101, {
          teamName: "Đội Phản Biện Sấm Sét",
        });

        expect(axiosClient.post).toHaveBeenCalledWith("/competitions/101/teams", {
          teamName: "Đội Phản Biện Sấm Sét",
        });
        expect(res.data!.teamId).toBe(301);
      });

      it("Bước 5B: Captain mời thành viên thứ hai & người được mời chấp nhận", async () => {
        const inviteResponse = {
          success: true,
          message: "Đã gửi lời mời",
          data: {
            requestId: 401,
            teamId: 301,
            userId: 15,
            requestType: "Invitation",
            status: "Pending",
          },
        };

        const acceptResponse = {
          success: true,
          message: "Đã chấp nhận lời mời",
          data: {},
        };

        vi.mocked(axiosClient.post).mockResolvedValueOnce(inviteResponse as never);
        vi.mocked(axiosClient.post).mockResolvedValueOnce(acceptResponse as never);

        // Captain sends invitation
        const inviteRes = await competitionApi.sendTeamInvitation(101, 301, { userId: 15 });
        expect(axiosClient.post).toHaveBeenCalledWith(
          "/competitions/101/teams/301/invitations",
          { userId: 15 }
        );
        expect(inviteRes.data!.requestId).toBe(401);

        // Member accepts invitation
        const acceptRes = await competitionApi.acceptInvitation(101, 401);
        expect(axiosClient.post).toHaveBeenCalledWith(
          "/competitions/101/teams/invitations/401/accept"
        );
        expect(acceptRes.success).toBe(true);
      });

      it("Đường thay thế: Thành viên gửi join-request và captain phê duyệt", async () => {
        const joinRes = {
          success: true,
          message: "Đã gửi yêu cầu",
          data: { requestId: 402, status: "Pending" },
        };

        const approveJoinRes = {
          success: true,
          message: "Đã duyệt yêu cầu",
          data: {},
        };

        vi.mocked(axiosClient.post).mockResolvedValueOnce(joinRes as never);
        vi.mocked(axiosClient.post).mockResolvedValueOnce(approveJoinRes as never);

        await competitionApi.createJoinRequest(101, 301);
        expect(axiosClient.post).toHaveBeenCalledWith(
          "/competitions/101/teams/301/join-requests"
        );

        await competitionApi.approveJoinRequest(101, 301, 402);
        expect(axiosClient.post).toHaveBeenCalledWith(
          "/competitions/101/teams/301/join-requests/402/approve"
        );
      });
    });
  });

  // ════════════════════════════════════════════════════════════════
  // GIAI ĐOẠN 3: ĐÓNG ĐĂNG KÝ, TẠO BRACKET VÀ BẮT ĐẦU GIẢI
  // ════════════════════════════════════════════════════════════════
  describe("Giai đoạn 3: Đóng đăng ký, tạo bracket và bắt đầu giải", () => {
    it("Bước 6: Đóng đăng ký (POST /api/Competitions/{id}/close-registration)", async () => {
      vi.mocked(axiosClient.post).mockResolvedValueOnce({
        success: true,
        message: "Đã đóng đăng ký",
        data: {},
      } as never);

      const res = await competitionApi.closeRegistration(101);

      expect(axiosClient.post).toHaveBeenCalledWith("/competitions/101/close-registration");
      expect(res.success).toBe(true);
    });

    it("Bước 7: Sinh bracket (POST /api/competitions/{competitionId}/bracket)", async () => {
      const mockBracket: TournamentBracketResponse = {
        competitionId: 101,
        rounds: [
          {
            roundId: 1,
            roundNumber: 1,
            roundName: "Tứ kết",
            matches: [
              {
                matchId: 2001,
                roundNumber: 1,
                status: "Scheduled",
                proParticipant: {
                  matchParticipantId: 1,
                  matchId: 2001,
                  userId: 12,
                  userName: "Thí sinh A",
                  side: "PRO",
                },
                conParticipant: {
                  matchParticipantId: 2,
                  matchId: 2001,
                  userId: 14,
                  userName: "Thí sinh B",
                  side: "CON",
                },
                nextMatchId: 3001,
              },
            ],
          },
        ],
      };

      vi.mocked(axiosClient.post).mockResolvedValueOnce({
        success: true,
        message: "Sinh bracket thành công",
        data: mockBracket,
      } as never);

      const res = await competitionApi.generateBracket(101);

      expect(axiosClient.post).toHaveBeenCalledWith("/competitions/101/bracket");
      expect(res.data!.rounds[0].matches[0].matchId).toBe(2001);
    });

    it("Bước 8: Xem bracket (GET /api/competitions/{competitionId}/bracket)", async () => {
      const mockBracket: TournamentBracketResponse = {
        competitionId: 101,
        rounds: [
          {
            roundId: 1,
            roundNumber: 1,
            roundName: "Chung kết",
            matches: [
              {
                matchId: 2001,
                roundNumber: 1,
                status: "Ready",
                nextMatchId: null,
              },
            ],
          },
        ],
      };

      vi.mocked(axiosClient.get).mockResolvedValueOnce({
        success: true,
        message: "Success",
        data: mockBracket,
      } as never);

      const res = await competitionApi.getBracket(101);

      expect(axiosClient.get).toHaveBeenCalledWith("/competitions/101/bracket");
      expect(res.data!.competitionId).toBe(101);
      expect(res.data!.rounds.length).toBe(1);
    });

    it("Bước 9: Bắt đầu Competition (POST /api/Competitions/{id}/start)", async () => {
      vi.mocked(axiosClient.post).mockResolvedValueOnce({
        success: true,
        message: "Đã bắt đầu cuộc thi",
        data: {},
      } as never);

      const res = await competitionApi.startCompetition(101);

      expect(axiosClient.post).toHaveBeenCalledWith("/competitions/101/start");
      expect(res.success).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // GIAI ĐOẠN 4: CHẠY TỪNG TRẬN READY (BƯỚC 10 - 16)
  // ════════════════════════════════════════════════════════════════
  describe("Giai đoạn 4: Chạy từng trận Ready", () => {
    it("Bước 10: Phân công judge (PUT /api/competitions/{competitionId}/matches/{matchId}/judge)", async () => {
      vi.mocked(axiosClient.put).mockResolvedValueOnce({
        success: true,
        message: "Phân công giám khảo thành công",
        data: {},
      } as never);

      const res = await competitionApi.assignMatchJudge(101, 2001, { judgeUserId: 88 });

      expect(axiosClient.put).toHaveBeenCalledWith(
        "/competitions/101/matches/2001/judge",
        { judgeUserId: 88 }
      );
      expect(res.success).toBe(true);
    });

    it("Bước 11: Chuẩn bị Debate (POST /api/Competitions/matches/{matchId}/prepare-debate)", async () => {
      const prepareReq: PrepareDebateRequest = { topicId: 5 };
      const prepareRes = {
        success: true,
        message: "Khởi tạo phiên tranh biện thành công",
        data: { sessionId: 999 },
      };

      vi.mocked(axiosClient.post).mockResolvedValueOnce(prepareRes as never);

      const res = await competitionApi.prepareDebate(2001, prepareReq);

      // Note: route does NOT contain competitionId
      expect(axiosClient.post).toHaveBeenCalledWith(
        "/competitions/matches/2001/prepare-debate",
        prepareReq
      );
      expect(res.data!.sessionId).toBe(999);
    });

    it("Bước 12: Start Debate (POST /api/Debate/{sessionId}/start)", async () => {
      vi.mocked(axiosClient.post).mockResolvedValueOnce({
        success: true,
        message: "Đã bắt đầu phiên tranh biện",
        data: { sessionId: 999, status: 2 },
      } as never);

      const res = await debateApi.startDebateSession(999);

      expect(axiosClient.post).toHaveBeenCalledWith("/debate/999/start");
      expect(res.success).toBe(true);
    });

    it("Bước 13: Người chơi tranh biện (POST /api/Debate/{sessionId}/arguments)", async () => {
      vi.mocked(axiosClient.post).mockResolvedValueOnce({
        success: true,
        message: "Đã gửi lập luận",
        data: { sessionId: 999 },
      } as never);

      const res = await debateApi.submitArgument(999, {
        content: "Trí tuệ nhân tạo mang lại lợi ích đột phá cho giáo dục nếu được kiểm soát tốt.",
      });

      expect(axiosClient.post).toHaveBeenCalledWith("/debate/999/arguments", {
        content: "Trí tuệ nhân tạo mang lại lợi ích đột phá cho giáo dục nếu được kiểm soát tốt.",
      });
      expect(res.success).toBe(true);
    });

    it("Bước 14: Kích hoạt & đọc AI evaluation (POST & GET /api/Debate/{sessionId}/evaluate)", async () => {
      const evalPostRes = {
        success: true,
        message: "Đã kích hoạt AI đánh giá",
        data: {},
      };

      const evalGetRes = {
        success: true,
        message: "Success",
        data: {
          sessionId: 999,
          summary: "Bên PRO có lập luận chặt chẽ hơn về mặt thực chứng.",
          winnerSide: "PRO",
          proScore: 8.5,
          conScore: 7.2,
        },
      };

      vi.mocked(axiosClient.post).mockResolvedValueOnce(evalPostRes as never);
      vi.mocked(axiosClient.get).mockResolvedValueOnce(evalGetRes as never);

      const triggerRes = await debateApi.evaluateDebate(999);
      const getRes = await debateApi.getEvaluation(999);

      expect(axiosClient.post).toHaveBeenCalledWith("/debate/999/evaluate");
      expect(axiosClient.get).toHaveBeenCalledWith("/debate/999/evaluation");
      expect(triggerRes.success).toBe(true);
      expect((getRes.data as { winnerSide: string }).winnerSide).toBe("PRO");
    });

    it("Bước 15: Judge xem hồ sơ review trận đấu (GET /api/competitions/{id}/matches/{matchId}/review)", async () => {
      const mockReview: MatchReviewResponse = {
        matchId: 2001,
        competitionId: 101,
        participants: [
          { matchParticipantId: 1, side: "PRO", userName: "Thí sinh A" },
          { matchParticipantId: 2, side: "CON", userName: "Thí sinh B" },
        ],
        criteria: [
          { criteriaId: 1, name: "Logic & Lập luận", maxScore: 10, weight: 0.4 },
          { criteriaId: 2, name: "Phản biện & Tái khẳng định", maxScore: 10, weight: 0.3 },
          { criteriaId: 3, name: "Phong thái & Thời gian", maxScore: 10, weight: 0.3 },
        ],
        aiJudgement: {
          summary: "PRO thể hiện sự vượt trội trong các luận điểm chứng cứ.",
          recommendedWinnerSide: "PRO",
        },
      };

      vi.mocked(axiosClient.get).mockResolvedValueOnce({
        success: true,
        message: "Success",
        data: mockReview,
      } as never);

      const res = await competitionApi.getMatchReview(101, 2001);

      expect(axiosClient.get).toHaveBeenCalledWith(
        "/competitions/101/matches/2001/review"
      );
      expect(res.data!.participants.length).toBe(2);
      expect(res.data!.criteria.length).toBe(3);
      expect(res.data!.aiJudgement?.recommendedWinnerSide).toBe("PRO");
    });

    it("Bước 16: Judge xác nhận kết quả chấm điểm (POST /api/competitions/{id}/matches/{matchId}/finalize)", async () => {
      const finalizeData: FinalizeMatchRequest = {
        scores: [
          { matchParticipantId: 1, criteriaId: 1, score: 9.0, feedback: "Lập luận rất sắc bén" },
          { matchParticipantId: 1, criteriaId: 2, score: 8.5, feedback: "Phản biện tốt" },
          { matchParticipantId: 1, criteriaId: 3, score: 8.0, feedback: "Quản lý thời gian tốt" },
          { matchParticipantId: 2, criteriaId: 1, score: 7.5, feedback: "Lập luận còn thiếu số liệu" },
          { matchParticipantId: 2, criteriaId: 2, score: 7.0, feedback: "Chưa bẻ được luận điểm chính" },
          { matchParticipantId: 2, criteriaId: 3, score: 8.0, feedback: "Phong thái tự tin" },
        ],
        winnerMatchParticipantId: 1,
        decisionReason: "Thí sinh PRO có dẫn chứng thuyết phục và cấu trúc lập luận vượt trội.",
      };

      vi.mocked(axiosClient.post).mockResolvedValueOnce({
        success: true,
        message: "Đã xác nhận kết quả và chuyển thí sinh vào trận tiếp theo.",
        data: {},
      } as never);

      const res = await competitionApi.finalizeMatch(101, 2001, finalizeData);

      expect(axiosClient.post).toHaveBeenCalledWith(
        "/competitions/101/matches/2001/finalize",
        finalizeData
      );
      expect(res.success).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // GIAI ĐOẠN 5: ĐI TIẾP VÀ XÁC ĐỊNH CHAMPION
  // ════════════════════════════════════════════════════════════════
  describe("Giai đoạn 5: Đi tiếp và xác định champion", () => {
    it("Xác định Champion qua GET /api/competitions/{id}/bracket", async () => {
      const mockFinalBracket: TournamentBracketResponse = {
        competitionId: 101,
        championUserId: 12,
        championName: "Thí sinh A",
        rounds: [
          {
            roundId: 2,
            roundNumber: 2,
            roundName: "Chung kết",
            matches: [
              {
                matchId: 3001,
                roundNumber: 2,
                status: "Completed",
                winnerMatchParticipantId: 1,
                winnerName: "Thí sinh A",
              },
            ],
          },
        ],
      };

      vi.mocked(axiosClient.get).mockResolvedValueOnce({
        success: true,
        message: "Success",
        data: mockFinalBracket,
      } as never);

      const res = await competitionApi.getBracket(101);

      expect(axiosClient.get).toHaveBeenCalledWith("/competitions/101/bracket");
      expect(res.data!.championUserId).toBe(12);
      expect(res.data!.championName).toBe("Thí sinh A");
    });

    it("Hoàn thành giải đấu (POST /api/Competitions/{id}/complete)", async () => {
      vi.mocked(axiosClient.post).mockResolvedValueOnce({
        success: true,
        message: "Giải đấu đã hoàn tất.",
        data: {},
      } as never);

      const res = await competitionApi.completeCompetition(101);

      expect(axiosClient.post).toHaveBeenCalledWith("/competitions/101/complete");
      expect(res.success).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════
  // TOÀN BỘ CHU TRÌNH END-TO-END (TỪ DRAFT ĐẾN CHAMPION)
  // ════════════════════════════════════════════════════════════════
  describe("End-to-End Simulation: Chuỗi liên hoàn 16 bước", () => {
    it("Thực thi toàn bộ luồng từ tạo giải -> mở đăng ký -> duyệt thí sinh -> tạo bracket -> debate -> AI evaluate -> chấm điểm -> xác định champion", async () => {
      // 1. Tạo giải
      vi.mocked(axiosClient.post).mockResolvedValueOnce({
        success: true,
        data: { competitionId: 77, status: "Draft" },
      } as never);
      const created = await competitionApi.createCompetition({
        title: "Toàn quốc 2026",
        competitionType: "INDIVIDUAL",
        registrationStart: "2026-11-01T00:00:00Z",
        registrationEnd: "2026-11-05T00:00:00Z",
        startDate: "2026-11-06T00:00:00Z",
      });
      const compId = created.data!.competitionId;

      // 2. Mở đăng ký
      vi.mocked(axiosClient.post).mockResolvedValueOnce({ success: true, data: {} } as never);
      await competitionApi.openRegistration(compId);

      // 4A. Thí sinh đăng ký
      vi.mocked(axiosClient.post).mockResolvedValueOnce({
        success: true,
        data: { registrationId: 901, status: "Pending" },
      } as never);
      const reg = await competitionApi.registerIndividual(compId);

      // 5A. Duyệt thí sinh
      vi.mocked(axiosClient.put).mockResolvedValueOnce({
        success: true,
        data: { registrationId: 901, status: "Approved" },
      } as never);
      await competitionApi.approveRegistration(compId, reg.data!.registrationId);

      // 6. Đóng đăng ký
      vi.mocked(axiosClient.post).mockResolvedValueOnce({ success: true, data: {} } as never);
      await competitionApi.closeRegistration(compId);

      // 7. Sinh bracket
      vi.mocked(axiosClient.post).mockResolvedValueOnce({
        success: true,
        data: {
          competitionId: compId,
          rounds: [{ roundNumber: 1, roundName: "Chung kết", matches: [{ matchId: 5001, status: "Scheduled" }] }],
        },
      } as never);
      await competitionApi.generateBracket(compId);

      // 9. Bắt đầu giải (Scheduled -> Ready)
      vi.mocked(axiosClient.post).mockResolvedValueOnce({ success: true, data: {} } as never);
      await competitionApi.startCompetition(compId);

      // 10. Phân công judge
      vi.mocked(axiosClient.put).mockResolvedValueOnce({ success: true, data: {} } as never);
      await competitionApi.assignMatchJudge(compId, 5001, { judgeUserId: 99 });

      // 11. Chuẩn bị Debate
      vi.mocked(axiosClient.post).mockResolvedValueOnce({
        success: true,
        data: { sessionId: 8888 },
      } as never);
      const prep = await competitionApi.prepareDebate(5001, { topicId: 10 });
      const sessionId = prep.data!.sessionId;

      // 12. Bắt đầu Debate session (Ready -> Ongoing)
      vi.mocked(axiosClient.post).mockResolvedValueOnce({ success: true, data: {} } as never);
      await debateApi.startDebateSession(sessionId);

      // 13. Người chơi gửi luận điểm
      vi.mocked(axiosClient.post).mockResolvedValueOnce({ success: true, data: {} } as never);
      await debateApi.submitArgument(sessionId, { content: "Luận điểm phản biện của bên PRO." });

      // 14. AI evaluation
      vi.mocked(axiosClient.post).mockResolvedValueOnce({ success: true, data: {} } as never);
      await debateApi.evaluateDebate(sessionId);

      // 15. Judge xem review hồ sơ
      vi.mocked(axiosClient.get).mockResolvedValueOnce({
        success: true,
        data: {
          matchId: 5001,
          competitionId: compId,
          participants: [{ matchParticipantId: 1, side: "PRO" }, { matchParticipantId: 2, side: "CON" }],
          criteria: [{ criteriaId: 1, name: "Logic", maxScore: 10, weight: 1 }],
          aiJudgement: { recommendedWinnerSide: "PRO" },
        },
      } as never);
      const review = await competitionApi.getMatchReview(compId, 5001);
      expect(review.data!.aiJudgement?.recommendedWinnerSide).toBe("PRO");

      // 16. Judge finalize kết quả
      vi.mocked(axiosClient.post).mockResolvedValueOnce({ success: true, data: {} } as never);
      await competitionApi.finalizeMatch(compId, 5001, {
        scores: [
          { matchParticipantId: 1, criteriaId: 1, score: 9.5 },
          { matchParticipantId: 2, criteriaId: 1, score: 7.0 },
        ],
        winnerMatchParticipantId: 1,
        decisionReason: "PRO thể hiện cấu trúc luận điểm xuất sắc.",
      });

      // 17. Xác nhận Champion từ Bracket
      vi.mocked(axiosClient.get).mockResolvedValueOnce({
        success: true,
        data: {
          competitionId: compId,
          championUserId: 901,
          championName: "Thí sinh PRO",
          rounds: [],
        },
      } as never);
      const finalBracket = await competitionApi.getBracket(compId);
      expect(finalBracket.data!.championUserId).toBe(901);
    });
  });
});

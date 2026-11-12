import axiosClient from "./axiosClient";
import {
  ApiResponse,
  AssignMatchJudgeRequest,
  CompetitionDetail,
  CompetitionJudge,
  CompetitionListItem,
  CompetitionQueryFilter,
  CompetitionRegistration,
  CompetitionTeam,
  CompetitionTeamDetail,
  CompetitionTeamRequest,
  CreateCompetitionDto,
  FinalizeMatchRequest,
  MatchReviewResponse,
  PatchCompetitionDto,
  PrepareDebateRequest,
  PrepareDebateResponse,
  TournamentBracketResponse,
} from "../types";

const competitionApi = {
  // ── Competition Management ───────────────────────────────────
  getCompetitions: (
    params?: CompetitionQueryFilter
  ): Promise<ApiResponse<CompetitionListItem[]>> =>
    axiosClient.get("/competitions", { params }),

  // Alias for backward compatibility
  getAllCompetitions: (
    params?: CompetitionQueryFilter
  ): Promise<ApiResponse<CompetitionListItem[]>> =>
    axiosClient.get("/competitions", { params }),

  getCompetitionById: (
    id: number | string
  ): Promise<ApiResponse<CompetitionDetail>> =>
    axiosClient.get(`/competitions/${id}`),

  createCompetition: (
    data: CreateCompetitionDto
  ): Promise<ApiResponse<CompetitionDetail>> =>
    axiosClient.post("/competitions", data),

  patchCompetition: (
    id: number | string,
    data: PatchCompetitionDto
  ): Promise<ApiResponse<CompetitionDetail>> =>
    axiosClient.patch(`/competitions/${id}`, data),

  deleteCompetition: (id: number | string): Promise<ApiResponse<void>> =>
    axiosClient.post(`/competitions/${id}/cancel`),

  // Lifecycle status transition endpoints
  openRegistration: (id: number | string): Promise<ApiResponse<object>> =>
    axiosClient.post(`/competitions/${id}/open-registration`),

  closeRegistration: (id: number | string): Promise<ApiResponse<object>> =>
    axiosClient.post(`/competitions/${id}/close-registration`),

  startCompetition: (id: number | string): Promise<ApiResponse<object>> =>
    axiosClient.post(`/competitions/${id}/start`),

  completeCompetition: (id: number | string): Promise<ApiResponse<object>> =>
    axiosClient.post(`/competitions/${id}/complete`),

  cancelCompetition: (id: number | string): Promise<ApiResponse<object>> =>
    axiosClient.post(`/competitions/${id}/cancel`),

  // ── Registrations (INDIVIDUAL Competitions) ───────────────────
  getRegistrations: (
    competitionId: number | string,
    status?: string
  ): Promise<ApiResponse<CompetitionRegistration[]>> =>
    axiosClient.get(`/competitions/${competitionId}/registrations`, {
      params: status ? { status } : undefined,
    }),

  getRegistrationById: (
    competitionId: number | string,
    registrationId: number | string
  ): Promise<ApiResponse<CompetitionRegistration>> =>
    axiosClient.get(`/competitions/${competitionId}/registrations/${registrationId}`),

  getMyRegistration: async (
    competitionId: number | string,
    userId?: number
  ): Promise<ApiResponse<CompetitionRegistration | null>> => {
    if (!userId) return { success: true, message: "", data: null };
    try {
      const listRes = await axiosClient.get<ApiResponse<CompetitionRegistration[]>>(
        `/competitions/${competitionId}/registrations`
      );
      const list = (listRes as unknown as ApiResponse<CompetitionRegistration[]>).data || [];
      const found = list.find((r) => r.userId === userId);
      return {
        success: true,
        message: "",
        data: found || null,
      };
    } catch (err: unknown) {
      const e = err as { message?: string };
      return {
        success: false,
        message: e.message || "Không thể tải trạng thái đăng ký",
        data: null,
      };
    }
  },

  registerIndividual: (
    competitionId: number | string
  ): Promise<ApiResponse<CompetitionRegistration>> =>
    axiosClient.post(`/competitions/${competitionId}/registrations`),

  approveRegistration: (
    competitionId: number | string,
    registrationId: number | string
  ): Promise<ApiResponse<CompetitionRegistration>> =>
    axiosClient.put(`/competitions/${competitionId}/registrations/${registrationId}/approve`),

  rejectRegistration: (
    competitionId: number | string,
    registrationId: number | string,
    reason: string
  ): Promise<ApiResponse<CompetitionRegistration>> =>
    axiosClient.put(`/competitions/${competitionId}/registrations/${registrationId}/reject`, {
      reason,
    }),

  updateRegistrationStatus: (
    competitionId: number | string,
    registrationId: number | string,
    reason: string
  ): Promise<ApiResponse<CompetitionRegistration>> =>
    axiosClient.put(`/competitions/${competitionId}/registrations/${registrationId}/status`, {
      reason,
    }),

  removeParticipant: async (
    competitionId: number | string,
    registrationId: number | string,
    reason: string
  ): Promise<ApiResponse<CompetitionRegistration | void>> => {
    try {
      return await axiosClient.put(
        `/competitions/${competitionId}/registrations/${registrationId}/status`,
        { reason }
      );
    } catch {
      return await axiosClient.delete(
        `/competitions/${competitionId}/registrations/${registrationId}`,
        { data: { reason } }
      );
    }
  },

  cancelMyRegistration: (
    competitionId: number | string,
    reason: string = "User requested cancellation"
  ): Promise<ApiResponse<object>> =>
    axiosClient.delete(`/competitions/${competitionId}/registrations/me`, {
      data: { reason },
    }),

  // ── Teams (TEAM Competitions) ─────────────────────────────────
  getTeams: (
    competitionId: number | string
  ): Promise<ApiResponse<CompetitionTeam[]>> =>
    axiosClient.get(`/competitions/${competitionId}/teams`),

  getTeamById: (
    competitionId: number | string,
    teamId: number | string
  ): Promise<ApiResponse<CompetitionTeamDetail>> =>
    axiosClient.get(`/competitions/${competitionId}/teams/${teamId}`),

  createTeam: (
    competitionId: number | string,
    data: { teamName: string }
  ): Promise<ApiResponse<CompetitionTeam>> =>
    axiosClient.post(`/competitions/${competitionId}/teams`, data),

  deleteTeam: (
    competitionId: number | string,
    teamId: number | string
  ): Promise<ApiResponse<void>> =>
    axiosClient.delete(`/competitions/${competitionId}/teams/${teamId}`),

  withdrawTeam: (
    competitionId: number | string,
    teamId: number | string
  ): Promise<ApiResponse<object>> =>
    axiosClient.post(`/competitions/${competitionId}/teams/${teamId}/withdraw`),

  leaveTeam: (
    competitionId: number | string,
    teamId: number | string
  ): Promise<ApiResponse<object>> =>
    axiosClient.delete(`/competitions/${competitionId}/teams/${teamId}/members/me`),

  removeTeamMember: (
    competitionId: number | string,
    teamId: number | string,
    userId: number | string
  ): Promise<ApiResponse<object>> =>
    axiosClient.delete(`/competitions/${competitionId}/teams/${teamId}/members/${userId}`),

  // ── Team Invitations (Captain -> User) ───────────────────────
  sendTeamInvitation: (
    competitionId: number | string,
    teamId: number | string,
    data: { userId: number }
  ): Promise<ApiResponse<CompetitionTeamRequest>> =>
    axiosClient.post(`/competitions/${competitionId}/teams/${teamId}/invitations`, data),

  getMyInvitations: (
    competitionId: number | string
  ): Promise<ApiResponse<CompetitionTeamRequest[]>> =>
    axiosClient.get(`/competitions/${competitionId}/teams/invitations/me`),

  acceptInvitation: (
    competitionId: number | string,
    invitationId: number | string
  ): Promise<ApiResponse<object>> =>
    axiosClient.post(
      `/competitions/${competitionId}/teams/invitations/${invitationId}/accept`
    ),

  rejectInvitation: (
    competitionId: number | string,
    invitationId: number | string,
    reason?: string
  ): Promise<ApiResponse<object>> =>
    axiosClient.post(
      `/competitions/${competitionId}/teams/invitations/${invitationId}/reject`,
      { reason }
    ),

  // ── Team Join Requests (User -> Captain) ─────────────────────
  createJoinRequest: (
    competitionId: number | string,
    teamId: number | string
  ): Promise<ApiResponse<CompetitionTeamRequest>> =>
    axiosClient.post(`/competitions/${competitionId}/teams/${teamId}/join-requests`),

  getTeamJoinRequests: (
    competitionId: number | string,
    teamId: number | string
  ): Promise<ApiResponse<CompetitionTeamRequest[]>> =>
    axiosClient.get(`/competitions/${competitionId}/teams/${teamId}/join-requests`),

  approveJoinRequest: (
    competitionId: number | string,
    teamId: number | string,
    requestId: number | string
  ): Promise<ApiResponse<object>> =>
    axiosClient.post(
      `/competitions/${competitionId}/teams/${teamId}/join-requests/${requestId}/approve`
    ),

  rejectJoinRequest: (
    competitionId: number | string,
    teamId: number | string,
    requestId: number | string,
    reason?: string
  ): Promise<ApiResponse<object>> =>
    axiosClient.post(
      `/competitions/${competitionId}/teams/${teamId}/join-requests/${requestId}/reject`,
      { reason }
    ),

  // ── Judges ───────────────────────────────────────────────────
  getJudges: (
    competitionId: number | string
  ): Promise<ApiResponse<CompetitionJudge[]>> =>
    axiosClient.get(`/competitions/${competitionId}/judges`),

  addJudge: (
    competitionId: number | string,
    data: { userId: number }
  ): Promise<ApiResponse<CompetitionJudge | object>> =>
    axiosClient.post(`/competitions/${competitionId}/judges`, data),

  // ── Tournament Bracket & Matches ──────────────────────────────
  /**
   * POST /api/competitions/{competitionId}/bracket [Authorized - Creator]
   * Generates single-elimination tournament bracket for the competition.
   */
  generateBracket: (
    competitionId: number | string
  ): Promise<ApiResponse<TournamentBracketResponse>> =>
    axiosClient.post(`/competitions/${competitionId}/bracket`),

  /**
   * GET /api/competitions/{competitionId}/bracket
   * Retrieves tournament bracket rounds, matches, and champion if determined.
   */
  getBracket: (
    competitionId: number | string
  ): Promise<ApiResponse<TournamentBracketResponse>> =>
    axiosClient.get(`/competitions/${competitionId}/bracket`),

  /**
   * PUT /api/competitions/{competitionId}/matches/{matchId}/judge [Authorized - Creator]
   * Assigns a judge to a scheduled/ready match.
   */
  assignMatchJudge: (
    competitionId: number | string,
    matchId: number | string,
    data: AssignMatchJudgeRequest
  ): Promise<ApiResponse<object>> =>
    axiosClient.put(
      `/competitions/${competitionId}/matches/${matchId}/judge`,
      data
    ),

  /**
   * POST /api/Competitions/matches/{matchId}/prepare-debate [Authorized - Creator / Assigned Judge]
   * Prepares debate session for a ready match using active topic from catalog.
   */
  prepareDebate: (
    matchId: number | string,
    data: PrepareDebateRequest
  ): Promise<ApiResponse<PrepareDebateResponse>> =>
    axiosClient.post(`/competitions/matches/${matchId}/prepare-debate`, data),

  /**
   * GET /api/competitions/{competitionId}/matches/{matchId}/review [Authorized - Creator / Assigned Judge]
   * Retrieves review dossier for a completed debate match including criteria and AI suggestions.
   */
  getMatchReview: (
    competitionId: number | string,
    matchId: number | string
  ): Promise<ApiResponse<MatchReviewResponse>> =>
    axiosClient.get(
      `/competitions/${competitionId}/matches/${matchId}/review`
    ),

  /**
   * GET /api/competitions/{competitionId}/matches/{matchId}
   * Retrieves detailed match information including participants, judge, topic, and status.
   */
  getMatchDetail: (
    competitionId: number | string,
    matchId: number | string
  ): Promise<ApiResponse<TournamentMatch>> =>
    axiosClient.get(`/competitions/${competitionId}/matches/${matchId}`),

  /**
   * GET /api/competitions/{competitionId}/sessions
   * Retrieves all debate sessions created for matches in the competition.
   */
  getCompetitionSessions: (
    competitionId: number | string
  ): Promise<ApiResponse<unknown[]>> =>
    axiosClient.get(`/competitions/${competitionId}/sessions`),

  /**
   * POST /api/competitions/{competitionId}/matches/{matchId}/finalize [Authorized - Assigned Judge]
   * Submits official judge scoring and finalizes match result.
   */
  finalizeMatch: (
    competitionId: number | string,
    matchId: number | string,
    data: FinalizeMatchRequest
  ): Promise<ApiResponse<object>> =>
    axiosClient.post(
      `/competitions/${competitionId}/matches/${matchId}/finalize`,
      data
    ),
};

export default competitionApi;

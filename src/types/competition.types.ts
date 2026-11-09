export type CompetitionLifecycleStatus =
  | "Draft"
  | "OpenRegistration"
  | "RegistrationClosed"
  | "Ongoing"
  | "Completed"
  | "Cancelled";

export type CompetitionType = "INDIVIDUAL" | "TEAM";

export type RegistrationStatus = "Pending" | "Approved" | "Rejected" | "Cancelled";
export type TeamStatus = "Active" | "Withdrawn";
export type TeamRequestType = "Invitation" | "JoinRequest";
export type TeamRequestStatus = "Pending" | "Accepted" | "Rejected" | "Cancelled";

export interface CompetitionListItem {
  competitionId: number;
  title: string;
  competitionType: CompetitionType;
  registrationStart: string;
  registrationEnd: string;
  startDate: string;
  status: CompetitionLifecycleStatus | string;
  isPublic: boolean;
  description?: string;
  createdAt?: string;
  registrationDeadline?: string;
  registeredCount?: number;
  maxParticipants?: number;
  format?: string;
}

export interface CompetitionDetail {
  competitionId: number;
  title: string;
  description?: string | null;
  createdBy: number;
  createdByName?: string;
  competitionType: CompetitionType;
  formatId?: number | null;
  formatName?: string | null;
  maxParticipants?: number | null;
  registrationStart: string;
  registrationEnd: string;
  startDate: string;
  endDate?: string | null;
  status: CompetitionLifecycleStatus | string;
  isPublic: boolean;
  createdAt: string;
  updatedAt?: string | null;
  championUserId?: number | null;
  championTeamId?: number | null;
  championName?: string | null;
}

export interface CreateCompetitionDto {
  title: string;
  description?: string;
  competitionType: CompetitionType;
  formatId?: number | null;
  maxParticipants?: number | null;
  registrationStart: string;
  registrationEnd: string;
  startDate: string;
  endDate?: string | null;
  isPublic?: boolean;
}

export interface PatchCompetitionDto {
  title?: string;
  description?: string;
  formatId?: number | null;
  maxParticipants?: number | null;
  registrationStart?: string;
  registrationEnd?: string;
  startDate?: string;
  endDate?: string | null;
  isPublic?: boolean;
}

export interface CompetitionQueryFilter {
  status?: string;
  competitionType?: string;
  isPublic?: boolean;
  keyword?: string;
}

export interface CompetitionRegistration {
  registrationId: number;
  competitionId: number;
  userId: number;
  userName: string;
  userEmail: string;
  status: RegistrationStatus | string;
  note?: string | null;
  registeredAt: string;
  reviewedBy?: number | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
}

export interface CompetitionTeam {
  teamId: number;
  competitionId: number;
  teamName: string;
  captainUserId: number;
  status: TeamStatus | string;
  createdAt: string;
}

export interface CompetitionTeamMember {
  teamMemberId: number;
  userId: number;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  joinedAt: string;
}

export interface CompetitionTeamDetail extends CompetitionTeam {
  captainName: string;
  members: CompetitionTeamMember[];
}

export interface CompetitionTeamRequest {
  requestId: number;
  teamId: number;
  teamName: string;
  userId: number;
  userName: string;
  createdByUserId: number;
  createdByName: string;
  requestType: TeamRequestType | string;
  status: TeamRequestStatus | string;
  note?: string | null;
  createdAt: string;
  respondedAt?: string | null;
  respondedByUserId?: number | null;
  respondedByName?: string | null;
}

export interface CompetitionJudge {
  competitionJudgeId: number;
  competitionId: number;
  userId: number;
  fullName: string;
  email: string;
  assignedAt: string;
}

// Backward compatibility alias
export type Competition = CompetitionDetail;

export interface CompetitionMatchJudge {
  userId?: number;
  fullName: string;
  isCurrentUser?: boolean;
}

export interface CompetitionMatchDetail {
  matchId?: number;
  competitionId?: number;
  matchCode?: string;
  roundStage?: string;
  judges?: CompetitionMatchJudge[];
}

// ── Tournament Bracket & Matches ──────────────────────────────
export type MatchStatus =
  | "Scheduled"
  | "Ready"
  | "Ongoing"
  | "Evaluating"
  | "Completed"
  | "Bye"
  | string;

export interface MatchParticipant {
  matchParticipantId: number;
  matchId: number;
  userId?: number | null;
  userName?: string | null;
  teamId?: number | null;
  teamName?: string | null;
  side: "PRO" | "CON" | string;
  finalScore?: number | null;
  isWinner?: boolean;
}

export interface TournamentMatch {
  matchId: number;
  competitionId?: number;
  roundId?: number;
  roundNumber?: number;
  roundName?: string;
  matchNumber?: number;
  debateSessionId?: number | null;
  assignedJudgeUserId?: number | null;
  assignedJudgeName?: string | null;
  nextMatchId?: number | null;
  status: MatchStatus;
  winnerMatchParticipantId?: number | null;
  winnerName?: string | null;
  proParticipant?: MatchParticipant | null;
  conParticipant?: MatchParticipant | null;
  proParticipantName?: string | null;
  conParticipantName?: string | null;
  participants?: MatchParticipant[];
}

export interface TournamentRound {
  roundId?: number;
  roundNumber: number;
  roundName: string;
  matches: TournamentMatch[];
}

export interface TournamentBracketResponse {
  competitionId: number;
  rounds: TournamentRound[];
  championUserId?: number | null;
  championTeamId?: number | null;
  championName?: string | null;
}

export interface AssignMatchJudgeRequest {
  judgeUserId: number;
}

export interface PrepareDebateRequest {
  topicId: number;
}

export interface PrepareDebateResponse {
  sessionId: number;
  debateSessionId?: number;
}

export interface DebateCriteria {
  criteriaId: number;
  name: string;
  description?: string;
  maxScore: number;
  weight: number;
}

export interface MatchReviewParticipant {
  matchParticipantId: number;
  side: "PRO" | "CON" | string;
  userId?: number | null;
  userName?: string | null;
  teamId?: number | null;
  teamName?: string | null;
  currentScore?: number | null;
}

export interface AiJudgementSuggestion {
  summary?: string;
  recommendedWinnerSide?: string;
  winnerSuggestion?: string;
  confidenceScore?: number;
  feedback?: string;
  [key: string]: unknown;
}

export interface MatchReviewResponse {
  matchId: number;
  competitionId: number;
  participants: MatchReviewParticipant[];
  criteria: DebateCriteria[];
  aiJudgement?: AiJudgementSuggestion | null;
  [key: string]: unknown;
}

export interface JudgeScoreItem {
  matchParticipantId: number;
  criteriaId: number;
  score: number;
  feedback?: string;
}

export interface FinalizeMatchRequest {
  scores: JudgeScoreItem[];
  winnerMatchParticipantId: number;
  decisionReason?: string;
}

import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Users,
  Trophy,
  Shield,
  UserPlus,
  LogOut,
  UserX,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Send,
  PlusCircle,
  RefreshCw,
  Settings,
  Swords,
} from "lucide-react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import CompetitionStatusBadge from "./CompetitionStatusBadge";
import CompetitionTypeBadge from "./CompetitionTypeBadge";
import competitionApi from "../../api/competitionApi";
import { formatDate, formatDateTime } from "../../utils/formatDate";
import {
  CompetitionDetail,
  CompetitionRegistration,
  CompetitionTeamDetail,
  CompetitionTeamRequest,
  CompetitionJudge,
  User,
} from "../../types";
import CompetitionBracketView from "./CompetitionBracketView";
import CompetitionChampionBanner from "./CompetitionChampionBanner";

interface Props {
  competitionId: number | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  initialTab?: "overview" | "registration" | "teams" | "judges" | "bracket";
  onStatusChanged?: () => void;
  onOpenManage?: (competitionId: number) => void;
}

const CompetitionDetailModal: React.FC<Props> = ({
  competitionId,
  isOpen,
  onClose,
  currentUser,
  initialTab,
  onStatusChanged,
  onOpenManage,
}) => {
  const [activeTab, setActiveTab] = useState<"overview" | "registration" | "teams" | "judges" | "bracket">(initialTab || "overview");
  const [competition, setCompetition] = useState<CompetitionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Individual registration state
  const [myRegistration, setMyRegistration] = useState<CompetitionRegistration | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Team state
  const [teams, setTeams] = useState<CompetitionTeamDetail[]>([]);
  const [myTeam, setMyTeam] = useState<CompetitionTeamDetail | null>(null);
  const [isCaptain, setIsCaptain] = useState(false);
  const [myInvitations, setMyInvitations] = useState<CompetitionTeamRequest[]>([]);
  const [teamJoinRequests, setTeamJoinRequests] = useState<CompetitionTeamRequest[]>([]);

  // Team action modals
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteUserId, setInviteUserId] = useState<string>("");

  // Judges
  const [judges, setJudges] = useState<CompetitionJudge[]>([]);

  const currentUserId = currentUser?.userId ? Number(currentUser.userId) : null;
  const isCreator = Boolean(competition && currentUserId && competition.createdBy === currentUserId);
  const isJudge = Boolean(currentUserId && judges.some((j) => j.userId === currentUserId));
  const isOrganizerOrJudge = isCreator || isJudge;

  const isParticipantApproved = Boolean(
    (competition?.competitionType === "INDIVIDUAL" && myRegistration?.status === "Approved") ||
    (competition?.competitionType === "TEAM" && myTeam != null && myTeam.status !== "Withdrawn")
  );

  const isParticipantPending = Boolean(
    competition?.competitionType === "INDIVIDUAL" && myRegistration?.status === "Pending"
  );

  const isRegistrationPhase =
    competition?.status === "OpenRegistration" || competition?.status === "RegistrationClosed";

  const canCancelRegistration = Boolean(
    myRegistration &&
      (myRegistration.status === "Pending" || myRegistration.status === "Approved") &&
      isRegistrationPhase
  );

  const canModifyTeam = Boolean(myTeam && isRegistrationPhase);

  const loadData = useCallback(async () => {
    if (!competitionId) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Fetch competition details
      const detailRes = await competitionApi.getCompetitionById(competitionId);
      if (detailRes.success && detailRes.data) {
        setCompetition(detailRes.data);

        // 2. If INDIVIDUAL, fetch user's registration
        if (detailRes.data.competitionType === "INDIVIDUAL" && currentUserId) {
          const regRes = await competitionApi.getMyRegistration(competitionId, currentUserId);
          if (regRes.success) {
            setMyRegistration(regRes.data || null);
          }
        }

        // 3. If TEAM, fetch teams, invitations, and user's team details
        if (detailRes.data.competitionType === "TEAM") {
          const teamsRes = await competitionApi.getTeams(competitionId);
          if (teamsRes.success && teamsRes.data) {
            // Fetch detail for each team to get member list
            const detailedTeams: CompetitionTeamDetail[] = await Promise.all(
              teamsRes.data.map(async (t) => {
                try {
                  const d = await competitionApi.getTeamById(competitionId, t.teamId);
                  return d.data || { ...t, captainName: "", members: [] };
                } catch {
                  return { ...t, captainName: "", members: [] };
                }
              })
            );
            setTeams(detailedTeams);

            // Determine if current user belongs to any active team
            if (currentUserId) {
              const activeTeam = detailedTeams.find(
                (t) =>
                  t.status === "Active" &&
                  (t.captainUserId === currentUserId ||
                    t.members?.some((m) => m.userId === currentUserId))
              );
              setMyTeam(activeTeam || null);
              const userIsCaptain = activeTeam?.captainUserId === currentUserId;
              setIsCaptain(userIsCaptain);

              // If captain, fetch incoming join requests
              if (activeTeam && userIsCaptain) {
                try {
                  const reqRes = await competitionApi.getTeamJoinRequests(competitionId, activeTeam.teamId);
                  if (reqRes.success && reqRes.data) {
                    setTeamJoinRequests(reqRes.data as unknown as CompetitionTeamRequest[]);
                  }
                } catch {
                  setTeamJoinRequests([]);
                }
              }

              // Fetch my invitations
              try {
                const invRes = await competitionApi.getMyInvitations(competitionId);
                if (invRes.success && invRes.data) {
                  setMyInvitations(invRes.data as unknown as CompetitionTeamRequest[]);
                }
              } catch {
                setMyInvitations([]);
              }
            }
          }
        }

        // 4. Fetch judges
        try {
          const judgeRes = await competitionApi.getJudges(competitionId);
          if (judgeRes.success && judgeRes.data) {
            setJudges(judgeRes.data);
          }
        } catch {
          setJudges([]);
        }
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setErrorMsg(e.message || "Không thể tải thông tin cuộc thi.");
    } finally {
      setLoading(false);
    }
  }, [competitionId, currentUserId]);

  useEffect(() => {
    if (isOpen && competitionId) {
      loadData();
      setActiveTab(initialTab || "overview");
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, competitionId, loadData, initialTab]);

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setSuccessMsg(null);
    } else {
      setSuccessMsg(msg);
      setErrorMsg(null);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  // ── Individual Actions ─────────────────────────────────────
  const handleRegisterIndividual = async () => {
    if (!competitionId) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await competitionApi.registerIndividual(competitionId);
      if (res.success) {
        showNotification("Đăng ký cá nhân thành công! Trạng thái: Đang chờ duyệt.");
        await loadData();
        onStatusChanged?.();
      } else {
        showNotification(res.message || "Đăng ký không thành công.", true);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Đăng ký thất bại.", true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRegistration = async () => {
    if (!competitionId) return;
    if (!canCancelRegistration) {
      showNotification("Không thể hủy đăng ký khi cuộc thi đã diễn ra hoặc đã kết thúc.", true);
      return;
    }
    setActionLoading(true);
    try {
      const res = await competitionApi.cancelMyRegistration(
        competitionId,
        cancelReason || "Thí sinh tự hủy đăng ký"
      );
      if (res.success) {
        showNotification("Đã hủy đăng ký thành công.");
        setShowCancelModal(false);
        setCancelReason("");
        await loadData();
        onStatusChanged?.();
      } else {
        showNotification(res.message || "Hủy đăng ký thất bại.", true);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Hủy đăng ký thất bại.", true);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Team Actions ───────────────────────────────────────────
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!competitionId || !newTeamName.trim()) return;
    setActionLoading(true);
    try {
      const res = await competitionApi.createTeam(competitionId, { teamName: newTeamName.trim() });
      if (res.success) {
        showNotification(`Tạo đội "${newTeamName}" thành công! Bạn là Đội trưởng.`);
        setShowCreateTeamModal(false);
        setNewTeamName("");
        await loadData();
        onStatusChanged?.();
      } else {
        showNotification(res.message || "Không thể tạo đội.", true);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Không thể tạo đội.", true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdrawTeam = async () => {
    if (!competitionId || !myTeam) return;
    if (!canModifyTeam) {
      showNotification("Không thể rút đội khi cuộc thi đã diễn ra hoặc đã kết thúc.", true);
      return;
    }
    if (!window.confirm("Bạn có chắc chắn muốn rút đội khỏi cuộc thi? Hành động này không thể hoàn tác.")) return;

    setActionLoading(true);
    try {
      const res = await competitionApi.withdrawTeam(competitionId, myTeam.teamId);
      if (res.success) {
        showNotification("Đã rút đội khỏi cuộc thi thành công.");
        await loadData();
        onStatusChanged?.();
      } else {
        showNotification(res.message || "Rút đội thất bại.", true);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Rút đội thất bại.", true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveTeam = async () => {
    if (!competitionId || !myTeam) return;
    if (!canModifyTeam) {
      showNotification("Không thể rời đội khi cuộc thi đã diễn ra hoặc đã kết thúc.", true);
      return;
    }
    if (!window.confirm("Bạn có chắc chắn muốn rời khỏi đội?")) return;

    setActionLoading(true);
    try {
      const res = await competitionApi.leaveTeam(competitionId, myTeam.teamId);
      if (res.success) {
        showNotification("Đã rời đội thành công.");
        await loadData();
        onStatusChanged?.();
      } else {
        showNotification(res.message || "Rời đội thất bại.", true);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Rời đội thất bại.", true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleKickMember = async (memberUserId: number) => {
    if (!competitionId || !myTeam) return;
    if (!window.confirm("Bạn có chắc chắn muốn mời thành viên này ra khỏi đội?")) return;

    setActionLoading(true);
    try {
      const res = await competitionApi.removeTeamMember(competitionId, myTeam.teamId, memberUserId);
      if (res.success) {
        showNotification("Đã xóa thành viên khỏi đội.");
        await loadData();
        onStatusChanged?.();
      } else {
        showNotification(res.message || "Không thể xóa thành viên.", true);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Không thể xóa thành viên.", true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!competitionId || !myTeam || !inviteUserId.trim()) return;

    const targetUserId = parseInt(inviteUserId.trim(), 10);
    if (isNaN(targetUserId)) {
      showNotification("User ID phải là số hợp lệ.", true);
      return;
    }

    setActionLoading(true);
    try {
      const res = await competitionApi.sendTeamInvitation(competitionId, myTeam.teamId, {
        userId: targetUserId,
      });
      if (res.success) {
        showNotification("Đã gửi lời mời tham gia đội thành công.");
        setShowInviteModal(false);
        setInviteUserId("");
        await loadData();
      } else {
        showNotification(res.message || "Gửi lời mời thất bại.", true);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Gửi lời mời thất bại.", true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptInvitation = async (invitationId: number) => {
    if (!competitionId) return;
    setActionLoading(true);
    try {
      const res = await competitionApi.acceptInvitation(competitionId, invitationId);
      if (res.success) {
        showNotification("Đã tham gia đội thành công!");
        await loadData();
        onStatusChanged?.();
      } else {
        showNotification(res.message || "Chấp nhận lời mời thất bại.", true);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Chấp nhận lời mời thất bại.", true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectInvitation = async (invitationId: number) => {
    if (!competitionId) return;
    setActionLoading(true);
    try {
      const res = await competitionApi.rejectInvitation(competitionId, invitationId);
      if (res.success) {
        showNotification("Đã từ chối lời mời.");
        await loadData();
      } else {
        showNotification(res.message || "Từ chối lời mời thất bại.", true);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Từ chối lời mời thất bại.", true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinRequest = async (teamId: number) => {
    if (!competitionId) return;
    setActionLoading(true);
    try {
      const res = await competitionApi.createJoinRequest(competitionId, teamId);
      if (res.success) {
        showNotification("Đã gửi yêu cầu gia nhập đội! Vui lòng chờ Đội trưởng duyệt.");
        await loadData();
      } else {
        showNotification(res.message || "Gửi yêu cầu gia nhập thất bại.", true);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Gửi yêu cầu thất bại.", true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveJoinRequest = async (teamId: number, requestId: number) => {
    if (!competitionId) return;
    setActionLoading(true);
    try {
      const res = await competitionApi.approveJoinRequest(competitionId, teamId, requestId);
      if (res.success) {
        showNotification("Đã duyệt thành viên vào đội thành công!");
        await loadData();
        onStatusChanged?.();
      } else {
        showNotification(res.message || "Duyệt yêu cầu thất bại.", true);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Duyệt yêu cầu thất bại.", true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectJoinRequest = async (teamId: number, requestId: number) => {
    if (!competitionId) return;
    setActionLoading(true);
    try {
      const res = await competitionApi.rejectJoinRequest(competitionId, teamId, requestId);
      if (res.success) {
        showNotification("Đã từ chối yêu cầu gia nhập.");
        await loadData();
      } else {
        showNotification(res.message || "Từ chối yêu cầu thất bại.", true);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Từ chối yêu cầu thất bại.", true);
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  const isRegistrationOpen = competition?.status === "OpenRegistration";

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={competition?.title || "Chi tiết giải đấu"}
        maxWidth="max-w-4xl"
      >
        <div className="space-y-6">
          {/* Notifications */}
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl animate-fade-in">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl animate-fade-in">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <RefreshCw className="animate-spin text-[#008A64]" size={28} />
              <p className="text-xs text-slate-500 font-medium">Đang tải dữ liệu giải đấu...</p>
            </div>
          ) : competition ? (
            <>
              {/* Header Badges & Quick Info */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <CompetitionStatusBadge status={competition.status} />
                  <CompetitionTypeBadge type={competition.competitionType} />
                  {isCreator && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                      👑 Ban tổ chức (Bạn tạo)
                    </span>
                  )}
                  {!isCreator && isJudge && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-blue-100 border border-blue-300 px-2.5 py-0.5 rounded-full">
                      ⚖️ Giám khảo (Bạn)
                    </span>
                  )}
                  {competition.maxParticipants && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full">
                      <Users size={12} />
                      Tối đa {competition.maxParticipants}{" "}
                      {competition.competitionType === "TEAM" ? "đội" : "thí sinh"}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock size={13} />
                    <span>
                      Bắt đầu: {formatDateTime(competition.startDate)}
                    </span>
                  </div>

                  {isCreator && onOpenManage && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenManage(competition.competitionId);
                      }}
                      className="px-3 py-1.5 bg-[#008A64] hover:bg-[#007457] text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Mở bảng điều phối và quản trị giải đấu này"
                    >
                      <Settings size={13} />
                      <span>Quản lý cuộc thi</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Ongoing Status CTA Banner */}
              {competition.status === "Ongoing" && (
                <div
                  className={`rounded-2xl p-4 sm:p-5 transition-all shadow-xs border animate-fade-in ${
                    isParticipantApproved
                      ? "bg-gradient-to-r from-emerald-600 via-[#008A64] to-teal-700 text-white border-emerald-500 shadow-emerald-600/20"
                      : isOrganizerOrJudge
                      ? "bg-gradient-to-r from-slate-800 to-slate-900 text-white border-slate-700 shadow-slate-900/20"
                      : isParticipantPending
                      ? "bg-amber-50 border-amber-200 text-amber-900"
                      : "bg-blue-50 border-blue-200 text-blue-900"
                  }`}
                >
                  {isParticipantApproved ? (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                          </span>
                          <h4 className="font-extrabold text-sm sm:text-base tracking-wide flex items-center gap-2">
                            <span>CUỘC THI ĐANG DIỄN RA!</span>
                            <span className="text-[11px] font-bold bg-white/20 px-2 py-0.5 rounded-full">
                              Đã phê duyệt
                            </span>
                          </h4>
                        </div>
                        <p className="text-xs sm:text-sm text-emerald-50 leading-relaxed max-w-xl">
                          Đơn đăng ký của bạn đã được Ban tổ chức chấp thuận. Phòng tranh biện trực tiếp đã sẵn sàng để bạn tham gia thi đấu!
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab("bracket")}
                        className="px-5 py-2.5 bg-white text-[#008A64] hover:bg-emerald-50 font-black text-xs sm:text-sm rounded-xl shadow-md transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                      >
                        <Swords size={16} />
                        <span>Xem cây thi đấu & Trận của bạn</span>
                      </button>
                    </div>
                  ) : isOrganizerOrJudge ? (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
                          </span>
                          <h4 className="font-extrabold text-sm sm:text-base tracking-wide">
                            CUỘC THI ĐANG DIỄN RA ({isCreator ? "BAN TỔ CHỨC" : "GIÁM KHẢO"})
                          </h4>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
                          Bạn có thể theo dõi tiến độ từng cặp đấu trên cây thi đấu, mở trang giám sát hoặc thực hiện chấm điểm trận.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setActiveTab("bracket")}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Swords size={14} />
                          <span>Cây thi đấu & Giám sát</span>
                        </button>
                        {isCreator && onOpenManage && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenManage(competition.competitionId);
                            }}
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Settings size={14} />
                            <span>Bảng quản trị</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : isParticipantPending ? (
                    <div className="flex items-start gap-3">
                      <Clock size={20} className="text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="font-bold text-xs sm:text-sm text-amber-900">
                          Cuộc thi đang diễn ra nhưng đơn của bạn đang chờ phê duyệt
                        </p>
                        <p className="text-xs text-amber-700 leading-relaxed">
                          Ban tổ chức đang xem xét đơn đăng ký của bạn. Bạn sẽ có quyền vào phòng tranh biện ngay sau khi đơn được duyệt.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <Trophy size={20} className="text-blue-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="font-bold text-xs sm:text-sm text-blue-900">
                          Giải đấu đang diễn ra các trận tranh biện
                        </p>
                        <p className="text-xs text-blue-700 leading-relaxed">
                          Thời gian diễn ra: {formatDateTime(competition.startDate)}.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Champion Banner if completed */}
              {competition.status === "Completed" && (
                <CompetitionChampionBanner
                  championName={competition.championName}
                  championUserId={competition.championUserId}
                  championTeamId={competition.championTeamId}
                  competitionTitle={competition.title}
                  competitionType={competition.competitionType}
                />
              )}

              {/* Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("overview")}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                    activeTab === "overview"
                      ? "bg-[#008A64] text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Tổng quan & Thể lệ
                </button>

                {competition.competitionType === "INDIVIDUAL" && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("registration")}
                    className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                      activeTab === "registration"
                        ? "bg-[#008A64] text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Đăng ký cá nhân
                    {myRegistration && (
                      <span className="ml-1.5 px-1.5 py-0.2 bg-white/20 rounded-md text-[10px]">
                        {myRegistration.status}
                      </span>
                    )}
                  </button>
                )}

                {competition.competitionType === "TEAM" && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("teams")}
                    className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                      activeTab === "teams"
                        ? "bg-[#008A64] text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Đội thi đấu ({teams.length})
                    {myTeam && (
                      <span className="ml-1.5 px-1.5 py-0.2 bg-emerald-500 text-white rounded-md text-[10px]">
                        Đội của bạn
                      </span>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveTab("judges")}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                    activeTab === "judges"
                      ? "bg-[#008A64] text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Giám khảo ({judges.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("bracket")}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                    activeTab === "bracket"
                      ? "bg-[#008A64] text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Swords size={13} />
                    Cây thi đấu & Trận đấu
                  </span>
                </button>
              </div>

              {/* Tab 1: Overview */}
              {activeTab === "overview" && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Mô tả giải đấu
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-white p-4 rounded-xl border border-slate-200">
                      {competition.description || "Chưa có mô tả chi tiết cho cuộc thi này."}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                      <p className="font-bold text-slate-700 flex items-center gap-1.5">
                        <Calendar size={14} className="text-[#008A64]" />
                        Thời gian đăng ký
                      </p>
                      <p className="text-slate-600">
                        {formatDateTime(competition.registrationStart)}
                      </p>
                      <p className="text-slate-600">
                        đến {formatDateTime(competition.registrationEnd)}
                      </p>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                      <p className="font-bold text-slate-700 flex items-center gap-1.5">
                        <Trophy size={14} className="text-amber-500" />
                        Thời gian diễn ra
                      </p>
                      <p className="text-slate-600">
                        Bắt đầu: {formatDateTime(competition.startDate)}
                      </p>
                      {competition.endDate && (
                        <p className="text-slate-600">
                          Kết thúc: {formatDateTime(competition.endDate)}
                        </p>
                      )}
                    </div>
                  </div>

                  {competition.createdByName && (
                    <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-xs text-slate-600 flex items-center justify-between">
                      <span>
                        Người khởi tạo / Ban tổ chức:{" "}
                        <strong className="text-slate-800">{competition.createdByName}</strong>
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Tạo ngày {formatDate(competition.createdAt)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Individual Registration */}
              {activeTab === "registration" && competition.competitionType === "INDIVIDUAL" && (
                <div className="space-y-4">
                  {myRegistration ? (
                    <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={20} className="text-[#008A64]" />
                          <h4 className="font-bold text-sm text-slate-900">
                            Trạng thái đăng ký của bạn
                          </h4>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${
                            myRegistration.status === "Approved"
                              ? "bg-emerald-100 text-emerald-800"
                              : myRegistration.status === "Pending"
                              ? "bg-amber-100 text-amber-800"
                              : myRegistration.status === "Rejected"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {myRegistration.status === "Approved"
                            ? "Đã duyệt"
                            : myRegistration.status === "Pending"
                            ? "Đang chờ duyệt"
                            : myRegistration.status === "Rejected"
                            ? "Bị từ chối"
                            : "Đã hủy"}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl">
                        <p>Họ tên: <strong>{myRegistration.userName}</strong></p>
                        <p>Email: <strong>{myRegistration.userEmail}</strong></p>
                        <p>
                          Thời gian đăng ký:{" "}
                          <strong>{formatDateTime(myRegistration.registeredAt)}</strong>
                        </p>
                        {myRegistration.note && (
                          <p className="text-amber-800 mt-2 font-medium">
                            Ghi chú từ BTC: {myRegistration.note}
                          </p>
                        )}
                      </div>

                      {competition.status === "Ongoing" && myRegistration.status === "Approved" && (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                          <p className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                            <Swords size={16} className="text-[#008A64]" />
                            Phòng thi đấu tranh biện đã mở
                          </p>
                          <p className="text-xs text-emerald-700 leading-relaxed">
                            Cuộc thi đang diễn ra. Bạn đã được Ban tổ chức phê duyệt hợp lệ. Nhấn nút bên dưới để vào phòng thi đấu tranh biện ngay.
                          </p>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setActiveTab("bracket")}
                            className="bg-[#008A64] hover:bg-[#007457] font-bold text-xs"
                          >
                            <Swords size={14} className="mr-1.5" />
                            Xem nhánh đấu & Trận của tôi
                          </Button>
                        </div>
                      )}

                      {competition.status === "Completed" && (
                        <div className="p-3 bg-purple-50 border border-purple-200 text-purple-900 rounded-xl text-xs flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-purple-600 shrink-0" />
                          <span>Cuộc thi đã hoàn thành. Cảm ơn bạn đã tham gia giải đấu!</span>
                        </div>
                      )}

                      {canCancelRegistration && (
                        <div className="pt-2">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setShowCancelModal(true)}
                            disabled={actionLoading}
                          >
                            Hủy đăng ký
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : isOrganizerOrJudge ? (
                    <div className="p-6 bg-emerald-50/70 border border-[#008A64]/30 rounded-2xl text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-[#008A64]/10 text-[#008A64] flex items-center justify-center mx-auto">
                        <Shield size={24} />
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        Bạn là {isCreator ? "Ban tổ chức (Người tạo)" : "Giám khảo"} của giải đấu này
                      </h4>
                      <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                        Với vai trò {isCreator ? "người khởi tạo và điều phối giải đấu" : "giám khảo chấm thi"}, bạn không tham gia thi đấu với tư cách thí sinh để đảm bảo tính công bằng và minh bạch.
                      </p>
                      {onOpenManage && (
                        <div className="pt-2">
                          <Button
                            variant="primary"
                            onClick={() => {
                              onClose();
                              onOpenManage(competition.competitionId);
                            }}
                          >
                            <Settings size={14} className="mr-1.5" />
                            Mở Bảng Quản trị & Xét duyệt
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-3">
                      <Trophy size={36} className="mx-auto text-[#008A64]" />
                      <h4 className="font-bold text-slate-900 text-sm">
                        Bạn chưa đăng ký tham gia giải đấu này
                      </h4>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Giải đấu cá nhân. Khi đăng ký, thông tin của bạn sẽ được gửi tới Ban tổ chức và Ban giám khảo để xét duyệt.
                      </p>

                      {isRegistrationOpen ? (
                        <Button
                          variant="primary"
                          onClick={handleRegisterIndividual}
                          disabled={actionLoading}
                          className="mt-2"
                        >
                          {actionLoading ? "Đang xử lý..." : "Đăng ký tham gia ngay"}
                        </Button>
                      ) : (
                        <p className="text-xs font-bold text-amber-600 bg-amber-50 py-2 px-3 rounded-xl inline-block border border-amber-200">
                          Giải đấu hiện không ở trạng thái mở đăng ký.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Teams */}
              {activeTab === "teams" && competition.competitionType === "TEAM" && (
                <div className="space-y-5">
                  {/* Notice of Rules */}
                  <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-xl flex items-start gap-2">
                    <Shield size={16} className="shrink-0 mt-0.5" />
                    <div>
                      <strong>Quy định giải đấu đội:</strong> Mỗi đội gồm tối đa 2 thành viên (1 Đội trưởng + 1 Thành viên). Một người dùng chỉ thuộc 1 đội đang hoạt động trong giải đấu.
                    </div>
                  </div>

                  {/* My Team Section */}
                  {myTeam ? (
                    <div className="p-5 bg-gradient-to-br from-emerald-50/80 to-teal-50/40 border border-[#008A64]/30 rounded-2xl space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#008A64]">
                            {isCaptain ? "Bạn là Đội trưởng" : "Bạn là Thành viên"}
                          </span>
                          <h4 className="text-base font-black text-slate-900">
                            Đội: {myTeam.teamName}
                          </h4>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#008A64] text-white">
                          Trạng thái: {myTeam.status}
                        </span>
                      </div>

                      {/* Members list */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {/* Captain slot */}
                        <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                          <span className="text-[10px] font-bold text-amber-600 uppercase">
                            👑 Đội trưởng
                          </span>
                          <p className="font-bold text-slate-800 text-sm">
                            {myTeam.captainName || `User #${myTeam.captainUserId}`}
                          </p>
                          {isCaptain && <span className="text-[10px] text-[#008A64] font-bold">(Bạn)</span>}
                        </div>

                        {/* Member slot */}
                        <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">
                            👥 Thành viên
                          </span>
                          {myTeam.members && myTeam.members.length > 0 ? (
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-bold text-slate-800 text-sm">
                                  {myTeam.members[0].fullName || myTeam.members[0].email}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  Gia nhập: {formatDate(myTeam.members[0].joinedAt)}
                                </p>
                              </div>
                              {isCaptain && (
                                <button
                                  type="button"
                                  onClick={() => handleKickMember(myTeam.members[0].userId)}
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-colors"
                                  title="Mời ra khỏi đội"
                                  disabled={actionLoading}
                                >
                                  <UserX size={15} />
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-between py-1">
                              <span className="text-slate-400 italic">Chưa có thành viên (1/2)</span>
                              {isCaptain && isRegistrationOpen && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setShowInviteModal(true)}
                                  className="text-xs"
                                >
                                  <UserPlus size={13} className="mr-1" />
                                  Mời
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Team Join Requests (For Captain) */}
                      {isCaptain && (
                        <div className="space-y-2 pt-2 border-t border-slate-200/60">
                          <h5 className="text-xs font-bold text-slate-700">
                            Yêu cầu xin gia nhập ({teamJoinRequests.filter((r) => r.status === "Pending").length})
                          </h5>
                          {teamJoinRequests.filter((r) => r.status === "Pending").length === 0 ? (
                            <p className="text-[11px] text-slate-400">Chưa có yêu cầu xin vào đội nào.</p>
                          ) : (
                            <div className="space-y-2">
                              {teamJoinRequests
                                .filter((r) => r.status === "Pending")
                                .map((req) => (
                                  <div
                                    key={req.requestId}
                                    className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl text-xs"
                                  >
                                    <div>
                                      <p className="font-bold text-slate-800">{req.userName}</p>
                                      <p className="text-[10px] text-slate-400">
                                        Gửi lúc: {formatDateTime(req.createdAt)}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleApproveJoinRequest(myTeam.teamId, req.requestId)}
                                        className="px-2.5 py-1 bg-[#008A64] hover:bg-[#007457] text-white rounded-lg font-bold text-xs flex items-center gap-1"
                                        disabled={actionLoading}
                                      >
                                        <CheckCircle2 size={13} /> Duyệt
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRejectJoinRequest(myTeam.teamId, req.requestId)}
                                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-bold text-xs flex items-center gap-1"
                                        disabled={actionLoading}
                                      >
                                        <XCircle size={13} /> Từ chối
                                      </button>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      )}

                      {competition.status === "Ongoing" && (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                          <p className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                            <Swords size={16} className="text-[#008A64]" />
                            Phòng thi đấu tranh biện đồng đội đã mở
                          </p>
                          <p className="text-xs text-emerald-700 leading-relaxed">
                            Cuộc thi đang diễn ra. Cả Đội trưởng và thành viên hãy vào phòng tranh biện để phối hợp thi đấu.
                          </p>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setActiveTab("bracket")}
                            className="bg-[#008A64] hover:bg-[#007457] font-bold text-xs"
                          >
                            <Swords size={14} className="mr-1.5" />
                            Xem nhánh đấu & Trận của tôi
                          </Button>
                        </div>
                      )}

                      {/* Captain & Member Control Actions */}
                      {canModifyTeam && (
                        <div className="flex items-center justify-between pt-2">
                          {isCaptain ? (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={handleWithdrawTeam}
                              disabled={actionLoading}
                            >
                              <LogOut size={13} className="mr-1" />
                              Rút đội khỏi giải
                            </Button>
                          ) : (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={handleLeaveTeam}
                              disabled={actionLoading}
                            >
                              <LogOut size={13} className="mr-1" />
                              Rời đội
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* User has NO active team */
                    <div className="space-y-4">
                      {isOrganizerOrJudge && (
                        <div className="p-4 bg-emerald-50/70 border border-[#008A64]/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">
                              Bạn là {isCreator ? "Ban tổ chức (Người tạo)" : "Giám khảo"} của giải đấu này
                            </h4>
                            <p className="text-xs text-slate-600 mt-0.5">
                              Bạn có thể tạo đội thi để tham gia hoặc chuyển sang Bảng Quản trị để điều phối và xét duyệt giải đấu.
                            </p>
                          </div>
                          {onOpenManage && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                onClose();
                                onOpenManage(competition.competitionId);
                              }}
                              className="shrink-0"
                            >
                              <Settings size={14} className="mr-1.5" />
                              Quản lý các đội thi
                            </Button>
                          )}
                        </div>
                      )}
                      <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">
                            Bạn chưa tham gia đội thi nào
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Bạn có thể tạo đội mới làm Đội trưởng hoặc xin gia nhập vào một đội còn trống.
                          </p>
                        </div>
                        {isRegistrationOpen && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setShowCreateTeamModal(true)}
                          >
                            <PlusCircle size={14} className="mr-1.5" />
                            Tạo đội mới
                          </Button>
                        )}
                      </div>

                      {/* My Pending Invitations */}
                      {myInvitations.filter((inv) => inv.status === "Pending").length > 0 && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
                          <h5 className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                            <Send size={13} />
                            Lời mời tham gia đội gửi tới bạn
                          </h5>
                          <div className="space-y-2">
                            {myInvitations
                              .filter((inv) => inv.status === "Pending")
                              .map((inv) => (
                                <div
                                  key={inv.requestId}
                                  className="flex items-center justify-between p-3 bg-white border border-amber-200/80 rounded-xl text-xs"
                                >
                                  <div>
                                    <p className="font-bold text-slate-800">
                                      Đội: {inv.teamName}
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                      Người mời: {inv.createdByName}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleAcceptInvitation(inv.requestId)}
                                      className="px-3 py-1.5 bg-[#008A64] hover:bg-[#007457] text-white rounded-lg font-bold text-xs"
                                      disabled={actionLoading}
                                    >
                                      Chấp nhận
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRejectInvitation(inv.requestId)}
                                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-bold text-xs"
                                      disabled={actionLoading}
                                    >
                                      Từ chối
                                    </button>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* All Teams in Competition */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Danh sách các đội tham gia ({teams.length})
                    </h4>
                    {teams.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-4 text-center">
                        Chưa có đội nào đăng ký tham gia cuộc thi này.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {teams.map((team) => {
                          const memberCount = 1 + (team.members?.length || 0);
                          const isFull = memberCount >= 2;
                          const isMyTeamItem = myTeam?.teamId === team.teamId;

                          return (
                            <div
                              key={team.teamId}
                              className={`p-4 rounded-xl border transition-all ${
                                isMyTeamItem
                                  ? "bg-emerald-50/50 border-[#008A64]"
                                  : "bg-white border-slate-200 hover:border-slate-300"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h5 className="font-bold text-slate-900 text-sm">
                                  {team.teamName}
                                </h5>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isFull
                                      ? "bg-slate-100 text-slate-600"
                                      : "bg-emerald-50 text-[#008A64] border border-emerald-200"
                                  }`}
                                >
                                  {memberCount}/2 thành viên
                                </span>
                              </div>

                              <div className="text-xs text-slate-500 space-y-1">
                                <p>
                                  👑 Đội trưởng:{" "}
                                  <strong className="text-slate-700">
                                    {team.captainName || `User #${team.captainUserId}`}
                                  </strong>
                                </p>
                                {team.members && team.members.length > 0 && (
                                  <p>
                                    👥 Thành viên:{" "}
                                    <strong className="text-slate-700">
                                      {team.members[0].fullName || team.members[0].email}
                                    </strong>
                                  </p>
                                )}
                              </div>

                              {/* Join Request Button for non-team users */}
                              {!myTeam && !isFull && isRegistrationOpen && (
                                <div className="mt-3 pt-2 border-t border-slate-100">
                                  <button
                                    type="button"
                                    onClick={() => handleJoinRequest(team.teamId)}
                                    className="w-full py-1.5 px-3 bg-slate-100 hover:bg-[#008A64] hover:text-white text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                                    disabled={actionLoading}
                                  >
                                    <UserPlus size={13} />
                                    Gửi yêu cầu xin gia nhập
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 4: Judges */}
              {activeTab === "judges" && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Ban giám khảo của cuộc thi
                  </h4>
                  {judges.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4 text-center">
                      Chưa có giám khảo nào được phân công.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {judges.map((judge) => (
                        <div
                          key={judge.competitionJudgeId}
                          className="flex items-center gap-3 p-3.5 bg-white border border-slate-200 rounded-xl"
                        >
                          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 font-black text-sm flex items-center justify-center">
                            {judge.fullName ? judge.fullName.charAt(0).toUpperCase() : "J"}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-xs sm:text-sm">
                              {judge.fullName || judge.email}
                            </p>
                            <p className="text-[11px] text-slate-400">{judge.email}</p>
                            <span className="text-[10px] text-purple-600 font-semibold">
                              Giám khảo chính thức
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 5: Bracket & Matches */}
              {activeTab === "bracket" && (
                <div className="pt-2">
                  <CompetitionBracketView
                    competition={competition}
                    isOrganizer={isCreator}
                    judges={judges}
                    currentUserId={currentUser?.userId}
                  />
                </div>
              )}
            </>
          ) : null}
        </div>
      </Modal>

      {/* Modal: Cancel Registration Reason */}
      {showCancelModal && (
        <Modal
          isOpen={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          title="Xác nhận hủy đăng ký"
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Vui lòng cho biết lý do bạn muốn hủy đăng ký tham gia cuộc thi này:
            </p>
            <textarea
              className="w-full p-3 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#008A64] focus:outline-hidden"
              rows={3}
              placeholder="Nhập lý do hủy đăng ký..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCancelModal(false)}>
                Đóng
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleCancelRegistration}
                disabled={actionLoading}
              >
                {actionLoading ? "Đang hủy..." : "Xác nhận hủy"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Create Team */}
      {showCreateTeamModal && (
        <Modal
          isOpen={showCreateTeamModal}
          onClose={() => setShowCreateTeamModal(false)}
          title="Tạo đội thi mới"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleCreateTeam} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tên đội thi <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#008A64] focus:outline-hidden"
                placeholder="Ví dụ: Đội Rồng Vàng, Alpha Debaters..."
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Bạn sẽ tự động là Đội trưởng của đội này và có quyền mời 1 thành viên.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowCreateTeamModal(false)}>
                Hủy
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={actionLoading || !newTeamName.trim()}>
                {actionLoading ? "Đang tạo..." : "Tạo đội"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Invite User */}
      {showInviteModal && (
        <Modal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          title="Mời thành viên vào đội"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleSendInvitation} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ID người dùng (UserId) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#008A64] focus:outline-hidden"
                placeholder="Nhập ID người dùng muốn mời (Ví dụ: 2)"
                value={inviteUserId}
                onChange={(e) => setInviteUserId(e.target.value)}
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Người được mời sẽ nhận được thông báo lời mời và có thể chấp nhận để gia nhập đội.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowInviteModal(false)}>
                Đóng
              </Button>
              <Button variant="primary" size="sm" type="submit" disabled={actionLoading || !inviteUserId.trim()}>
                {actionLoading ? "Đang gửi..." : "Gửi lời mời"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};

export default CompetitionDetailModal;

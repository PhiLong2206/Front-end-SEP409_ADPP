import React, { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Play,
  CheckCheck,
  Ban,
  Trash2,
  Edit,
  UserPlus,
  RefreshCw,
  DoorOpen,
  DoorClosed,
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
  CompetitionJudge,
} from "../../types";
import CompetitionBracketView from "./CompetitionBracketView";
import CompetitionChampionBanner from "./CompetitionChampionBanner";

interface Props {
  competitionId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (competition: CompetitionDetail) => void;
  onUpdated: () => void;
}

const CompetitionAdminDetailModal: React.FC<Props> = ({
  competitionId,
  isOpen,
  onClose,
  onEdit,
  onUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<"overview" | "registrations" | "teams" | "judges" | "bracket">("overview");
  const [competition, setCompetition] = useState<CompetitionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Registrations state (for INDIVIDUAL)
  const [registrations, setRegistrations] = useState<CompetitionRegistration[]>([]);
  const [regStatusFilter, setRegStatusFilter] = useState<string>("all");

  // Teams state (for TEAM)
  const [teams, setTeams] = useState<CompetitionTeamDetail[]>([]);

  // Judges state
  const [judges, setJudges] = useState<CompetitionJudge[]>([]);
  const [showAddJudgeModal, setShowAddJudgeModal] = useState(false);
  const [judgeUserId, setJudgeUserId] = useState("");

  // Reject / Remove participant modal
  const [actionModalType, setActionModalType] = useState<"reject" | "remove" | null>(null);
  const [selectedReg, setSelectedReg] = useState<CompetitionRegistration | null>(null);
  const [reasonNote, setReasonNote] = useState("");

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

  const loadData = useCallback(async () => {
    if (!competitionId) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const detailRes = await competitionApi.getCompetitionById(competitionId);
      if (detailRes.success && detailRes.data) {
        setCompetition(detailRes.data);

        // If individual, load registrations
        if (detailRes.data.competitionType === "INDIVIDUAL") {
          try {
            const regRes = await competitionApi.getRegistrations(competitionId);
            if (regRes.success && regRes.data) {
              setRegistrations(regRes.data);
            }
          } catch {
            setRegistrations([]);
          }
        }

        // If team, load teams and their member details
        if (detailRes.data.competitionType === "TEAM") {
          try {
            const teamRes = await competitionApi.getTeams(competitionId);
            if (teamRes.success && teamRes.data) {
              const detailedTeams: CompetitionTeamDetail[] = await Promise.all(
                teamRes.data.map(async (t) => {
                  try {
                    const d = await competitionApi.getTeamById(competitionId, t.teamId);
                    return d.data || { ...t, captainName: "", members: [] };
                  } catch {
                    return { ...t, captainName: "", members: [] };
                  }
                })
              );
              setTeams(detailedTeams);
            }
          } catch {
            setTeams([]);
          }
        }

        // Load judges
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
      setErrorMsg(e.message || "Không thể tải dữ liệu cuộc thi.");
    } finally {
      setLoading(false);
    }
  }, [competitionId]);

  useEffect(() => {
    if (isOpen && competitionId) {
      loadData();
      setActiveTab("overview");
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, competitionId, loadData]);

  // ── Lifecycle Transitions ────────────────────────────────────
  const handleOpenRegistration = async () => {
    if (!competitionId) return;
    setActionLoading(true);
    try {
      const res = await competitionApi.openRegistration(competitionId);
      if (res.success) {
        showNotification("Đã mở đăng ký cho cuộc thi!");
        await loadData();
        onUpdated();
      } else {
        showNotification(res.message || "Mở đăng ký thất bại.", true);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Mở đăng ký thất bại.", true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseRegistration = async () => {
    if (!competitionId) return;
    setActionLoading(true);
    try {
      const res = await competitionApi.closeRegistration(competitionId);
      if (res.success) {
        showNotification("Đã đóng đăng ký cuộc thi.");
        await loadData();
        onUpdated();
      } else {
        showNotification(res.message || "Đóng đăng ký thất bại.", true);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Đóng đăng ký thất bại.", true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartCompetition = async () => {
    if (!competitionId || !competition) return;

    const approvedCount =
      competition.competitionType === "INDIVIDUAL"
        ? registrations.filter((r) => r.status === "Approved").length
        : teams.filter((t) => t.status === "Approved" || t.status === "Active").length;

    if (approvedCount === 0) {
      const confirmStart = window.confirm(
        "Cảnh báo: Hiện chưa có thí sinh/đội thi nào được Ban tổ chức phê duyệt (Approved) trong danh sách!\n\nBạn có chắc chắn muốn bắt đầu cuộc thi ngay bây giờ không?"
      );
      if (!confirmStart) return;
    }

    setActionLoading(true);
    try {
      const res = await competitionApi.startCompetition(competitionId);
      if (res.success) {
        showNotification("Đã bắt đầu cuộc thi! Trạng thái chuyển sang Đang diễn ra.");
        await loadData();
        onUpdated();
      } else {
        showNotification(res.message || "Bắt đầu cuộc thi thất bại.", true);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Bắt đầu cuộc thi thất bại.", true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteCompetition = async () => {
    if (!competitionId) return;
    if (!window.confirm("Bạn có chắc chắn muốn đánh dấu cuộc thi này là Đã hoàn thành?")) return;

    setActionLoading(true);
    try {
      const res = await competitionApi.completeCompetition(competitionId);
      if (res.success) {
        showNotification("Cuộc thi đã kết thúc thành công!");
        await loadData();
        onUpdated();
      } else {
        showNotification(res.message || "Kết thúc cuộc thi thất bại.", true);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Kết thúc cuộc thi thất bại.", true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelCompetition = async () => {
    if (!competitionId) return;
    if (!window.confirm("Bạn có chắc chắn muốn HỦY cuộc thi này? Hành động này sẽ dừng toàn bộ hoạt động của giải đấu.")) return;

    setActionLoading(true);
    try {
      const res = await competitionApi.cancelCompetition(competitionId);
      if (res.success) {
        showNotification("Cuộc thi đã bị hủy.");
        await loadData();
        onUpdated();
      } else {
        showNotification(res.message || "Hủy cuộc thi thất bại.", true);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Hủy cuộc thi thất bại.", true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCompetition = async () => {
    if (!competitionId) return;
    if (!window.confirm("Bạn có chắc chắn muốn HỦY cuộc thi này?")) return;

    setActionLoading(true);
    try {
      const res = await competitionApi.cancelCompetition(competitionId);
      if (res.success) {
        showNotification("Đã hủy cuộc thi thành công.");
        onUpdated();
        onClose();
      } else {
        showNotification(res.message || "Hủy cuộc thi thất bại.", true);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Hủy cuộc thi thất bại.", true);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Registration Review (INDIVIDUAL) ──────────────────────────
  const handleApproveRegistration = async (regId: number) => {
    if (!competitionId) return;
    setActionLoading(true);
    try {
      const res = await competitionApi.approveRegistration(competitionId, regId);
      if (res.success) {
        showNotification("Đã duyệt đơn đăng ký của thí sinh!");
        await loadData();
      } else {
        showNotification(res.message || "Duyệt đơn thất bại.", true);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Duyệt đơn thất bại.", true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmRejectOrRemove = async () => {
    if (!competitionId || !selectedReg || !reasonNote.trim()) {
      showNotification("Vui lòng nhập lý do.", true);
      return;
    }

    setActionLoading(true);
    try {
      if (actionModalType === "reject") {
        const res = await competitionApi.rejectRegistration(
          competitionId,
          selectedReg.registrationId,
          reasonNote.trim()
        );
        if (res.success) {
          showNotification("Đã từ chối đơn đăng ký.");
          setActionModalType(null);
          setSelectedReg(null);
          setReasonNote("");
          await loadData();
        } else {
          showNotification(res.message || "Từ chối thất bại.", true);
        }
      } else if (actionModalType === "remove") {
        const res = await competitionApi.removeParticipant(
          competitionId,
          selectedReg.registrationId,
          reasonNote.trim()
        );
        if (res.success) {
          showNotification("Đã loại thí sinh khỏi giải đấu.");
          setActionModalType(null);
          setSelectedReg(null);
          setReasonNote("");
          await loadData();
        } else {
          showNotification(res.message || "Loại thí sinh thất bại.", true);
        }
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Thao tác thất bại.", true);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Judge Actions ───────────────────────────────────────────
  const handleAddJudge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!competitionId || !judgeUserId.trim()) return;

    const uId = parseInt(judgeUserId.trim(), 10);
    if (isNaN(uId)) {
      showNotification("User ID phải là số hợp lệ.", true);
      return;
    }

    setActionLoading(true);
    try {
      const res = await competitionApi.addJudge(competitionId, { userId: uId });
      if (res.success) {
        showNotification("Đã thêm giám khảo thành công.");
        setShowAddJudgeModal(false);
        setJudgeUserId("");
        await loadData();
      } else {
        showNotification(res.message || "Thêm giám khảo thất bại.", true);
      }
    } catch (err: unknown) {
      const e = err as { message?: string; response?: { status?: number } };
      if (e.response?.status === 405 || e.response?.status === 404) {
        showNotification("Backend chưa có API thêm giám khảo thủ công (Người tạo cuộc thi đã được hệ thống tự động gán làm giám khảo chính).", true);
      } else {
        showNotification(e.message || "Thêm giám khảo thất bại.", true);
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredRegistrations = registrations.filter((r) =>
    regStatusFilter === "all" ? true : r.status.toLowerCase() === regStatusFilter.toLowerCase()
  );

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={competition ? `Quản lý giải đấu: ${competition.title}` : "Quản lý giải đấu"}
        maxWidth="max-w-4xl"
      >
        <div className="space-y-6">
          {/* Notifications */}
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <RefreshCw className="animate-spin text-[#008A64]" size={28} />
              <p className="text-xs text-slate-500 font-medium">Đang tải dữ liệu quản lý...</p>
            </div>
          ) : competition ? (
            <>
              {/* Header Status & Lifecycle Control Bar */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CompetitionStatusBadge status={competition.status} />
                    <CompetitionTypeBadge type={competition.competitionType} />
                    <span className="text-xs text-slate-500 font-mono">
                      ID: #{competition.competitionId}
                    </span>
                  </div>

                  {/* Edit button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(competition)}
                    className="text-xs"
                  >
                    <Edit size={13} className="mr-1" />
                    Chỉnh sửa thông tin
                  </Button>
                </div>

                {/* Lifecycle Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80">
                  <span className="text-xs font-bold text-slate-600 mr-1">Chuyển trạng thái:</span>

                  {competition.status === "Draft" && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleOpenRegistration}
                        disabled={actionLoading}
                        className="text-xs"
                      >
                        <DoorOpen size={14} className="mr-1" />
                        Mở đăng ký
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={handleDeleteCompetition}
                        disabled={actionLoading}
                        className="text-xs"
                      >
                        <Trash2 size={13} className="mr-1" />
                        Xóa giải đấu
                      </Button>
                    </>
                  )}

                  {competition.status === "OpenRegistration" && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleCloseRegistration}
                        disabled={actionLoading}
                        className="text-xs bg-amber-500 hover:bg-amber-600 text-white"
                      >
                        <DoorClosed size={14} className="mr-1" />
                        Đóng đăng ký
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={handleCancelCompetition}
                        disabled={actionLoading}
                        className="text-xs"
                      >
                        <Ban size={13} className="mr-1" />
                        Hủy giải đấu
                      </Button>
                    </>
                  )}

                  {competition.status === "RegistrationClosed" && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleStartCompetition}
                        disabled={actionLoading}
                        className="text-xs bg-blue-600 hover:bg-blue-700"
                      >
                        <Play size={14} className="mr-1" />
                        Bắt đầu cuộc thi
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab("bracket")}
                        className="text-xs border-[#008A64] text-[#008A64] hover:bg-emerald-50 font-bold"
                      >
                        <Swords size={13} className="mr-1" />
                        Cây thi đấu & Bốc thăm
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={handleCancelCompetition}
                        disabled={actionLoading}
                        className="text-xs"
                      >
                        <Ban size={13} className="mr-1" />
                        Hủy giải đấu
                      </Button>
                    </>
                  )}

                  {competition.status === "Ongoing" && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleCompleteCompetition}
                        disabled={actionLoading}
                        className="text-xs bg-purple-600 hover:bg-purple-700"
                      >
                        <CheckCheck size={14} className="mr-1" />
                        Hoàn thành cuộc thi
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab("bracket")}
                        className="text-xs border-[#008A64] text-[#008A64] hover:bg-emerald-50 font-bold"
                      >
                        <Swords size={13} className="mr-1" />
                        Cây thi đấu & Giám sát trận
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={handleCancelCompetition}
                        disabled={actionLoading}
                        className="text-xs"
                      >
                        <Ban size={13} className="mr-1" />
                        Hủy giải đấu
                      </Button>
                    </>
                  )}

                  {(competition.status === "Completed" || competition.status === "Cancelled") && (
                    <span className="text-xs text-slate-400 italic">
                      Giải đấu đã kết thúc, không thể thay đổi trạng thái vòng đời.
                    </span>
                  )}
                </div>
              </div>

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
                  Tổng quan
                </button>

                {competition.competitionType === "INDIVIDUAL" && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("registrations")}
                    className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                      activeTab === "registrations"
                        ? "bg-[#008A64] text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Thí sinh đăng ký ({registrations.length})
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
                    Đội tham gia ({teams.length})
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

              {/* Tab: Overview */}
              {activeTab === "overview" && (
                <div className="space-y-4 text-xs">
                  <div>
                    <h4 className="font-bold text-slate-400 uppercase tracking-wider mb-1">Mô tả</h4>
                    <p className="p-3 bg-white border border-slate-200 rounded-xl text-slate-700 whitespace-pre-line leading-relaxed">
                      {competition.description || "Chưa có mô tả."}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <p className="font-bold text-slate-700">Thời gian đăng ký</p>
                      <p className="text-slate-600">
                        {formatDateTime(competition.registrationStart)}
                      </p>
                      <p className="text-slate-600">
                        đến {formatDateTime(competition.registrationEnd)}
                      </p>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <p className="font-bold text-slate-700">Thời gian thi đấu</p>
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
                </div>
              )}

              {/* Tab: Registrations (INDIVIDUAL) */}
              {activeTab === "registrations" && competition.competitionType === "INDIVIDUAL" && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {(["all", "pending", "approved", "rejected", "cancelled"] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setRegStatusFilter(s)}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                            regStatusFilter === s
                              ? "bg-[#008A64] text-white"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {s === "all"
                            ? "Tất cả"
                            : s === "pending"
                            ? "Chờ duyệt"
                            : s === "approved"
                            ? "Đã duyệt"
                            : s === "rejected"
                            ? "Từ chối"
                            : "Đã hủy"}
                        </button>
                      ))}
                    </div>

                    <span className="text-xs text-slate-400">
                      Hiển thị {filteredRegistrations.length} / {registrations.length} thí sinh
                    </span>
                  </div>

                  {filteredRegistrations.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-6 text-center">
                      Không có thí sinh nào trong danh sách.
                    </p>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px]">
                            <th className="py-2.5 px-3">Thí sinh</th>
                            <th className="py-2.5 px-3">Email</th>
                            <th className="py-2.5 px-3">Ngày đăng ký</th>
                            <th className="py-2.5 px-3">Trạng thái</th>
                            <th className="py-2.5 px-3">Ghi chú</th>
                            <th className="py-2.5 px-3 text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredRegistrations.map((reg) => (
                            <tr key={reg.registrationId} className="hover:bg-slate-50/60">
                              <td className="py-3 px-3 font-bold text-slate-900">
                                {reg.userName}
                              </td>
                              <td className="py-3 px-3 text-slate-500 font-mono">
                                {reg.userEmail}
                              </td>
                              <td className="py-3 px-3 text-slate-500">
                                {formatDateTime(reg.registeredAt)}
                              </td>
                              <td className="py-3 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    reg.status === "Approved"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : reg.status === "Pending"
                                      ? "bg-amber-100 text-amber-800"
                                      : reg.status === "Rejected"
                                      ? "bg-rose-100 text-rose-800"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {reg.status}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-slate-400 italic text-[11px] max-w-xs truncate">
                                {reg.note || "-"}
                              </td>
                              <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                                {reg.status === "Pending" && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleApproveRegistration(reg.registrationId)}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px]"
                                      disabled={actionLoading}
                                    >
                                      Duyệt
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedReg(reg);
                                        setActionModalType("reject");
                                        setReasonNote("");
                                      }}
                                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold text-[11px]"
                                      disabled={actionLoading}
                                    >
                                      Từ chối
                                    </button>
                                  </>
                                )}

                                {reg.status === "Approved" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedReg(reg);
                                      setActionModalType("remove");
                                      setReasonNote("");
                                    }}
                                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold text-[11px]"
                                    disabled={actionLoading}
                                  >
                                    Loại thí sinh
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Teams (TEAM) */}
              {activeTab === "teams" && competition.competitionType === "TEAM" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-700 text-xs">
                      Danh sách các đội tham gia ({teams.length})
                    </h4>
                    <span className="text-xs text-slate-400">
                      Tối đa 2 thành viên / đội
                    </span>
                  </div>

                  {teams.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-6 text-center">
                      Chưa có đội nào đăng ký cuộc thi này.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {teams.map((t) => (
                        <div key={t.teamId} className="p-4 bg-white border border-slate-200 rounded-xl space-y-2 text-xs">
                          <div className="flex items-start justify-between">
                            <h5 className="font-bold text-slate-900 text-sm">{t.teamName}</h5>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                t.status === "Active"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {t.status}
                            </span>
                          </div>

                          <div className="space-y-1 text-slate-600 bg-slate-50 p-2.5 rounded-lg">
                            <p>
                              👑 Đội trưởng:{" "}
                              <strong className="text-slate-800">
                                {t.captainName || `User #${t.captainUserId}`}
                              </strong>
                            </p>
                            <p>
                              👥 Thành viên (
                              {t.members?.length ? `1/1` : `0/1`}):{" "}
                              {t.members && t.members.length > 0 ? (
                                <strong className="text-slate-800">
                                  {t.members[0].fullName || t.members[0].email}
                                </strong>
                              ) : (
                                <span className="italic text-slate-400">Chưa có</span>
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Judges */}
              {activeTab === "judges" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-700 text-xs">
                      Hội đồng Ban Giám Khảo ({judges.length})
                    </h4>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setShowAddJudgeModal(true)}
                      className="text-xs"
                    >
                      <UserPlus size={13} className="mr-1" />
                      Thêm Giám khảo
                    </Button>
                  </div>

                  {judges.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-6 text-center">
                      Chưa có giám khảo nào được chỉ định.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {judges.map((j) => (
                        <div
                          key={j.competitionJudgeId}
                          className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl text-xs"
                        >
                          <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center">
                            {j.fullName ? j.fullName.charAt(0).toUpperCase() : "J"}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{j.fullName || j.email}</p>
                            <p className="text-[11px] text-slate-400">{j.email}</p>
                            <span className="text-[10px] text-purple-600 font-semibold">
                              Chỉ định lúc: {formatDate(j.assignedAt)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Bracket & Matches */}
              {activeTab === "bracket" && (
                <div className="pt-2">
                  <CompetitionBracketView
                    competition={competition}
                    isOrganizer={true}
                    judges={judges}
                  />
                </div>
              )}
            </>
          ) : null}
        </div>
      </Modal>

      {/* Modal: Reason for Reject or Remove Participant */}
      {actionModalType && selectedReg && (
        <Modal
          isOpen={Boolean(actionModalType)}
          onClose={() => {
            setActionModalType(null);
            setSelectedReg(null);
          }}
          title={
            actionModalType === "reject"
              ? `Từ chối đơn đăng ký: ${selectedReg.userName}`
              : `Loại thí sinh: ${selectedReg.userName}`
          }
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Vui lòng nhập lý do {actionModalType === "reject" ? "từ chối" : "loại"} thí sinh này. Lý do sẽ được lưu vào ghi chú (Note):
            </p>
            <textarea
              required
              rows={3}
              className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#008A64] focus:outline-hidden"
              placeholder="Nhập lý do cụ thể..."
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActionModalType(null);
                  setSelectedReg(null);
                }}
              >
                Hủy
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmRejectOrRemove}
                disabled={actionLoading || !reasonNote.trim()}
              >
                {actionLoading ? "Đang xử lý..." : "Xác nhận"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Add Judge */}
      {showAddJudgeModal && (
        <Modal
          isOpen={showAddJudgeModal}
          onClose={() => setShowAddJudgeModal(false)}
          title="Thêm Giám khảo vào cuộc thi"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleAddJudge} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                ID người dùng (UserId) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#008A64] focus:outline-hidden"
                placeholder="Nhập ID người dùng làm giám khảo (Ví dụ: 3)"
                value={judgeUserId}
                onChange={(e) => setJudgeUserId(e.target.value)}
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Người dùng này sẽ có quyền tham gia chấm điểm và theo dõi giải đấu.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddJudgeModal(false)}>
                Hủy
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={actionLoading || !judgeUserId.trim()}
              >
                {actionLoading ? "Đang thêm..." : "Thêm giám khảo"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};

export default CompetitionAdminDetailModal;

import React, { useState, useEffect, useCallback } from "react";
import {
  Trophy,
  Calendar,
  ChevronRight,
  Search,
  Filter,
  RefreshCw,
  Clock,
  Plus,
  Edit,
  Eye,
  Settings,
  DoorOpen,
  DoorClosed,
  Play,
  CheckCheck,
  Ban,
  CheckCircle2,
  AlertCircle,
  Swords,
} from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import competitionApi from "../../../api/competitionApi";
import { CompetitionDetail, CompetitionListItem } from "../../../types";
import CompetitionStatusBadge from "../../../components/competition/CompetitionStatusBadge";
import CompetitionTypeBadge from "../../../components/competition/CompetitionTypeBadge";
import CompetitionDetailModal from "../../../components/competition/CompetitionDetailModal";
import CompetitionAdminDetailModal from "../../../components/competition/CompetitionAdminDetailModal";
import CompetitionFormModal from "../../../components/competition/CompetitionFormModal";
import Button from "../../../components/common/Button";
import { formatDate } from "../../../utils/formatDate";

// ── Leaderboard empty state ──────────────────────────────────────────

const Competitions: React.FC = () => {
  const { user } = useAuth();
  const currentUserId = user?.userId ? Number(user.userId) : null;

  const [mainTab, setMainTab] = useState<"competitions" | "my-competitions" | "leaderboard">("competitions");

  // Real backend competitions state
  const [competitions, setCompetitions] = useState<CompetitionListItem[]>([]);
  const [detailedCompMap, setDetailedCompMap] = useState<Record<number, CompetitionDetail>>({});
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [competitionToEdit, setCompetitionToEdit] = useState<CompetitionDetail | null>(null);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<number | null>(null);
  const [selectedAdminCompId, setSelectedAdminCompId] = useState<number | null>(null);

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

  const fetchCompetitions = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await competitionApi.getCompetitions({
        keyword: keyword.trim() || undefined,
        competitionType: typeFilter !== "all" ? typeFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      if (res.success && res.data) {
        setCompetitions(res.data);

        // Fetch details in background to identify creator (CreatedBy) for "Cuộc thi của tôi"
        const entries = await Promise.all(
          res.data.map(async (item) => {
            try {
              const d = await competitionApi.getCompetitionById(item.competitionId);
              return d.data ? [item.competitionId, d.data] as const : null;
            } catch {
              return null;
            }
          })
        );
        const map: Record<number, CompetitionDetail> = {};
        for (const entry of entries) {
          if (entry) {
            map[entry[0]] = entry[1];
          }
        }
        setDetailedCompMap(map);
      } else {
        setCompetitions([]);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setErrorMsg(e.message || "Không thể tải danh sách giải đấu.");
    } finally {
      setLoading(false);
    }
  }, [keyword, typeFilter, statusFilter]);

  useEffect(() => {
    fetchCompetitions();
  }, [fetchCompetitions]);

  // Lifecycle actions
  const handleOpenRegistration = async (id: number) => {
    setActionLoading(true);
    try {
      const res = await competitionApi.openRegistration(id);
      if (res.success) {
        showNotification("Đã mở đăng ký cho cuộc thi!");
        await fetchCompetitions();
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

  const handleCloseRegistration = async (id: number) => {
    setActionLoading(true);
    try {
      const res = await competitionApi.closeRegistration(id);
      if (res.success) {
        showNotification("Đã đóng đăng ký cuộc thi.");
        await fetchCompetitions();
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

  const handleStartCompetition = async (id: number) => {
    try {
      const detail = detailedCompMap[id];
      if (detail) {
        if (detail.competitionType === "INDIVIDUAL") {
          const regRes = await competitionApi.getRegistrations(id);
          const approvedCount = regRes.data?.filter((r) => r.status === "Approved")?.length ?? 0;
          if (approvedCount === 0) {
            const confirmStart = window.confirm(
              "Cảnh báo: Hiện chưa có thí sinh nào được Ban tổ chức phê duyệt (Approved) trong danh sách!\n\nBạn có chắc chắn muốn chuyển cuộc thi sang trạng thái Đang diễn ra không?"
            );
            if (!confirmStart) return;
          }
        } else {
          const teamRes = await competitionApi.getTeams(id);
          const approvedCount = teamRes.data?.length ?? 0;
          if (approvedCount === 0) {
            const confirmStart = window.confirm(
              "Cảnh báo: Hiện chưa có đội thi nào trong danh sách!\n\nBạn có chắc chắn muốn chuyển cuộc thi sang trạng thái Đang diễn ra không?"
            );
            if (!confirmStart) return;
          }
        }
      }
    } catch {
      // Ignore validation pre-check errors
    }

    setActionLoading(true);
    try {
      const res = await competitionApi.startCompetition(id);
      if (res.success) {
        showNotification("Cuộc thi đã bắt đầu diễn ra!");
        await fetchCompetitions();
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

  const handleCompleteCompetition = async (id: number) => {
    if (!window.confirm("Bạn có chắc chắn muốn hoàn thành giải đấu này?")) return;
    setActionLoading(true);
    try {
      const res = await competitionApi.completeCompetition(id);
      if (res.success) {
        showNotification("Cuộc thi đã kết thúc thành công.");
        await fetchCompetitions();
      } else {
        showNotification(res.message || "Hoàn thành cuộc thi thất bại.", true);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Hoàn thành cuộc thi thất bại.", true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelCompetition = async (id: number) => {
    if (!window.confirm("Bạn có chắc chắn muốn HỦY cuộc thi này?")) return;
    setActionLoading(true);
    try {
      const res = await competitionApi.cancelCompetition(id);
      if (res.success) {
        showNotification("Cuộc thi đã bị hủy.");
        await fetchCompetitions();
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

  const handleOpenEdit = async (id: number) => {
    try {
      const res = await competitionApi.getCompetitionById(id);
      if (res.success && res.data) {
        setCompetitionToEdit(res.data);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Không thể tải chi tiết để sửa.", true);
    }
  };

  // My competitions: where user is the creator
  const myCompetitions = competitions.filter((comp) => {
    const detail = detailedCompMap[comp.competitionId];
    return detail && currentUserId && detail.createdBy === currentUserId;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">
            Giải đấu & Xếp hạng
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Tham gia các cuộc thi tranh biện cá nhân & đồng đội, tích lũy điểm và thăng hạng.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">

          {/* Button: + Tạo cuộc thi */}
          {/* Business Rule: Bất kỳ Authenticated user nào cũng có thể tạo cuộc thi (Creator tự động thành Judge). Khi Backend bổ sung Credit Cost API sau này sẽ integrate tiếp. */}
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-[#008A64] hover:bg-[#007457] text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-all hover:shadow-md cursor-pointer shrink-0"
            title="Khởi tạo cuộc thi mới"
          >
            <Plus size={16} />
            <span>Tạo cuộc thi</span>
          </button>
        </div>
      </div>

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

      {/* Main tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {[
          { id: "competitions" as const, label: "⚔️ Cuộc thi & Giải đấu" },
          { id: "my-competitions" as const, label: `📋 Cuộc thi của tôi (${myCompetitions.length})` },
          { id: "leaderboard" as const, label: "🏆 Bảng xếp hạng" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMainTab(tab.id)}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              mainTab === tab.id
                ? "border-[#008A64] text-[#008A64]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: All Competitions ── */}
      {mainTab === "competitions" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm cuộc thi theo tên..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#008A64] focus:outline-hidden"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
              </div>

              {/* Type filter */}
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-slate-400 shrink-0" />
                <select
                  className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-[#008A64] focus:outline-hidden"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="all">Tất cả hình thức</option>
                  <option value="INDIVIDUAL">Cá nhân</option>
                  <option value="TEAM">Đồng đội</option>
                </select>

                {/* Status filter */}
                <select
                  className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-[#008A64] focus:outline-hidden"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="OpenRegistration">Đang mở đăng ký</option>
                  <option value="RegistrationClosed">Đã đóng đăng ký</option>
                  <option value="Ongoing">Đang diễn ra</option>
                  <option value="Completed">Đã hoàn thành</option>
                </select>

                <button
                  type="button"
                  onClick={fetchCompetitions}
                  className="p-2 text-slate-500 hover:text-[#008A64] hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  title="Tải lại danh sách"
                >
                  <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                </button>
              </div>
            </div>
          </div>

          {/* List of competitions */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white border border-slate-200 rounded-2xl">
              <RefreshCw className="animate-spin text-[#008A64]" size={28} />
              <p className="text-xs text-slate-500 font-medium">Đang tải danh sách giải đấu...</p>
            </div>
          ) : errorMsg ? (
            <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-2">
              <p className="text-xs font-bold text-rose-700">{errorMsg}</p>
              <button
                type="button"
                onClick={fetchCompetitions}
                className="text-xs font-bold text-[#008A64] hover:underline cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          ) : competitions.length === 0 ? (
            <div className="p-12 bg-white border border-slate-200 rounded-2xl text-center space-y-3">
              <Trophy size={40} className="mx-auto text-slate-300" />
              <h3 className="font-bold text-slate-800 text-sm">Chưa có giải đấu nào phù hợp</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Hiện tại chưa có cuộc thi nào được công khai hoặc phù hợp với bộ lọc tìm kiếm của bạn.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {competitions.map((comp) => {
                const isOpenReg = comp.status === "OpenRegistration";

                return (
                  <div
                    key={comp.competitionId}
                    onClick={() => setSelectedCompetitionId(comp.competitionId)}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 hover:shadow-md hover:border-[#008A64]/50 transition-all cursor-pointer group"
                  >
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Left: icon */}
                      <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                        <Trophy size={24} className="text-amber-500 fill-amber-200" />
                      </div>

                      {/* Center: info */}
                      <div className="flex-1 space-y-2 min-w-0">
                        <div className="flex items-start gap-2 flex-wrap">
                          <h3 className="font-black text-slate-900 text-base group-hover:text-[#008A64] transition-colors">
                            {comp.title}
                          </h3>
                          <CompetitionStatusBadge status={comp.status} />
                          <CompetitionTypeBadge type={comp.competitionType} />
                        </div>

                        <div className="flex flex-wrap gap-4 text-xs text-slate-500 pt-1">
                          <span className="flex items-center gap-1.5">
                            <Clock size={12} className="text-slate-400" />
                            Đăng ký: {formatDate(comp.registrationStart)} – {formatDate(comp.registrationEnd)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Calendar size={12} className="text-slate-400" />
                            Thi đấu: {formatDate(comp.startDate)}
                          </span>
                        </div>
                      </div>

                      {/* Right: CTA */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 shrink-0">
                        {comp.status === "Ongoing" ? (
                          <span className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-[#008A64] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-sm">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                            </span>
                            Đang diễn ra • Xem phòng <ChevronRight size={13} />
                          </span>
                        ) : isOpenReg ? (
                          <span className="px-3.5 py-2 rounded-xl bg-[#008A64] hover:bg-[#007457] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-sm">
                            Xem & Đăng ký <ChevronRight size={13} />
                          </span>
                        ) : (
                          <span className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold inline-flex items-center gap-1.5 transition-all">
                            Xem chi tiết <ChevronRight size={13} />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: My Competitions (Organizer / Manager View) ── */}
      {mainTab === "my-competitions" && (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50/60 border border-[#008A64]/20 rounded-2xl flex items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Cuộc thi do bạn khởi tạo & quản lý</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Quản lý vòng đời giải đấu, xét duyệt đơn đăng ký của thí sinh/đội thi và phân công giám khảo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 bg-[#008A64] hover:bg-[#007457] text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1 transition-all cursor-pointer shrink-0"
            >
              <Plus size={14} />
              <span>Tạo thêm cuộc thi</span>
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white border border-slate-200 rounded-2xl">
              <RefreshCw className="animate-spin text-[#008A64]" size={28} />
              <p className="text-xs text-slate-500 font-medium">Đang tải cuộc thi của bạn...</p>
            </div>
          ) : myCompetitions.length === 0 ? (
            <div className="p-12 bg-white border border-slate-200 rounded-2xl text-center space-y-3">
              <Trophy size={40} className="mx-auto text-slate-300" />
              <h3 className="font-bold text-slate-800 text-sm">Bạn chưa tạo cuộc thi nào</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Nhấn nút &ldquo;Tạo cuộc thi&rdquo; để khởi tạo và tổ chức giải đấu đầu tiên của bạn trên nền tảng.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowCreateModal(true)}
                className="mt-2"
              >
                <Plus size={14} className="mr-1" />
                Tạo cuộc thi ngay
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {myCompetitions.map((comp) => {
                const detail = detailedCompMap[comp.competitionId];

                return (
                  <div
                    key={comp.competitionId}
                    className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3 hover:border-slate-300 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-bold text-slate-400">
                            #{comp.competitionId}
                          </span>
                          <h4 className="font-black text-slate-900 text-base">{comp.title}</h4>
                          <CompetitionStatusBadge status={comp.status} />
                          <CompetitionTypeBadge type={comp.competitionType} />
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs text-slate-500 pt-1.5">
                          <span className="flex items-center gap-1">
                            <Clock size={12} className="text-slate-400" />
                            Đăng ký: {formatDate(comp.registrationStart)} – {formatDate(comp.registrationEnd)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar size={12} className="text-slate-400" />
                            Thi đấu: {formatDate(comp.startDate)}
                          </span>
                          {detail?.maxParticipants && (
                            <span className="text-slate-600 font-medium">
                              Tối đa: {detail.maxParticipants} {comp.competitionType === "TEAM" ? "đội" : "thí sinh"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Operation Actions */}
                      <div className="flex items-center gap-1.5 flex-wrap sm:justify-end">
                        {/* Detail */}
                        <button
                          type="button"
                          onClick={() => setSelectedCompetitionId(comp.competitionId)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl inline-flex items-center gap-1 transition-colors cursor-pointer"
                          title="Xem chi tiết giải đấu"
                        >
                          <Eye size={13} />
                          <span>Xem</span>
                        </button>

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(comp.competitionId)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl inline-flex items-center gap-1 transition-colors cursor-pointer"
                          title="Chỉnh sửa thông tin"
                        >
                          <Edit size={13} />
                          <span>Sửa</span>
                        </button>

                        {/* Manage Modal */}
                        <button
                          type="button"
                          onClick={() => setSelectedAdminCompId(comp.competitionId)}
                          className="px-2.5 py-1.5 bg-[#008A64] hover:bg-[#007457] text-white text-xs font-bold rounded-xl inline-flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                          title="Quản lý thí sinh, đội thi & giám khảo"
                        >
                          <Settings size={13} />
                          <span>Quản lý</span>
                        </button>

                        {/* Lifecycle quick buttons */}
                        {comp.status === "Draft" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenRegistration(comp.competitionId)}
                              disabled={actionLoading}
                              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl inline-flex items-center gap-1 transition-colors cursor-pointer border border-emerald-200"
                              title="Mở đăng ký"
                            >
                              <DoorOpen size={13} />
                              <span>Mở ĐK</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelCompetition(comp.competitionId)}
                              disabled={actionLoading}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                              title="Hủy cuộc thi"
                            >
                              <Ban size={14} />
                            </button>
                          </>
                        )}

                        {comp.status === "OpenRegistration" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCloseRegistration(comp.competitionId)}
                              disabled={actionLoading}
                              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-xl inline-flex items-center gap-1 transition-colors cursor-pointer border border-amber-200"
                              title="Đóng đăng ký"
                            >
                              <DoorClosed size={13} />
                              <span>Đóng ĐK</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelCompetition(comp.competitionId)}
                              disabled={actionLoading}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                              title="Hủy cuộc thi"
                            >
                              <Ban size={14} />
                            </button>
                          </>
                        )}

                        {comp.status === "RegistrationClosed" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStartCompetition(comp.competitionId)}
                              disabled={actionLoading}
                              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold rounded-xl inline-flex items-center gap-1 transition-colors cursor-pointer border border-blue-200"
                              title="Bắt đầu thi đấu"
                            >
                              <Play size={13} />
                              <span>Bắt đầu</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelCompetition(comp.competitionId)}
                              disabled={actionLoading}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                              title="Hủy cuộc thi"
                            >
                              <Ban size={14} />
                            </button>
                          </>
                        )}

                        {comp.status === "Ongoing" && (
                          <>
                            <button
                              type="button"
                              onClick={() => setSelectedAdminCompId(comp.competitionId)}
                              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#008A64] text-xs font-bold rounded-xl inline-flex items-center gap-1 transition-colors cursor-pointer border border-emerald-200"
                              title="Xem cây thi đấu và điều phối các trận"
                            >
                              <Swords size={13} />
                              <span>Cây thi đấu</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCompleteCompetition(comp.competitionId)}
                              disabled={actionLoading}
                              className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold rounded-xl inline-flex items-center gap-1 transition-colors cursor-pointer border border-purple-200"
                              title="Hoàn thành giải đấu"
                            >
                              <CheckCheck size={13} />
                              <span>Hoàn thành</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelCompetition(comp.competitionId)}
                              disabled={actionLoading}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                              title="Hủy cuộc thi"
                            >
                              <Ban size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: Leaderboard ── */}
      {mainTab === "leaderboard" && (
        <div className="bg-white dark:bg-[#12231C] rounded-3xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-500/15 border border-amber-100 dark:border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto mb-4 shadow-xs">
            <Trophy size={32} />
          </div>
          <h3 className="text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC] mb-2">
            Bảng xếp hạng giải đấu
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Hệ thống bảng xếp hạng đang được đồng bộ và tổng hợp dựa trên kết quả các giải đấu đã hoàn thành. Hiện chưa có xếp hạng chính thức từ hệ thống.
          </p>
        </div>
      )}

      {/* Modal: Create Competition */}
      {showCreateModal && (
        <CompetitionFormModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(createdComp) => {
            showNotification("Đã tạo cuộc thi mới thành công (trạng thái: Bản nháp)!");
            fetchCompetitions();
            if (createdComp?.competitionId) {
              setSelectedCompetitionId(createdComp.competitionId);
            }
          }}
        />
      )}

      {/* Modal: Edit Competition */}
      {competitionToEdit && (
        <CompetitionFormModal
          isOpen={Boolean(competitionToEdit)}
          onClose={() => setCompetitionToEdit(null)}
          competitionToEdit={competitionToEdit}
          onSuccess={() => {
            showNotification("Đã cập nhật thông tin cuộc thi thành công!");
            fetchCompetitions();
          }}
        />
      )}

      {/* Modal: Interactive Competition Detail for Debater */}
      {selectedCompetitionId && (
        <CompetitionDetailModal
          competitionId={selectedCompetitionId}
          isOpen={Boolean(selectedCompetitionId)}
          onClose={() => setSelectedCompetitionId(null)}
          currentUser={user}
          onStatusChanged={fetchCompetitions}
          onOpenManage={(compId) => setSelectedAdminCompId(compId)}
        />
      )}

      {/* Modal: Organizer / Admin Management (Registrations review, Teams, Judges) */}
      {selectedAdminCompId && (
        <CompetitionAdminDetailModal
          competitionId={selectedAdminCompId}
          isOpen={Boolean(selectedAdminCompId)}
          onClose={() => setSelectedAdminCompId(null)}
          onEdit={(comp) => {
            setSelectedAdminCompId(null);
            setCompetitionToEdit(comp);
          }}
          onUpdated={fetchCompetitions}
        />
      )}
    </div>
  );
};

export default Competitions;

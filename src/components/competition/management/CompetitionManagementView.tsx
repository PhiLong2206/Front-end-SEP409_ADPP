import React, { useState, useEffect, useCallback } from "react";
import {
  Trophy,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Edit,
  Trash2,
  Calendar,
  Clock,
  DoorOpen,
  DoorClosed,
  Play,
  CheckCheck,
  Ban,
  Eye,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import Button from "../../common/Button";
import CompetitionStatusBadge from "../common/CompetitionStatusBadge";
import CompetitionTypeBadge from "../common/CompetitionTypeBadge";
import CompetitionFormModal from "./CompetitionFormModal";
import CompetitionAdminDetailModal from "./CompetitionAdminDetailModal";
import competitionApi from "../../../api/competitionApi";
import { formatDate } from "../../../utils/formatDate";
import { CompetitionDetail, CompetitionListItem } from "../../../types";

interface Props {
  title?: string;
  subtitle?: string;
}

const CompetitionManagementView: React.FC<Props> = ({
  title = "Quản lý cuộc thi & giải đấu",
  subtitle = "Khởi tạo, điều phối vòng đời giải đấu, xét duyệt thí sinh/đội thi và phân công giám khảo.",
}) => {
  const [competitions, setCompetitions] = useState<CompetitionListItem[]>([]);
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
      } else {
        setCompetitions([]);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setErrorMsg(e.message || "Không thể tải danh sách cuộc thi.");
    } finally {
      setLoading(false);
    }
  }, [keyword, typeFilter, statusFilter]);

  useEffect(() => {
    fetchCompetitions();
  }, [fetchCompetitions]);

  // Direct quick lifecycle actions
  const handleOpenRegistration = async (id: number) => {
    setActionLoading(true);
    try {
      const res = await competitionApi.openRegistration(id);
      if (res.success) {
        showNotification("Đã mở đăng ký cho giải đấu.");
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
        showNotification("Đã đóng đăng ký giải đấu.");
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

  const handleDeleteCompetition = async (id: number) => {
    if (!window.confirm("Bạn có chắc chắn muốn XÓA cuộc thi này?")) return;
    setActionLoading(true);
    try {
      const res = await competitionApi.deleteCompetition(id);
      if (res.success) {
        showNotification("Đã xóa cuộc thi.");
        await fetchCompetitions();
      } else {
        showNotification(res.message || "Xóa cuộc thi thất bại.", true);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Xóa cuộc thi thất bại.", true);
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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">{subtitle}</p>
        </div>

        <Button
          variant="primary"
          onClick={() => setShowCreateModal(true)}
          className="shadow-sm self-start sm:self-auto"
        >
          <Plus size={16} className="mr-1.5" />
          Tạo cuộc thi mới
        </Button>
      </div>

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

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên giải đấu..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#008A64] focus:outline-hidden"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

          {/* Filters */}
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

            <select
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-[#008A64] focus:outline-hidden"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="Draft">Bản nháp</option>
              <option value="OpenRegistration">Đang mở đăng ký</option>
              <option value="RegistrationClosed">Đã đóng đăng ký</option>
              <option value="Ongoing">Đang diễn ra</option>
              <option value="Completed">Đã hoàn thành</option>
              <option value="Cancelled">Đã hủy</option>
            </select>

            <button
              type="button"
              onClick={fetchCompetitions}
              className="p-2 text-slate-500 hover:text-[#008A64] hover:bg-slate-100 rounded-xl transition-colors"
              title="Tải lại danh sách"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* Competitions Table / List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white border border-slate-200 rounded-2xl">
          <RefreshCw className="animate-spin text-[#008A64]" size={28} />
          <p className="text-xs text-slate-500 font-medium">Đang tải danh sách cuộc thi...</p>
        </div>
      ) : competitions.length === 0 ? (
        <div className="p-12 bg-white border border-slate-200 rounded-2xl text-center space-y-3">
          <Trophy size={40} className="mx-auto text-slate-300" />
          <h3 className="font-bold text-slate-800 text-sm">Chưa có giải đấu nào</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Nhấn nút &ldquo;Tạo cuộc thi mới&rdquo; để khởi tạo giải đấu đầu tiên của bạn.
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
        <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4 w-12">#ID</th>
                <th className="py-3 px-4">Tên cuộc thi</th>
                <th className="py-3 px-4">Hình thức</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4">Đăng ký</th>
                <th className="py-3 px-4">Thi đấu</th>
                <th className="py-3 px-4 text-right">Vận hành & Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {competitions.map((comp) => (
                <tr key={comp.competitionId} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-slate-400 font-semibold">
                    #{comp.competitionId}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      onClick={() => setSelectedAdminCompId(comp.competitionId)}
                      className="font-bold text-slate-900 hover:text-[#008A64] cursor-pointer block text-sm"
                    >
                      {comp.title}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <CompetitionTypeBadge type={comp.competitionType} />
                  </td>
                  <td className="py-3.5 px-4">
                    <CompetitionStatusBadge status={comp.status} />
                  </td>
                  <td className="py-3.5 px-4 text-slate-500">
                    <div className="flex items-center gap-1">
                      <Clock size={11} className="text-slate-400" />
                      <span>
                        {formatDate(comp.registrationStart)} – {formatDate(comp.registrationEnd)}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500">
                    <div className="flex items-center gap-1">
                      <Calendar size={11} className="text-slate-400" />
                      <span>{formatDate(comp.startDate)}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      {/* Open Manage Details */}
                      <button
                        type="button"
                        onClick={() => setSelectedAdminCompId(comp.competitionId)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs inline-flex items-center gap-1 transition-colors"
                        title="Quản lý chi tiết thí sinh, đội thi & giám khảo"
                      >
                        <Eye size={12} />
                        Chi tiết
                      </button>

                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(comp.competitionId)}
                        className="p-1 text-slate-400 hover:text-[#008A64] hover:bg-slate-100 rounded-lg transition-colors"
                        title="Chỉnh sửa thông tin"
                      >
                        <Edit size={14} />
                      </button>

                      {/* Quick Lifecycle Buttons */}
                      {comp.status === "Draft" && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenRegistration(comp.competitionId)}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-bold text-[11px] inline-flex items-center gap-1 transition-colors"
                            title="Mở đăng ký"
                            disabled={actionLoading}
                          >
                            <DoorOpen size={12} />
                            Mở ĐK
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCompetition(comp.competitionId)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Xóa giải đấu"
                            disabled={actionLoading}
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}

                      {comp.status === "OpenRegistration" && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleCloseRegistration(comp.competitionId)}
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg font-bold text-[11px] inline-flex items-center gap-1 transition-colors"
                            title="Đóng đăng ký"
                            disabled={actionLoading}
                          >
                            <DoorClosed size={12} />
                            Đóng ĐK
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelCompetition(comp.competitionId)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Hủy giải đấu"
                            disabled={actionLoading}
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
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-bold text-[11px] inline-flex items-center gap-1 transition-colors"
                            title="Bắt đầu thi đấu"
                            disabled={actionLoading}
                          >
                            <Play size={12} />
                            Bắt đầu
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelCompetition(comp.competitionId)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Hủy giải đấu"
                            disabled={actionLoading}
                          >
                            <Ban size={14} />
                          </button>
                        </>
                      )}

                      {comp.status === "Ongoing" && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleCompleteCompetition(comp.competitionId)}
                            className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg font-bold text-[11px] inline-flex items-center gap-1 transition-colors"
                            title="Hoàn thành giải đấu"
                            disabled={actionLoading}
                          >
                            <CheckCheck size={12} />
                            Hoàn thành
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelCompetition(comp.competitionId)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Hủy giải đấu"
                            disabled={actionLoading}
                          >
                            <Ban size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Create Competition */}
      {showCreateModal && (
        <CompetitionFormModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            showNotification("Đã tạo cuộc thi mới thành công (trạng thái: Bản nháp)!");
            fetchCompetitions();
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
            showNotification("Đã cập nhật cuộc thi thành công!");
            fetchCompetitions();
          }}
        />
      )}

      {/* Modal: Full Admin Management (Lifecycle, Registrations, Teams, Judges) */}
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

export default CompetitionManagementView;

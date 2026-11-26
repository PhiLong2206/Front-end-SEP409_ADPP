import React, { useEffect, useState, useCallback } from "react";
import {
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Shield,
  CheckCircle,
  XCircle,
  Lock,
  Unlock,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Mail,
  Phone,
  Calendar,
  Check,
} from "lucide-react";
import adminApi from "../../../api/adminApi";
import { AdminUserItem, AdminRoleItem } from "../../../types";
import { useAuth } from "../../../hooks/useAuth";

const UserManagement: React.FC = () => {
  const { user: currentAdmin } = useAuth();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Pagination state
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Data state
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [availableRoles, setAvailableRoles] = useState<AdminRoleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Toast / Messages
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  // Modals state
  const [detailModalUser, setDetailModalUser] = useState<AdminUserItem | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  const [roleModalUser, setRoleModalUser] = useState<AdminUserItem | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);

  const [statusModalUser, setStatusModalUser] = useState<AdminUserItem | null>(null);

  // Load roles master list
  const fetchRoles = useCallback(async () => {
    try {
      const res = await adminApi.getRoles();
      if (res && res.success && res.data) {
        setAvailableRoles(res.data);
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch users with real API: GET /api/admin/users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await adminApi.getUsers({
        searchTerm: appliedSearch.trim() || undefined,
        pageNumber,
        pageSize,
      });

      if (res && res.success && res.data) {
        setUsers(res.data.items || []);
        setTotalCount(res.data.totalCount || 0);
        setTotalPages(res.data.totalPages || 1);
      } else {
        setErrorMsg(res?.message || "Không thể tải danh sách người dùng.");
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setErrorMsg(errObj?.message || "Lỗi khi kết nối đến máy chủ người dùng.");
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, pageNumber, pageSize]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Handle Search Submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPageNumber(1);
    setAppliedSearch(searchTerm);
  };

  // View User Details: GET /api/admin/users/{id}
  const handleViewDetail = async (userId: number) => {
    setDetailLoading(true);
    setDetailModalUser(null);
    try {
      const res = await adminApi.getUserById(userId);
      if (res && res.success && res.data) {
        setDetailModalUser(res.data);
      } else {
        setErrorMsg(res?.message || "Không thể lấy thông tin chi tiết người dùng.");
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setErrorMsg(errObj?.message || "Lỗi khi tải chi tiết người dùng.");
    } finally {
      setDetailLoading(false);
    }
  };

  // Open Assign Roles Modal
  const handleOpenRoleModal = async (u: AdminUserItem) => {
    setRoleModalUser(u);
    let rolesList = availableRoles;
    if (rolesList.length === 0) {
      try {
        const res = await adminApi.getRoles();
        if (res && res.success && res.data) {
          rolesList = res.data;
          setAvailableRoles(res.data);
        }
      } catch {
        // ignore
      }
    }
    // Map current roles by name to role IDs
    const currentRoleIds = rolesList
      .filter((r) => u.roles.some((roleName) => roleName.toLowerCase() === r.roleName.toLowerCase()))
      .map((r) => r.roleId);
    setSelectedRoleIds(currentRoleIds);
  };

  const isCurrentAdminSelf = Boolean(
    roleModalUser &&
      currentAdmin &&
      (String(roleModalUser.userId) === String(currentAdmin.userId) ||
        String(roleModalUser.userId) === String(currentAdmin.id))
  );

  // Submit Assign Roles: PUT /api/admin/users/{id}/roles
  const handleAssignRolesSubmit = async () => {
    if (!roleModalUser) return;
    if (selectedRoleIds.length === 0) {
      setErrorMsg("Người dùng phải có ít nhất một vai trò trong hệ thống.");
      return;
    }
    if (isCurrentAdminSelf) {
      const adminRole = availableRoles.find((r) => r.roleName.toLowerCase() === "admin");
      if (adminRole && !selectedRoleIds.includes(adminRole.roleId)) {
        setErrorMsg("Bạn không thể tự gỡ bỏ quyền Quản trị viên của chính mình.");
        return;
      }
    }
    setActionLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await adminApi.assignUserRoles(roleModalUser.userId, selectedRoleIds);
      if (res && res.success) {
        setSuccessMsg(`Cập nhật phân quyền cho "${roleModalUser.fullName}" thành công.`);
        setRoleModalUser(null);
        fetchUsers();
      } else {
        setErrorMsg(res?.message || "Cập nhật phân quyền thất bại.");
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setErrorMsg(errObj?.message || "Lỗi khi cập nhật vai trò người dùng.");
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Role Checkbox
  const toggleRoleSelection = (roleId: number) => {
    const role = availableRoles.find((r) => r.roleId === roleId);
    if (isCurrentAdminSelf && role?.roleName.toLowerCase() === "admin") {
      setErrorMsg("Bạn không thể tự gỡ bỏ quyền Quản trị viên của chính mình.");
      return;
    }
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  // Toggle Status: PATCH /api/admin/users/{id}/status
  const handleUpdateStatusConfirm = async () => {
    if (!statusModalUser) return;
    setActionLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    const newStatus = !statusModalUser.isActive;
    try {
      const res = await adminApi.updateUserStatus(statusModalUser.userId, newStatus);
      if (res && res.success) {
        setSuccessMsg(
          newStatus
            ? `Đã mở khóa tài khoản "${statusModalUser.fullName}".`
            : `Đã khóa tài khoản "${statusModalUser.fullName}".`
        );
        setStatusModalUser(null);
        fetchUsers();
      } else {
        setErrorMsg(res?.message || "Cập nhật trạng thái thất bại.");
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setErrorMsg(errObj?.message || "Lỗi khi cập nhật trạng thái người dùng.");
    } finally {
      setActionLoading(false);
    }
  };

  // Filter users locally for role & status dropdown filters if desired
  const displayedUsers = users.filter((u) => {
    const matchesRole =
      roleFilter === "ALL" ||
      u.roles.some((r) => r.toLowerCase() === roleFilter.toLowerCase());
    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && u.isActive) ||
      (statusFilter === "INACTIVE" && !u.isActive);
    return matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Quản lý người dùng
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Quản trị danh sách tài khoản học viên, giảng viên, khóa/mở khóa và phân quyền hệ thống qua API Backend (.NET 8).
          </p>
        </div>

        <button
          type="button"
          onClick={fetchUsers}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#162032] hover:bg-slate-100 dark:hover:bg-[#1D2B45] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[rgba(148,163,184,0.18)] text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw size={13} className={loading ? "animate-spin text-[#0B5ED7]" : ""} />
          <span>Làm mới danh sách</span>
        </button>
      </div>

      {/* Alert Banners */}
      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg("")} className="text-rose-400 hover:text-rose-600">
            <X size={14} />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 text-blue-800 dark:text-blue-300 text-xs font-medium flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-[#0B5ED7] shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg("")} className="text-blue-500 hover:text-blue-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Security & RBAC Policy Notice */}
      <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/40 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-3">
        <Shield size={18} className="text-[#0B5ED7] shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-bold">Chính sách Phân quyền & Bảo mật Quản trị</p>
          <p className="text-[11.5px] text-blue-700 dark:text-blue-400 leading-relaxed">
            Hệ thống áp dụng các nguyên tắc nghiệp vụ bảo mật nghiêm ngặt từ Backend: Không cho phép Quản trị viên tự khóa tài khoản của chính mình và ngăn chặn gỡ bỏ quyền Admin cuối cùng để đảm bảo hệ thống luôn có người điều hành.
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-[#0F1726] p-4 rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên hoặc email... (Enter)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7] text-slate-800 dark:text-slate-200"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-1.5">
            <Filter size={13} className="text-slate-400" />
            <span className="text-[11px] font-bold text-slate-500 uppercase">Lọc:</span>
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7] font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value="ALL">Tất cả vai trò</option>
            <option value="Admin">Quản trị viên</option>
            <option value="Lecturer">Giảng viên</option>
            <option value="Member">Học viên</option>
            <option value="Moderator">Kiểm duyệt viên</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7] font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="INACTIVE">Đã bị khóa</option>
          </select>
        </div>
      </div>

      {/* User Table */}
      <div className="bg-white dark:bg-[#0F1726] rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            <RefreshCw size={24} className="animate-spin text-[#0B5ED7] mx-auto mb-2" />
            <span>Đang tải danh sách người dùng từ máy chủ...</span>
          </div>
        ) : displayedUsers.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">
            Không tìm thấy người dùng nào phù hợp với bộ lọc.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#090E19] text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Mã ID</th>
                  <th className="px-5 py-3.5">Họ và tên</th>
                  <th className="px-5 py-3.5">Email</th>
                  <th className="px-5 py-3.5">Vai trò</th>
                  <th className="px-5 py-3.5">Trạng thái</th>
                  <th className="px-5 py-3.5">Ngày tham gia</th>
                  <th className="px-5 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[rgba(148,163,184,0.12)]">
                {displayedUsers.map((u) => {
                  const isCurrentAdmin =
                    currentAdmin &&
                    (String(currentAdmin.id) === String(u.userId) ||
                      String(currentAdmin.userId) === String(u.userId) ||
                      currentAdmin.email === u.email);

                  return (
                    <tr
                      key={u.userId}
                      className="hover:bg-slate-50/60 dark:hover:bg-[#162032]/40 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-mono text-slate-400">#{u.userId}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300">
                            {u.avatarUrl ? (
                              <img src={u.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              u.fullName.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {u.fullName}
                            </span>
                            {isCurrentAdmin && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9.5px] font-black bg-blue-100 dark:bg-blue-950 text-[#0B5ED7]">
                                Bạn
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <span>{u.email}</span>
                          {u.isEmailVerified && (
                            <span title="Email đã xác thực" className="inline-flex">
                              <CheckCircle size={12} className="text-[#0B5ED7]" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.length > 0 ? (
                            u.roles.map((r, idx) => {
                              const rLower = r.toLowerCase();
                              const badgeText =
                                rLower === "admin"
                                  ? "Quản trị viên"
                                  : rLower === "lecturer" || rLower === "educator" || rLower === "organizer"
                                  ? "Giảng viên"
                                  : rLower === "member" || rLower === "learner" || rLower === "debater"
                                  ? "Học viên"
                                  : rLower === "moderator"
                                  ? "Kiểm duyệt viên"
                                  : r;
                              return (
                                <span
                                  key={idx}
                                  className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                    rLower === "admin"
                                      ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200"
                                      : rLower === "lecturer" || rLower === "educator" || rLower === "organizer"
                                      ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200"
                                      : rLower === "moderator"
                                      ? "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200"
                                      : "bg-blue-50 text-[#0B5ED7] dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200"
                                  }`}
                                >
                                  {badgeText}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-[11px] text-slate-400">Không có</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                            <CheckCircle size={13} /> Hoạt động
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500">
                            <XCircle size={13} /> Đã khóa
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString("vi-VN") : "--"}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Xem chi tiết */}
                          <button
                            type="button"
                            onClick={() => handleViewDetail(u.userId)}
                            disabled={detailLoading}
                            className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer disabled:opacity-40"
                            title="Xem chi tiết người dùng"
                          >
                            <Eye size={13} />
                          </button>

                          {/* Phân quyền */}
                          <button
                            type="button"
                            onClick={() => handleOpenRoleModal(u)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-[#0B5ED7] dark:text-blue-300 text-[11px] font-bold border border-blue-200/80 transition-colors cursor-pointer"
                            title="Phân quyền vai trò"
                          >
                            <UserCheck size={12} />
                            <span>Phân quyền</span>
                          </button>

                          {/* Khóa / Mở khóa */}
                          <button
                            type="button"
                            onClick={() => setStatusModalUser(u)}
                            disabled={Boolean(isCurrentAdmin && u.isActive)}
                            className={`p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                              u.isActive
                                ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-100 border border-rose-200/80"
                                : "bg-blue-50 dark:bg-blue-950/40 text-[#0B5ED7] hover:bg-blue-100 border border-blue-200/80"
                            }`}
                            title={
                              isCurrentAdmin && u.isActive
                                ? "Không thể tự khóa tài khoản của chính mình"
                                : u.isActive
                                ? "Khóa tài khoản"
                                : "Mở khóa tài khoản"
                            }
                          >
                            {u.isActive ? <Lock size={13} /> : <Unlock size={13} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-4 bg-slate-50 dark:bg-[#090E19] border-t border-slate-100 dark:border-[rgba(148,163,184,0.12)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            Hiển thị trang <span className="font-bold text-slate-800 dark:text-slate-200">{pageNumber}</span> /{" "}
            <span className="font-bold text-slate-800 dark:text-slate-200">{totalPages}</span> (Tổng cộng{" "}
            <span className="font-bold text-[#0B5ED7]">{totalCount}</span> người dùng)
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
              disabled={pageNumber <= 1 || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-[#0F1726] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 font-bold transition-all disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft size={14} />
              <span>Trang trước</span>
            </button>

            <button
              type="button"
              onClick={() => setPageNumber((p) => Math.min(totalPages, p + 1))}
              disabled={pageNumber >= totalPages || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-[#0F1726] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 font-bold transition-all disabled:opacity-40 cursor-pointer"
            >
              <span>Trang sau</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Modal 1: User Detail */}
      {detailModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#0F1726] w-full max-w-lg rounded-3xl border border-slate-200 dark:border-[rgba(148,163,184,0.18)] shadow-2xl p-6 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[rgba(148,163,184,0.12)]">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Chi tiết người dùng
              </h3>
              <button
                type="button"
                onClick={() => setDetailModalUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-[#0B5ED7] flex items-center justify-center text-xl font-black border border-blue-200/60 shrink-0">
                {detailModalUser.avatarUrl ? (
                  <img src={detailModalUser.avatarUrl} alt="" className="w-full h-full rounded-2xl object-cover" />
                ) : (
                  detailModalUser.fullName.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-900 dark:text-slate-100">
                  {detailModalUser.fullName}
                </h4>
                <p className="text-xs text-slate-500 font-mono">Mã người dùng: #{detailModalUser.userId}</p>
                <div className="mt-1 flex items-center gap-2">
                  {detailModalUser.isActive ? (
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                      <CheckCircle size={11} /> Hoạt động
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-md">
                      <XCircle size={11} /> Bị vô hiệu hóa
                    </span>
                  )}
                  {detailModalUser.isEmailVerified && (
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                      <Check size={11} /> Đã xác thực Email
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#090E19] flex items-center gap-2.5">
                <Mail size={15} className="text-slate-400 shrink-0" />
                <span className="text-slate-500">Email:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 ml-auto">{detailModalUser.email}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#090E19] flex items-center gap-2.5">
                <Phone size={15} className="text-slate-400 shrink-0" />
                <span className="text-slate-500">Số điện thoại:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 ml-auto">
                  {detailModalUser.phoneNumber || "Chưa cập nhật"}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#090E19] flex items-center gap-2.5">
                <Calendar size={15} className="text-slate-400 shrink-0" />
                <span className="text-slate-500">Ngày tạo tài khoản:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 ml-auto">
                  {detailModalUser.createdAt ? new Date(detailModalUser.createdAt).toLocaleString("vi-VN") : "--"}
                </span>
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
                Các vai trò được cấp:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {detailModalUser.roles.map((r, idx) => {
                  const rLower = r.toLowerCase();
                  const badgeText =
                    rLower === "admin"
                      ? "Quản trị viên"
                      : rLower === "lecturer" || rLower === "educator" || rLower === "organizer"
                      ? "Giảng viên"
                      : rLower === "member" || rLower === "learner" || rLower === "debater"
                      ? "Học viên"
                      : rLower === "moderator"
                      ? "Kiểm duyệt viên"
                      : r;
                  return (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-[#0B5ED7] dark:text-blue-300 border border-blue-200/80"
                    >
                      {badgeText}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailModalUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Assign Roles */}
      {roleModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#0F1726] w-full max-w-md rounded-3xl border border-slate-200 dark:border-[rgba(148,163,184,0.18)] shadow-2xl p-6 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[rgba(148,163,184,0.12)]">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Phân quyền người dùng
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Tài khoản: <span className="font-bold text-slate-800 dark:text-slate-200">{roleModalUser.fullName}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRoleModalUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Chọn các vai trò áp dụng:
              </span>
              {availableRoles.map((role) => {
                const isChecked = selectedRoleIds.includes(role.roleId);
                const roleNameLower = role.roleName.toLowerCase();
                const roleLabel =
                  roleNameLower === "admin"
                    ? "Quản trị viên"
                    : roleNameLower === "lecturer" || roleNameLower === "educator" || roleNameLower === "organizer"
                    ? "Giảng viên"
                    : roleNameLower === "member" || roleNameLower === "learner" || roleNameLower === "debater"
                    ? "Học viên"
                    : roleNameLower === "moderator"
                    ? "Kiểm duyệt viên"
                    : role.roleName;

                const roleDesc =
                  roleNameLower === "admin"
                    ? "Toàn quyền quản lý hệ thống, kiểm soát người dùng và thiết lập bảo mật nền tảng."
                    : roleNameLower === "lecturer" || roleNameLower === "educator" || roleNameLower === "organizer"
                    ? "Tạo đề tài, tổ chức và chấm điểm các giải đấu, cuộc thi tranh biện."
                    : roleNameLower === "member" || roleNameLower === "learner" || roleNameLower === "debater"
                    ? "Học viên tham gia luyện tập cùng AI, thi đấu 1v1, 2v2 và tích lũy điểm số."
                    : roleNameLower === "moderator"
                    ? "Giám sát nội dung, kiểm duyệt các chủ đề và báo cáo vi phạm."
                    : role.description;

                const isAdminRole = roleNameLower === "admin";
                const isSelfAdmin = isCurrentAdminSelf && isAdminRole;

                return (
                  <label
                    key={role.roleId}
                    className={`flex items-start gap-3 p-3 rounded-2xl border transition-all ${
                      isSelfAdmin ? "cursor-not-allowed opacity-90" : "cursor-pointer"
                    } ${
                      isChecked
                        ? "bg-blue-50/60 dark:bg-blue-950/30 border-[#0B5ED7] text-slate-900 dark:text-slate-100"
                        : "bg-white dark:bg-[#090E19] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isSelfAdmin}
                      onChange={() => toggleRoleSelection(role.roleId)}
                      className="mt-0.5 accent-[#0B5ED7] w-4 h-4 rounded cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold">{roleLabel}</span>
                        <span className="text-[10px] text-slate-400 font-mono">Mã vai trò: #{role.roleId}</span>
                        {isSelfAdmin && (
                          <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                            (Bạn không thể tự bỏ quyền Quản trị viên của chính mình)
                          </span>
                        )}
                      </div>
                      {roleDesc && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                          {roleDesc}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/40 leading-relaxed">
              * Lưu ý: Quản trị viên không thể tự gỡ bỏ quyền Quản trị viên của chính mình. Hệ thống luôn yêu cầu ít nhất một Quản trị viên đang hoạt động và mỗi tài khoản phải có ít nhất một vai trò.
            </p>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRoleModalUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleAssignRolesSubmit}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-[#0B5ED7] hover:bg-[#0a4fb4] text-white font-bold text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {actionLoading && <RefreshCw size={13} className="animate-spin" />}
                <span>Lưu phân quyền</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Lock / Unlock Confirmation */}
      {statusModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#0F1726] w-full max-w-md rounded-3xl border border-slate-200 dark:border-[rgba(148,163,184,0.18)] shadow-2xl p-6 space-y-4 animate-scale-up">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  statusModalUser.isActive
                    ? "bg-rose-50 text-rose-600 dark:bg-rose-950/60"
                    : "bg-blue-50 text-[#0B5ED7] dark:bg-blue-950/60"
                }`}
              >
                {statusModalUser.isActive ? <Lock size={20} /> : <Unlock size={20} />}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {statusModalUser.isActive ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {statusModalUser.fullName} ({statusModalUser.email})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {statusModalUser.isActive
                ? "Bạn có chắc chắn muốn khóa tài khoản này? Người dùng sẽ bị từ chối truy cập và không thể đăng nhập vào nền tảng cho đến khi được mở khóa lại."
                : "Bạn có chắc chắn muốn kích hoạt lại tài khoản này? Người dùng sẽ có thể đăng nhập và tiếp tục sử dụng hệ thống bình thường."}
            </p>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setStatusModalUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleUpdateStatusConfirm}
                disabled={actionLoading}
                className={`px-4 py-2 rounded-xl text-white font-bold text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ${
                  statusModalUser.isActive
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-[#0B5ED7] hover:bg-[#0a4fb4]"
                }`}
              >
                {actionLoading && <RefreshCw size={13} className="animate-spin" />}
                <span>{statusModalUser.isActive ? "Xác nhận khóa" : "Xác nhận mở khóa"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;

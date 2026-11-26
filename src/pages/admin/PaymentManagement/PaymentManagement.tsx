import React, { useEffect, useState, useCallback } from "react";
import {
  CreditCard,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Edit3,
  X,
  AlertCircle,
  Coins,
  Gift,
  ToggleLeft,
  ToggleRight,
  Layers,
} from "lucide-react";
import adminApi from "../../../api/adminApi";
import {
  CreditPackageAdminItem,
  CreateCreditPackageRequest,
  PatchCreditPackageRequest,
} from "../../../types";

const PaymentManagement: React.FC = () => {
  const [packages, setPackages] = useState<CreditPackageAdminItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingPackage, setEditingPackage] = useState<CreditPackageAdminItem | null>(null);

  // Form states
  const [formData, setFormData] = useState<{
    packageCode: string;
    packageName: string;
    price: number;
    currency: string;
    creditAmount: number;
    bonusCredit: number;
    isActive: boolean;
  }>({
    packageCode: "",
    packageName: "",
    price: 50000,
    currency: "VND",
    creditAmount: 50,
    bonusCredit: 0,
    isActive: true,
  });

  // Fetch packages from real API: GET /api/admin/credit-packages
  const fetchPackages = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await adminApi.getCreditPackages();
      if (res && res.success && res.data) {
        setPackages(res.data);
      } else {
        setErrorMsg(res?.message || "Không thể tải danh sách gói nạp.");
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setErrorMsg(errObj?.message || "Lỗi khi kết nối đến dịch vụ thanh toán.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setFormData({
      packageCode: "",
      packageName: "",
      price: 50000,
      currency: "VND",
      creditAmount: 50,
      bonusCredit: 0,
      isActive: true,
    });
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (pkg: CreditPackageAdminItem) => {
    setEditingPackage(pkg);
    setFormData({
      packageCode: pkg.packageCode,
      packageName: pkg.packageName,
      price: pkg.price,
      currency: pkg.currency || "VND",
      creditAmount: pkg.creditAmount,
      bonusCredit: pkg.bonusCredit || 0,
      isActive: pkg.isActive,
    });
  };

  // Submit Create: POST /api/admin/credit-packages
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const payload: CreateCreditPackageRequest = {
        packageCode: formData.packageCode.trim().toUpperCase(),
        packageName: formData.packageName.trim(),
        price: Number(formData.price),
        currency: "VND",
        creditAmount: Number(formData.creditAmount),
        bonusCredit: Number(formData.bonusCredit) || 0,
        isActive: formData.isActive,
      };

      const res = await adminApi.createCreditPackage(payload);
      if (res && res.success) {
        setSuccessMsg(`Tạo gói nạp "${payload.packageName}" thành công.`);
        setIsCreateModalOpen(false);
        fetchPackages();
      } else {
        setErrorMsg(res?.message || "Tạo gói nạp thất bại.");
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setErrorMsg(errObj?.message || "Lỗi khi gửi yêu cầu tạo gói nạp.");
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Edit: PATCH /api/admin/credit-packages/{packageId}
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPackage) return;
    setActionLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const payload: PatchCreditPackageRequest = {
        packageCode: formData.packageCode.trim().toUpperCase(),
        packageName: formData.packageName.trim(),
        price: Number(formData.price),
        currency: "VND",
        creditAmount: Number(formData.creditAmount),
        bonusCredit: Number(formData.bonusCredit),
        isActive: formData.isActive,
      };

      const res = await adminApi.patchCreditPackage(editingPackage.packageId, payload);
      if (res && res.success) {
        setSuccessMsg(`Cập nhật thông tin gói nạp "${formData.packageName}" thành công.`);
        setEditingPackage(null);
        fetchPackages();
      } else {
        setErrorMsg(res?.message || "Cập nhật gói nạp thất bại.");
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setErrorMsg(errObj?.message || "Lỗi khi cập nhật gói nạp.");
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle quick Active status: PATCH /api/admin/credit-packages/{packageId}
  const handleToggleStatus = async (pkg: CreditPackageAdminItem) => {
    setActionLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    const nextStatus = !pkg.isActive;
    try {
      const res = await adminApi.patchCreditPackage(pkg.packageId, { isActive: nextStatus });
      if (res && res.success) {
        setSuccessMsg(
          nextStatus
            ? `Đã kích hoạt mở bán gói "${pkg.packageName}".`
            : `Đã tạm ngưng gói "${pkg.packageName}".`
        );
        fetchPackages();
      } else {
        setErrorMsg(res?.message || "Thay đổi trạng thái thất bại.");
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setErrorMsg(errObj?.message || "Lỗi khi thay đổi trạng thái gói nạp.");
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered packages
  const filteredPackages = packages.filter((p) => {
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.packageName.toLowerCase().includes(q) ||
      p.packageCode.toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && p.isActive) ||
      (statusFilter === "INACTIVE" && !p.isActive);
    return matchesSearch && matchesStatus;
  });

  // Metrics
  const activeCount = packages.filter((p) => p.isActive).length;
  const inactiveCount = packages.filter((p) => !p.isActive).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <CreditCard className="text-[#0B5ED7]" size={26} />
            <span>Quản lý gói nạp điểm tín chỉ</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Thiết lập danh mục các gói nạp credit, khuyến mãi thưởng, bảng giá VNĐ và kích hoạt bán qua cổng PayOS.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={fetchPackages}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#162032] hover:bg-slate-100 dark:hover:bg-[#1D2B45] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[rgba(148,163,184,0.18)] text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-[#0B5ED7]" : ""} />
            <span>Làm mới</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0B5ED7] hover:bg-[#0a4fb4] text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <Plus size={14} />
            <span>Thêm gói nạp mới</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
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
            <CheckCircle2 size={16} className="text-[#0B5ED7] shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg("")} className="text-blue-500 hover:text-blue-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#0F1726] p-4.5 rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tổng số gói nạp</p>
            <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5">{packages.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
            <Layers size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-[#0F1726] p-4.5 rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Đang mở bán</p>
            <p className="text-2xl font-black text-[#0B5ED7] mt-0.5">{activeCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#0B5ED7] flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-[#0F1726] p-4.5 rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tạm ngưng bán</p>
            <p className="text-2xl font-black text-slate-400 mt-0.5">{inactiveCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-500 flex items-center justify-center">
            <XCircle size={20} />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-[#0F1726] p-4 rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên hoặc mã gói... (STARTER, PRO)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7] text-slate-800 dark:text-slate-200"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <Filter size={13} className="text-slate-400" />
          <span className="text-[11px] font-bold text-slate-500 uppercase">Trạng thái:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7] font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value="ALL">Tất cả gói nạp</option>
            <option value="ACTIVE">Đang mở bán</option>
            <option value="INACTIVE">Tạm ngưng</option>
          </select>
        </div>
      </div>

      {/* Credit Packages Grid Cards */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-white dark:bg-[#0F1726] rounded-3xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)]">
          <RefreshCw size={24} className="animate-spin text-[#0B5ED7] mx-auto mb-2" />
          <span>Đang tải danh mục gói nạp từ máy chủ Backend...</span>
        </div>
      ) : filteredPackages.length === 0 ? (
        <div className="p-12 text-center text-slate-400 text-xs bg-white dark:bg-[#0F1726] rounded-3xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)]">
          Không tìm thấy gói nạp điểm nào phù hợp với bộ lọc.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPackages.map((pkg) => {
            const totalCredits = pkg.creditAmount + (pkg.bonusCredit || 0);

            return (
              <div
                key={pkg.packageId}
                className={`bg-white dark:bg-[#0F1726] rounded-3xl border p-5.5 shadow-xs flex flex-col justify-between transition-all hover:border-[#0B5ED7]/50 group relative ${
                  pkg.isActive
                    ? "border-slate-200/80 dark:border-[rgba(148,163,184,0.18)]"
                    : "border-slate-200/60 dark:border-slate-800 opacity-75"
                }`}
              >
                <div className="space-y-4">
                  {/* Top Bar in Card */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-black px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      #{pkg.packageCode}
                    </span>

                    {pkg.isActive ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full">
                        <CheckCircle2 size={12} /> Đang mở bán
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">
                        <XCircle size={12} /> Tạm ngưng
                      </span>
                    )}
                  </div>

                  {/* Package Name & Price */}
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
                      {pkg.packageName}
                    </h3>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className="text-2xl font-black text-[#0B5ED7]">
                        {pkg.price.toLocaleString("vi-VN")}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        {pkg.currency || "VNĐ"}
                      </span>
                    </div>
                  </div>

                  {/* Credit Details */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#090E19] space-y-2 border border-slate-100 dark:border-slate-800/80 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Coins size={14} className="text-amber-500" />
                        Điểm tín chỉ chính:
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {pkg.creditAmount.toLocaleString()} Credit
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Gift size={14} className="text-rose-500" />
                        Điểm thưởng thêm:
                      </span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        +{pkg.bonusCredit.toLocaleString()} Bonus
                      </span>
                    </div>

                    <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between font-bold">
                      <span className="text-slate-600 dark:text-slate-300">Tổng nhận được:</span>
                      <span className="text-sm font-black text-[#0B5ED7]">
                        {totalCredits.toLocaleString()} Credit
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-[rgba(148,163,184,0.12)] flex items-center justify-between">
                  {/* Quick Toggle Active Button */}
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(pkg)}
                    disabled={actionLoading}
                    className={`inline-flex items-center gap-1 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                      pkg.isActive
                        ? "text-slate-500 hover:text-rose-600"
                        : "text-[#0B5ED7] hover:text-[#0a4fb4]"
                    }`}
                    title={pkg.isActive ? "Nhấn để tạm ngưng gói" : "Nhấn để mở bán gói"}
                  >
                    {pkg.isActive ? (
                      <>
                        <ToggleRight size={18} className="text-blue-600" />
                        <span>Đang bán</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft size={18} className="text-slate-400" />
                        <span>Kích hoạt</span>
                      </>
                    )}
                  </button>

                  {/* Edit Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(pkg)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-[#0B5ED7] dark:text-blue-300 text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                  >
                    <Edit3 size={13} />
                    <span>Chỉnh sửa</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Thêm gói nạp mới (POST /api/admin/credit-packages) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#0F1726] w-full max-w-lg rounded-3xl border border-slate-200 dark:border-[rgba(148,163,184,0.18)] shadow-2xl p-6 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[rgba(148,163,184,0.12)]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#0B5ED7] flex items-center justify-center">
                  <CreditCard size={16} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Thêm gói nạp điểm mới
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Mã định danh gói <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: STARTER, PRO, VIP"
                    value={formData.packageCode}
                    onChange={(e) => setFormData({ ...formData, packageCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Giá bán (VNĐ) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={1000}
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tên gói nạp hiển thị <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Gói Khởi Động Tranh Biện, Gói Cao Cấp"
                  value={formData.packageName}
                  onChange={(e) => setFormData({ ...formData, packageName: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Số điểm Credit chính <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formData.creditAmount}
                    onChange={(e) => setFormData({ ...formData, creditAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Credit tặng kèm (Khuyến mãi)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.bonusCredit}
                    onChange={(e) => setFormData({ ...formData, bonusCredit: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7]"
                  />
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 accent-[#0B5ED7] rounded cursor-pointer"
                  />
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Kích hoạt mở bán ngay trên cổng nạp học viên
                  </span>
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-[rgba(148,163,184,0.12)]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-[#0B5ED7] hover:bg-[#0a4fb4] text-white font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {actionLoading && <RefreshCw size={13} className="animate-spin" />}
                  <span>Tạo gói nạp</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Chỉnh sửa gói nạp (PATCH /api/admin/credit-packages/{packageId}) */}
      {editingPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#0F1726] w-full max-w-lg rounded-3xl border border-slate-200 dark:border-[rgba(148,163,184,0.18)] shadow-2xl p-6 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[rgba(148,163,184,0.12)]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#0B5ED7] flex items-center justify-center">
                  <Edit3 size={16} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Chỉnh sửa gói nạp #{editingPackage.packageId}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingPackage(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Mã định danh gói <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.packageCode}
                    onChange={(e) => setFormData({ ...formData, packageCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Giá bán (VNĐ) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={1000}
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tên gói nạp hiển thị <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.packageName}
                  onChange={(e) => setFormData({ ...formData, packageName: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Số điểm Credit chính <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formData.creditAmount}
                    onChange={(e) => setFormData({ ...formData, creditAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Credit tặng kèm (Khuyến mãi)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.bonusCredit}
                    onChange={(e) => setFormData({ ...formData, bonusCredit: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7]"
                  />
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 accent-[#0B5ED7] rounded cursor-pointer"
                  />
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Mở bán gói nạp này (Hiển thị cho học viên trên trang nạp tiền)
                  </span>
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-[rgba(148,163,184,0.12)]">
                <button
                  type="button"
                  onClick={() => setEditingPackage(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-[#0B5ED7] hover:bg-[#0a4fb4] text-white font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {actionLoading && <RefreshCw size={13} className="animate-spin" />}
                  <span>Lưu thay đổi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentManagement;

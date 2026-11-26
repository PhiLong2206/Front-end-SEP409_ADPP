import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Shield,
  ShieldCheck,
  Check,
  X,
  RefreshCw,
  Users,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import adminApi from "../../../api/adminApi";
import { AdminRoleItem } from "../../../types";

interface RolePermission {
  module: string;
  description: string;
  admin: boolean;
  organizer: boolean;
  debater: boolean;
}

const getRoleDisplayName = (roleName: string) => {
  switch (roleName.toLowerCase()) {
    case "admin":
      return "Quản trị viên";
    case "lecturer":
    case "educator":
    case "organizer":
      return "Giảng viên";
    case "member":
    case "learner":
    case "debater":
      return "Học viên";
    case "moderator":
      return "Kiểm duyệt viên";
    default:
      return roleName;
  }
};

const getRoleDescription = (role: AdminRoleItem) => {
  const name = role.roleName.toLowerCase();
  if (name === "admin") {
    return "Quản trị viên có toàn quyền quản lý hệ thống, kiểm soát người dùng và thiết lập bảo mật nền tảng.";
  }
  if (name === "lecturer" || name === "educator" || name === "organizer") {
    return "Giảng viên có quyền tạo đề tài, tổ chức và chấm điểm các giải đấu, cuộc thi tranh biện.";
  }
  if (name === "member" || name === "learner" || name === "debater") {
    return "Học viên tiêu chuẩn có quyền tham gia luyện tập với AI, thi đấu 1v1, 2v2 và tích lũy điểm số.";
  }
  if (name === "moderator") {
    return "Kiểm duyệt viên có quyền giám sát nội dung, kiểm duyệt các chủ đề và báo cáo vi phạm.";
  }
  return role.description || `Vai trò ${role.roleName} trong hệ thống tranh biện trực tuyến ADPP.`;
};

const RoleManagement: React.FC = () => {
  const [roles, setRoles] = useState<AdminRoleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const fetchRoles = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminApi.getRoles();
      if (res && res.success && res.data) {
        setRoles(res.data);
      } else {
        setError(res?.message || "Không thể tải danh sách vai trò.");
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setError(errObj?.message || "Lỗi khi tải dữ liệu vai trò từ máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const permissions: RolePermission[] = [
    {
      module: "Truy cập Cổng Quản trị hệ thống",
      description: "Xem bảng điều khiển tổng quan, quản lý hạ tầng và kiểm soát hệ thống",
      admin: true,
      organizer: false,
      debater: false,
    },
    {
      module: "Kiểm duyệt & Quản lý Chủ đề tranh biện",
      description: "Thêm mới, chỉnh sửa, xóa và xuất bản các chủ đề kiến nghị toàn nền tảng",
      admin: true,
      organizer: true,
      debater: false,
    },
    {
      module: "Quản lý Người dùng & Phân quyền",
      description: "Khóa hoặc mở khóa tài khoản người dùng, gán các vai trò hệ thống",
      admin: true,
      organizer: false,
      debater: false,
    },
    {
      module: "Quản lý Gói nạp & Giao dịch điểm tín chỉ",
      description: "Thiết lập danh mục gói nạp và kiểm tra lịch sử thanh toán",
      admin: true,
      organizer: false,
      debater: false,
    },
    {
      module: "Tổ chức Giải đấu & Cuộc thi tranh biện",
      description: "Khởi tạo cuộc thi tranh biện, xét duyệt đội thi và ban giám khảo chấm điểm",
      admin: true,
      organizer: true,
      debater: false,
    },
    {
      module: "Luyện tập Tranh biện cùng Trí tuệ Nhân tạo",
      description: "Khởi tạo phòng đấu luyện tập với đối thủ AI và nhận đánh giá tự động",
      admin: true,
      organizer: true,
      debater: true,
    },
    {
      module: "Tham gia Tranh biện Đối kháng 1 vs 1 & 2 vs 2",
      description: "Thi đấu trực tiếp cùng các học viên khác trong thời gian thực",
      admin: true,
      organizer: true,
      debater: true,
    },
    {
      module: "Tự ý thay đổi vai trò cá nhân",
      description: "Nghiêm cấm tự nâng quyền từ giao diện người dùng nhằm bảo vệ an toàn hệ thống",
      admin: false,
      organizer: false,
      debater: false,
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Phân quyền vai trò
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Danh sách các vai trò chuẩn và ma trận quyền hạn tương ứng trên toàn hệ thống ADPP.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            to="/admin/users"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0B5ED7] hover:bg-[#0a4fb4] text-white text-xs font-bold transition-all shadow-xs"
          >
            <Users size={13} />
            <span>Phân quyền người dùng</span>
            <ArrowRight size={13} />
          </Link>
          <button
            type="button"
            onClick={fetchRoles}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#162032] hover:bg-slate-100 dark:hover:bg-[#1D2B45] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[rgba(148,163,184,0.18)] text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-[#0B5ED7]" : ""} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Dynamic Role Cards */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Danh sách vai trò chuẩn trong hệ thống
          </h2>
          <span className="text-xs font-bold text-[#0B5ED7]">
            {roles.length} vai trò khả dụng
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 bg-white dark:bg-[#0F1726] rounded-3xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)]">
            <RefreshCw size={24} className="animate-spin text-[#0B5ED7] mx-auto mb-2" />
            <span>Đang tải danh sách vai trò từ máy chủ...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {roles.map((r) => {
              const isAdmin = r.roleName.toLowerCase() === "admin";
              const isOrganizer =
                r.roleName.toLowerCase() === "organizer" ||
                r.roleName.toLowerCase() === "educator" ||
                r.roleName.toLowerCase() === "lecturer";
              const isDebater =
                r.roleName.toLowerCase() === "debater" ||
                r.roleName.toLowerCase() === "learner" ||
                r.roleName.toLowerCase() === "member";

              return (
                <div
                  key={r.roleId}
                  className={`bg-white dark:bg-[#0F1726] p-5 rounded-3xl border shadow-xs flex flex-col justify-between transition-all hover:border-[#0B5ED7]/40 ${
                    isAdmin
                      ? "border-2 border-[#0B5ED7]/50"
                      : "border-slate-200/80 dark:border-[rgba(148,163,184,0.18)]"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${
                          isAdmin
                            ? "bg-rose-50 text-rose-600 dark:bg-rose-950/60"
                            : isOrganizer
                            ? "bg-amber-50 text-amber-600 dark:bg-amber-950/60"
                            : isDebater
                            ? "bg-blue-50 text-[#0B5ED7] dark:bg-blue-950/60"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800"
                        }`}
                      >
                        {isAdmin ? <ShieldCheck size={22} /> : <Shield size={22} />}
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold">
                        Mã vai trò: #{r.roleId}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                        {getRoleDisplayName(r.roleName)}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-3 leading-relaxed">
                        {getRoleDescription(r)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[rgba(148,163,184,0.12)] flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-medium">Định danh: {r.roleName}</span>
                    <Link
                      to={`/admin/users?role=${r.roleName}`}
                      className="font-bold text-[#0B5ED7] hover:underline"
                    >
                      Xem người dùng
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Permissions Matrix Table */}
      <div className="bg-white dark:bg-[#0F1726] rounded-3xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Ma trận phân quyền chức năng
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Chi tiết các chức năng được cấp phép cho từng vai trò trong hệ thống ADPP.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-[#090E19] text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-4 py-3 rounded-l-xl">Chức năng / Phân hệ</th>
                <th className="px-4 py-3">Mô tả chi tiết</th>
                <th className="px-4 py-3 text-center">Quản trị viên</th>
                <th className="px-4 py-3 text-center">Giảng viên</th>
                <th className="px-4 py-3 rounded-r-xl text-center">Học viên</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[rgba(148,163,184,0.12)]">
              {permissions.map((p, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-[#162032]/40 transition-colors">
                  <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-slate-200">
                    {p.module}
                  </td>
                  <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">
                    {p.description}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {p.admin ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950/60 text-[#0B5ED7]">
                        <Check size={14} />
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                        <X size={14} />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {p.organizer ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950/60 text-[#0B5ED7]">
                        <Check size={14} />
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                        <X size={14} />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {p.debater ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950/60 text-[#0B5ED7]">
                        <Check size={14} />
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                        <X size={14} />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RoleManagement;

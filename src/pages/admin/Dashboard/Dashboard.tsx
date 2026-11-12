import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import adminApi from "../../../api/adminApi";
import topicApi from "../../../api/topicApi";
import { Topic, AdminDashboardStats } from "../../../types";
import {
  Users,
  BookOpen,
  Swords,
  Activity,
  ShieldCheck,
  CreditCard,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  ArrowRight,
  User,
  Settings,
} from "lucide-react";

interface ServiceStatus {
  name: string;
  endpoint: string;
  status: "connected" | "pending" | "loading";
  note: string;
}

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();

  // Metrics state (Real API from GET /api/admin/dashboard/stats)
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [recentTopics, setRecentTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [adminAuthStatus, setAdminAuthStatus] = useState<"checking" | "verified" | "failed">("checking");
  const [lastRefreshed, setLastRefreshed] = useState<string>("");

  const [services, setServices] = useState<ServiceStatus[]>([
    {
      name: "Thống kê tổng quan (Dashboard Stats)",
      endpoint: "GET /api/admin/dashboard/stats",
      status: "loading",
      note: "Tổng hợp số liệu Users, Debate Sessions và Topics từ Database",
    },
    {
      name: "Quản lý Người dùng (Identity RBAC)",
      endpoint: "GET /api/admin/users",
      status: "loading",
      note: "Truy vấn danh sách, phân trang, khóa tài khoản và phân quyền",
    },
    {
      name: "Danh mục Vai trò (Roles Master)",
      endpoint: "GET /api/admin/roles",
      status: "loading",
      note: "Danh sách 4 vai trò chuẩn hệ thống (Admin, Organizer, Debater, Guest)",
    },
    {
      name: "Quản lý Chủ đề tranh biện (Debate)",
      endpoint: "GET /api/topics",
      status: "loading",
      note: "Truy vấn danh mục chủ đề và kiến nghị từ Database",
    },
  ]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setAdminAuthStatus("checking");

    // 1. Fetch real stats & verify Admin authorization: GET /api/admin/dashboard/stats
    try {
      const statsRes = await adminApi.getDashboardStats().catch(() => null);
      if (statsRes && statsRes.success && statsRes.data) {
        setAdminAuthStatus("verified");
        setStats(statsRes.data);
        setServices((prev) =>
          prev.map((s) =>
            s.endpoint === "GET /api/admin/dashboard/stats"
              ? { ...s, status: "connected", note: `Đã kết nối thành công: ${statsRes.data?.totalUsers} Người dùng, ${statsRes.data?.totalDebateSessions} Phiên tranh biện, ${statsRes.data?.totalTopics} Chủ đề` }
              : s
          )
        );
      } else {
        setAdminAuthStatus("failed");
      }
    } catch {
      setAdminAuthStatus("failed");
    }

    // 3. Query real topics from Backend: GET /api/topics
    try {
      const topicsRes = await topicApi.getAll({ pageNumber: 1, pageSize: 5 }).catch(() => null);
      if (topicsRes && topicsRes.success && topicsRes.data) {
        const rawData = topicsRes.data as unknown as {
          totalCount?: number;
          items?: Topic[];
        };
        setRecentTopics(rawData.items || []);
        setServices((prev) =>
          prev.map((s) =>
            s.endpoint === "GET /api/topics"
              ? { ...s, status: "connected", note: "Kết nối thành công với kho chủ đề tranh biện" }
              : s
          )
        );
      }
    } catch {
      // Keep empty
    }

    // 4. Test Roles and Users endpoint connectivity for diagnostic panel
    try {
      const [usersRes, rolesRes] = await Promise.all([
        adminApi.getUsers({ pageNumber: 1, pageSize: 1 }).catch(() => null),
        adminApi.getRoles().catch(() => null),
      ]);

      setServices((prev) =>
        prev.map((s) => {
          if (s.endpoint === "GET /api/admin/users") {
            return usersRes && usersRes.success
              ? { ...s, status: "connected", note: "API Người dùng hoạt động bình thường" }
              : { ...s, status: "pending", note: "Lỗi kết nối API người dùng" };
          }
          if (s.endpoint === "GET /api/admin/roles") {
            return rolesRes && rolesRes.success
              ? { ...s, status: "connected", note: `API vai trò sẵn sàng (${rolesRes.data?.length ?? 4} vai trò)` }
              : { ...s, status: "pending", note: "Lỗi kết nối API vai trò" };
          }
          return s;
        })
      );
    } catch {
      // Continue
    }

    setLastRefreshed(new Date().toLocaleTimeString("vi-VN"));
    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Top Banner: Greeting, Role Badge & Controls */}
      <div className="bg-white dark:bg-[#12231C] rounded-3xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] p-6 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Bảng điều khiển Quản trị viên
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/80 text-[#008A64] dark:text-emerald-300 border border-[#008A64]/30">
              Vai trò: Quản trị viên
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Xin chào, <span className="font-bold text-slate-800 dark:text-slate-200">{user?.fullName || user?.email || "Quản trị viên"}</span>. Hệ thống phân quyền vai trò đang hoạt động trên nền tảng ADPP.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          {/* Admin API verification indicator */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
              adminAuthStatus === "verified"
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-[#008A64] dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40"
                : adminAuthStatus === "checking"
                ? "bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200"
                : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200"
            }`}
            title="Trạng thái xác thực quyền Quản trị viên"
          >
            {adminAuthStatus === "verified" ? (
              <CheckCircle2 size={14} className="text-[#008A64]" />
            ) : adminAuthStatus === "checking" ? (
              <Clock size={14} className="animate-spin text-slate-400" />
            ) : (
              <AlertCircle size={14} className="text-amber-600" />
            )}
            <span>
              {adminAuthStatus === "verified"
                ? "Quyền Quản trị: Hợp lệ"
                : adminAuthStatus === "checking"
                ? "Đang xác thực..."
                : "Chưa kích hoạt"}
            </span>
          </div>

          <button
            type="button"
            onClick={fetchDashboardData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#1A2E26] hover:bg-slate-100 dark:hover:bg-[#233F34] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[rgba(148,163,184,0.18)] text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
            title="Làm mới số liệu"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-[#008A64]" : ""} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* 4 Required Metric Cards: Total Users, Total Debates, Total Topics, Active Users */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Chỉ số vận hành hệ thống
          </h2>
          {lastRefreshed && (
            <span className="text-[11px] text-slate-400">
              Cập nhật lần cuối: {lastRefreshed}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Card 1: Total Users */}
          <div className="bg-white dark:bg-[#12231C] p-5 rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] shadow-xs flex flex-col justify-between transition-all hover:border-[#008A64]/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Tổng người dùng
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-[#008A64] dark:text-emerald-400 flex items-center justify-center">
                <Users size={18} />
              </div>
            </div>
            <div className="mt-4">
              {stats !== null ? (
                <div className="space-y-1">
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                    {stats.totalUsers.toLocaleString()}
                  </p>
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#008A64] dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/80 dark:border-emerald-800/40">
                    <CheckCircle2 size={11} /> Dữ liệu thời gian thực
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-2xl font-black text-slate-300 dark:text-slate-600">--</p>
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                    {loading ? "Đang tải dữ liệu..." : "Chưa có dữ liệu"}
                  </span>
                </div>
              )}
              <p className="text-[11px] text-slate-400 mt-2 truncate">
                Tài khoản toàn hệ thống ADPP
              </p>
            </div>
          </div>

          {/* Card 2: Total Debate Sessions */}
          <div className="bg-white dark:bg-[#12231C] p-5 rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] shadow-xs flex flex-col justify-between transition-all hover:border-[#008A64]/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Tổng phiên tranh biện
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-[#008A64] dark:text-emerald-400 flex items-center justify-center">
                <Swords size={18} />
              </div>
            </div>
            <div className="mt-4">
              {stats !== null ? (
                <div className="space-y-1">
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                    {stats.totalDebateSessions.toLocaleString()}
                  </p>
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#008A64] dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/80 dark:border-emerald-800/40">
                    <CheckCircle2 size={11} /> Luyện tập AI & Thi đấu
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-2xl font-black text-slate-300 dark:text-slate-600">--</p>
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                    {loading ? "Đang tải dữ liệu..." : "Chưa có dữ liệu"}
                  </span>
                </div>
              )}
              <p className="text-[11px] text-slate-400 mt-2 truncate">
                Phiên AI Practice, 1v1 & 2v2
              </p>
            </div>
          </div>

          {/* Card 3: Total Topics */}
          <div className="bg-white dark:bg-[#12231C] p-5 rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] shadow-xs flex flex-col justify-between transition-all hover:border-[#008A64]/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Tổng chủ đề
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-[#008A64] dark:text-emerald-400 flex items-center justify-center">
                <BookOpen size={18} />
              </div>
            </div>
            <div className="mt-4">
              {stats !== null ? (
                <div className="space-y-1">
                  <p className="text-2xl sm:text-3xl font-black text-[#008A64] dark:text-emerald-400 tracking-tight">
                    {stats.totalTopics}
                  </p>
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#008A64] dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/80 dark:border-emerald-800/40">
                    <CheckCircle2 size={11} /> Đang hoạt động
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-2xl font-black text-slate-300 dark:text-slate-600">--</p>
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                    {loading ? "Đang tải dữ liệu..." : "Chưa có dữ liệu"}
                  </span>
                </div>
              )}
              <p className="text-[11px] text-slate-400 mt-2 truncate">
                Kiến nghị tranh biện có sẵn trong Database
              </p>
            </div>
          </div>

          {/* Card 4: System Status */}
          <div className="bg-white dark:bg-[#12231C] p-5 rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] shadow-xs flex flex-col justify-between transition-all hover:border-[#008A64]/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Hệ thống Quản trị
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-[#008A64] dark:text-emerald-400 flex items-center justify-center">
                <Activity size={18} />
              </div>
            </div>
            <div className="mt-4">
              <div className="space-y-1">
                <p className="text-2xl sm:text-3xl font-black text-[#008A64] dark:text-emerald-400 tracking-tight">
                  {services.filter((s) => s.status === "connected").length}/{services.length} Dịch vụ
                </p>
                <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#008A64] dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/80 dark:border-emerald-800/40">
                  <CheckCircle2 size={11} /> Bảo mật vai trò đầy đủ
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 truncate">
                Hệ thống máy chủ đang hoạt động ổn định
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Navigation Hub: Streamlined to match the active scope */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 px-1">
          Các phân hệ quản trị chính
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Module 1: Users */}
          <Link
            to="/admin/users"
            className="group bg-white dark:bg-[#12231C] p-5 rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] hover:border-[#008A64] hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-[#008A64] dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users size={20} />
                </div>
                <ArrowRight size={16} className="text-slate-300 group-hover:text-[#008A64] group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#008A64] transition-colors">
                Quản lý người dùng
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                Danh sách tài khoản học viên và giảng viên, tìm kiếm, lọc theo vai trò và trạng thái khóa/kích hoạt.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[rgba(148,163,184,0.12)] flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Đường dẫn: /admin/users</span>
              <span className="font-bold text-[#008A64] dark:text-emerald-400">Truy cập</span>
            </div>
          </Link>

          {/* Module 2: Roles */}
          <Link
            to="/admin/roles"
            className="group bg-white dark:bg-[#12231C] p-5 rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] hover:border-[#008A64] hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-[#008A64] dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ShieldCheck size={20} />
                </div>
                <ArrowRight size={16} className="text-slate-300 group-hover:text-[#008A64] group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#008A64] transition-colors">
                Phân quyền vai trò
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                Ma trận quyền hạn RBAC giữa Administrator, Organizer và Debater. Quản trị chính sách bảo mật hệ thống.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[rgba(148,163,184,0.12)] flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Đường dẫn: /admin/roles</span>
              <span className="font-bold text-[#008A64] dark:text-emerald-400">Truy cập</span>
            </div>
          </Link>

          {/* Module 3: Topics */}
          <Link
            to="/admin/topics"
            className="group bg-white dark:bg-[#12231C] p-5 rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] hover:border-[#008A64] hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-[#008A64] dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <BookOpen size={20} />
                </div>
                <ArrowRight size={16} className="text-slate-300 group-hover:text-[#008A64] group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#008A64] transition-colors">
                Quản lý chủ đề
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                Kiểm duyệt danh mục chủ đề tranh biện, phân loại danh mục, cấp độ khó và nguồn tài liệu tham khảo.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[rgba(148,163,184,0.12)] flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Đường dẫn: /admin/topics</span>
              <span className="font-bold text-[#008A64] dark:text-emerald-400">Truy cập</span>
            </div>
          </Link>

          {/* Module 4: Payments & Credit Packages */}
          <Link
            to="/admin/payments"
            className="group bg-white dark:bg-[#12231C] p-5 rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] hover:border-[#008A64] hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-[#008A64] dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CreditCard size={20} />
                </div>
                <ArrowRight size={16} className="text-slate-300 group-hover:text-[#008A64] group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#008A64] transition-colors">
                Gói Credit & Giao dịch
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                Quản lý danh sách gói nạp credit tranh biện thông qua API Backend [Authorize(Roles = 'Admin')].
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[rgba(148,163,184,0.12)] flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Đường dẫn: /admin/payments</span>
              <span className="font-bold text-[#008A64] dark:text-emerald-400">Truy cập</span>
            </div>
          </Link>

          {/* Module 5: Profile */}
          <Link
            to="/admin/profile"
            className="group bg-white dark:bg-[#12231C] p-5 rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] hover:border-[#008A64] hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-[#008A64] dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <User size={20} />
                </div>
                <ArrowRight size={16} className="text-slate-300 group-hover:text-[#008A64] group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#008A64] transition-colors">
                Hồ sơ cá nhân Admin
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                Xem và cập nhật thông tin họ tên, email, ảnh đại diện tài khoản quản trị viên.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[rgba(148,163,184,0.12)] flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Đường dẫn: /admin/profile</span>
              <span className="font-bold text-[#008A64] dark:text-emerald-400">Truy cập</span>
            </div>
          </Link>

          {/* Module 6: Settings */}
          <Link
            to="/admin/settings"
            className="group bg-white dark:bg-[#12231C] p-5 rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] hover:border-[#008A64] hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-[#008A64] dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Settings size={20} />
                </div>
                <ArrowRight size={16} className="text-slate-300 group-hover:text-[#008A64] group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#008A64] transition-colors">
                Cài đặt & Tùy chọn
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                Tùy chỉnh thông báo, bảo mật mật khẩu tài khoản và các cài đặt trải nghiệm nền tảng.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[rgba(148,163,184,0.12)] flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Đường dẫn: /admin/settings</span>
              <span className="font-bold text-[#008A64] dark:text-emerald-400">Truy cập</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Backend Integration Diagnostics Panel (Transparency regarding BE status) */}
      <div className="bg-white dark:bg-[#12231C] rounded-3xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-100 dark:bg-[#1A2E26] text-slate-700 dark:text-slate-300">
              <Layers size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Hiện trạng kết nối các dịch vụ quản trị
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Báo cáo tính sẵn sàng của các cổng kết nối và phân hệ dịch vụ
              </p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-[rgba(148,163,184,0.12)]">
          {services.map((svc, idx) => (
            <div key={idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {svc.name}
                  </span>
                  <code className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {svc.endpoint}
                  </code>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {svc.note}
                </p>
              </div>

              <div className="shrink-0">
                {svc.status === "connected" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-[#008A64] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                    <CheckCircle2 size={12} />
                    <span>Đã kết nối</span>
                  </span>
                )}
                {svc.status === "pending" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                    <Clock size={12} />
                    <span>Chờ kết nối máy chủ</span>
                  </span>
                )}
                {svc.status === "loading" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <Clock size={12} className="animate-spin" />
                    <span>Đang kiểm tra...</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Real Live Data: Recent Topics from Backend */}
      <div className="bg-white dark:bg-[#12231C] rounded-3xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Chủ đề tranh biện gần đây
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Danh mục các kiến nghị vừa được cập nhật trong cơ sở dữ liệu hệ thống
            </p>
          </div>
          <Link
            to="/admin/topics"
            className="text-xs font-bold text-[#008A64] dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            <span>Xem tất cả</span>
            <ExternalLink size={12} />
          </Link>
        </div>

        {recentTopics.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#0B1713] text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3 rounded-l-xl">Mã ID</th>
                  <th className="px-4 py-3">Tiêu đề chủ đề tranh biện</th>
                  <th className="px-4 py-3">Danh mục</th>
                  <th className="px-4 py-3">Độ khó</th>
                  <th className="px-4 py-3 rounded-r-xl text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[rgba(148,163,184,0.12)]">
                {recentTopics.map((topic, idx) => {
                  const topicId = (topic as unknown as { topicId?: number; id?: number }).topicId ?? (topic as unknown as { id?: number }).id ?? idx + 1;
                  const difficultyLabel =
                    topic.difficulty === "Easy"
                      ? "Dễ"
                      : topic.difficulty === "Hard"
                      ? "Khó"
                      : "Trung bình";
                  return (
                    <tr key={String(topicId)} className="hover:bg-slate-50/60 dark:hover:bg-[#1A2E26]/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-slate-400">#{topicId}</td>
                      <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200 max-w-md truncate">
                        {topic.title}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium text-[11px]">
                          {topic.category || "Chung"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-[#008A64] dark:text-emerald-300 font-bold text-[11px]">
                          {difficultyLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/debater/topics/${topicId}`}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#008A64] hover:underline"
                        >
                          <span>Chi tiết</span>
                          <ArrowRight size={11} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400 text-xs">
            {loading ? "Đang tải dữ liệu từ máy chủ..." : "Chưa có chủ đề nào trong cơ sở dữ liệu."}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;

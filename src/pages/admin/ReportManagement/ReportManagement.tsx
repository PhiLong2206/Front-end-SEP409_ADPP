import React, { useState } from "react";
import { AlertTriangle, Search, Filter, RefreshCw, Clock } from "lucide-react";

const ReportManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const loading = false;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Quản lý Báo cáo & Khiếu nại
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Xử lý các khiếu nại về hành vi phi thể thao, vi phạm chuẩn mực tranh biện hoặc phúc khảo điểm số AI.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {}}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#162032] hover:bg-slate-100 dark:hover:bg-[#1D2B45] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[rgba(148,163,184,0.18)] text-xs font-bold transition-all shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={13} className={loading ? "animate-spin text-[#0B5ED7]" : ""} />
          <span>Làm mới danh sách</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-[#0F1726] p-4 rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo người gửi hoặc nội dung..."
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
            <option value="ALL">Tất cả báo cáo</option>
            <option value="Pending">Chờ tiếp nhận</option>
            <option value="Investigating">Đang điều tra</option>
            <option value="Resolved">Đã giải quyết</option>
            <option value="Dismissed">Đã bác bỏ</option>
          </select>
        </div>
      </div>

      {/* Backend Status Box */}
      <div className="bg-white dark:bg-[#0F1726] rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] shadow-xs p-10 text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
          <AlertTriangle size={28} />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            Phân hệ Báo cáo & Khiếu nại (Chờ tích hợp Backend)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
            Hệ thống đã chuẩn bị sẵn sàng giao diện và quy trình xử lý khiếu nại. Hiện tại Database chưa có bảng lưu trữ Report và Backend .NET chưa có endpoint API <code className="text-[#0B5ED7] font-mono">/api/admin/reports</code>.
          </p>
        </div>
        <div className="pt-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <Clock size={12} /> Trạng thái: Chờ triển khai Microservice kiểm duyệt phía Backend
          </span>
        </div>
      </div>
    </div>
  );
};

export default ReportManagement;

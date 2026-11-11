import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { BarChart2, Flame, ArrowRight, Trophy, Calendar, User, Settings, Swords } from "lucide-react";
import CompetitionStatusBadge from "../../../components/competition/CompetitionStatusBadge";
import CompetitionTypeBadge from "../../../components/competition/CompetitionTypeBadge";
import { useAuth } from "../../../hooks/useAuth";
import competitionApi from "../../../api/competitionApi";
import { debateApi } from "../../../api";
import { CompetitionListItem } from "../../../types";
import { formatDate } from "../../../utils/formatDate";
import { isDebateLeaveEnabled } from "../../../utils/debateLeave";
import { countCompletedDebates } from "../../../utils/debateStats";

import natureBg from "../../../assets/images/nature-bg.jpg";

const DebaterDashboard: React.FC = () => {
  const { user } = useAuth();
  const [competitions, setCompetitions] = useState<CompetitionListItem[]>([]);
  const [debateCount, setDebateCount] = useState<number>(0);
  const [loadingComps, setLoadingComps] = useState(false);

  useEffect(() => {
    const loadCompetitions = async () => {
      setLoadingComps(true);
      try {
        const res = await competitionApi.getCompetitions();
        if (res.success && res.data) {
          setCompetitions(res.data.slice(0, 6));
        }
      } catch {
        // Fallback silently if offline
      } finally {
        setLoadingComps(false);
      }
    };

    const loadDebateStats = async () => {
      try {
        const historyRes = await debateApi.getUserHistory();
        if (historyRes.success && Array.isArray(historyRes.data)) {
          setDebateCount(isDebateLeaveEnabled() ? countCompletedDebates(historyRes.data) : historyRes.data.length);
        }
      } catch {
        // Fallback silently
      }
    };

    loadCompetitions();
    loadDebateStats();
  }, []);

  return (
    <div className="space-y-6">
      {/* 1. Header Welcome Banner */}
      <div className="relative overflow-hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 bg-white dark:bg-[#0F1C17] p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] shadow-xs">
        {/* Subtle Nature background image slice on the right */}
        <div
          className="absolute right-0 top-0 bottom-0 w-1/2 bg-cover bg-center bg-no-repeat opacity-25 dark:opacity-15 pointer-events-none hidden md:block"
          style={{ backgroundImage: `url(${natureBg})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-white/40 dark:from-[#0F1C17] dark:via-[#0F1C17]/95 dark:to-[#0F1C17]/50 pointer-events-none" />

        <div className="relative z-10 space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] dark:text-[#F8FAFC] tracking-tight flex items-center gap-2">
            <span>Xin chào, {user?.fullName || user?.email?.split("@")[0] || "bạn"}!</span>
            <span>👋</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 font-normal">
            Chào mừng bạn đến với Nền tảng Luyện tập & Thi đấu Tranh biện ADPP.
          </p>
        </div>

        <Link
          to="/debater/competitions"
          className="relative z-10 inline-flex items-center gap-2 px-6 py-3 bg-[#008A64] hover:bg-[#007457] active:bg-[#005e45] text-white text-sm font-bold rounded-full shadow-md shadow-[#008A64]/20 transition-all duration-200 hover:scale-102 self-start sm:self-auto shrink-0 cursor-pointer"
        >
          <span>Khám phá giải đấu</span>
          <ArrowRight size={16} />
        </Link>
      </div>

      {/* 2. THREE Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        {/* Stat 1 */}
        <div className="bg-white dark:bg-[#12231C] p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] shadow-xs flex items-center justify-between hover:border-[#008A64]/40 hover:shadow-sm transition-all group">
          <div>
            <div className="text-3xl sm:text-4xl font-black text-[#0F172A] dark:text-[#F8FAFC] tracking-tight group-hover:text-[#008A64] dark:group-hover:text-emerald-400 transition-colors">
              {competitions.length}
            </div>
            <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 inline-block">
              Giải đấu trên hệ thống
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-100 dark:border-emerald-500/30 text-[#008A64] dark:text-emerald-400 flex items-center justify-center shadow-xs">
            <Trophy size={22} />
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-white dark:bg-[#12231C] p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] shadow-xs flex items-center justify-between hover:border-[#008A64]/40 hover:shadow-sm transition-all group">
          <div>
            <div className="text-3xl sm:text-4xl font-black text-[#0F172A] dark:text-[#F8FAFC] tracking-tight group-hover:text-[#008A64] dark:group-hover:text-emerald-400 transition-colors">
              {debateCount}
            </div>
            <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 inline-block">
              {isDebateLeaveEnabled() ? "Phiên tranh biện đã hoàn thành" : "Phiên tranh biện đã tham gia"}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-100 dark:border-emerald-500/30 text-[#008A64] dark:text-emerald-400 flex items-center justify-center shadow-xs">
            <BarChart2 size={22} />
          </div>
        </div>

        {/* Stat 3 */}
        <div className="bg-white dark:bg-[#12231C] p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] shadow-xs flex items-center justify-between hover:border-amber-500/40 hover:shadow-sm transition-all group">
          <div>
            <div className="text-3xl sm:text-4xl font-black text-[#0F172A] dark:text-[#F8FAFC] tracking-tight group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors">
              0
            </div>
            <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 inline-block">
              Ngày luyện tập liên tiếp
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/15 border border-amber-100 dark:border-amber-500/30 text-amber-500 dark:text-amber-400 flex items-center justify-center shadow-xs">
            <Flame size={22} />
          </div>
        </div>
      </div>

      {/* 3. Real Competitions from Backend */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Trophy size={14} className="text-amber-500" />
            <span>GIẢI ĐẤU TRANH BIỆN THỰC TẾ (BACKEND)</span>
          </h2>
          <Link
            to="/debater/competitions"
            className="text-xs font-bold text-[#008A64] dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Xem tất cả ({competitions.length})</span>
            <ArrowRight size={12} />
          </Link>
        </div>

        {loadingComps ? (
          <div className="bg-white dark:bg-[#12231C] p-8 rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] text-center text-slate-400 text-sm">
            Đang tải dữ liệu giải đấu từ máy chủ...
          </div>
        ) : competitions.length === 0 ? (
          <div className="bg-white dark:bg-[#12231C] p-8 rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] text-center text-slate-500 text-sm">
            Hiện chưa có giải đấu nào được công bố.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {competitions.map((comp) => (
              <div
                key={comp.competitionId}
                className="bg-white dark:bg-[#12231C] p-5 rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] shadow-xs flex flex-col justify-between hover:border-[#008A64]/40 hover:shadow-sm transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <CompetitionTypeBadge type={comp.competitionType} />
                    <CompetitionStatusBadge status={comp.status} />
                  </div>
                  <h3 className="font-bold text-[#0F172A] dark:text-[#F8FAFC] text-sm sm:text-base line-clamp-2">
                    {comp.title}
                  </h3>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Calendar size={13} className="text-slate-400" />
                    <span>Bắt đầu: {formatDate(comp.startDate)}</span>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-[rgba(148,163,184,0.1)] flex justify-end">
                  <Link
                    to="/debater/competitions"
                    className="text-xs font-bold text-[#008A64] hover:text-[#007457] dark:text-emerald-400 inline-flex items-center gap-1"
                  >
                    <span>Chi tiết giải đấu</span>
                    <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Quick Navigation Cards */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          LỐI TẮT NHANH
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/debater/competitions"
            className="p-5 rounded-2xl bg-white dark:bg-[#12231C] border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] shadow-xs hover:border-[#008A64]/40 hover:shadow-sm transition-all flex items-center gap-4 group"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-500/15 border border-amber-100 dark:border-amber-500/30 text-amber-500 flex items-center justify-center shrink-0">
              <Swords size={22} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] group-hover:text-[#008A64] transition-colors">
                Giải đấu & Cuộc thi
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Đăng ký và tham gia tranh tài
              </p>
            </div>
          </Link>

          <Link
            to="/debater/profile"
            className="p-5 rounded-2xl bg-white dark:bg-[#12231C] border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] shadow-xs hover:border-[#008A64]/40 hover:shadow-sm transition-all flex items-center gap-4 group"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/15 border border-blue-100 dark:border-blue-500/30 text-blue-600 flex items-center justify-center shrink-0">
              <User size={22} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] group-hover:text-[#008A64] transition-colors">
                Hồ sơ học viên
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Xem thông tin tài khoản thật từ BE
              </p>
            </div>
          </Link>

          <Link
            to="/debater/settings"
            className="p-5 rounded-2xl bg-white dark:bg-[#12231C] border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] shadow-xs hover:border-[#008A64]/40 hover:shadow-sm transition-all flex items-center gap-4 group"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-500/15 border border-purple-100 dark:border-purple-500/30 text-purple-600 flex items-center justify-center shrink-0">
              <Settings size={22} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] group-hover:text-[#008A64] transition-colors">
                Cài đặt & Bảo mật
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Đổi mật khẩu & tùy biến giao diện
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DebaterDashboard;

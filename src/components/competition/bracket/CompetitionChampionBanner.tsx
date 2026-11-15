import React from "react";
import { Trophy, Sparkles, Crown } from "lucide-react";

interface Props {
  championName?: string | null;
  championUserId?: number | null;
  championTeamId?: number | null;
  competitionTitle?: string;
  competitionType: "INDIVIDUAL" | "TEAM";
}

const CompetitionChampionBanner: React.FC<Props> = ({
  championName,
  championUserId,
  championTeamId,
  competitionTitle = "Cuộc thi",
  competitionType,
}) => {
  if (!championName && !championUserId && !championTeamId) return null;

  const displayName = championName || (competitionType === "TEAM" ? `Đội Quán Quân #${championTeamId}` : `Thí Sinh Quán Quân #${championUserId}`);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 p-6 sm:p-8 text-white shadow-xl shadow-amber-500/20 animate-fade-in border border-yellow-300">
      {/* Background Decorative Rings */}
      <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10 blur-xl pointer-events-none" />
      <div className="absolute -left-8 -bottom-8 w-40 h-40 rounded-full bg-yellow-300/20 blur-xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-white text-amber-600 flex items-center justify-center shadow-lg transform rotate-3">
            <Trophy size={40} className="animate-bounce" />
          </div>

          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/20 text-yellow-100 font-black text-xs uppercase tracking-wider backdrop-blur-xs">
              <Crown size={14} className="text-yellow-200" />
              <span>Vinh danh Quán quân Cuộc thi</span>
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-xs">
              {displayName}
            </h3>

            <p className="text-xs sm:text-sm text-yellow-100 font-medium">
              Xuất sắc giành chức Vô địch giải đấu{" "}
              <strong className="text-white underline decoration-yellow-300 underline-offset-2">
                {competitionTitle}
              </strong>
            </p>
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-center sm:items-end">
          <div className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-white/20 backdrop-blur-md text-white font-bold text-xs border border-white/30 shadow-xs">
            <Sparkles size={16} className="text-yellow-200" />
            <span>Kết quả chính thức từ Giám khảo</span>
          </div>
          <span className="text-[11px] text-yellow-100/90 mt-1.5 font-medium">
            Hình thức: {competitionType === "TEAM" ? "Đồng đội 2v2" : "Cá nhân 1v1"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CompetitionChampionBanner;

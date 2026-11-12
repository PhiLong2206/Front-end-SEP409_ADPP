import React, { useEffect, useState } from "react";
import { FolderKanban, Calendar, Trophy, Users } from "lucide-react";
import topicApi from "../../../api/topicApi";
import competitionApi from "../../../api/competitionApi";

const OrganizerDashboard: React.FC = () => {
  const [topicCount, setTopicCount] = useState<number>(0);
  const [competitionCount, setCompetitionCount] = useState<number>(0);
  const [activeCompetitionsCount, setActiveCompetitionsCount] = useState<number>(0);
  const [totalParticipantsCount, setTotalParticipantsCount] = useState<number>(0);

  useEffect(() => {
    topicApi
      .getAll({ pageNumber: 1, pageSize: 50 })
      .then((res) => {
        if (res?.success && res.data) {
          const raw = res.data as unknown as { totalCount?: number; items?: unknown[] };
          if (typeof raw.totalCount === "number") {
            setTopicCount(raw.totalCount);
          } else if (Array.isArray(res.data)) {
            setTopicCount(res.data.length);
          } else if (Array.isArray(raw.items)) {
            setTopicCount(raw.items.length);
          }
        }
      })
      .catch(() => {});

    competitionApi
      .getCompetitions()
      .then((res) => {
        if (res?.success && Array.isArray(res.data)) {
          setCompetitionCount(res.data.length);
          setActiveCompetitionsCount(
            res.data.filter(
              (c) =>
                c.status === "OpenRegistration" ||
                c.status === "Ongoing" ||
                c.status === "RegistrationClosed"
            ).length
          );
          const sumParticipants = res.data.reduce(
            (sum, c) => sum + Number((c as { currentParticipantsCount?: number }).currentParticipantsCount || 0),
            0
          );
          setTotalParticipantsCount(sumParticipants);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Bảng điều khiển Nhà giáo dục</h1>
        <p className="text-sm text-slate-500 mt-1">
          Quản lý chủ đề tranh biện, sự kiện tập huấn và theo dõi tiến độ sinh viên.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Chủ đề đã tạo</span>
            <div className="p-2 rounded-xl bg-[#ECFDF5] text-[#008A64]">
              <FolderKanban size={18} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-3">{topicCount}</p>
          <span className="text-xs text-slate-400 mt-1 inline-block">Chủ đề tranh biện</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Giải đấu đang diễn ra</span>
            <div className="p-2 rounded-xl bg-[#ECFDF5] text-[#008A64]">
              <Calendar size={18} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-3">{activeCompetitionsCount}</p>
          <span className="text-xs text-slate-400 mt-1 inline-block">Đang mở đăng ký / thi đấu</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cuộc thi & Giải đấu</span>
            <div className="p-2 rounded-xl bg-[#ECFDF5] text-[#008A64]">
              <Trophy size={18} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-3">{competitionCount}</p>
          <span className="text-xs text-slate-400 mt-1 inline-block">Giải đấu quản lý</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Thí sinh tham gia</span>
            <div className="p-2 rounded-xl bg-[#ECFDF5] text-[#008A64]">
              <Users size={18} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-3">{totalParticipantsCount}</p>
          <span className="text-xs text-slate-400 mt-1 inline-block">Lượt đăng ký giải đấu</span>
        </div>
      </div>
    </div>
  );
};

export default OrganizerDashboard;

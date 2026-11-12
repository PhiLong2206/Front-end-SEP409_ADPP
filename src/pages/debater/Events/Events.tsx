import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Trophy, Users, Clock, Tag, ChevronRight, CheckCircle, AlertCircle, Filter, Zap, BookOpen, Swords } from "lucide-react";
import competitionApi from "../../../api/competitionApi";

export interface DebateEvent {
  id: string;
  title: string;
  description: string;
  type: "competition" | "event";
  status: "upcoming" | "ongoing" | "ended";
  format: "AI_JUDGE" | "EDUCATOR_JUDGE" | "ORGANIZER_JUDGE" | "PEER" | "INDIVIDUAL" | "TEAM";
  startDate: string;
  registerDeadline: string;
  currentParticipants: number;
  maxParticipants: number;
  isRegistered: boolean;
  tags: string[];
  bannerUrl?: string;
  rules?: string;
  organizer?: string;
  topic?: string;
  rounds?: number;
  prizePool?: string;
  entryFee?: number;
}

const statusConfig = {
  upcoming: { label: "Sắp diễn ra", color: "bg-blue-50 text-blue-700 border-blue-200" },
  ongoing: { label: "Đang diễn ra", color: "bg-[#ECFDF5] text-[#008A64] border-[#008A64]/30" },
  ended: { label: "Đã kết thúc", color: "bg-slate-100 text-slate-500 border-slate-200" },
};

const formatConfig = {
  AI_JUDGE: { label: "AI Judge", icon: Zap, color: "text-violet-600" },
  EDUCATOR_JUDGE: { label: "GV Chấm điểm", icon: BookOpen, color: "text-blue-600" },
  ORGANIZER_JUDGE: { label: "GV Chấm điểm", icon: BookOpen, color: "text-blue-600" },
  PEER: { label: "Đánh giá chéo", icon: Users, color: "text-amber-600" },
  INDIVIDUAL: { label: "1v1 Cá nhân", icon: Swords, color: "text-emerald-600" },
  TEAM: { label: "Đồng đội 2v2", icon: Users, color: "text-indigo-600" },
};

function getDaysLeft(dateStr: string) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (diff < 0) return null;
  if (diff === 0) return "Hôm nay";
  return "Còn " + diff + " ngày";
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div
        className="h-full bg-[#008A64] rounded-full transition-all"
        style={{ width: pct + "%" }}
      />
    </div>
  );
}

function EventCard({ event, onRegister }: { event: DebateEvent; onRegister: (id: string) => void }) {
  const status = statusConfig[event.status];
  const fmt = formatConfig[event.format];
  const FmtIcon = fmt.icon;
  const daysLeft = getDaysLeft(event.registerDeadline);
  const isFull = event.currentParticipants >= event.maxParticipants;
  const fillPct = Math.round((event.currentParticipants / event.maxParticipants) * 100);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden hover:shadow-md hover:border-slate-300 transition-all group">
      {/* Top accent bar */}
      <div className={`h-1 w-full ${event.type === "competition" ? "bg-gradient-to-r from-[#008A64] to-emerald-400" : "bg-gradient-to-r from-blue-500 to-indigo-400"}`} />

      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={"px-2.5 py-0.5 rounded-full text-[11px] font-bold border " + status.color}>
                {status.label}
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                <FmtIcon size={11} className={fmt.color} />
                {fmt.label}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                {event.rules}
              </span>
            </div>
            <h3 className="font-black text-slate-900 text-sm leading-tight group-hover:text-[#008A64] transition-colors">
              {event.title}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">by {event.organizer}</p>
          </div>

          {event.type === "competition" && (
            <div className="shrink-0 w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
              <Trophy size={18} className="text-amber-500 fill-amber-200" />
            </div>
          )}
        </div>

        {/* Topic */}
        <div className="flex items-start gap-2 p-2.5 bg-slate-50/80 rounded-xl border border-slate-100">
          <Tag size={13} className="text-slate-400 mt-0.5 shrink-0" />
          <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 italic">
            &ldquo;{event.topic}&rdquo;
          </p>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600">
            <Calendar size={12} className="text-slate-400" />
            <span>{new Date(event.startDate).toLocaleDateString("vi-VN")}</span>
          </div>
          {event.rounds && (
            <div className="flex items-center gap-1.5 text-slate-600">
              <Swords size={12} className="text-slate-400" />
              <span>{event.rounds} vong dau</span>
            </div>
          )}
          {event.prizePool && (
            <div className="flex items-center gap-1.5 font-bold text-amber-600">
              <Trophy size={12} />
              <span>{event.prizePool}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            {event.entryFee === 0 ? (
              <span className="text-[#008A64] font-bold">Mien phi</span>
            ) : (
              <span className="text-slate-700 font-bold">{(event.entryFee ?? 0).toLocaleString("vi-VN")}d</span>
            )}
          </div>
        </div>

        {/* Participants progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Users size={11} />
              <span>{event.currentParticipants}/{event.maxParticipants} nguoi tham gia</span>
            </div>
            <span className={"font-bold text-[11px] " + (isFull ? "text-rose-600" : "text-slate-600")}>
              {isFull ? "Da du cho" : fillPct + "%"}
            </span>
          </div>
          <ProgressBar value={event.currentParticipants} max={event.maxParticipants} />
        </div>

        {/* Deadline & CTA */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Clock size={11} />
            {daysLeft ? (
              <span>{daysLeft}</span>
            ) : (
              <span className="text-slate-400">Da het han DK</span>
            )}
          </div>

          {event.isRegistered ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ECFDF5] text-[#008A64] text-xs font-bold border border-[#008A64]/30">
              <CheckCircle size={13} />
              Da dang ky
            </span>
          ) : isFull ? (
            <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-400 text-xs font-bold cursor-not-allowed border border-slate-200">
              Da day
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onRegister(event.id)}
              className="px-3.5 py-1.5 rounded-xl bg-[#008A64] hover:bg-[#007457] text-white text-xs font-bold transition-all hover:scale-105 shadow-sm shadow-[#008A64]/20 flex items-center gap-1.5"
            >
              Dang ky
              <ChevronRight size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const Events: React.FC = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<DebateEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<"all" | "event" | "competition">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "upcoming" | "ongoing" | "ended">("all");

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const res = await competitionApi.getCompetitions();
        if (res.success && res.data) {
          const mapped: DebateEvent[] = res.data.map((c) => {
            const rawStatus = String(c.status || "").toUpperCase();
            let status: "upcoming" | "ongoing" | "ended" = "upcoming";
            if (rawStatus === "IN_PROGRESS" || rawStatus === "ONGOING") {
              status = "ongoing";
            } else if (rawStatus === "COMPLETED" || rawStatus === "CANCELLED") {
              status = "ended";
            }

            return {
              id: c.competitionId.toString(),
              title: c.title,
              description: c.description || "Cuộc thi tranh biện",
              type: "competition",
              status,
              format: c.competitionType || "AI_JUDGE",
              startDate: c.startDate || c.createdAt || "",
              registerDeadline: c.registrationDeadline || c.registrationEnd || "",
              currentParticipants: c.registeredCount ?? 0,
              maxParticipants: c.maxParticipants || 16,
              isRegistered: false,
              tags: [c.competitionType, String(c.status)],
            };
          });
          setEvents(mapped);
        } else {
          setEvents([]);
        }
      } catch (err) {
        console.error("Failed to load events", err);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const filtered = events.filter((e) => {
    if (filterType !== "all" && e.type !== filterType) return false;
    if (filterStatus !== "all" && e.status !== filterStatus) return false;
    return true;
  });

  const handleRegister = (id: string) => {
    navigate(`/debater/competitions?highlight=${id}`);
  };

  const myRegistered = events.filter((e) => e.isRegistered);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">Su kien &amp; Cuoc thi</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kham pha giai dau, hoi thao va phien tranh bien giao luu sap dien ra.
          </p>
        </div>

        {myRegistered.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#ECFDF5] border border-[#008A64]/30 rounded-xl text-sm font-bold text-[#008A64] self-start sm:self-auto">
            <CheckCircle size={16} />
            <span>Da dang ky {myRegistered.length} su kien</span>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-12 text-center text-slate-400">
          <div className="w-6 h-6 border-2 border-[#008A64] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs">Đang tải danh sách cuộc thi...</p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Tong su kien", value: events.length, icon: Calendar, color: "text-blue-600" },
          { label: "Dang dien ra", value: events.filter((e) => e.status === "ongoing").length, icon: Zap, color: "text-[#008A64]" },
          { label: "Sap toi", value: events.filter((e) => e.status === "upcoming").length, icon: Clock, color: "text-amber-600" },
          { label: "Da dang ky", value: myRegistered.length, icon: CheckCircle, color: "text-violet-600" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <stat.icon size={18} className={stat.color + " mb-2"} />
            <div className="text-2xl font-black text-slate-900">{stat.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter size={14} className="text-slate-400" />
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
          {[{ v: "all", l: "Tat ca" }, { v: "competition", l: "Cuoc thi" }, { v: "event", l: "Su kien" }].map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setFilterType(opt.v as typeof filterType)}
              className={"px-3 py-1 rounded-lg text-xs font-bold transition-all " + (filterType === opt.v ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-700")}
            >
              {opt.l}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
          {[{ v: "all", l: "Moi trang thai" }, { v: "ongoing", l: "Dang dien ra" }, { v: "upcoming", l: "Sap toi" }].map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setFilterStatus(opt.v as typeof filterStatus)}
              className={"px-3 py-1 rounded-lg text-xs font-bold transition-all " + (filterStatus === opt.v ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-700")}
            >
              {opt.l}
            </button>
          ))}
        </div>
      </div>

      {/* Event cards grid */}
      {filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500 shadow-xs">
          <AlertCircle size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm">Khong tim thay su kien phu hop.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} onRegister={handleRegister} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Events;

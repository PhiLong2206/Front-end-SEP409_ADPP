import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Trophy, Users, Clock, ChevronRight, CheckCircle, AlertCircle, Zap, BookOpen, Swords } from "lucide-react";
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
  upcoming: { label: "Sắp diễn ra", dot: "bg-accent" },
  ongoing: { label: "Đang diễn ra", dot: "bg-ap-success" },
  ended: { label: "Đã kết thúc", dot: "bg-label-tertiary" },
};

const formatConfig = {
  AI_JUDGE: { label: "AI chấm điểm", icon: Zap },
  EDUCATOR_JUDGE: { label: "GV Chấm điểm", icon: BookOpen },
  ORGANIZER_JUDGE: { label: "GV Chấm điểm", icon: BookOpen },
  PEER: { label: "Đánh giá chéo", icon: Users },
  INDIVIDUAL: { label: "1v1 Cá nhân", icon: Swords },
  TEAM: { label: "Đồng đội 2v2", icon: Users },
};

function getDaysLeft(dateStr: string) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (diff < 0) return null;
  if (diff === 0) return "Hôm nay";
  return "Còn " + diff + " ngày";
}

function ProgressBar({ value, max, full }: { value: number; max: number; full: boolean }) {
  const pct = Math.min((value / Math.max(max, 1)) * 100, 100);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label="Số người đã tham gia"
      className="h-1.5 w-full overflow-hidden rounded-full bg-canvas-secondary"
    >
      <div
        className={"h-full rounded-full transition-[width] duration-(--t-slow) ease-ap " + (full ? "bg-ap-danger" : "bg-accent")}
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
  const fillPct = Math.round((event.currentParticipants / Math.max(event.maxParticipants, 1)) * 100);

  return (
    <article className="flex flex-col gap-(--s-5) rounded-ap-xl bg-elevated p-(--s-6) shadow-ap-sm transition-shadow duration-(--t-base) ease-ap hover:shadow-ap-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-(--s-4)">
        <div className="min-w-0 flex-1 space-y-(--s-2)">
          <div className="flex flex-wrap items-center gap-x-(--s-4) gap-y-1 text-(length:--text-caption) text-label-secondary">
            <span className="inline-flex items-center gap-(--s-2) font-medium text-label">
              <span aria-hidden="true" className={"h-2 w-2 rounded-full " + status.dot} />
              {status.label}
            </span>
            <span className="inline-flex items-center gap-(--s-2)">
              <FmtIcon size={13} aria-hidden="true" />
              {fmt.label}
            </span>
            {event.rules && <span>{event.rules}</span>}
          </div>
          <h3 className="text-(length:--text-headline) font-semibold leading-(--leading-snug)">{event.title}</h3>
          {event.organizer && (
            <p className="text-(length:--text-callout) text-label-secondary">Tổ chức bởi {event.organizer}</p>
          )}
        </div>

        {event.type === "competition" && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-ap-md bg-ap-warning/15 text-ap-warning">
            <Trophy size={20} aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Topic */}
      {event.topic && (
        <p className="line-clamp-2 rounded-ap-md bg-canvas-secondary p-(--s-4) text-(length:--text-callout) italic leading-(--leading-body) text-label-secondary">
          &ldquo;{event.topic}&rdquo;
        </p>
      )}

      {/* Info */}
      <dl className="grid grid-cols-2 gap-x-(--s-4) gap-y-(--s-3) text-(length:--text-callout)">
        <div className="flex items-center gap-(--s-2) text-label-secondary">
          <Calendar size={14} aria-hidden="true" />
          <dd>{new Date(event.startDate).toLocaleDateString("vi-VN")}</dd>
        </div>
        {event.rounds && (
          <div className="flex items-center gap-(--s-2) text-label-secondary">
            <Swords size={14} aria-hidden="true" />
            <dd>{event.rounds} vòng đấu</dd>
          </div>
        )}
        {event.prizePool && (
          <div className="flex items-center gap-(--s-2) font-medium text-label">
            <Trophy size={14} className="text-ap-warning" aria-hidden="true" />
            <dd>{event.prizePool}</dd>
          </div>
        )}
        <div className="flex items-center gap-(--s-2) font-medium">
          {event.entryFee === 0 ? (
            <dd className="text-accent">Miễn phí</dd>
          ) : (
            <dd>{(event.entryFee ?? 0).toLocaleString("vi-VN")} đ</dd>
          )}
        </div>
      </dl>

      {/* Participants */}
      <div className="space-y-(--s-2)">
        <div className="flex items-center justify-between text-(length:--text-callout)">
          <span className="inline-flex items-center gap-(--s-2) text-label-secondary">
            <Users size={14} aria-hidden="true" />
            {event.currentParticipants}/{event.maxParticipants} người tham gia
          </span>
          <span className={"text-(length:--text-caption) font-medium " + (isFull ? "text-ap-danger" : "text-label-secondary")}>
            {isFull ? "Đã đủ chỗ" : fillPct + "%"}
          </span>
        </div>
        <ProgressBar value={event.currentParticipants} max={event.maxParticipants} full={isFull} />
      </div>

      {/* Deadline & action */}
      <div className="flex items-center justify-between gap-(--s-3) border-t border-separator pt-(--s-4)">
        <span className="inline-flex items-center gap-(--s-2) text-(length:--text-callout) text-label-secondary">
          <Clock size={14} aria-hidden="true" />
          {daysLeft ? daysLeft : <span className="text-label-tertiary">Đã hết hạn đăng ký</span>}
        </span>

        {event.isRegistered ? (
          <span className="inline-flex items-center gap-(--s-2) text-(length:--text-callout) font-medium text-accent">
            <CheckCircle size={16} aria-hidden="true" />
            Đã đăng ký
          </span>
        ) : isFull ? (
          <span className="text-(length:--text-callout) text-label-tertiary">Đã đầy</span>
        ) : (
          <button
            type="button"
            onClick={() => onRegister(event.id)}
            className="inline-flex h-10 cursor-pointer items-center gap-1 rounded-ap-pill bg-accent-soft px-(--s-4) text-(length:--text-callout) font-medium text-accent transition-[background-color,transform] duration-(--t-fast) ease-ap hover:bg-accent/15 active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
          >
            Đăng ký
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </article>
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

  const stats = [
    { label: "Tổng sự kiện", value: events.length, icon: Calendar },
    { label: "Đang diễn ra", value: events.filter((e) => e.status === "ongoing").length, icon: Zap },
    { label: "Sắp tới", value: events.filter((e) => e.status === "upcoming").length, icon: Clock },
    { label: "Đã đăng ký", value: myRegistered.length, icon: CheckCircle },
  ];

  const segment = (active: boolean) =>
    `min-h-10 cursor-pointer rounded-ap-pill px-(--s-4) text-(length:--text-callout) font-medium transition-[background-color,box-shadow,color] duration-(--t-base) ease-ap focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 ${
      active ? "bg-elevated text-label shadow-ap-sm" : "text-label-secondary hover:text-label"
    }`;

  return (
    <div className="mx-auto max-w-6xl space-y-(--s-7) pb-(--s-8) animate-fade-in motion-reduce:animate-none">
      {/* Header */}
      <section className="flex flex-col gap-(--s-4) pt-(--s-4) sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-[680px] space-y-(--s-2)">
          <h1 className="text-(length:--text-hero) font-bold leading-(--leading-tight) tracking-(--tracking-display)">
            Sự kiện &amp; Cuộc thi
          </h1>
          <p className="text-(length:--text-body) leading-(--leading-body) text-label-secondary">
            Khám phá giải đấu, hội thảo và phiên tranh biện giao lưu sắp diễn ra.
          </p>
        </div>

        {myRegistered.length > 0 && (
          <p className="inline-flex items-center gap-(--s-2) self-start rounded-ap-pill bg-accent-soft px-(--s-4) py-(--s-2) text-(length:--text-callout) font-medium text-accent sm:self-auto">
            <CheckCircle size={16} aria-hidden="true" />
            <span>Đã đăng ký {myRegistered.length} sự kiện</span>
          </p>
        )}
      </section>

      {/* Numbers: one surface, hairlines between */}
      <section aria-label="Thống kê sự kiện" className="rounded-ap-xl bg-elevated shadow-ap-sm">
        <div className="grid grid-cols-2 divide-separator sm:grid-cols-4 sm:divide-x">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center justify-between gap-(--s-3) p-(--s-5)">
              <div>
                <div className="text-(length:--text-title) font-semibold leading-none tracking-(--tracking-display) tabular-nums">{value}</div>
                <div className="mt-(--s-2) text-(length:--text-callout) text-label-secondary">{label}</div>
              </div>
              <Icon size={20} className="shrink-0 text-label-tertiary" aria-hidden="true" />
            </div>
          ))}
        </div>
      </section>

      {/* Filters: two segmented controls */}
      <div className="flex flex-wrap items-center gap-(--s-3)">
        <div role="group" aria-label="Lọc theo loại" className="inline-flex gap-1 rounded-ap-pill bg-canvas-secondary p-1">
          {[{ v: "all", l: "Tất cả" }, { v: "competition", l: "Cuộc thi" }, { v: "event", l: "Sự kiện" }].map((opt) => (
            <button
              key={opt.v}
              type="button"
              aria-pressed={filterType === opt.v}
              onClick={() => setFilterType(opt.v as typeof filterType)}
              className={segment(filterType === opt.v)}
            >
              {opt.l}
            </button>
          ))}
        </div>

        <div role="group" aria-label="Lọc theo trạng thái" className="inline-flex gap-1 rounded-ap-pill bg-canvas-secondary p-1">
          {[{ v: "all", l: "Mọi trạng thái" }, { v: "ongoing", l: "Đang diễn ra" }, { v: "upcoming", l: "Sắp tới" }].map((opt) => (
            <button
              key={opt.v}
              type="button"
              aria-pressed={filterStatus === opt.v}
              onClick={() => setFilterStatus(opt.v as typeof filterStatus)}
              className={segment(filterStatus === opt.v)}
            >
              {opt.l}
            </button>
          ))}
        </div>
      </div>

      {/* Event cards */}
      {loading ? (
        <div role="status" className="space-y-(--s-3) rounded-ap-xl bg-elevated px-(--s-6) py-(--s-8) text-center shadow-ap-sm">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent motion-reduce:animate-none" aria-hidden="true" />
          <p className="text-(length:--text-callout) text-label-secondary">Đang tải danh sách cuộc thi...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="space-y-(--s-3) rounded-ap-xl bg-elevated px-(--s-6) py-(--s-8) text-center shadow-ap-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-ap-lg bg-canvas-secondary text-label-tertiary">
            <AlertCircle size={26} aria-hidden="true" />
          </div>
          <p className="text-(length:--text-callout) font-semibold">Không tìm thấy sự kiện phù hợp.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-(--s-5) md:grid-cols-2">
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} onRegister={handleRegister} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Events;

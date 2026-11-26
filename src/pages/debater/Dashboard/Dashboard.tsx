import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  BarChart2,
  Flame,
  ArrowRight,
  ChevronRight,
  Trophy,
  Calendar,
  CalendarDays,
  User,
  Settings,
  Swords,
  Bot,
  Users,
  BookOpen,
  Wallet,
} from "lucide-react";
import CompetitionStatusBadge from "../../../components/competition/CompetitionStatusBadge";
import CompetitionTypeBadge from "../../../components/competition/CompetitionTypeBadge";
import { useAuth } from "../../../hooks/useAuth";
import { readActiveDebateSession } from "../../../hooks/useDebateNavigationGuard";
import competitionApi from "../../../api/competitionApi";
import { debateApi } from "../../../api";
import { CompetitionListItem } from "../../../types";
import { formatDate } from "../../../utils/formatDate";
import { countCompletedDebates } from "../../../utils/debateStats";


type DashboardTab = "practice" | "competitions" | "account";

const DebaterDashboard: React.FC = () => {
  const { user } = useAuth();
  const [competitions, setCompetitions] = useState<CompetitionListItem[]>([]);
  const [debateCount, setDebateCount] = useState<number>(0);
  const [streakDays, setStreakDays] = useState<number>(0);
  const [loadingComps, setLoadingComps] = useState(false);
  const [tab, setTab] = useState<DashboardTab>("practice");

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
          setDebateCount(countCompletedDebates(historyRes.data));

          // Compute consecutive practice days streak from history dates
          const uniqueDays = Array.from(
            new Set(
              historyRes.data
                .filter((item) => item.createdAt)
                .map((item) => new Date(item.createdAt).toISOString().slice(0, 10))
            )
          ).sort((a, b) => (a > b ? -1 : 1));

          if (uniqueDays.length > 0) {
            let streak = 1;
            for (let i = 1; i < uniqueDays.length; i++) {
              const prevDate = new Date(uniqueDays[i - 1]);
              const currDate = new Date(uniqueDays[i]);
              const diffDays = Math.round((prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24));
              if (diffDays === 1) {
                streak += 1;
              } else {
                break;
              }
            }
            setStreakDays(streak);
          } else {
            setStreakDays(0);
          }
        }
      } catch {
        // Fallback silently
      }
    };

    loadCompetitions();
    loadDebateStats();
  }, []);

  const displayName = user?.fullName || user?.email?.split("@")[0] || "bạn";
  const activeDebateSession = useMemo(() => readActiveDebateSession(), []);

  const stats = [
    { value: competitions.length, label: "Giải đấu trên hệ thống", icon: Trophy },
    { value: debateCount, label: "Phiên tranh biện đã hoàn thành", icon: BarChart2 },
    { value: streakDays, label: "Ngày luyện tập liên tiếp", icon: Flame },
  ];

  // The first tile is the one thing to do; the others are the ways around it
  const practice = [
    { to: "/debater/debate-1v1", title: "Tranh biện 1 vs 1", text: "Đấu với một người học khác theo luật WSDC.", icon: Swords },
    { to: "/debater/debate-2v2", title: "Tranh biện 2 vs 2", text: "Phối hợp cùng đồng đội, gọi tiếng trong phút chuẩn bị.", icon: Users },
    { to: "/debater/topics", title: "Kho chủ đề", text: "Chọn kiến nghị và phe để bắt đầu.", icon: BookOpen },
    { to: "/debater/events", title: "Sự kiện học tập", text: "Hội thảo và buổi huấn luyện sắp tới.", icon: CalendarDays },
  ];

  const account = [
    { to: "/debater/profile", title: "Hồ sơ học viên", text: "Thông tin và kết quả của bạn", icon: User },
    { to: "/debater/payments", title: "Nạp điểm tín chỉ", text: "Xem số dư và nạp thêm Credit", icon: Wallet },
    { to: "/debater/settings", title: "Cài đặt & Bảo mật", text: "Đổi mật khẩu và giao diện", icon: Settings },
  ];

  const tabs: { id: DashboardTab; label: string; count?: number }[] = [
    { id: "practice", label: "Luyện tập" },
    { id: "competitions", label: "Giải đấu", count: competitions.length },
    { id: "account", label: "Tài khoản" },
  ];

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = -1;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next >= 0) {
      event.preventDefault();
      setTab(tabs[next].id);
      document.getElementById(`dash-tab-${tabs[next].id}`)?.focus();
    }
  };

  const tile =
    "group flex flex-col justify-between gap-(--s-5) rounded-ap-xl p-(--s-6) shadow-ap-sm transition-[transform,box-shadow] duration-(--t-base) ease-ap hover:-translate-y-0.5 hover:shadow-ap-md motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30";
  const iconTile = "flex h-12 w-12 shrink-0 items-center justify-center rounded-ap-md bg-accent-soft text-accent";
  const learnMore =
    "inline-flex items-center gap-1 text-(length:--text-callout) font-medium text-accent";

  return (
    <div className="space-y-(--s-8)">
      {/* 1. Welcome: plain, large, one action */}
      <section className="space-y-(--s-5) pt-(--s-4)">
        <div className="max-w-[680px] space-y-(--s-2)">
          <p className="text-(length:--text-callout) text-label-secondary">Chào mừng trở lại</p>
          <h1 className="text-(length:--text-hero) font-bold leading-(--leading-tight) tracking-(--tracking-display) text-balance">
            Xin chào, {displayName}
          </h1>
          <p className="text-(length:--text-body) leading-(--leading-body) text-label-secondary">
            Sẵn sàng cho trận tranh biện tiếp theo? Vào thẳng với AI, hoặc chọn một cách luyện khác bên dưới.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-(--s-5)">
          <Link
            to="/debater/debate"
            className="group inline-flex h-12 items-center gap-(--s-2) rounded-ap-pill bg-accent px-(--s-6) text-(length:--text-body) font-medium text-accent-contrast transition-[background-color,transform] duration-(--t-fast) ease-ap hover:bg-accent-hover active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40"
          >
            <span>Bắt đầu trận với AI</span>
            <ArrowRight size={18} className="transition-transform duration-(--t-base) group-hover:translate-x-1 motion-reduce:transform-none" aria-hidden="true" />
          </Link>
          <Link to="/debater/competitions" className={`${learnMore} min-h-11 hover:underline focus-visible:outline-none focus-visible:underline`}>
            Khám phá giải đấu <ChevronRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* A debate that was left open comes first */}
      {activeDebateSession && (
        <div
          data-testid="dashboard-resume-banner"
          className="flex flex-col gap-(--s-3) rounded-ap-lg bg-accent-soft p-(--s-4) sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="text-(length:--text-callout) font-semibold text-accent">Bạn đang có một phiên tranh biện chưa kết thúc</p>
            <p className="truncate text-(length:--text-callout) text-label-secondary">&ldquo;{activeDebateSession.topicTitle}&rdquo;</p>
          </div>
          <Link
            to={activeDebateSession.url}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-(--s-2) rounded-ap-pill bg-accent px-(--s-5) text-(length:--text-callout) font-medium text-accent-contrast transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40"
          >
            <span>Tiếp tục</span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* 2. Numbers: one surface, three columns, hairlines between */}
      <section aria-label="Thống kê của bạn" className="rounded-ap-xl bg-elevated shadow-ap-sm">
        <div className="grid grid-cols-1 divide-y divide-separator sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {stats.map(({ value, label, icon: Icon }) => (
            <div key={label} className="flex items-center justify-between gap-(--s-4) p-(--s-6)">
              <div>
                <div className="text-(length:--text-section) font-semibold leading-none tracking-(--tracking-display) tabular-nums">{value}</div>
                <span className="mt-(--s-2) inline-block text-(length:--text-callout) text-label-secondary">{label}</span>
              </div>
              <Icon size={22} className="shrink-0 text-label-tertiary" aria-hidden="true" />
            </div>
          ))}
        </div>
      </section>

      {/* 3. Tabs */}
      <section className="space-y-(--s-6)">
        <div
          role="tablist"
          aria-label="Các mục của trang tổng quan"
          className="inline-flex max-w-full gap-1 overflow-x-auto rounded-ap-pill bg-canvas-secondary p-1"
        >
          {tabs.map((item, index) => (
            <button
              key={item.id}
              id={`dash-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              aria-controls={`dash-panel-${item.id}`}
              tabIndex={tab === item.id ? 0 : -1}
              onClick={() => setTab(item.id)}
              onKeyDown={(e) => onTabKeyDown(e, index)}
              className={`inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-(--s-2) rounded-ap-pill px-(--s-5) text-(length:--text-callout) font-medium transition-[background-color,box-shadow,color] duration-(--t-base) ease-ap focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 ${
                tab === item.id ? "bg-elevated text-label shadow-ap-sm" : "text-label-secondary hover:text-label"
              }`}
            >
              <span>{item.label}</span>
              {item.count !== undefined && item.count > 0 && (
                <span className="rounded-full bg-accent-soft px-2 text-(length:--text-caption) text-accent">{item.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Luyện tập: a bento, one big tile and four small ones */}
        {tab === "practice" && (
          <div id="dash-panel-practice" role="tabpanel" aria-labelledby="dash-tab-practice" className="grid grid-cols-1 gap-(--s-4) md:grid-cols-2 lg:grid-cols-4">
            <Link
              to="/debater/debate"
              className={`${tile} bg-accent-soft md:col-span-2 lg:row-span-2 lg:col-span-2`}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-ap-lg bg-accent text-accent-contrast">
                <Bot size={26} aria-hidden="true" />
              </div>
              <div className="space-y-(--s-2)">
                <h3 className="text-(length:--text-title) font-semibold leading-(--leading-tight) tracking-(--tracking-display)">Tranh biện với AI</h3>
                <p className="max-w-[420px] text-(length:--text-body) leading-(--leading-body) text-label-secondary">
                  Luyện một mình với đối thủ AI, chọn phe và độ khó, nhận điểm Rubric ngay sau mỗi lượt.
                </p>
                <span className={learnMore}>
                  Bắt đầu <ChevronRight size={16} className="transition-transform duration-(--t-base) group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
                </span>
              </div>
            </Link>

            {practice.map(({ to, title, text, icon: Icon }) => (
              <Link key={to} to={to} className={`${tile} bg-elevated`}>
                <div className={iconTile}>
                  <Icon size={22} aria-hidden="true" />
                </div>
                <div className="space-y-(--s-1)">
                  <h3 className="text-(length:--text-headline) font-semibold leading-(--leading-snug)">{title}</h3>
                  <p className="text-(length:--text-callout) leading-(--leading-body) text-label-secondary">{text}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {tab === "competitions" && (
          <div id="dash-panel-competitions" role="tabpanel" aria-labelledby="dash-tab-competitions" className="space-y-(--s-5)">
            {loadingComps ? (
              <div role="status" className="rounded-ap-xl bg-elevated p-(--s-8) text-center text-(length:--text-callout) text-label-secondary shadow-ap-sm">
                Đang tải dữ liệu giải đấu từ máy chủ...
              </div>
            ) : competitions.length === 0 ? (
              <div className="rounded-ap-xl bg-elevated p-(--s-8) text-center text-(length:--text-callout) text-label-secondary shadow-ap-sm">
                Hiện chưa có giải đấu nào được công bố.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-(--s-4) md:grid-cols-2 lg:grid-cols-3">
                  {competitions.map((comp) => (
                    <article
                      key={comp.competitionId}
                      className="flex flex-col justify-between rounded-ap-xl bg-elevated p-(--s-6) shadow-ap-sm transition-[transform,box-shadow] duration-(--t-base) ease-ap hover:-translate-y-0.5 hover:shadow-ap-md motion-reduce:transform-none"
                    >
                      <div className="space-y-(--s-3)">
                        <div className="flex items-center justify-between gap-(--s-2)">
                          <CompetitionTypeBadge type={comp.competitionType} />
                          <CompetitionStatusBadge status={comp.status} />
                        </div>
                        <h3 className="line-clamp-2 text-(length:--text-headline) font-semibold leading-(--leading-snug)">{comp.title}</h3>
                        <div className="flex items-center gap-(--s-2) text-(length:--text-callout) text-label-secondary">
                          <Calendar size={15} aria-hidden="true" />
                          <span>Bắt đầu: {formatDate(comp.startDate)}</span>
                        </div>
                      </div>
                      <div className="mt-(--s-5)">
                        <Link
                          to="/debater/competitions"
                          className={`${learnMore} min-h-10 hover:underline focus-visible:outline-none focus-visible:underline`}
                        >
                          Chi tiết giải đấu <ChevronRight size={16} aria-hidden="true" />
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
                <div>
                  <Link to="/debater/competitions" className={`${learnMore} min-h-10 hover:underline focus-visible:outline-none focus-visible:underline`}>
                    Xem tất cả ({competitions.length}) <ChevronRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              </>
            )}
          </div>
        )}

        {tab === "account" && (
          <div id="dash-panel-account" role="tabpanel" aria-labelledby="dash-tab-account" className="grid grid-cols-1 gap-(--s-4) sm:grid-cols-3">
            {account.map(({ to, title, text, icon: Icon }) => (
              <Link key={to} to={to} className={`${tile} bg-elevated`}>
                <div className={iconTile}>
                  <Icon size={22} aria-hidden="true" />
                </div>
                <div className="space-y-(--s-1)">
                  <h3 className="text-(length:--text-headline) font-semibold leading-(--leading-snug)">{title}</h3>
                  <p className="text-(length:--text-callout) leading-(--leading-body) text-label-secondary">{text}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default DebaterDashboard;

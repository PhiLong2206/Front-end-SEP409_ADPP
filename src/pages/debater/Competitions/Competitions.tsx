import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Trophy,
  Calendar,
  ChevronRight,
  Search,
  RefreshCw,
  Clock,
  Plus,
  Edit,
  Eye,
  Settings,
  DoorOpen,
  DoorClosed,
  Play,
  CheckCheck,
  Ban,
  CheckCircle2,
  AlertCircle,
  Swords,
} from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import competitionApi from "../../../api/competitionApi";
import { CompetitionDetail, CompetitionListItem } from "../../../types";
import CompetitionStatusBadge from "../../../components/competition/CompetitionStatusBadge";
import CompetitionTypeBadge from "../../../components/competition/CompetitionTypeBadge";
import CompetitionDetailModal from "../../../components/competition/CompetitionDetailModal";
import CompetitionAdminDetailModal from "../../../components/competition/CompetitionAdminDetailModal";
import CompetitionFormModal from "../../../components/competition/CompetitionFormModal";
import Button from "../../../components/common/Button";
import { formatDate } from "../../../utils/formatDate";

// ── Leaderboard empty state ──────────────────────────────────────────

const Competitions: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUserId = user?.userId ? Number(user.userId) : null;

  const [mainTab, setMainTab] = useState<"competitions" | "my-competitions" | "leaderboard">("competitions");

  // Real backend competitions state
  const [competitions, setCompetitions] = useState<CompetitionListItem[]>([]);
  const [detailedCompMap, setDetailedCompMap] = useState<Record<number, CompetitionDetail>>({});
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [competitionToEdit, setCompetitionToEdit] = useState<CompetitionDetail | null>(null);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<number | null>(null);
  const [selectedAdminCompId, setSelectedAdminCompId] = useState<number | null>(null);

  const showNotification = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setSuccessMsg(null);
    } else {
      setSuccessMsg(msg);
      setErrorMsg(null);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const fetchCompetitions = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await competitionApi.getCompetitions({
        keyword: keyword.trim() || undefined,
        competitionType: typeFilter !== "all" ? typeFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      if (res.success && res.data) {
        setCompetitions(res.data);

        // Fetch details in background to identify creator (CreatedBy) for "Cuộc thi của tôi"
        const entries = await Promise.all(
          res.data.map(async (item) => {
            try {
              const d = await competitionApi.getCompetitionById(item.competitionId);
              return d.data ? [item.competitionId, d.data] as const : null;
            } catch {
              return null;
            }
          })
        );
        const map: Record<number, CompetitionDetail> = {};
        for (const entry of entries) {
          if (entry) {
            map[entry[0]] = entry[1];
          }
        }
        setDetailedCompMap(map);
      } else {
        setCompetitions([]);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setErrorMsg(e.message || "Không thể tải danh sách giải đấu.");
    } finally {
      setLoading(false);
    }
  }, [keyword, typeFilter, statusFilter]);

  useEffect(() => {
    fetchCompetitions();
  }, [fetchCompetitions]);

  // Lifecycle actions
  const handleOpenRegistration = async (id: number) => {
    setActionLoading(true);
    try {
      const res = await competitionApi.openRegistration(id);
      if (res.success) {
        showNotification("Đã mở đăng ký cho cuộc thi!");
        await fetchCompetitions();
      } else {
        showNotification(res.message || "Mở đăng ký thất bại.", true);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Mở đăng ký thất bại.", true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseRegistration = async (id: number) => {
    setActionLoading(true);
    try {
      const res = await competitionApi.closeRegistration(id);
      if (res.success) {
        showNotification("Đã đóng đăng ký cuộc thi.");
        await fetchCompetitions();
      } else {
        showNotification(res.message || "Đóng đăng ký thất bại.", true);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Đóng đăng ký thất bại.", true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartCompetition = async (id: number) => {
    try {
      const detail = detailedCompMap[id];
      if (detail) {
        if (detail.competitionType === "INDIVIDUAL") {
          const regRes = await competitionApi.getRegistrations(id);
          const approvedCount = regRes.data?.filter((r) => r.status === "Approved")?.length ?? 0;
          if (approvedCount === 0) {
            const confirmStart = window.confirm(
              "Cảnh báo: Hiện chưa có thí sinh nào được Ban tổ chức phê duyệt (Approved) trong danh sách!\n\nBạn có chắc chắn muốn chuyển cuộc thi sang trạng thái Đang diễn ra không?"
            );
            if (!confirmStart) return;
          }
        } else {
          const teamRes = await competitionApi.getTeams(id);
          const approvedCount = teamRes.data?.length ?? 0;
          if (approvedCount === 0) {
            const confirmStart = window.confirm(
              "Cảnh báo: Hiện chưa có đội thi nào trong danh sách!\n\nBạn có chắc chắn muốn chuyển cuộc thi sang trạng thái Đang diễn ra không?"
            );
            if (!confirmStart) return;
          }
        }
      }
    } catch {
      // Ignore validation pre-check errors
    }

    setActionLoading(true);
    try {
      const res = await competitionApi.startCompetition(id);
      if (res.success) {
        showNotification("Cuộc thi đã bắt đầu diễn ra!");
        await fetchCompetitions();
      } else {
        showNotification(res.message || "Bắt đầu cuộc thi thất bại.", true);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Bắt đầu cuộc thi thất bại.", true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteCompetition = async (id: number) => {
    if (!window.confirm("Bạn có chắc chắn muốn hoàn thành giải đấu này?")) return;
    setActionLoading(true);
    try {
      const res = await competitionApi.completeCompetition(id);
      if (res.success) {
        showNotification("Cuộc thi đã kết thúc thành công.");
        await fetchCompetitions();
      } else {
        showNotification(res.message || "Hoàn thành cuộc thi thất bại.", true);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Hoàn thành cuộc thi thất bại.", true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelCompetition = async (id: number) => {
    if (!window.confirm("Bạn có chắc chắn muốn HỦY cuộc thi này?")) return;
    setActionLoading(true);
    try {
      const res = await competitionApi.cancelCompetition(id);
      if (res.success) {
        showNotification("Cuộc thi đã bị hủy.");
        await fetchCompetitions();
      } else {
        showNotification(res.message || "Hủy cuộc thi thất bại.", true);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Hủy cuộc thi thất bại.", true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEdit = async (id: number) => {
    try {
      const res = await competitionApi.getCompetitionById(id);
      if (res.success && res.data) {
        setCompetitionToEdit(res.data);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      showNotification(e.message || "Không thể tải chi tiết để sửa.", true);
    }
  };

  // My competitions: where user is the creator
  const myCompetitions = competitions.filter((comp) => {
    const detail = detailedCompMap[comp.competitionId];
    return detail && currentUserId && detail.createdBy === currentUserId;
  });

  const fieldClass =
    "h-11 w-full rounded-ap-pill border border-transparent bg-canvas-secondary px-(--s-4) text-(length:--text-callout) text-label placeholder:text-label-tertiary outline-none transition-[box-shadow,border-color] duration-(--t-fast) ease-ap focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/25";
  const surface = "rounded-ap-xl bg-elevated shadow-ap-sm";
  const emptyBox = `${surface} space-y-(--s-3) px-(--s-6) py-(--s-8) text-center`;
  const textAction =
    "inline-flex min-h-11 cursor-pointer items-center gap-(--s-2) text-(length:--text-callout) font-medium text-accent hover:underline focus-visible:outline-none focus-visible:underline";
  // The actions of an organiser's card: quiet pills, the colour only says what the action does
  const pill =
    "inline-flex min-h-9 cursor-pointer items-center gap-(--s-2) rounded-full px-(--s-4) text-(length:--text-callout) font-medium transition-colors duration-(--t-fast) focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50";
  const pillNeutral = `${pill} bg-canvas-secondary text-label-secondary hover:text-label`;
  const pillAccent = `${pill} bg-accent-soft text-accent hover:bg-accent/15`;
  const pillWarn = `${pill} bg-ap-warning/15 text-label hover:bg-ap-warning/25`;
  const cancelIcon =
    "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-label-tertiary transition-colors hover:bg-ap-danger/10 hover:text-ap-danger focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 disabled:opacity-50";

  const mainTabs = [
    { id: "competitions" as const, label: "Cuộc thi & Giải đấu" },
    { id: "my-competitions" as const, label: "Cuộc thi của tôi", count: myCompetitions.length },
    { id: "leaderboard" as const, label: "Bảng xếp hạng" },
  ];

  const onMainTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = -1;
    if (event.key === "ArrowRight") next = (index + 1) % mainTabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + mainTabs.length) % mainTabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = mainTabs.length - 1;
    if (next >= 0) {
      event.preventDefault();
      setMainTab(mainTabs[next].id);
      document.getElementById(`comp-tab-${mainTabs[next].id}`)?.focus();
    }
  };

  const loadingBox = (text: string) => (
    <div role="status" className={`${emptyBox} flex flex-col items-center`}>
      <RefreshCw className="animate-spin text-accent" size={26} aria-hidden="true" />
      <p className="text-(length:--text-callout) text-label-secondary">{text}</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-(--s-7) pb-(--s-8) animate-fade-in motion-reduce:animate-none">
      {/* Header: plain and large, one filled button */}
      <section className="flex flex-col gap-(--s-5) pt-(--s-4) sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-[640px] space-y-(--s-2)">
          <h1 className="text-(length:--text-hero) font-bold leading-(--leading-tight) tracking-(--tracking-display)">
            Giải đấu &amp; Xếp hạng
          </h1>
          <p className="text-(length:--text-body) leading-(--leading-body) text-label-secondary">
            Tham gia các cuộc thi tranh biện cá nhân &amp; đồng đội, tích lũy điểm và thăng hạng.
          </p>
        </div>

        {/* Bất kỳ Authenticated user nào cũng có thể tạo cuộc thi (Creator tự động thành Judge). */}
        <button
          type="button"
          onClick={() => {
            if (!user) {
              navigate("/login");
              return;
            }
            setShowCreateModal(true);
          }}
          className="inline-flex h-12 shrink-0 cursor-pointer items-center gap-(--s-2) self-start rounded-ap-pill bg-accent px-(--s-6) text-(length:--text-body) font-medium text-accent-contrast transition-[background-color,transform] duration-(--t-fast) ease-ap hover:bg-accent-hover active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40 sm:self-auto"
          title="Khởi tạo cuộc thi mới"
        >
          <Plus size={18} aria-hidden="true" />
          <span>Tạo cuộc thi</span>
        </button>
      </section>

      {/* Notifications */}
      {errorMsg && (
        <div role="alert" className="flex items-center gap-(--s-3) rounded-ap-md bg-ap-danger/10 p-(--s-3) text-(length:--text-callout) text-label animate-fade-in">
          <AlertCircle size={18} className="shrink-0 text-ap-danger" aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div role="status" className="flex items-center gap-(--s-3) rounded-ap-md bg-accent-soft p-(--s-3) text-(length:--text-callout) text-label animate-fade-in">
          <CheckCircle2 size={18} className="shrink-0 text-accent" aria-hidden="true" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main tabs */}
      <div role="tablist" aria-label="Các mục giải đấu" className="inline-flex max-w-full gap-1 overflow-x-auto rounded-ap-pill bg-canvas-secondary p-1">
        {mainTabs.map((tab, index) => (
          <button
            key={tab.id}
            id={`comp-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={mainTab === tab.id}
            aria-controls={`comp-panel-${tab.id}`}
            tabIndex={mainTab === tab.id ? 0 : -1}
            onClick={() => setMainTab(tab.id)}
            onKeyDown={(e) => onMainTabKeyDown(e, index)}
            className={`inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-(--s-2) rounded-ap-pill px-(--s-5) text-(length:--text-callout) font-medium transition-[background-color,box-shadow,color] duration-(--t-base) ease-ap focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 ${
              mainTab === tab.id ? "bg-elevated text-label shadow-ap-sm" : "text-label-secondary hover:text-label"
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className="rounded-full bg-accent-soft px-2 text-(length:--text-caption) text-accent">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab 1: All Competitions ── */}
      {mainTab === "competitions" && (
        <div id="comp-panel-competitions" role="tabpanel" aria-labelledby="comp-tab-competitions" className="space-y-(--s-5)">
          {/* Search and filters */}
          <div className="flex flex-col gap-(--s-3) sm:flex-row sm:items-center">
            <div role="search" className="relative flex-1">
              <Search size={17} className="pointer-events-none absolute left-(--s-4) top-1/2 -translate-y-1/2 text-label-tertiary" aria-hidden="true" />
              <input
                type="search"
                aria-label="Tìm kiếm cuộc thi"
                placeholder="Tìm kiếm cuộc thi theo tên..."
                className={`${fieldClass} pl-11 [&::-webkit-search-cancel-button]:hidden`}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-(--s-2)">
              <select
                aria-label="Lọc theo hình thức"
                className={`${fieldClass} w-auto`}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">Tất cả hình thức</option>
                <option value="INDIVIDUAL">Cá nhân</option>
                <option value="TEAM">Đồng đội</option>
              </select>

              <select
                aria-label="Lọc theo trạng thái"
                className={`${fieldClass} w-auto`}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="OpenRegistration">Đang mở đăng ký</option>
                <option value="RegistrationClosed">Đã đóng đăng ký</option>
                <option value="Ongoing">Đang diễn ra</option>
                <option value="Completed">Đã hoàn thành</option>
              </select>

              <button
                type="button"
                onClick={fetchCompetitions}
                aria-label="Tải lại danh sách"
                className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-label-secondary transition-colors hover:bg-canvas-secondary hover:text-label focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
                title="Tải lại danh sách"
              >
                <RefreshCw size={17} className={loading ? "animate-spin" : ""} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* List of competitions */}
          {loading ? (
            loadingBox("Đang tải danh sách giải đấu...")
          ) : errorMsg ? (
            <div className="space-y-(--s-2) rounded-ap-xl bg-ap-danger/10 p-(--s-6) text-center">
              <p className="text-(length:--text-callout) font-semibold">{errorMsg}</p>
              <button type="button" onClick={fetchCompetitions} className={textAction}>
                Thử lại
              </button>
            </div>
          ) : competitions.length === 0 ? (
            <div className={emptyBox}>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-ap-lg bg-canvas-secondary text-label-tertiary">
                <Trophy size={26} aria-hidden="true" />
              </div>
              <h3 className="text-(length:--text-headline) font-semibold">Chưa có giải đấu nào phù hợp</h3>
              <p className="mx-auto max-w-sm text-(length:--text-callout) text-label-secondary">
                Hiện tại chưa có cuộc thi nào được công khai hoặc phù hợp với bộ lọc tìm kiếm của bạn.
              </p>
            </div>
          ) : (
            <div className="space-y-(--s-4)">
              {competitions.map((comp) => {
                const isOpenReg = comp.status === "OpenRegistration";
                const isOngoing = comp.status === "Ongoing";

                return (
                  <article
                    key={comp.competitionId}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedCompetitionId(comp.competitionId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedCompetitionId(comp.competitionId);
                      }
                    }}
                    className={`${surface} group flex cursor-pointer flex-col gap-(--s-4) p-(--s-6) transition-[transform,box-shadow] duration-(--t-base) ease-ap hover:-translate-y-0.5 hover:shadow-ap-md motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 sm:flex-row sm:items-center`}
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-ap-lg bg-ap-warning/15 text-ap-warning">
                      <Trophy size={26} aria-hidden="true" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-(--s-2)">
                      <div className="flex flex-wrap items-center gap-(--s-2)">
                        <h3 className="text-(length:--text-headline) font-semibold leading-(--leading-snug)">{comp.title}</h3>
                        <CompetitionStatusBadge status={comp.status} />
                        <CompetitionTypeBadge type={comp.competitionType} />
                      </div>
                      <div className="flex flex-wrap gap-x-(--s-5) gap-y-1 text-(length:--text-callout) text-label-secondary">
                        <span className="inline-flex items-center gap-(--s-2)">
                          <Clock size={14} aria-hidden="true" />
                          Đăng ký: {formatDate(comp.registrationStart)} – {formatDate(comp.registrationEnd)}
                        </span>
                        <span className="inline-flex items-center gap-(--s-2)">
                          <Calendar size={14} aria-hidden="true" />
                          Thi đấu: {formatDate(comp.startDate)}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`inline-flex shrink-0 items-center gap-1 self-start text-(length:--text-callout) font-medium sm:self-center ${
                        isOngoing || isOpenReg ? "text-accent" : "text-label-secondary"
                      }`}
                    >
                      {isOngoing && (
                        <span className="relative mr-1 flex h-2 w-2" aria-hidden="true">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:animate-none" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                        </span>
                      )}
                      {isOngoing ? "Đang diễn ra • Xem phòng" : isOpenReg ? "Xem & Đăng ký" : "Xem chi tiết"}
                      <ChevronRight size={16} className="transition-transform duration-(--t-base) group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
                    </span>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: My Competitions (Organizer / Manager View) ── */}
      {mainTab === "my-competitions" && (
        <div id="comp-panel-my-competitions" role="tabpanel" aria-labelledby="comp-tab-my-competitions" className="space-y-(--s-5)">
          <div className="flex flex-col gap-(--s-3) rounded-ap-xl bg-canvas-secondary p-(--s-5) sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-(length:--text-callout) font-semibold">Cuộc thi do bạn khởi tạo &amp; quản lý</h3>
              <p className="mt-0.5 text-(length:--text-callout) leading-(--leading-body) text-label-secondary">
                Quản lý vòng đời giải đấu, xét duyệt đơn đăng ký của thí sinh/đội thi và phân công giám khảo.
              </p>
            </div>
            <button type="button" onClick={() => setShowCreateModal(true)} className={`${pillAccent} shrink-0`}>
              <Plus size={15} aria-hidden="true" />
              <span>Tạo thêm cuộc thi</span>
            </button>
          </div>

          {loading ? (
            loadingBox("Đang tải cuộc thi của bạn...")
          ) : myCompetitions.length === 0 ? (
            <div className={emptyBox}>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-ap-lg bg-canvas-secondary text-label-tertiary">
                <Trophy size={26} aria-hidden="true" />
              </div>
              <h3 className="text-(length:--text-headline) font-semibold">Bạn chưa tạo cuộc thi nào</h3>
              <p className="mx-auto max-w-sm text-(length:--text-callout) text-label-secondary">
                Nhấn nút &ldquo;Tạo cuộc thi&rdquo; để khởi tạo và tổ chức giải đấu đầu tiên của bạn trên nền tảng.
              </p>
              <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)} className="mt-2">
                <Plus size={14} className="mr-1" />
                Tạo cuộc thi ngay
              </Button>
            </div>
          ) : (
            <div className="space-y-(--s-4)">
              {myCompetitions.map((comp) => {
                const detail = detailedCompMap[comp.competitionId];

                return (
                  <article key={comp.competitionId} className={`${surface} space-y-(--s-4) p-(--s-6)`}>
                    <div className="flex flex-col justify-between gap-(--s-4) lg:flex-row lg:items-center">
                      <div className="min-w-0 space-y-(--s-2)">
                        <div className="flex flex-wrap items-center gap-(--s-2)">
                          <span className="text-(length:--text-caption) tabular-nums text-label-tertiary">#{comp.competitionId}</span>
                          <h4 className="text-(length:--text-headline) font-semibold leading-(--leading-snug)">{comp.title}</h4>
                          <CompetitionStatusBadge status={comp.status} />
                          <CompetitionTypeBadge type={comp.competitionType} />
                        </div>
                        <div className="flex flex-wrap gap-x-(--s-5) gap-y-1 text-(length:--text-callout) text-label-secondary">
                          <span className="inline-flex items-center gap-(--s-2)">
                            <Clock size={14} aria-hidden="true" />
                            Đăng ký: {formatDate(comp.registrationStart)} – {formatDate(comp.registrationEnd)}
                          </span>
                          <span className="inline-flex items-center gap-(--s-2)">
                            <Calendar size={14} aria-hidden="true" />
                            Thi đấu: {formatDate(comp.startDate)}
                          </span>
                          {detail?.maxParticipants && (
                            <span className="font-medium text-label">
                              Tối đa: {detail.maxParticipants} {comp.competitionType === "TEAM" ? "đội" : "thí sinh"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Operation actions */}
                      <div className="flex flex-wrap items-center gap-(--s-2) lg:justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedCompetitionId(comp.competitionId)}
                          className={pillNeutral}
                          title="Xem chi tiết giải đấu"
                        >
                          <Eye size={14} aria-hidden="true" />
                          <span>Xem</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEdit(comp.competitionId)}
                          className={pillNeutral}
                          title="Chỉnh sửa thông tin"
                        >
                          <Edit size={14} aria-hidden="true" />
                          <span>Sửa</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedAdminCompId(comp.competitionId)}
                          className={pillAccent}
                          title="Quản lý thí sinh, đội thi & giám khảo"
                        >
                          <Settings size={14} aria-hidden="true" />
                          <span>Quản lý</span>
                        </button>

                        {/* Lifecycle quick buttons */}
                        {comp.status === "Draft" && (
                          <>
                            <button type="button" onClick={() => handleOpenRegistration(comp.competitionId)} disabled={actionLoading} className={pillAccent} title="Mở đăng ký">
                              <DoorOpen size={14} aria-hidden="true" />
                              <span>Mở ĐK</span>
                            </button>
                            <button type="button" onClick={() => handleCancelCompetition(comp.competitionId)} disabled={actionLoading} className={cancelIcon} title="Hủy cuộc thi" aria-label="Hủy cuộc thi">
                              <Ban size={15} aria-hidden="true" />
                            </button>
                          </>
                        )}

                        {comp.status === "OpenRegistration" && (
                          <>
                            <button type="button" onClick={() => handleCloseRegistration(comp.competitionId)} disabled={actionLoading} className={pillWarn} title="Đóng đăng ký">
                              <DoorClosed size={14} aria-hidden="true" />
                              <span>Đóng ĐK</span>
                            </button>
                            <button type="button" onClick={() => handleCancelCompetition(comp.competitionId)} disabled={actionLoading} className={cancelIcon} title="Hủy cuộc thi" aria-label="Hủy cuộc thi">
                              <Ban size={15} aria-hidden="true" />
                            </button>
                          </>
                        )}

                        {comp.status === "RegistrationClosed" && (
                          <>
                            <button type="button" onClick={() => handleStartCompetition(comp.competitionId)} disabled={actionLoading} className={pillAccent} title="Bắt đầu thi đấu">
                              <Play size={14} aria-hidden="true" />
                              <span>Bắt đầu</span>
                            </button>
                            <button type="button" onClick={() => handleCancelCompetition(comp.competitionId)} disabled={actionLoading} className={cancelIcon} title="Hủy cuộc thi" aria-label="Hủy cuộc thi">
                              <Ban size={15} aria-hidden="true" />
                            </button>
                          </>
                        )}

                        {comp.status === "Ongoing" && (
                          <>
                            <button
                              type="button"
                              onClick={() => setSelectedAdminCompId(comp.competitionId)}
                              className={pillAccent}
                              title="Xem cây thi đấu và điều phối các trận"
                            >
                              <Swords size={14} aria-hidden="true" />
                              <span>Cây thi đấu</span>
                            </button>
                            <button type="button" onClick={() => handleCompleteCompetition(comp.competitionId)} disabled={actionLoading} className={pillNeutral} title="Hoàn thành giải đấu">
                              <CheckCheck size={14} aria-hidden="true" />
                              <span>Hoàn thành</span>
                            </button>
                            <button type="button" onClick={() => handleCancelCompetition(comp.competitionId)} disabled={actionLoading} className={cancelIcon} title="Hủy cuộc thi" aria-label="Hủy cuộc thi">
                              <Ban size={15} aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: Leaderboard ── */}
      {mainTab === "leaderboard" && (
        <div id="comp-panel-leaderboard" role="tabpanel" aria-labelledby="comp-tab-leaderboard" className={emptyBox}>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-ap-lg bg-ap-warning/15 text-ap-warning">
            <Trophy size={32} aria-hidden="true" />
          </div>
          <h3 className="text-(length:--text-title) font-semibold leading-(--leading-tight)">Bảng xếp hạng giải đấu</h3>
          <p className="mx-auto max-w-md text-(length:--text-body) leading-(--leading-body) text-label-secondary">
            Hệ thống bảng xếp hạng đang được đồng bộ và tổng hợp dựa trên kết quả các giải đấu đã hoàn thành. Hiện chưa có xếp hạng chính thức từ hệ thống.
          </p>
        </div>
      )}

      {/* Modal: Create Competition */}
      {showCreateModal && (
        <CompetitionFormModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(createdComp) => {
            showNotification("Đã tạo cuộc thi mới thành công (trạng thái: Bản nháp)!");
            fetchCompetitions();
            if (createdComp?.competitionId) {
              setSelectedCompetitionId(createdComp.competitionId);
            }
          }}
        />
      )}

      {/* Modal: Edit Competition */}
      {competitionToEdit && (
        <CompetitionFormModal
          isOpen={Boolean(competitionToEdit)}
          onClose={() => setCompetitionToEdit(null)}
          competitionToEdit={competitionToEdit}
          onSuccess={() => {
            showNotification("Đã cập nhật thông tin cuộc thi thành công!");
            fetchCompetitions();
          }}
        />
      )}

      {/* Modal: Interactive Competition Detail for Debater */}
      {selectedCompetitionId && (
        <CompetitionDetailModal
          competitionId={selectedCompetitionId}
          isOpen={Boolean(selectedCompetitionId)}
          onClose={() => setSelectedCompetitionId(null)}
          currentUser={user}
          onStatusChanged={fetchCompetitions}
          onOpenManage={(compId) => setSelectedAdminCompId(compId)}
        />
      )}

      {/* Modal: Organizer / Admin Management (Registrations review, Teams, Judges) */}
      {selectedAdminCompId && (
        <CompetitionAdminDetailModal
          competitionId={selectedAdminCompId}
          isOpen={Boolean(selectedAdminCompId)}
          onClose={() => setSelectedAdminCompId(null)}
          onEdit={(comp) => {
            setSelectedAdminCompId(null);
            setCompetitionToEdit(comp);
          }}
          onUpdated={fetchCompetitions}
        />
      )}
    </div>
  );
};

export default Competitions;

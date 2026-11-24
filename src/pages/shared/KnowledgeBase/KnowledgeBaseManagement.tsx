import React, { useCallback, useEffect, useState } from "react";
import { AxiosError } from "axios";
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Database,
  ExternalLink,
  FileText,
  Filter,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { knowledgeBaseApi } from "../../../api";
import { TOPIC_CATEGORIES, topicCategoryLabel } from "../../../constants/topicCategories";
import { useAuth } from "../../../hooks/useAuth";
import { ROLES } from "../../../utils/constants";
import type {
  CreateKnowledgeSourceRequest,
  FactCardItem,
  FactCardStatus,
  KnowledgeBaseStats,
  KnowledgeSourceItem,
  UpdateFactCardRequest,
} from "../../../types";
import CreateSourceModal from "./CreateSourceModal";
import EditFactModal from "./EditFactModal";

const PAGE_SIZE = 20;

interface ApiErrorInfo {
  is503: boolean;
  message: string;
}

function extractApiError(err: unknown, fallback: string): ApiErrorInfo {
  if (err instanceof AxiosError) {
    const status = err.response?.status;
    const data = err.response?.data as { message?: string; detail?: string } | undefined;
    const msg = data?.message || data?.detail || err.message || fallback;
    return { is503: status === 503, message: msg };
  }
  if (err instanceof Error) {
    return { is503: false, message: err.message || fallback };
  }
  return { is503: false, message: fallback };
}

const STATUS_BADGE: Record<FactCardStatus, { label: string; className: string }> = {
  pending: {
    label: "Chờ duyệt",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  },
  approved: {
    label: "Đã duyệt",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  rejected: {
    label: "Từ chối",
    className: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
  },
};

const KnowledgeBaseManagement: React.FC = () => {
  const { role } = useAuth();
  const isAdmin = role === ROLES.ADMIN;

  const [activeTab, setActiveTab] = useState<"sources" | "facts">("sources");

  // Global stats & service banner
  const [stats, setStats] = useState<KnowledgeBaseStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [serviceBanner, setServiceBanner] = useState<ApiErrorInfo | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Tab 1: Sources state
  const [sources, setSources] = useState<KnowledgeSourceItem[]>([]);
  const [sourcesTotal, setSourcesTotal] = useState(0);
  const [sourcesPage, setSourcesPage] = useState(1);
  const [sourceTopicFilter, setSourceTopicFilter] = useState("");
  const [loadingSources, setLoadingSources] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Tab 2: Fact Cards state
  const [facts, setFacts] = useState<FactCardItem[]>([]);
  const [factsTotal, setFactsTotal] = useState(0);
  const [factsPage, setFactsPage] = useState(1);
  const [factTopicFilter, setFactTopicFilter] = useState("");
  const [factStatusFilter, setFactStatusFilter] = useState<FactCardStatus | "">("pending");
  const [factSourceFilter, setFactSourceFilter] = useState<{ id: string; title: string } | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingFacts, setLoadingFacts] = useState(false);
  const [selectedFactIds, setSelectedFactIds] = useState<string[]>([]);
  const [editingFact, setEditingFact] = useState<FactCardItem | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    window.setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await knowledgeBaseApi.getStats();
      if (res.success && res.data) {
        setStats(res.data);
        setServiceBanner(null);
      } else {
        setServiceBanner({ is503: false, message: res.message || "Không thể tải thống kê kho tri thức." });
      }
    } catch (err) {
      setServiceBanner(extractApiError(err, "Không thể kết nối tới dịch vụ Kho tri thức."));
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchSources = useCallback(async () => {
    setLoadingSources(true);
    try {
      const res = await knowledgeBaseApi.getSources({
        topic: sourceTopicFilter || undefined,
        page: sourcesPage,
        pageSize: PAGE_SIZE,
      });
      if (res.success && res.data) {
        setSources(res.data.items ?? []);
        setSourcesTotal(res.data.total ?? 0);
        setServiceBanner(null);
      } else {
        setServiceBanner({ is503: false, message: res.message || "Không thể tải danh sách nguồn." });
      }
    } catch (err) {
      setServiceBanner(extractApiError(err, "Không thể tải danh sách nguồn tài liệu."));
    } finally {
      setLoadingSources(false);
    }
  }, [sourceTopicFilter, sourcesPage]);

  const fetchFacts = useCallback(async () => {
    setLoadingFacts(true);
    try {
      const res = await knowledgeBaseApi.getFacts({
        topic: factTopicFilter || undefined,
        status: factStatusFilter || undefined,
        sourceId: factSourceFilter?.id || undefined,
        q: searchQuery || undefined,
        page: factsPage,
        pageSize: PAGE_SIZE,
      });
      if (res.success && res.data) {
        setFacts(res.data.items ?? []);
        setFactsTotal(res.data.total ?? 0);
        setSelectedFactIds([]);
        setServiceBanner(null);
      } else {
        setServiceBanner({ is503: false, message: res.message || "Không thể tải danh sách dữ kiện." });
      }
    } catch (err) {
      setServiceBanner(extractApiError(err, "Không thể tải danh sách dữ kiện (Fact Cards)."));
    } finally {
      setLoadingFacts(false);
    }
  }, [factTopicFilter, factStatusFilter, factSourceFilter, searchQuery, factsPage]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    void fetchSources();
  }, [fetchSources]);

  useEffect(() => {
    if (activeTab === "facts") {
      void fetchFacts();
    }
  }, [activeTab, fetchFacts]);

  const refreshAll = async () => {
    await Promise.all([
      fetchStats(),
      fetchSources(),
      activeTab === "facts" ? fetchFacts() : Promise.resolve(),
    ]);
  };

  const handleCreateSource = async (payload: CreateKnowledgeSourceRequest) => {
    try {
      const res = await knowledgeBaseApi.createSource(payload);
      if (!res.success) {
        throw new Error(res.message || "Không thể nạp nguồn tài liệu.");
      }
      showToast(
        "success",
        `Đã nạp nguồn thành công (${res.data?.created_facts ?? 0} dữ kiện được tạo).`
      );
      setSourcesPage(1);
      await refreshAll();
    } catch (err) {
      const info = extractApiError(err, "Lỗi khi nạp nguồn tài liệu.");
      if (info.is503) setServiceBanner(info);
      throw new Error(info.message);
    }
  };

  const handleDeleteSource = async (source: KnowledgeSourceItem) => {
    if (
      !window.confirm(
        `Xoá nguồn "${source.title}"? Toàn bộ ${source.total_facts} dữ kiện thuộc nguồn này cũng sẽ bị xoá.`
      )
    ) {
      return;
    }
    setBusyAction(true);
    try {
      const res = await knowledgeBaseApi.deleteSource(source.id);
      if (!res.success) throw new Error(res.message);
      showToast("success", `Đã xoá nguồn "${source.title}".`);
      await refreshAll();
    } catch (err) {
      const info = extractApiError(err, "Không thể xoá nguồn tài liệu.");
      if (info.is503) setServiceBanner(info);
      showToast("error", info.message);
    } finally {
      setBusyAction(false);
    }
  };

  const handleUpdateFact = async (factId: string, payload: UpdateFactCardRequest) => {
    try {
      const res = await knowledgeBaseApi.updateFact(factId, payload);
      if (!res.success) throw new Error(res.message || "Không thể cập nhật dữ kiện.");
      showToast("success", "Đã cập nhật nội dung Fact Card.");
      await Promise.all([fetchFacts(), fetchStats()]);
    } catch (err) {
      const info = extractApiError(err, "Lỗi khi cập nhật Fact Card.");
      if (info.is503) setServiceBanner(info);
      throw new Error(info.message);
    }
  };

  const handleSingleStatus = async (factId: string, status: FactCardStatus) => {
    setBusyAction(true);
    try {
      const res = await knowledgeBaseApi.updateFactStatus(factId, status);
      if (!res.success) throw new Error(res.message);
      showToast(
        "success",
        status === "approved" ? "Đã duyệt Fact Card." : "Đã chuyển trạng thái Fact Card."
      );
      await Promise.all([fetchFacts(), fetchStats()]);
    } catch (err) {
      const info = extractApiError(err, "Không thể cập nhật trạng thái.");
      if (info.is503) setServiceBanner(info);
      showToast("error", info.message);
    } finally {
      setBusyAction(false);
    }
  };

  const handleBatchStatus = async (status: FactCardStatus) => {
    if (selectedFactIds.length === 0) return;
    setBusyAction(true);
    try {
      const res = await knowledgeBaseApi.batchUpdateFactStatus({
        factIds: selectedFactIds,
        status,
      });
      if (!res.success) throw new Error(res.message);
      showToast(
        "success",
        `Đã cập nhật ${res.data?.updated_count ?? selectedFactIds.length} dữ kiện sang "${STATUS_BADGE[status].label}".`
      );
      await Promise.all([fetchFacts(), fetchStats()]);
    } catch (err) {
      const info = extractApiError(err, "Không thể duyệt/từ chối hàng loạt.");
      if (info.is503) setServiceBanner(info);
      showToast("error", info.message);
    } finally {
      setBusyAction(false);
    }
  };

  const handleDeleteFact = async (fact: FactCardItem) => {
    if (!window.confirm("Bạn có chắc muốn xoá Fact Card này?")) return;
    setBusyAction(true);
    try {
      const res = await knowledgeBaseApi.deleteFact(fact.id);
      if (!res.success) throw new Error(res.message);
      showToast("success", "Đã xoá Fact Card.");
      await Promise.all([fetchFacts(), fetchStats()]);
    } catch (err) {
      const info = extractApiError(err, "Không thể xoá Fact Card.");
      if (info.is503) setServiceBanner(info);
      showToast("error", info.message);
    } finally {
      setBusyAction(false);
    }
  };

  const toggleFactSelection = (id: string) => {
    setSelectedFactIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const allSelectedOnPage = facts.length > 0 && facts.every((f) => selectedFactIds.includes(f.id));
  const toggleSelectAllOnPage = () => {
    if (allSelectedOnPage) {
      setSelectedFactIds([]);
    } else {
      setSelectedFactIds(facts.map((f) => f.id));
    }
  };

  const sourcesTotalPages = Math.max(1, Math.ceil(sourcesTotal / PAGE_SIZE));
  const factsTotalPages = Math.max(1, Math.ceil(factsTotal / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#008A64] dark:text-[#34D399] mb-1">
            <Database size={14} />
            <span>RAG Evidence Knowledge Base</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC]">
            Kho tri thức & Dẫn chứng
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Nạp tài liệu nguồn, tách đoạn vector và kiểm duyệt dẫn chứng cho AI Evaluator.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refreshAll()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#12231C] text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <RefreshCw size={14} className={loadingStats || loadingSources || loadingFacts ? "animate-spin" : ""} />
            <span>Làm mới</span>
          </button>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#008A64] hover:bg-[#007457] text-white text-xs font-bold shadow-sm cursor-pointer"
          >
            <Plus size={15} />
            <span>Nạp tài liệu mới</span>
          </button>
        </div>
      </div>

      {/* 503 / Service Error Banner */}
      {serviceBanner && (
        <div
          role="alert"
          data-testid="kb-service-banner"
          className={`p-4 rounded-2xl border flex items-start gap-3 ${
            serviceBanner.is503
              ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
          }`}
        >
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm space-y-1">
            <p className="font-bold">
              {serviceBanner.is503
                ? "Dịch vụ Kho tri thức RAG hiện chưa sẵn sàng (HTTP 503)"
                : "Không thể tải dữ liệu Kho tri thức"}
            </p>
            <p className="opacity-90">{serviceBanner.message}</p>
            {serviceBanner.is503 && (
              <p className="text-xs opacity-80">
                Kiểm tra `ai-evaluator-service` đã bật `RAG_ENABLED=true` và kết nối Postgres pgvector chưa.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Action Toast */}
      {toast && (
        <div
          role="status"
          className={`px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
            toast.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
          }`}
        >
          <span>{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} className="cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          {
            label: "Tổng nguồn",
            value: stats?.total_sources ?? 0,
            icon: BookOpen,
            tone: "text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800",
          },
          {
            label: "Tổng Fact Cards",
            value: stats?.totals.total ?? 0,
            icon: FileText,
            tone: "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50",
          },
          {
            label: "Đã duyệt",
            value: stats?.totals.approved ?? 0,
            icon: CheckCircle2,
            tone: "text-[#008A64] dark:text-[#34D399] bg-emerald-50 dark:bg-emerald-950/50",
          },
          {
            label: "Chờ duyệt",
            value: stats?.totals.pending ?? 0,
            icon: Clock,
            tone: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50",
          },
          {
            label: "Từ chối",
            value: stats?.totals.rejected ?? 0,
            icon: XCircle,
            tone: "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50",
          },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="p-4 rounded-2xl bg-white dark:bg-[#0F1C17] border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {kpi.label}
                </p>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-[#F8FAFC] mt-0.5">
                  {loadingStats && !stats ? "—" : kpi.value}
                </p>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${kpi.tone}`}>
                <Icon size={18} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Topic breakdown pills */}
      {stats?.by_topic && Object.keys(stats.by_topic).length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-500 dark:text-slate-400">Theo chủ đề:</span>
          {Object.entries(stats.by_topic).map(([topicCode, count]) => (
            <span
              key={topicCode}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-[#12231C] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
            >
              <strong>{topicCategoryLabel(topicCode)}:</strong>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                {count.approved} duyệt
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-amber-600 dark:text-amber-400">{count.pending} chờ</span>
              <span className="text-slate-400">·</span>
              <span>{count.total} tổng</span>
            </span>
          ))}
        </div>
      )}

      {/* Main Tabs */}
      <div className="bg-white dark:bg-[#0F1C17] border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="flex items-center gap-1 px-4 pt-3 border-b border-slate-200/80 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("sources")}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === "sources"
                ? "border-[#008A64] text-[#008A64] dark:text-[#34D399]"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Nguồn tài liệu ({sourcesTotal})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("facts")}
            className={`px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === "facts"
                ? "border-[#008A64] text-[#008A64] dark:text-[#34D399]"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <span>Kiểm duyệt Dữ kiện (Fact Cards)</span>
            {(stats?.totals.pending ?? 0) > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                {stats?.totals.pending}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: SOURCES */}
        {activeTab === "sources" && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-slate-400" />
                <select
                  aria-label="Lọc nguồn theo danh mục"
                  value={sourceTopicFilter}
                  onChange={(e) => {
                    setSourceTopicFilter(e.target.value);
                    setSourcesPage(1);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#12231C] text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  <option value="">Tất cả danh mục</option>
                  {TOPIC_CATEGORIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Trang {sourcesPage}/{sourcesTotalPages} · {sourcesTotal} nguồn
              </p>
            </div>

            {loadingSources ? (
              <div className="py-12 flex items-center justify-center gap-2 text-xs text-slate-500">
                <Loader2 size={16} className="animate-spin text-[#008A64]" />
                <span>Đang tải danh sách nguồn tài liệu...</span>
              </div>
            ) : sources.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Chưa có nguồn tài liệu nào
                </p>
                <p className="text-xs text-slate-400">
                  Bấm &ldquo;Nạp tài liệu mới&rdquo; để thêm tài liệu hoặc dữ kiện cho kho RAG.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 pr-4 font-bold">Tiêu đề nguồn</th>
                      <th className="py-2.5 px-3 font-bold">Danh mục</th>
                      <th className="py-2.5 px-3 font-bold">Loại</th>
                      <th className="py-2.5 px-3 font-bold">Dữ kiện</th>
                      <th className="py-2.5 px-3 font-bold">Ngày tạo</th>
                      <th className="py-2.5 pl-3 text-right font-bold">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {sources.map((src) => (
                      <tr key={src.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/30">
                        <td className="py-3 pr-4">
                          <p className="font-bold text-slate-800 dark:text-slate-100">{src.title}</p>
                          {src.url && (
                            <a
                              href={src.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-[#008A64] hover:underline mt-0.5"
                            >
                              <span className="truncate max-w-[240px]">{src.url}</span>
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {topicCategoryLabel(src.topic)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-400 uppercase">
                          {src.source_type}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {src.total_facts} tổng
                            </span>
                            <span className="text-emerald-600">({src.approved_facts} duyệt</span>
                            <span className="text-amber-600">/ {src.pending_facts} chờ</span>
                            <span className="text-rose-600">/ {src.rejected_facts} từ chối)</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-500">
                          {new Date(src.created_at).toLocaleDateString("vi-VN")}
                        </td>
                        <td className="py-3 pl-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setFactSourceFilter({ id: src.id, title: src.title });
                                setFactStatusFilter("");
                                setFactsPage(1);
                                setActiveTab("facts");
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#ECFDF5] hover:bg-[#D1FAE5] dark:bg-emerald-950/40 text-[#008A64] dark:text-emerald-300 text-xs font-bold cursor-pointer"
                            >
                              Xem dẫn chứng
                            </button>
                            <button
                              type="button"
                              disabled={busyAction}
                              onClick={() => void handleDeleteSource(src)}
                              aria-label={`Xoá nguồn ${src.title}`}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {sourcesTotalPages > 1 && (
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={sourcesPage <= 1}
                  onClick={() => setSourcesPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  Trước
                </button>
                <button
                  type="button"
                  disabled={sourcesPage >= sourcesTotalPages}
                  onClick={() => setSourcesPage((p) => Math.min(sourcesTotalPages, p + 1))}
                  className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  Sau
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: FACT CARDS */}
        {activeTab === "facts" && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Filters */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Lọc dữ kiện theo danh mục"
                  value={factTopicFilter}
                  onChange={(e) => {
                    setFactTopicFilter(e.target.value);
                    setFactsPage(1);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#12231C] text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  <option value="">Tất cả danh mục</option>
                  {TOPIC_CATEGORIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Lọc dữ kiện theo trạng thái"
                  value={factStatusFilter}
                  onChange={(e) => {
                    setFactStatusFilter(e.target.value as FactCardStatus | "");
                    setFactsPage(1);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#12231C] text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  <option value="pending">Chờ duyệt (pending)</option>
                  <option value="approved">Đã duyệt (approved)</option>
                  <option value="rejected">Từ chối (rejected)</option>
                  <option value="">Tất cả trạng thái</option>
                </select>

                {factSourceFilter && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-[#008A64] dark:text-emerald-300">
                    <span>Nguồn: {factSourceFilter.title}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFactSourceFilter(null);
                        setFactsPage(1);
                      }}
                      aria-label="Bỏ lọc nguồn"
                      className="hover:text-rose-600 cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  </span>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSearchQuery(searchInput);
                  setFactsPage(1);
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1 sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Tìm nội dung hoặc trích dẫn..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#12231C] text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#008A64]/30"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold cursor-pointer"
                >
                  Tìm
                </button>
              </form>
            </div>

            {/* Batch actions */}
            {selectedFactIds.length > 0 && (
              <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Đã chọn {selectedFactIds.length} Fact Cards
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={() => void handleBatchStatus("approved")}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#008A64] hover:bg-[#007457] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                  >
                    <Check size={13} />
                    <span>Duyệt hàng loạt</span>
                  </button>
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={() => void handleBatchStatus("rejected")}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                  >
                    <X size={13} />
                    <span>Từ chối hàng loạt</span>
                  </button>
                </div>
              </div>
            )}

            {/* Facts List */}
            {loadingFacts ? (
              <div className="py-12 flex items-center justify-center gap-2 text-xs text-slate-500">
                <Loader2 size={16} className="animate-spin text-[#008A64]" />
                <span>Đang tải danh sách dữ kiện...</span>
              </div>
            ) : facts.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Không có Fact Card nào khớp bộ lọc
                </p>
                <p className="text-xs text-slate-400">
                  Thử đổi trạng thái lọc hoặc từ khoá tìm kiếm.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-600 dark:text-slate-400">
                  <label className="inline-flex items-center gap-2 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allSelectedOnPage}
                      onChange={toggleSelectAllOnPage}
                      className="accent-[#008A64] w-4 h-4"
                    />
                    <span>Chọn tất cả trang này ({facts.length})</span>
                  </label>
                  <span>
                    Trang {factsPage}/{factsTotalPages} · {factsTotal} kết quả
                  </span>
                </div>

                {facts.map((fact) => {
                  const badge = STATUS_BADGE[fact.status] ?? STATUS_BADGE.pending;
                  const checked = selectedFactIds.includes(fact.id);
                  return (
                    <div
                      key={fact.id}
                      className={`p-4 rounded-2xl border transition-colors ${
                        checked
                          ? "border-[#008A64] bg-emerald-50/30 dark:bg-emerald-950/20"
                          : "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#12231C]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFactSelection(fact.id)}
                          aria-label={`Chọn fact ${fact.id}`}
                          className="accent-[#008A64] w-4 h-4 mt-1 shrink-0"
                        />

                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <span className={`px-2 py-0.5 rounded-full font-bold ${badge.className}`}>
                              {badge.label}
                            </span>
                            <span className="px-2 py-0.5 rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {topicCategoryLabel(fact.topic)}
                            </span>
                            {fact.has_embedding && (
                              <span className="px-2 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                                Vector Ready
                              </span>
                            )}
                            {fact.source_title && (
                              <span className="text-slate-500 dark:text-slate-400 truncate max-w-[260px]">
                                Nguồn: <strong>{fact.source_title}</strong>
                              </span>
                            )}
                          </div>

                          <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-100 leading-relaxed">
                            {fact.content}
                          </p>

                          {(fact.citation || fact.published_date) && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {fact.citation && <span>Trích dẫn: {fact.citation}</span>}
                              {fact.citation && fact.published_date && <span> · </span>}
                              {fact.published_date && <span>Ngày: {fact.published_date}</span>}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => setEditingFact(fact)}
                            title="Sửa nhanh"
                            aria-label="Sửa nhanh"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Pencil size={15} />
                          </button>
                          {fact.status !== "approved" && (
                            <button
                              type="button"
                              disabled={busyAction}
                              onClick={() => void handleSingleStatus(fact.id, "approved")}
                              title="Duyệt"
                              aria-label="Duyệt"
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                            >
                              <Check size={16} />
                            </button>
                          )}
                          {fact.status !== "rejected" && (
                            <button
                              type="button"
                              disabled={busyAction}
                              onClick={() => void handleSingleStatus(fact.id, "rejected")}
                              title="Từ chối"
                              aria-label="Từ chối"
                              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 cursor-pointer"
                            >
                              <X size={16} />
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busyAction}
                            onClick={() => void handleDeleteFact(fact)}
                            title="Xoá"
                            aria-label="Xoá"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {factsTotalPages > 1 && (
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={factsPage <= 1}
                  onClick={() => setFactsPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  Trước
                </button>
                <button
                  type="button"
                  disabled={factsPage >= factsTotalPages}
                  onClick={() => setFactsPage((p) => Math.min(factsTotalPages, p + 1))}
                  className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  Sau
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <CreateSourceModal
        isOpen={isCreateModalOpen}
        isAdmin={isAdmin}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateSource}
      />

      <EditFactModal
        key={editingFact?.id ?? "closed"}
        fact={editingFact}
        onClose={() => setEditingFact(null)}
        onSubmit={handleUpdateFact}
      />
    </div>
  );
};

export default KnowledgeBaseManagement;

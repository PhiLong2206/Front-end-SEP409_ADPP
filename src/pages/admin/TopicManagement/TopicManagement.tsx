import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Trash2,
  Edit3,
  Plus,
  AlertCircle,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import TopicGuideFields from "../../../components/admin/TopicGuideFields";
import {
  defaultGuidePlaceholders,
  guidesForCreate,
  guidesForUpdate,
  initialGuideValues,
  type GuidePair,
} from "../../../utils/topicGuides";
import topicApi from "../../../api/topicApi";
import { Topic, CreateTopicDto, UpdateTopicDto } from "../../../types";
import { normalizeTopicCategory, TOPIC_CATEGORIES, topicCategoryLabel } from "../../../constants/topicCategories";

const AdminTopicManagement: React.FC = () => {
  // Topics and Pagination state
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [pageSize] = useState<number>(15);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filters state
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [appliedSearch, setAppliedSearch] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Notifications
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [deletingTopic, setDeletingTopic] = useState<Topic | null>(null);

  // Form states
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    category: string;
    difficulty: string;
    isActive: boolean;
  }>({
    title: "",
    description: "",
    category: "",
    difficulty: "Medium",
    isActive: true,
  });
  // The task of each side. `guideInitial` is what the edit form opened with: only a changed field is sent.
  const [guides, setGuides] = useState<GuidePair>({ pro: "", con: "" });
  const [guideInitial, setGuideInitial] = useState<GuidePair>({ pro: "", con: "" });

  // The fixed categories: the option value is the code the backend stores, the text its label
  const categoriesList = TOPIC_CATEGORIES;

  // Fetch topics from real backend API: GET /api/topics
  const fetchTopics = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await topicApi.getAll({
        pageNumber,
        pageSize,
        searchTerm: appliedSearch.trim() || undefined,
        category: selectedCategory === "ALL" ? undefined : selectedCategory,
        difficulty: selectedDifficulty === "ALL" ? undefined : selectedDifficulty,
        isActive: statusFilter === "ALL" ? undefined : statusFilter === "ACTIVE",
      });

      if (res && res.success && res.data) {
        setTopics(res.data.items || []);
        setTotalCount(res.data.totalCount || 0);
        setTotalPages(res.data.totalPages || 1);
      } else {
        setError(res?.message || "Không thể tải danh sách chủ đề.");
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setError(errObj?.message || "Lỗi khi kết nối với máy chủ chủ đề.");
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, pageNumber, pageSize, selectedCategory, selectedDifficulty, statusFilter]);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  // Handle Search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPageNumber(1);
    setAppliedSearch(searchTerm);
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setFormData({
      title: "",
      description: "",
      category: "",
      difficulty: "Medium",
      isActive: true,
    });
    setGuides({ pro: "", con: "" });
    setGuideInitial({ pro: "", con: "" });
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (t: Topic) => {
    setEditingTopic(t);
    setFormData({
      title: t.title || "",
      description: t.description || "",
      // an old topic outside the list ("General") shows no category: the admin must pick one
      category: normalizeTopicCategory(t.category) ?? "",
      difficulty: t.difficulty || "Medium",
      isActive: t.isActive !== false,
    });
    // A topic on the default text starts with empty fields (the default is only the placeholder): saving never
    // writes the default into the database
    const startGuides = initialGuideValues(t);
    setGuides(startGuides);
    setGuideInitial(startGuides);
  };

  // Submit Create Topic: POST /api/topics
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError("Tiêu đề chủ đề không được để trống.");
      return;
    }

    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      const payload: CreateTopicDto = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        category: formData.category,
        difficulty: formData.difficulty,
        ...guidesForCreate(guides),
      };

      const res = await topicApi.create(payload);
      if (res && res.success) {
        setSuccess(`Tạo chủ đề "${formData.title}" thành công.`);
        setIsCreateModalOpen(false);
        setPageNumber(1);
        fetchTopics();
      } else {
        setError(res?.message || "Tạo chủ đề không thành công.");
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setError(errObj?.message || "Lỗi khi tạo chủ đề.");
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Edit Topic: PATCH /api/topics/{id}
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTopic) return;
    const topicId = editingTopic.topicId ?? editingTopic.id;
    if (!topicId) return;

    if (!formData.title.trim()) {
      setError("Tiêu đề chủ đề không được để trống.");
      return;
    }

    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      const payload: UpdateTopicDto = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        category: formData.category,
        difficulty: formData.difficulty,
        isActive: formData.isActive,
        // Only a field that changed: left out = keep the current text, "" = back to the default text
        ...guidesForUpdate(guideInitial, guides),
      };

      const res = await topicApi.update(topicId, payload);
      if (res && res.success) {
        setSuccess(`Cập nhật chủ đề "${formData.title}" thành công.`);
        setEditingTopic(null);
        fetchTopics();
      } else {
        setError(res?.message || "Cập nhật chủ đề không thành công.");
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setError(errObj?.message || "Lỗi khi cập nhật chủ đề.");
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Delete Topic: DELETE /api/topics/{id}
  const handleDeleteConfirm = async () => {
    if (!deletingTopic) return;
    const topicId = deletingTopic.topicId ?? deletingTopic.id;
    if (!topicId) return;

    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await topicApi.delete(topicId);
      if (res && res.success) {
        setSuccess(`Đã xóa/vô hiệu hóa chủ đề "${deletingTopic.title}".`);
        setDeletingTopic(null);
        fetchTopics();
      } else {
        setError(res?.message || "Xóa chủ đề không thành công.");
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setError(errObj?.message || "Lỗi khi xóa chủ đề.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Quản lý chủ đề hệ thống
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            CRUD kiểm duyệt, thêm mới, chỉnh sửa và quản lý kiến nghị tranh biện toàn nền tảng qua API Backend (.NET 8).
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0B5ED7] hover:bg-[#0a4fb4] text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <Plus size={14} />
            <span>Thêm chủ đề mới</span>
          </button>

          <button
            type="button"
            onClick={fetchTopics}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#162032] hover:bg-slate-100 dark:hover:bg-[#1D2B45] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[rgba(148,163,184,0.18)] text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin text-[#0B5ED7]" : ""} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError("")} className="text-rose-400 hover:text-rose-600">
            <X size={14} />
          </button>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 text-blue-800 dark:text-blue-300 text-xs font-medium flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-[#0B5ED7] shrink-0" />
            <span>{success}</span>
          </div>
          <button type="button" onClick={() => setSuccess("")} className="text-blue-500 hover:text-blue-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-[#0F1726] p-4 rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tiêu đề... (Enter)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7] text-slate-800 dark:text-slate-200"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-1.5">
            <Filter size={13} className="text-slate-400" />
            <span className="text-[11px] font-bold text-slate-500 uppercase">Lọc:</span>
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPageNumber(1);
            }}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7] font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value="ALL">Tất cả danh mục</option>
            {categoriesList.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>

          <select
            value={selectedDifficulty}
            onChange={(e) => {
              setSelectedDifficulty(e.target.value);
              setPageNumber(1);
            }}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7] font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value="ALL">Mọi độ khó</option>
            <option value="Easy">Dễ</option>
            <option value="Medium">Trung bình</option>
            <option value="Hard">Khó</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPageNumber(1);
            }}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7] font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Kích hoạt</option>
            <option value="INACTIVE">Vô hiệu hóa</option>
          </select>
        </div>
      </div>

      {/* Topics Table */}
      <div className="bg-white dark:bg-[#0F1726] rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            <RefreshCw size={24} className="animate-spin text-[#0B5ED7] mx-auto mb-2" />
            <span>Đang tải danh sách chủ đề từ máy chủ Backend...</span>
          </div>
        ) : topics.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            Không tìm thấy chủ đề nào phù hợp.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#090E19] text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Mã ID</th>
                  <th className="px-5 py-3.5">Tiêu đề kiến nghị</th>
                  <th className="px-5 py-3.5">Danh mục</th>
                  <th className="px-5 py-3.5">Độ khó</th>
                  <th className="px-5 py-3.5">Trạng thái</th>
                  <th className="px-5 py-3.5">Người tạo</th>
                  <th className="px-5 py-3.5 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[rgba(148,163,184,0.12)]">
                {topics.map((topic) => {
                  const topicId = topic.topicId ?? topic.id;
                  const isActive = topic.isActive !== false;
                  const difficultyLabel =
                    topic.difficulty === "Easy"
                      ? "Dễ"
                      : topic.difficulty === "Hard"
                      ? "Khó"
                      : "Trung bình";

                  return (
                    <tr
                      key={String(topicId)}
                      className="hover:bg-slate-50/60 dark:hover:bg-[#162032]/40 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-mono text-slate-400">#{topicId}</td>
                      <td className="px-5 py-3.5 max-w-sm">
                        <p className="font-bold text-slate-800 dark:text-slate-200 line-clamp-1">
                          {topic.title}
                        </p>
                        {topic.description && (
                          <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                            {topic.description}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                          {topicCategoryLabel(topic.category)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-md font-bold text-[11px] ${
                            topic.difficulty === "Easy"
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                              : topic.difficulty === "Hard"
                              ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                              : "bg-blue-50 text-[#0B5ED7] dark:bg-blue-950/60 dark:text-blue-300"
                          }`}
                        >
                          {difficultyLabel}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                            <CheckCircle2 size={12} /> Hoạt động
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                            Vô hiệu
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {topic.createdByUserName || topic.organizerName || topic.educatorName || "Hệ thống"}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Xem chi tiết trang debater */}
                          <Link
                            to={`/debater/topics/${topicId}`}
                            className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 transition-colors"
                            title="Xem trang chi tiết"
                          >
                            <ExternalLink size={13} />
                          </Link>

                          {/* Sửa chủ đề */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(topic)}
                            className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-[#0B5ED7] dark:text-blue-300 transition-colors cursor-pointer"
                            title="Chỉnh sửa chủ đề"
                          >
                            <Edit3 size={13} />
                          </button>

                          {/* Xóa chủ đề */}
                          <button
                            type="button"
                            onClick={() => setDeletingTopic(topic)}
                            className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                            title="Xóa chủ đề"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-4 bg-slate-50 dark:bg-[#090E19] border-t border-slate-100 dark:border-[rgba(148,163,184,0.12)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            Hiển thị trang <span className="font-bold text-slate-800 dark:text-slate-200">{pageNumber}</span> /{" "}
            <span className="font-bold text-slate-800 dark:text-slate-200">{totalPages}</span> (Tổng cộng{" "}
            <span className="font-bold text-[#0B5ED7]">{totalCount}</span> chủ đề)
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
              disabled={pageNumber <= 1 || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-[#0F1726] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 font-bold transition-all disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft size={14} />
              <span>Trang trước</span>
            </button>

            <button
              type="button"
              onClick={() => setPageNumber((p) => Math.min(totalPages, p + 1))}
              disabled={pageNumber >= totalPages || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-[#0F1726] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 font-bold transition-all disabled:opacity-40 cursor-pointer"
            >
              <span>Trang sau</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Thêm chủ đề mới (POST /api/topics) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#0F1726] w-full max-w-lg rounded-3xl border border-slate-200 dark:border-[rgba(148,163,184,0.18)] shadow-2xl p-6 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[rgba(148,163,184,0.12)]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#0B5ED7] flex items-center justify-center">
                  <BookOpen size={16} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Thêm chủ đề tranh biện mới
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tiêu đề kiến nghị / Chủ đề <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Chúng tôi tin rằng Trí tuệ Nhân tạo nên được quản lý chặt chẽ..."
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mô tả / Ngữ cảnh tranh biện
                </label>
                <textarea
                  rows={3}
                  placeholder="Cung cấp bối cảnh, thông tin nền hoặc gợi ý trọng tâm cho phiên tranh biện..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7]"
                />
              </div>

              <TopicGuideFields
                idPrefix="topic-create"
                proValue={guides.pro}
                conValue={guides.con}
                onProChange={(v) => setGuides((g) => ({ ...g, pro: v }))}
                onConChange={(v) => setGuides((g) => ({ ...g, con: v }))}
                hint="Để trống để dùng nội dung mặc định của hệ thống."
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Danh mục
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                    data-testid="topic-category-select"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7]"
                  >
                    <option value="" disabled>
                      Chọn danh mục
                    </option>
                    {categoriesList.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Độ khó
                  </label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7]"
                  >
                    <option value="Easy">Dễ</option>
                    <option value="Medium">Trung bình</option>
                    <option value="Hard">Khó</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-[rgba(148,163,184,0.12)]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-[#0B5ED7] hover:bg-[#0a4fb4] text-white font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {actionLoading && <RefreshCw size={13} className="animate-spin" />}
                  <span>Tạo chủ đề</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Chỉnh sửa chủ đề (PATCH /api/topics/{id}) */}
      {editingTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#0F1726] w-full max-w-lg rounded-3xl border border-slate-200 dark:border-[rgba(148,163,184,0.18)] shadow-2xl p-6 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[rgba(148,163,184,0.12)]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#0B5ED7] flex items-center justify-center">
                  <Edit3 size={16} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Chỉnh sửa chủ đề #{editingTopic.topicId ?? editingTopic.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingTopic(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tiêu đề kiến nghị / Chủ đề <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mô tả / Ngữ cảnh tranh biện
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7]"
                />
              </div>

              <TopicGuideFields
                idPrefix="topic-edit"
                proValue={guides.pro}
                conValue={guides.con}
                onProChange={(v) => setGuides((g) => ({ ...g, pro: v }))}
                onConChange={(v) => setGuides((g) => ({ ...g, con: v }))}
                proPlaceholder={defaultGuidePlaceholders(editingTopic).pro}
                conPlaceholder={defaultGuidePlaceholders(editingTopic).con}
                hint={
                  editingTopic?.hasCustomGuides === false
                    ? "Chủ đề đang dùng nội dung mặc định (chữ mờ). Nhập nội dung để tạo nhiệm vụ riêng; để trống thì giữ nguyên."
                    : "Xoá hết nội dung rồi lưu để quay về nội dung mặc định."
                }
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Danh mục
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                    data-testid="topic-category-select"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7]"
                  >
                    <option value="" disabled>
                      Chọn danh mục
                    </option>
                    {categoriesList.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Độ khó
                  </label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-[#090E19] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7]"
                  >
                    <option value="Easy">Dễ</option>
                    <option value="Medium">Trung bình</option>
                    <option value="Hard">Khó</option>
                  </select>
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 accent-[#0B5ED7] rounded cursor-pointer"
                  />
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Kích hoạt chủ đề (Khả dụng cho các phiên tranh biện)
                  </span>
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-[rgba(148,163,184,0.12)]">
                <button
                  type="button"
                  onClick={() => setEditingTopic(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-[#0B5ED7] hover:bg-[#0a4fb4] text-white font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {actionLoading && <RefreshCw size={13} className="animate-spin" />}
                  <span>Lưu thay đổi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Xác nhận xóa (DELETE /api/topics/{id}) */}
      {deletingTopic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-[#0F1726] w-full max-w-md rounded-3xl border border-slate-200 dark:border-[rgba(148,163,184,0.18)] shadow-2xl p-6 space-y-4 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Xác nhận xóa chủ đề
                </h3>
                <p className="text-xs text-slate-500 line-clamp-1">
                  #{deletingTopic.topicId ?? deletingTopic.id}: {deletingTopic.title}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Bạn có chắc chắn muốn xóa chủ đề này không? Thao tác này sẽ vô hiệu hóa chủ đề khỏi cơ sở dữ liệu hệ thống.
            </p>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingTopic(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {actionLoading && <RefreshCw size={13} className="animate-spin" />}
                <span>Xác nhận xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTopicManagement;

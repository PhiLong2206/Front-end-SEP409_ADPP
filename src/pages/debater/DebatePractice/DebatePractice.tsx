import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Loader2,
  BookOpen,
  PenTool,
  Search,
  AlertCircle,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { debateApi, topicApi } from "../../../api";
import { Topic } from "../../../types";
import { readActiveDebateSession } from "../../../hooks/useDebateNavigationGuard";

type PracticeMode = "available" | "custom";
type DebateRole = "PRO" | "CON";
type AIDifficultyLevel = "Dễ" | "Trung bình" | "Khó";

const QUICK_PROMPTS = [
  "Trí tuệ nhân tạo (AI) nên được kiểm soát chặt chẽ bởi luật pháp quốc tế.",
  "Nên cấm sử dụng điện thoại thông minh trong các trường phổ thông.",
  "Năng lượng hạt nhân là giải pháp tất yếu để chống biến đổi khí hậu toàn cầu.",
  "Làm việc từ xa (Remote work) mang lại hiệu quả cao hơn làm việc truyền thống.",
];

const DebatePractice: React.FC = () => {
  const navigate = useNavigate();

  // Mode selection
  const [mode, setMode] = useState<PracticeMode>("custom");

  // Mode 1: Available Topics State
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [topicApiAvailable, setTopicApiAvailable] = useState<boolean | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tất cả");
  const hasFetchedTopicsRef = useRef(false);

  // Mode 2: Custom Topic Input State
  const [customMotion, setCustomMotion] = useState("");
  const [validationError, setValidationError] = useState("");

  // Common Settings
  const [role, setRole] = useState<DebateRole>("PRO");
  const [difficulty, setDifficulty] = useState<AIDifficultyLevel>("Trung bình");
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const activeDebateSession = useMemo(() => readActiveDebateSession(), []);

  // Fetch topics when mode changes to "available"
  useEffect(() => {
    if (mode === "available" && !hasFetchedTopicsRef.current) {
      hasFetchedTopicsRef.current = true;
      loadAvailableTopics();
    }
  }, [mode]);

  const loadAvailableTopics = async () => {
    setLoadingTopics(true);
    setApiError(null);
    try {
      const res = await topicApi.getAll();
      const raw = res?.data as unknown;
      const rawItems: any[] = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as { items?: any[] })?.items)
        ? (raw as { items: any[] }).items
        : [];

      const list: Topic[] = rawItems.map((t: any) => ({
        id: String(t.topicId ?? t.id ?? ""),
        title: t.title || "Chủ đề tranh biện",
        motion: t.motion || t.description || t.title || "",
        description: t.description || t.title || "",
        category: t.category || "Chung",
        difficulty: (t.difficulty === "Easy" ? "Dễ" : t.difficulty === "Hard" ? "Khó" : "Trung bình") as any,
        isActive: t.isActive ?? true,
        createdAt: t.createdAt || new Date().toISOString(),
      }));
      setTopics(list);
      setTopicApiAvailable(true);
    } catch {
      setTopics([]);
      setTopicApiAvailable(false);
    } finally {
      setLoadingTopics(false);
    }
  };

  // Categories extracted from loaded topics
  const categories = useMemo(() => {
    const set = new Set<string>(["Tất cả"]);
    topics.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set);
  }, [topics]);

  // Filtered topics based on search & category
  const filteredTopics = useMemo(() => {
    return topics.filter((t) => {
      const matchSearch =
        (t.title && t.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.motion && t.motion.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchCat =
        selectedCategory === "Tất cả" || t.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [topics, searchTerm, selectedCategory]);

  // Validation function
  const validateForm = (): boolean => {
    setValidationError("");
    setApiError(null);

    if (mode === "available") {
      if (!selectedTopic) {
        setValidationError("Vui lòng chọn một chủ đề từ danh sách bên dưới.");
        return false;
      }
    } else {
      const trimmed = customMotion.trim();
      if (!trimmed) {
        setValidationError("Vui lòng nhập chủ đề / kiến nghị tranh biện.");
        return false;
      }
      if (trimmed.length < 10) {
        setValidationError("Chủ đề tranh biện phải có tối thiểu 10 ký tự.");
        return false;
      }
      if (trimmed.length > 300) {
        setValidationError("Chủ đề tranh biện không được vượt quá 300 ký tự.");
        return false;
      }
    }

    return true;
  };

  const handleStartDebate = async () => {
    if (!validateForm() || submitting) return;

    setSubmitting(true);
    setApiError(null);

    const finalMotion =
      mode === "available" && selectedTopic
        ? selectedTopic.motion || selectedTopic.title
        : customMotion.trim();

    const finalTitle =
      mode === "available" && selectedTopic
        ? selectedTopic.title
        : finalMotion.slice(0, 100);

    const backendDifficulty =
      difficulty === "Khó" ? "Hard" : difficulty === "Dễ" ? "Easy" : "Medium";

    try {
      const res = await debateApi.createAiPracticeSession({
        title: finalTitle,
        topic: finalMotion,
        userSide: role === "PRO" ? 1 : 2,
        isAI: true,
        difficulty: backendDifficulty,
        turnTimeLimitSeconds: 180,
      });

      const sId = res?.data?.sessionId;
      if (sId) {
        navigate(
          `/debater/debate/${sId}?role=${role}&difficulty=${difficulty}&motion=${encodeURIComponent(
            finalMotion
          )}`
        );
      } else {
        throw new Error("Không nhận được mã phiên tranh biện từ máy chủ.");
      }
    } catch (err: unknown) {
      const e = err as { message?: string; response?: { data?: { message?: string } } };
      const msg =
        e.response?.data?.message ||
        e.message ||
        "Lỗi khởi tạo phiên tranh biện với máy chủ.";
      setApiError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-7 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] dark:text-[#F8FAFC] tracking-tight flex items-center gap-2.5">
          <span>Tranh biện với AI</span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-[#ECFDF5] dark:bg-[rgba(16,185,129,0.15)] text-[#008A64] dark:text-[#34D399] font-bold border border-[#008A64]/30">
            Luyện tập 1v1
          </span>
        </h1>
        <p className="text-sm text-slate-500 dark:text-[#94A3B8] mt-1.5">
          Chọn chủ đề có sẵn hoặc tự nhập kiến nghị để rèn luyện kỹ năng lập luận và phản biện cùng trí tuệ nhân tạo.
        </p>
      </div>

      {/* Active Debate Recovery Banner */}
      {activeDebateSession && (
        <div
          data-testid="active-debate-recovery-banner"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 rounded-2xl bg-[#ECFDF5] dark:bg-emerald-950/30 border border-[#008A64]/30 text-slate-800 dark:text-slate-100 shadow-xs"
        >
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs font-bold text-[#008A64] dark:text-emerald-400">
              Bạn đang có một phiên tranh biện chưa kết thúc
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
              &ldquo;{activeDebateSession.topicTitle}&rdquo;
            </p>
          </div>
          <button
            type="button"
            data-testid="resume-active-debate-btn"
            onClick={() => navigate(activeDebateSession.url)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#008A64] hover:bg-[#007457] text-white text-xs font-bold shadow-xs transition-colors shrink-0 cursor-pointer"
          >
            <span>Tiếp tục trận tranh biện</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Main Configuration Card */}
      <div className="bg-white debate-panel-main rounded-3xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] p-6 sm:p-8 shadow-xs space-y-6 sm:space-y-7">
        {/* 1. Mode Switcher (Chế độ chọn chủ đề) */}
        <div className="space-y-2.5">
          <label className="text-[15px] font-bold text-slate-900 dark:text-[#F8FAFC] flex items-center justify-between">
            <span>Phương thức chọn chủ đề</span>
            <span className="text-xs text-slate-400 font-normal">
              {mode === "custom" ? "Chế độ: Tự do nhập đề" : "Chế độ: Thư viện chủ đề"}
            </span>
          </label>

          <div className="grid grid-cols-2 p-1.5 bg-slate-100 dark:bg-[#091713] rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.15)] gap-2">
            <button
              id="tab-mode-custom"
              type="button"
              onClick={() => {
                setMode("custom");
                setValidationError("");
              }}
              className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                mode === "custom"
                  ? "bg-white dark:bg-[#12231C] text-[#008A64] dark:text-[#34D399] shadow-sm ring-1 ring-slate-200/80 dark:ring-emerald-500/30"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <PenTool size={16} />
              <span>Tự nhập chủ đề</span>
            </button>

            <button
              id="tab-mode-available"
              type="button"
              onClick={() => {
                setMode("available");
                setValidationError("");
              }}
              className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                mode === "available"
                  ? "bg-white dark:bg-[#12231C] text-[#008A64] dark:text-[#34D399] shadow-sm ring-1 ring-slate-200/80 dark:ring-emerald-500/30"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <BookOpen size={16} />
              <span>Chọn chủ đề có sẵn</span>
            </button>
          </div>
        </div>

        {/* 2. Topic Input / Selection Area */}
        {mode === "custom" ? (
          /* Mode 2: Custom Motion Input */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[15px] font-bold text-slate-900 dark:text-[#F8FAFC]">
                Nội dung kiến nghị / Chủ đề <span className="text-rose-500">*</span>
              </label>
              <span
                className={`text-xs font-mono font-medium ${
                  customMotion.length > 300
                    ? "text-rose-500 font-bold"
                    : customMotion.length >= 10
                    ? "text-[#008A64] dark:text-emerald-400"
                    : "text-slate-400"
                }`}
              >
                {customMotion.length} / 300 ký tự
              </span>
            </div>

            <div className="relative">
              <textarea
                id="textarea-custom-motion"
                rows={3}
                value={customMotion}
                onChange={(e) => {
                  setCustomMotion(e.target.value);
                  if (validationError) setValidationError("");
                }}
                maxLength={350}
                placeholder="Ví dụ: Chúng tôi tin rằng trí tuệ nhân tạo nên được quản lý chặt chẽ bởi luật pháp quốc tế..."
                className={`w-full p-4 bg-slate-50 dark:bg-[#091713] border rounded-2xl text-sm font-medium text-slate-900 dark:text-[#F8FAFC] focus:outline-none transition-colors resize-none shadow-xs ${
                  validationError
                    ? "border-rose-300 dark:border-rose-500/50 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                    : "border-slate-200 dark:border-[rgba(148,163,184,0.20)] focus:border-[#008A64] focus:ring-2 focus:ring-[#008A64]/20"
                }`}
              />
            </div>

            {/* Quick Example Prompts */}
            <div className="space-y-2 pt-1">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-500" />
                <span>Gợi ý chủ đề nhanh (nhấn để chọn):</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setCustomMotion(prompt);
                      setValidationError("");
                    }}
                    className="text-xs px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-[#10231C] dark:hover:bg-[#153026] text-slate-700 dark:text-slate-300 transition-colors text-left border border-slate-200/60 dark:border-slate-700/40"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Mode 1: Available Topics from Backend */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[15px] font-bold text-slate-900 dark:text-[#F8FAFC]">
                Kho chủ đề mẫu từ máy chủ <span className="text-rose-500">*</span>
              </label>
              {topicApiAvailable && (
                <button
                  type="button"
                  onClick={loadAvailableTopics}
                  disabled={loadingTopics}
                  className="text-xs text-[#008A64] dark:text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <RefreshCw size={12} className={loadingTopics ? "animate-spin" : ""} />
                  <span>Tải lại</span>
                </button>
              )}
            </div>

            {loadingTopics ? (
              <div className="p-10 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-[#091713] text-center space-y-3">
                <Loader2 size={28} className="animate-spin mx-auto text-[#008A64]" />
                <p className="text-sm font-medium text-slate-500">Đang tải danh sách chủ đề từ máy chủ...</p>
              </div>
            ) : topicApiAvailable === false ? (
              /* Backend Topics API NOT IMPLEMENTED banner */
              <div className="p-6 border border-amber-200/80 dark:border-amber-800/40 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700/50 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0 mt-0.5">
                    <AlertCircle size={20} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-amber-900 dark:text-amber-300">
                      Kho chủ đề đang được phát triển
                    </h3>
                    <p className="text-xs text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
                      Máy chủ hiện chưa cung cấp endpoint danh mục chủ đề mẫu (Topics API). Bạn có thể sử dụng chế độ <strong className="font-semibold underline">Tự nhập chủ đề</strong> để bắt đầu phiên tranh biện ngay lập tức với bất kỳ kiến nghị nào.
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    id="btn-switch-to-custom"
                    type="button"
                    onClick={() => {
                      setMode("custom");
                      setValidationError("");
                    }}
                    className="px-4 py-2 bg-[#008A64] hover:bg-[#007457] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <PenTool size={13} />
                    <span>Chuyển sang Tự nhập chủ đề</span>
                  </button>
                </div>
              </div>
            ) : topics.length === 0 ? (
              /* Empty state if API is connected but returned 0 items */
              <div className="p-8 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-[#091713] text-center space-y-2">
                <BookOpen size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Chưa có chủ đề nào trong kho</p>
                <p className="text-xs text-slate-400">Vui lòng chọn chế độ tự nhập để luyện tập.</p>
                <button
                  type="button"
                  onClick={() => setMode("custom")}
                  className="mt-2 text-xs font-bold text-[#008A64] hover:underline inline-block"
                >
                  Tự nhập chủ đề ngay
                </button>
              </div>
            ) : (
              /* Topic Browser with Search and Categories */
              <div className="space-y-3">
                {/* Search Bar & Category Filter */}
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <Search
                      size={15}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      placeholder="Tìm kiếm chủ đề, kiến nghị..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 dark:bg-[#091713] border border-slate-200 dark:border-[rgba(148,163,184,0.20)] rounded-xl focus:border-[#008A64] focus:outline-none"
                    />
                  </div>

                  {categories.length > 1 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                            selectedCategory === cat
                              ? "bg-[#008A64] text-white"
                              : "bg-slate-100 dark:bg-[#091713] text-slate-600 dark:text-slate-400 hover:bg-slate-200/80"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Topics Grid */}
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1 sidebar-scroll">
                  {filteredTopics.map((item) => {
                    const isSelected = selectedTopic?.id === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSelectedTopic(item);
                          setValidationError("");
                        }}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                          isSelected
                            ? "bg-[#ECFDF5]/70 dark:bg-[rgba(16,185,129,0.12)] border-[#008A64] ring-1 ring-[#008A64] shadow-xs"
                            : "bg-slate-50/60 dark:bg-[#091713] border-slate-200 dark:border-[rgba(148,163,184,0.15)] hover:border-slate-300 dark:hover:border-slate-700"
                        }`}
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {item.category || "Chung"}
                            </span>
                            {item.difficulty && (
                              <span className="text-xs text-slate-400">
                                {item.difficulty}
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                            {item.title}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                            {item.motion || item.description}
                          </p>
                        </div>

                        <div className="shrink-0 mt-1">
                          <span
                            className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                              isSelected
                                ? "border-[#008A64] bg-[#008A64] text-white"
                                : "border-slate-300 dark:border-slate-600"
                            }`}
                          >
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Validation Error Banner */}
        {validationError && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2 animate-fadeIn">
            <AlertCircle size={15} className="shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* 3. Select Role (PRO / CON) */}
        <div className="space-y-2.5">
          <label className="text-[15px] font-bold text-slate-900 dark:text-[#F8FAFC]">
            Vai trò của bạn trong trận đấu
          </label>
          <div className="grid grid-cols-2 gap-3.5">
            <button
              type="button"
              onClick={() => setRole("PRO")}
              className={`py-3.5 px-4 rounded-2xl border text-sm sm:text-[15px] font-semibold flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-xs ${
                role === "PRO"
                  ? "bg-[#ECFDF5]/70 dark:bg-[rgba(16,185,129,0.12)] border-[#008A64] dark:border-[rgba(16,185,129,0.40)] text-[#008A64] dark:text-[#34D399] ring-1 ring-[#008A64]"
                  : "bg-slate-50 dark:bg-[#091713] border-slate-200 dark:border-[rgba(148,163,184,0.20)] text-slate-700 dark:text-[#CBD5E1] hover:bg-slate-100 dark:hover:bg-[#10231C]"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  role === "PRO"
                    ? "border-[#008A64] bg-[#008A64] text-white"
                    : "border-slate-300 dark:border-slate-600"
                }`}
              >
                {role === "PRO" && <Check size={11} strokeWidth={3} />}
              </span>
              <span>Ủng hộ (PRO)</span>
            </button>

            <button
              type="button"
              onClick={() => setRole("CON")}
              className={`py-3.5 px-4 rounded-2xl border text-sm sm:text-[15px] font-semibold flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-xs ${
                role === "CON"
                  ? "bg-[#ECFDF5]/70 dark:bg-[rgba(16,185,129,0.12)] border-[#008A64] dark:border-[rgba(16,185,129,0.40)] text-[#008A64] dark:text-[#34D399] ring-1 ring-[#008A64]"
                  : "bg-slate-50 dark:bg-[#091713] border-slate-200 dark:border-[rgba(148,163,184,0.20)] text-slate-700 dark:text-[#CBD5E1] hover:bg-slate-100 dark:hover:bg-[#10231C]"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  role === "CON"
                    ? "border-[#008A64] bg-[#008A64] text-white"
                    : "border-slate-300 dark:border-slate-600"
                }`}
              >
                {role === "CON" && <Check size={11} strokeWidth={3} />}
              </span>
              <span>Phản đối (CON)</span>
            </button>
          </div>
        </div>

        {/* 4. AI Difficulty */}
        <div className="space-y-2.5">
          <label className="text-[15px] font-bold text-slate-900 dark:text-[#F8FAFC]">
            Cấp độ đối thủ AI
          </label>
          <div className="grid grid-cols-3 gap-3.5">
            {(["Dễ", "Trung bình", "Khó"] as const).map((level) => {
              const isActive = difficulty === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setDifficulty(level)}
                  className={`py-3 px-3 rounded-2xl border text-sm sm:text-[15px] font-semibold flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-xs ${
                    isActive
                      ? "bg-[#ECFDF5]/70 dark:bg-[rgba(16,185,129,0.12)] border-[#008A64] dark:border-[rgba(16,185,129,0.40)] text-[#008A64] dark:text-[#34D399] ring-1 ring-[#008A64]"
                      : "bg-slate-50 dark:bg-[#091713] border-slate-200 dark:border-[rgba(148,163,184,0.20)] text-slate-700 dark:text-[#CBD5E1] hover:bg-slate-100 dark:hover:bg-[#10231C]"
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                      isActive
                        ? "border-[#008A64] bg-[#008A64]"
                        : "border-slate-300 dark:border-slate-600"
                    }`}
                  >
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                  <span>{level}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* API Error Alert */}
        {apiError && (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-rose-800 dark:text-rose-300 text-sm flex items-start gap-3">
            <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-500" />
            <div>
              <p className="font-bold">Không thể tạo phiên tranh biện:</p>
              <p className="text-xs mt-0.5">{apiError}</p>
            </div>
          </div>
        )}

        {/* 5. Start Debate CTA Button */}
        <div className="pt-2">
          <button
            id="btn-start-debate"
            type="button"
            disabled={submitting}
            onClick={handleStartDebate}
            className="w-full py-3.5 px-6 rounded-2xl text-[15px] sm:text-base font-semibold text-white bg-[#008A64] hover:bg-[#007457] active:bg-[#005e45] shadow-md shadow-[#008A64]/25 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Đang khởi tạo phiên tranh biện...</span>
              </>
            ) : (
              <>
                <span>Bắt đầu tranh biện</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DebatePractice;

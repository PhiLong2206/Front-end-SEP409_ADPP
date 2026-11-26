import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Search,
  ChevronDown,
  Check,
  AlertCircle,
  RefreshCw,
  BookOpen,
  X,
  Loader2,
} from "lucide-react";
import topicApi from "../../api/topicApi";
import { Topic } from "../../types";
import DifficultyBadge from "./DifficultyBadge";
import { topicCategoryLabel } from "../../constants/topicCategories";
import TopicGuides from "./TopicGuides";

export interface SelectedTopicOption {
  topicId: number;
  title: string;
  topicText: string;
  description?: string;
  category?: string;
  difficulty?: string;
  proGuide?: string;
  conGuide?: string;
}

export interface TopicSelectComboboxProps {
  selectedTopicId: number | null;
  onSelect: (topic: SelectedTopicOption | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

const normalizeTopic = (raw: Topic): SelectedTopicOption | null => {
  const numericId = Number(raw.topicId ?? raw.id);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;
  if (raw.isActive === false) return null;

  const title = (raw.title || "").trim();
  if (!title) return null;

  const description = (raw.description || raw.motion || "").trim();
  const topicText = description || title;

  return {
    topicId: numericId,
    title,
    topicText,
    description: description && description !== title ? description : undefined,
    category: raw.category?.trim() || undefined,
    difficulty: raw.difficulty?.trim() || undefined,
    proGuide: raw.proGuide?.trim() || undefined,
    conGuide: raw.conGuide?.trim() || undefined,
  };
};

const TopicSelectCombobox: React.FC<TopicSelectComboboxProps> = ({
  selectedTopicId,
  onSelect,
  label = "Chủ đề tranh biện",
  placeholder = "Chọn chủ đề từ ngân hàng đề...",
  disabled = false,
  required = true,
}) => {
  const [topics, setTopics] = useState<SelectedTopicOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const fetchActiveTopics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await topicApi.getAll({
        pageNumber: 1,
        pageSize: 100,
        isActive: true,
      });

      if (!res || res.success === false) {
        throw new Error(res?.message || "Không thể tải danh sách chủ đề tranh biện.");
      }

      const rawData = res.data as unknown;
      const rawItems: Topic[] = Array.isArray(rawData)
        ? (rawData as Topic[])
        : Array.isArray((rawData as { items?: Topic[] })?.items)
        ? (rawData as { items: Topic[] }).items
        : [];

      const activeTopics = rawItems
        .map(normalizeTopic)
        .filter((item): item is SelectedTopicOption => item !== null);

      setTopics(activeTopics);
    } catch (err: unknown) {
      const e = err as { message?: string; response?: { data?: { message?: string } } };
      setError(
        e.response?.data?.message ||
          e.message ||
          "Không thể kết nối tới máy chủ để tải danh sách chủ đề."
      );
      setTopics([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveTopics();
  }, [fetchActiveTopics]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when opening dropdown
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 20);
    } else {
      setSearchTerm("");
    }
  }, [isOpen]);

  const selectedTopic = useMemo(
    () => topics.find((t) => t.topicId === selectedTopicId) ?? null,
    [topics, selectedTopicId]
  );

  const filteredTopics = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return topics;
    return topics.filter(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query)) ||
        (t.category && topicCategoryLabel(t.category).toLowerCase().includes(query))
    );
  }, [topics, searchTerm]);

  const handleSelectTopic = (topic: SelectedTopicOption) => {
    onSelect(topic);
    setIsOpen(false);
  };

  const handleClearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null);
  };

  return (
    <div ref={containerRef} className="space-y-1.5 relative">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
          {!loading && !error && topics.length > 0 && (
            <span className="text-[11px] text-slate-400">
              {topics.length} chủ đề khả dụng
            </span>
          )}
        </div>
      )}

      {/* 1. LOADING STATE */}
      {loading ? (
        <div
          data-testid="topic-combobox-loading"
          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-500"
        >
          <Loader2 size={15} className="animate-spin text-[#0B5ED7] shrink-0" />
          <span>Đang tải danh sách chủ đề từ máy chủ...</span>
        </div>
      ) : error ? (
        /* 2. ERROR & RETRY STATE */
        <div
          data-testid="topic-combobox-error"
          className="w-full p-3 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 flex items-center justify-between gap-2.5 text-xs text-rose-700 dark:text-rose-300"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle size={15} className="text-rose-600 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
          <button
            type="button"
            data-testid="topic-combobox-retry"
            onClick={fetchActiveTopics}
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-700 text-rose-700 dark:text-rose-300 hover:bg-rose-50 font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
          >
            <RefreshCw size={12} />
            <span>Thử lại</span>
          </button>
        </div>
      ) : topics.length === 0 ? (
        /* 3. EMPTY STATE */
        <div
          data-testid="topic-combobox-empty"
          className="w-full p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-between gap-2.5 text-xs text-amber-800 dark:text-amber-300"
        >
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen size={15} className="text-amber-600 shrink-0" />
            <span>Hiện chưa có chủ đề tranh biện nào đang hoạt động trên hệ thống.</span>
          </div>
          <button
            type="button"
            data-testid="topic-combobox-reload"
            onClick={fetchActiveTopics}
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-50 font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
          >
            <RefreshCw size={12} />
            <span>Tải lại</span>
          </button>
        </div>
      ) : (
        /* 4. SEARCHABLE COMBOBOX TRIGGER + DROPDOWN */
        <div className="relative">
          <div
            role="combobox"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            data-testid="topic-combobox-trigger"
            tabIndex={disabled ? -1 : 0}
            onClick={() => {
              if (!disabled) setIsOpen((prev) => !prev);
            }}
            onKeyDown={(e) => {
              if (disabled) return;
              if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
                e.preventDefault();
                setIsOpen(true);
              }
            }}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 ${
              disabled
                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                : isOpen
                ? "bg-white dark:bg-[#060d1a] border-[#0B5ED7] ring-2 ring-[#0B5ED7]/20 cursor-pointer"
                : "bg-white dark:bg-[#060d1a] border-slate-200 dark:border-slate-800 hover:border-slate-300 cursor-pointer"
            }`}
          >
            {selectedTopic ? (
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-[#F8FAFC] truncate">
                    {selectedTopic.title}
                  </span>
                  {selectedTopic.category && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-[#0B5ED7] dark:text-[#60A5FA] border border-blue-200/70 dark:border-blue-800/60">
                      {topicCategoryLabel(selectedTopic.category)}
                    </span>
                  )}
                  {selectedTopic.difficulty && (
                    <DifficultyBadge difficulty={selectedTopic.difficulty} />
                  )}
                </div>
                {selectedTopic.description && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {selectedTopic.description}
                  </p>
                )}
              </div>
            ) : (
              <span className="text-xs sm:text-sm text-slate-400 truncate">{placeholder}</span>
            )}

            <div className="flex items-center gap-1 shrink-0">
              {selectedTopic && !disabled && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  aria-label="Bỏ chọn chủ đề"
                  title="Bỏ chọn chủ đề"
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
              <ChevronDown
                size={16}
                className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </div>
          </div>

          {/* Dropdown Menu */}
          {isOpen && !disabled && (
            <div
              role="listbox"
              data-testid="topic-combobox-listbox"
              className="z-30 mt-1.5 bg-white dark:bg-[#0D1524] border border-slate-200 dark:border-slate-700 rounded-xl shadow-md overflow-hidden animate-fade-in"
            >
              {/* Search Box */}
              <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-[#060d1a]">
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    data-testid="topic-combobox-search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm theo tên chủ đề, kiến nghị, danh mục..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-[#0F1726] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 focus:outline-none focus:border-[#0B5ED7]"
                  />
                </div>
              </div>

              {/* Filtered Options */}
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70">
                {filteredTopics.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    Không tìm thấy chủ đề phù hợp với từ khóa &ldquo;{searchTerm}&rdquo;.
                  </div>
                ) : (
                  filteredTopics.map((topic) => {
                    const isSelected = topic.topicId === selectedTopicId;
                    return (
                      <button
                        key={topic.topicId}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        data-testid={`topic-option-${topic.topicId}`}
                        onClick={() => handleSelectTopic(topic)}
                        className={`w-full px-3.5 py-2.5 text-left transition-colors flex items-start justify-between gap-2.5 cursor-pointer ${
                          isSelected
                            ? "bg-[#EAF2FF]/80 dark:bg-blue-950/50"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-xs sm:text-sm font-semibold leading-snug ${
                                isSelected
                                  ? "text-[#0B5ED7] dark:text-[#60A5FA]"
                                  : "text-slate-800 dark:text-slate-100"
                              }`}
                            >
                              {topic.title}
                            </span>
                          </div>

                          {topic.description && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                              {topic.description}
                            </p>
                          )}

                          {(topic.category || topic.difficulty) && (
                            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                              {topic.category && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                  {topicCategoryLabel(topic.category)}
                                </span>
                              )}
                              {topic.difficulty && (
                                <DifficultyBadge difficulty={topic.difficulty} />
                              )}
                            </div>
                          )}
                        </div>

                        {isSelected && (
                          <Check size={15} className="text-[#0B5ED7] dark:text-[#60A5FA] shrink-0 mt-0.5" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* What each side has to do in the chosen topic */}
      {selectedTopic && (selectedTopic.proGuide || selectedTopic.conGuide) && (
        <TopicGuides proGuide={selectedTopic.proGuide} conGuide={selectedTopic.conGuide} className="pt-1" />
      )}
    </div>
  );
};

export default TopicSelectCombobox;

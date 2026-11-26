import React, { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, ChevronRight, BookOpen, GraduationCap, Cpu, Users, X, type LucideIcon } from "lucide-react";
import Pagination from "../../../components/common/Pagination";
import { Topic } from "../../../types";
import { difficultyOf } from "../../../utils/topicDifficulty";
import { useDebounce } from "../../../hooks/useDebounce";
import topicApi from "../../../api/topicApi";
import { TOPIC_CATEGORIES, normalizeTopicCategory, topicCategoryLabel } from "../../../constants/topicCategories";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  education: GraduationCap,
  technology: Cpu,
  society: Users,
};

const Topics: React.FC = () => {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tất cả");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 9;

  const debouncedSearch = useDebounce(searchTerm, 300);

  const categories = ["Tất cả", ...TOPIC_CATEGORIES.map((c) => c.label)];

  const fetchTopics = async () => {
    setLoading(true);
    try {
      const res = await topicApi.getAll({
        pageNumber: 1,
        pageSize: 100,
        isActive: true,
      });

      if (res && res.success && res.data) {
        setTopics(res.data.items || []);
      }
    } catch {
      setTopics([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopics();
  }, []);

  const filteredTopics = useMemo(() => {
    return topics.filter((topic) => {
      const title = topic.title || "";
      const motion = topic.motion || topic.description || "";
      const matchSearch =
        title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        motion.toLowerCase().includes(debouncedSearch.toLowerCase());

      const matchCategory =
        selectedCategory === "Tất cả" ||
        normalizeTopicCategory(topic.category) === normalizeTopicCategory(selectedCategory);

      return matchSearch && matchCategory;
    });
  }, [topics, debouncedSearch, selectedCategory]);

  // How many topics each category has (for the chips), ignoring the search
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { "Tất cả": topics.length };
    for (const c of TOPIC_CATEGORIES) {
      counts[c.label] = topics.filter((t) => normalizeTopicCategory(t.category) === c.code).length;
    }
    return counts;
  }, [topics]);

  const hasFilter = searchTerm.trim() !== "" || selectedCategory !== "Tất cả";
  const clearFilters = () => {
    setSearchTerm("");
    setSelectedCategory("Tất cả");
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(filteredTopics.length / pageSize) || 1;
  const paginatedTopics = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTopics.slice(start, start + pageSize);
  }, [filteredTopics, currentPage, pageSize]);

  return (
    <div className="mx-auto max-w-6xl space-y-(--s-6) pb-(--s-8) animate-fade-in motion-reduce:animate-none">
      {/* Header */}
      <div className="flex flex-col gap-(--s-2) pt-(--s-4) sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-(length:--text-hero) font-bold leading-(--leading-tight) tracking-(--tracking-display)">
            Danh mục chủ đề
          </h1>
          <p className="mt-(--s-2) max-w-[560px] text-(length:--text-body) leading-(--leading-body) text-label-secondary">
            Khám phá và lựa chọn các chủ đề phong phú để bắt đầu luyện tập phản biện.
          </p>
        </div>
        {!loading && (
          <p className="text-(length:--text-callout) text-label-secondary" aria-live="polite">
            {filteredTopics.length} chủ đề
          </p>
        )}
      </div>

      {/* Search & category filter */}
      <div className="space-y-(--s-4)">
        <div role="search" className="relative">
          <Search
            size={18}
            className="pointer-events-none absolute left-(--s-4) top-1/2 -translate-y-1/2 text-label-tertiary"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Tìm kiếm chủ đề"
            placeholder="Tìm kiếm chủ đề, kiến nghị..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="h-12 w-full rounded-ap-pill border border-transparent bg-canvas-secondary pl-12 pr-12 text-(length:--text-body) text-label placeholder:text-label-tertiary outline-none transition-[box-shadow,border-color] duration-(--t-fast) ease-ap focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/25 [&::-webkit-search-cancel-button]:hidden"
          />
          {searchTerm && (
            <button
              type="button"
              aria-label="Xoá từ khoá"
              onClick={() => {
                setSearchTerm("");
                setCurrentPage(1);
              }}
              className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-label-tertiary transition-colors hover:text-label focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex gap-(--s-2) overflow-x-auto pb-1 sidebar-scroll" role="group" aria-label="Lọc theo danh mục">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  setSelectedCategory(cat);
                  setCurrentPage(1);
                }}
                className={`inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-(--s-2) rounded-ap-pill px-(--s-4) text-(length:--text-callout) font-medium transition-[background-color,color,transform] duration-(--t-fast) ease-ap active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 ${
                  isActive
                    ? "bg-accent text-accent-contrast"
                    : "bg-canvas-secondary text-label-secondary hover:bg-accent-soft hover:text-label"
                }`}
              >
                <span>{cat}</span>
                {!loading && (
                  <span className={`text-(length:--text-caption) ${isActive ? "opacity-80" : "text-label-tertiary"}`}>
                    {categoryCounts[cat] ?? 0}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading state: cards that are about to appear */}
      {loading ? (
        <div role="status" aria-label="Đang tải danh sách chủ đề tranh biện từ máy chủ..." className="grid grid-cols-1 gap-(--s-5) md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="space-y-(--s-4) rounded-ap-xl bg-elevated p-(--s-6) shadow-ap-sm">
              <div className="flex items-center justify-between">
                <div className="h-6 w-20 animate-pulse rounded-full bg-canvas-secondary motion-reduce:animate-none" />
                <div className="h-6 w-14 animate-pulse rounded-full bg-canvas-secondary motion-reduce:animate-none" />
              </div>
              <div className="space-y-(--s-2)">
                <div className="h-5 w-4/5 animate-pulse rounded bg-canvas-secondary motion-reduce:animate-none" />
                <div className="h-4 w-full animate-pulse rounded bg-canvas-secondary motion-reduce:animate-none" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-canvas-secondary motion-reduce:animate-none" />
              </div>
            </div>
          ))}
          <span className="sr-only">Đang tải danh sách chủ đề tranh biện từ máy chủ...</span>
        </div>
      ) : paginatedTopics.length === 0 ? (
        <div className="space-y-(--s-3) rounded-ap-xl bg-elevated p-(--s-8) text-center shadow-ap-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-ap-lg bg-accent-soft text-accent">
            <BookOpen size={26} aria-hidden="true" />
          </div>
          <p className="text-(length:--text-headline) font-semibold">Chưa có chủ đề tranh biện nào phù hợp.</p>
          <p className="text-(length:--text-callout) text-label-secondary">
            Hãy thử tìm kiếm với từ khóa khác hoặc chuyển sang danh mục "Tất cả".
          </p>
          {hasFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-(--s-2) inline-flex h-11 cursor-pointer items-center rounded-ap-pill bg-accent px-(--s-5) text-(length:--text-callout) font-medium text-accent-contrast transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40"
            >
              Xoá bộ lọc
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-(--s-5) md:grid-cols-2 lg:grid-cols-3">
          {paginatedTopics.map((topic) => {
            const topicId = topic.topicId ?? topic.id;
            const Icon = CATEGORY_ICONS[normalizeTopicCategory(topic.category) ?? ""] ?? BookOpen;
            return (
              <Link
                key={String(topicId)}
                to={`/debater/topics/${topicId}`}
                state={{ topic }}
                className="group flex flex-col justify-between gap-(--s-5) rounded-ap-xl bg-elevated p-(--s-6) shadow-ap-sm transition-[transform,box-shadow] duration-(--t-base) ease-ap hover:-translate-y-0.5 hover:shadow-ap-md motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
              >
                <div className="space-y-(--s-4)">
                  <div className="flex items-center justify-between gap-(--s-3)">
                    <span className="inline-flex items-center gap-(--s-2) text-(length:--text-caption) font-medium text-accent">
                      <Icon size={15} aria-hidden="true" />
                      {topicCategoryLabel(topic.category)}
                    </span>
                    <span className="inline-flex items-center gap-(--s-2) text-(length:--text-caption) text-label-secondary">
                      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${difficultyOf(topic.difficulty).dot}`} />
                      {difficultyOf(topic.difficulty).label}
                    </span>
                  </div>

                  <h3 className="line-clamp-2 text-(length:--text-headline) font-semibold leading-(--leading-snug)">
                    {topic.title}
                  </h3>

                  {topic.description && (
                    <p className="line-clamp-3 text-(length:--text-callout) leading-(--leading-body) text-label-secondary">
                      {topic.description}
                    </p>
                  )}
                </div>

                <span className="inline-flex items-center gap-1 text-(length:--text-callout) font-medium text-accent">
                  <span>Chi tiết</span>
                  <ChevronRight size={16} className="transition-transform duration-(--t-base) group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex justify-center pt-(--s-4)">
          <Pagination appearance="apple" currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      )}
    </div>
  );
};

export default Topics;

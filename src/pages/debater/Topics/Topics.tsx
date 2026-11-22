import React, { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, ArrowUpRight, BookOpen, RefreshCw } from "lucide-react";
import DifficultyBadge from "../../../components/topic/DifficultyBadge";
import Pagination from "../../../components/common/Pagination";
import { Topic } from "../../../types";
import { useDebounce } from "../../../hooks/useDebounce";
import topicApi from "../../../api/topicApi";
import { TOPIC_CATEGORIES, normalizeTopicCategory, topicCategoryLabel } from "../../../constants/topicCategories";

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

  const totalPages = Math.ceil(filteredTopics.length / pageSize) || 1;
  const paginatedTopics = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTopics.slice(start, start + pageSize);
  }, [filteredTopics, currentPage, pageSize]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight">
          Danh mục chủ đề
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Khám phá và lựa chọn các chủ đề phong phú để bắt đầu luyện tập phản biện.
        </p>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Tìm kiếm chủ đề, kiến nghị..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#008A64]/20 focus:border-[#008A64] shadow-xs transition-colors"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full sidebar-scroll">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat);
                  setCurrentPage(1);
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shadow-xs ${
                  isActive
                    ? "bg-[#008A64] text-white shadow-[#008A64]/20"
                    : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="bg-white p-16 rounded-3xl border border-slate-200 text-center text-slate-400 shadow-xs space-y-3">
          <RefreshCw size={28} className="animate-spin text-[#008A64] mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-600">Đang tải danh sách chủ đề tranh biện từ máy chủ...</p>
        </div>
      ) : paginatedTopics.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-500 shadow-xs space-y-3">
          <BookOpen size={36} className="mx-auto text-slate-300" />
          <p className="text-sm font-semibold">Chưa có chủ đề tranh biện nào phù hợp.</p>
          <p className="text-xs text-slate-400">
            Hãy thử tìm kiếm với từ khóa khác hoặc chuyển sang danh mục "Tất cả".
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {paginatedTopics.map((topic) => {
            const topicId = topic.topicId ?? topic.id;
            return (
              <Link
                key={String(topicId)}
                to={`/debater/topics/${topicId}`}
                state={{ topic }}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-lg hover:border-[#008A64]/40 transition-all duration-300 flex flex-col justify-between overflow-hidden group p-5 space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 border border-emerald-200/80 text-[#008A64]">
                      {topicCategoryLabel(topic.category)}
                    </span>
                    <DifficultyBadge difficulty={topic.difficulty} />
                  </div>

                  <h3 className="font-bold text-[#0F172A] text-sm sm:text-base line-clamp-2 leading-snug group-hover:text-[#008A64] transition-colors">
                    {topic.title}
                  </h3>

                  {topic.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {topic.description}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <span className="font-mono">#{topicId}</span>
                  <div className="flex items-center gap-1 font-bold text-[#008A64] group-hover:translate-x-1 transition-transform">
                    <span>Chi tiết</span>
                    <ArrowUpRight size={14} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex justify-end pt-2">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
};

export default Topics;

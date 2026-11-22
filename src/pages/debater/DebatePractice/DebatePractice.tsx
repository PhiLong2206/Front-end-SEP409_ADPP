import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, BookOpen, ChevronDown, ChevronUp, History, Loader2, RefreshCw, RotateCcw, Sparkles } from "lucide-react";
import { debateApi, topicApi } from "../../../api";
import { Topic } from "../../../types";
import { readActiveDebateSession } from "../../../hooks/useDebateNavigationGuard";
import DifficultyBadge from "../../../components/topic/DifficultyBadge";
import PracticeStartPanel, { AIDifficultyLevel } from "../../../components/debate/practice/PracticeStartPanel";
import { TOPIC_CATEGORIES, normalizeTopicCategory, topicCategoryLabel } from "../../../constants/topicCategories";
import {
  findListedTopic,
  groupPracticedTopics,
  PracticedTopic,
  PracticeSide,
  suggestTopics,
  topicIdOf,
} from "../../../utils/debateTopicHistory";

const HISTORY_PREVIEW = 5;
const SUGGESTION_PREVIEW = 6;
const TOPIC_PAGE_SIZE = 100;
const MAX_TOPIC_PAGES = 10;

const BACKEND_DIFFICULTY: Record<AIDifficultyLevel, "Easy" | "Medium" | "Hard"> = {
  "Dễ": "Easy",
  "Trung bình": "Medium",
  "Khó": "Hard",
};

const formatDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("vi-VN");
};

const cardClass =
  "bg-white debate-panel-main rounded-2xl border border-slate-200/80 dark:border-[rgba(148,163,184,0.18)] p-5 shadow-xs space-y-4";

const ShowAllButton: React.FC<{ testId: string; expanded: boolean; total: number; onToggle: () => void }> = ({
  testId,
  expanded,
  total,
  onToggle,
}) => (
  <button
    type="button"
    data-testid={testId}
    aria-expanded={expanded}
    onClick={onToggle}
    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[rgba(148,163,184,0.25)] text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-[#008A64] hover:text-[#008A64] transition-colors cursor-pointer"
  >
    {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
    <span>{expanded ? "Thu gọn" : `Xem toàn bộ (${total})`}</span>
  </button>
);

const DebatePractice: React.FC = () => {
  const navigate = useNavigate();
  const activeDebateSession = useMemo(() => readActiveDebateSession(), []);

  const [practiced, setPracticed] = useState<PracticedTopic[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [listed, setListed] = useState<Topic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [topicsError, setTopicsError] = useState<string | null>(null);

  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [suggestionCategory, setSuggestionCategory] = useState<string>("all");

  // One start panel at a time: "h:<key>" for a practised topic, "s:<id>" for a suggestion
  const [openId, setOpenId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Read synchronously: two quick clicks must not create two sessions
  const submittingRef = useRef(false);
  const [startError, setStartError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await debateApi.getUserHistory();
      if (!res?.success || !Array.isArray(res.data)) throw new Error("Không thể tải lịch sử luyện tập.");
      setPracticed(groupPracticedTopics(res.data));
    } catch (err: unknown) {
      const e = err as { message?: string };
      setHistoryError(e.message || "Không thể tải lịch sử luyện tập.");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadTopics = useCallback(async () => {
    setTopicsLoading(true);
    setTopicsError(null);
    try {
      // Every active topic, page by page: a topic missing here could be neither suggested nor practised again
      const all: Topic[] = [];
      let totalPages = 1;
      for (let page = 1; page <= Math.min(totalPages, MAX_TOPIC_PAGES); page++) {
        const res = await topicApi.getAll({ pageNumber: page, pageSize: TOPIC_PAGE_SIZE, isActive: true });
        if (!res?.success || !res.data) throw new Error("Không thể tải danh sách chủ đề.");
        all.push(...(res.data.items || []));
        totalPages = res.data.totalPages || 1;
      }
      setListed(all);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setTopicsError(e.message || "Không thể tải danh sách chủ đề.");
    } finally {
      setTopicsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
    void loadTopics();
  }, [loadHistory, loadTopics]);

  const suggestions = useMemo(() => suggestTopics(listed, practiced), [listed, practiced]);
  const visibleSuggestions = useMemo(() => {
    if (!showAllSuggestions) return suggestions.slice(0, SUGGESTION_PREVIEW);
    return suggestionCategory === "all"
      ? suggestions
      : suggestions.filter((t) => normalizeTopicCategory(t.category) === suggestionCategory);
  }, [suggestions, showAllSuggestions, suggestionCategory]);
  const visibleHistory = showAllHistory ? practiced : practiced.slice(0, HISTORY_PREVIEW);

  const togglePanel = (id: string) => {
    setOpenId((current) => (current === id ? null : id));
    setStartError(null);
  };

  /** Always a new session, started by the topic's id (the Backend takes its category from it). */
  const startSession = async (topic: Topic, side: PracticeSide, difficulty: AIDifficultyLevel) => {
    if (submittingRef.current) return;
    const topicId = topicIdOf(topic);
    if (!topicId) {
      setStartError("Chủ đề này chưa có mã nên chưa thể bắt đầu.");
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setStartError(null);
    const motion = topic.motion || topic.description || topic.title;
    try {
      const res = await debateApi.createAiPracticeSession({
        topicId,
        title: topic.title,
        topic: motion,
        userSide: side === "PRO" ? 1 : 2,
        isAI: true,
        difficulty: BACKEND_DIFFICULTY[difficulty],
        turnTimeLimitSeconds: 180,
      });
      const sessionId = res?.data?.sessionId;
      if (!sessionId) throw new Error("Không nhận được mã phiên tranh biện từ máy chủ.");
      navigate(`/debater/debate/${sessionId}?role=${side}&difficulty=${difficulty}&motion=${encodeURIComponent(motion)}`);
    } catch (err: unknown) {
      const e = err as { message?: string; response?: { data?: { message?: string } } };
      setStartError(e.response?.data?.message || e.message || "Lỗi khởi tạo phiên tranh biện với máy chủ.");
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-10">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] dark:text-[#F8FAFC] tracking-tight flex items-center gap-2.5">
          <span>Tranh biện với AI</span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-[#ECFDF5] dark:bg-[rgba(16,185,129,0.15)] text-[#008A64] dark:text-[#34D399] font-bold border border-[#008A64]/30">
            Luyện tập 1v1
          </span>
        </h1>
        <p className="text-sm text-slate-500 dark:text-[#94A3B8] mt-1.5">
          Học lại các chủ đề đã luyện, hoặc chọn nhanh một chủ đề mới để tranh biện cùng AI.
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

      {/* ── History: the topics already practised with the AI ── */}
      <section className="space-y-3" aria-labelledby="practice-history-title">
        <h2 id="practice-history-title" className="text-base font-black text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2">
          <History size={17} className="text-[#008A64]" />
          <span>Lịch sử luyện tập</span>
        </h2>

        {historyLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500" data-testid="practiced-loading">
            <Loader2 size={18} className="animate-spin" />
            <span>Đang tải lịch sử luyện tập...</span>
          </div>
        ) : historyError ? (
          <div role="alert" className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p>{historyError}</p>
              <button
                type="button"
                data-testid="history-retry-load"
                onClick={() => void loadHistory()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-rose-300 text-xs font-bold hover:bg-rose-100 cursor-pointer"
              >
                <RefreshCw size={13} /> Thử lại
              </button>
            </div>
          </div>
        ) : practiced.length === 0 ? (
          <div
            data-testid="practiced-empty"
            className="text-center bg-white debate-panel-main rounded-2xl border border-dashed border-slate-300 dark:border-[rgba(148,163,184,0.25)] px-6 py-8 space-y-1.5"
          >
            <p className="text-sm font-bold text-slate-800 dark:text-[#F8FAFC]">Bạn chưa luyện chủ đề nào với AI</p>
            <p className="text-xs text-slate-500 dark:text-[#94A3B8]">
              Chọn một chủ đề gợi ý bên dưới để bắt đầu. Chủ đề đã hoàn thành sẽ xuất hiện ở đây để bạn học lại.
            </p>
          </div>
        ) : (
          <>
            <ul className="space-y-3" data-testid="practiced-list">
              {visibleHistory.map((item) => {
                const panelId = `h:${item.key}`;
                const isOpen = openId === panelId;
                const source = findListedTopic(item, listed);
                const canRetry = Boolean(source);
                return (
                  <li key={item.key} data-testid="practiced-topic" className={cardClass}>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1.5">
                        <h3 className="text-[15px] font-bold text-slate-900 dark:text-[#F8FAFC] leading-snug">{item.title}</h3>
                        <p className="text-xs text-slate-500 dark:text-[#94A3B8] flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>Đã luyện {item.count} lần</span>
                          {formatDate(item.lastPracticedAt) && <span>Gần nhất: {formatDate(item.lastPracticedAt)}</span>}
                          {item.lastSide && <span>Lần trước: {item.lastSide === "PRO" ? "Ủng hộ" : "Phản đối"}</span>}
                        </p>
                        {!canRetry && !topicsLoading && (
                          <p className="text-[11px] text-amber-700 dark:text-amber-400">
                            {topicsError
                              ? "Chưa tải được danh sách chủ đề nên chưa thể học lại."
                              : "Chủ đề này không còn trong danh sách nên chưa thể học lại."}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          to={`/debater/debate/${item.lastSessionId}/result`}
                          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:border-slate-300 hover:text-[#008A64] transition-colors"
                        >
                          Xem kết quả
                        </Link>
                        <button
                          type="button"
                          data-testid="retry-topic-btn"
                          aria-expanded={isOpen}
                          disabled={!canRetry}
                          onClick={() => togglePanel(panelId)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#008A64] hover:bg-[#007457] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                        >
                          <RotateCcw size={13} />
                          <span>Học lại</span>
                        </button>
                      </div>
                    </div>

                    {isOpen && source && (
                      <PracticeStartPanel
                        idPrefix={panelId}
                        defaultSide={item.lastSide}
                        submitting={submitting}
                        error={startError}
                        onStart={(side, difficulty) => void startSession(source, side, difficulty)}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
            {practiced.length > HISTORY_PREVIEW && (
              <ShowAllButton
                testId="history-show-all"
                expanded={showAllHistory}
                total={practiced.length}
                onToggle={() => setShowAllHistory((v) => !v)}
              />
            )}
          </>
        )}
      </section>

      {/* ── Suggested topics: the listed ones not practised yet, to start quickly ── */}
      <section className="space-y-3" aria-labelledby="practice-suggestions-title">
        <h2 id="practice-suggestions-title" className="text-base font-black text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2">
          <Sparkles size={17} className="text-[#008A64]" />
          <span>Chủ đề gợi ý</span>
        </h2>

        {topicsLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500" data-testid="suggestions-loading">
            <Loader2 size={18} className="animate-spin" />
            <span>Đang tải chủ đề...</span>
          </div>
        ) : topicsError ? (
          <div role="alert" className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p>{topicsError}</p>
              <button
                type="button"
                data-testid="topics-retry-load"
                onClick={() => void loadTopics()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-rose-300 text-xs font-bold hover:bg-rose-100 cursor-pointer"
              >
                <RefreshCw size={13} /> Thử lại
              </button>
            </div>
          </div>
        ) : suggestions.length === 0 ? (
          <div
            data-testid="suggestions-empty"
            className="text-center bg-white debate-panel-main rounded-2xl border border-dashed border-slate-300 dark:border-[rgba(148,163,184,0.25)] px-6 py-8 space-y-2"
          >
            <BookOpen size={26} className="mx-auto text-slate-400" />
            <p className="text-sm font-bold text-slate-800 dark:text-[#F8FAFC]">
              {listed.length > 0 ? "Bạn đã luyện hết các chủ đề hiện có" : "Chưa có chủ đề nào để gợi ý"}
            </p>
          </div>
        ) : (
          <>
            {showAllSuggestions && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc theo lĩnh vực">
                {[{ code: "all", label: "Tất cả" }, ...TOPIC_CATEGORIES].map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    data-testid={`suggestion-filter-${c.code}`}
                    aria-pressed={suggestionCategory === c.code}
                    onClick={() => setSuggestionCategory(c.code)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                      suggestionCategory === c.code
                        ? "bg-[#008A64] border-[#008A64] text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:border-[#008A64] hover:text-[#008A64]"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            <ul className="space-y-3" data-testid="suggestion-list">
              {visibleSuggestions.map((topic) => {
                const topicId = topicIdOf(topic);
                const panelId = `s:${topicId ?? topic.title}`;
                const isOpen = openId === panelId;
                return (
                  <li key={panelId} data-testid="suggested-topic" className={cardClass}>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 border border-emerald-200/80 text-[#008A64]">
                            {topicCategoryLabel(topic.category)}
                          </span>
                          <DifficultyBadge difficulty={topic.difficulty} />
                        </div>
                        <h3 className="text-[15px] font-bold text-slate-900 dark:text-[#F8FAFC] leading-snug">{topic.title}</h3>
                        {(topic.motion || topic.description) && (
                          <p className="text-xs text-slate-500 dark:text-[#94A3B8] line-clamp-2">
                            {topic.motion || topic.description}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        data-testid="start-suggested-btn"
                        aria-expanded={isOpen}
                        onClick={() => togglePanel(panelId)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#008A64] hover:bg-[#007457] text-white text-xs font-bold shadow-xs transition-colors shrink-0 cursor-pointer"
                      >
                        <span>Luyện tập</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>

                    {isOpen && (
                      <PracticeStartPanel
                        idPrefix={panelId}
                        submitting={submitting}
                        error={startError}
                        onStart={(side, difficulty) => void startSession(topic, side, difficulty)}
                      />
                    )}
                  </li>
                );
              })}
            </ul>

            {visibleSuggestions.length === 0 && (
              <p className="text-center text-xs text-slate-500 py-4">Không còn chủ đề nào trong lĩnh vực này.</p>
            )}

            {suggestions.length > SUGGESTION_PREVIEW && (
              <ShowAllButton
                testId="suggestions-show-all"
                expanded={showAllSuggestions}
                total={suggestions.length}
                onToggle={() => {
                  setShowAllSuggestions((v) => !v);
                  setSuggestionCategory("all");
                }}
              />
            )}
          </>
        )}

        <p className="text-center text-xs text-slate-500 dark:text-[#94A3B8] pt-1">
          Muốn xem chi tiết từng chủ đề?{" "}
          <Link to="/debater/topics" className="font-bold text-[#008A64] hover:underline">
            Mở thư viện chủ đề
          </Link>
        </p>
      </section>
    </div>
  );
};

export default DebatePractice;

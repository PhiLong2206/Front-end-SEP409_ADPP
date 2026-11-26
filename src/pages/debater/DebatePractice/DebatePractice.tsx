import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, BookOpen, ChevronDown, ChevronRight, ChevronUp, History, Loader2, RefreshCw, RotateCcw, Sparkles } from "lucide-react";
import { debateApi, topicApi } from "../../../api";
import { Topic } from "../../../types";
import { readActiveDebateSession } from "../../../hooks/useDebateNavigationGuard";
import { difficultyOf } from "../../../utils/topicDifficulty";
import { TOPIC_CATEGORIES, normalizeTopicCategory, topicCategoryLabel } from "../../../constants/topicCategories";
import {
  findListedTopic,
  groupPracticedTopics,
  PracticedTopic,
  suggestTopics,
  topicIdOf,
} from "../../../utils/debateTopicHistory";

const HISTORY_PREVIEW = 5;
const SUGGESTION_PREVIEW = 6;
const TOPIC_PAGE_SIZE = 100;
const MAX_TOPIC_PAGES = 10;

const formatDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("vi-VN");
};

const cardClass =
  "rounded-ap-xl bg-elevated p-(--s-6) shadow-ap-sm transition-shadow duration-(--t-base) ease-ap hover:shadow-ap-md";

const sectionTitle = "flex items-center gap-(--s-3) text-(length:--text-headline) font-semibold leading-(--leading-snug)";
const sectionIcon = "flex h-6 w-6 items-center justify-center text-label-tertiary";
const loadingBox =
  "flex items-center justify-center gap-(--s-2) py-(--s-8) text-(length:--text-callout) text-label-secondary";
const errorBox =
  "flex items-start gap-(--s-3) rounded-ap-xl bg-ap-danger/10 p-(--s-5) text-(length:--text-callout) text-label";
const emptyBox =
  "space-y-(--s-2) rounded-ap-xl bg-canvas-secondary px-(--s-6) py-(--s-7) text-center";
const retryButton =
  "inline-flex h-10 cursor-pointer items-center gap-(--s-2) rounded-ap-pill bg-elevated px-(--s-4) text-(length:--text-callout) font-medium shadow-[inset_0_0_0_1px_var(--separator)] transition-colors hover:bg-canvas-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30";
// The page has no filled button: each card offers one quiet action, so the eye is not pulled six ways at once
const softPill =
  "inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-(--s-2) rounded-ap-pill bg-accent-soft px-(--s-4) text-(length:--text-callout) font-medium text-accent transition-[background-color,transform] duration-(--t-fast) ease-ap hover:bg-accent/15 active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50";
const textAction =
  "group inline-flex min-h-11 items-center gap-1 text-(length:--text-callout) font-medium text-accent hover:underline focus-visible:outline-none focus-visible:underline";

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
    className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-(--s-2) rounded-ap-pill bg-canvas-secondary px-(--s-4) text-(length:--text-callout) font-medium text-label-secondary transition-colors duration-(--t-fast) hover:bg-accent-soft hover:text-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
  >
    {expanded ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
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

  /** Practising a topic opens its page (the same one the topic library uses), where the side and difficulty are picked. */
  const topicPath = (topic: Topic) => `/debater/topics/${topicIdOf(topic)}`;

  return (
    <div className="mx-auto max-w-5xl space-y-(--s-8) pb-(--s-8) animate-fade-in motion-reduce:animate-none">
      <div className="space-y-(--s-2) pt-(--s-4)">
        <h1 className="text-(length:--text-hero) font-bold leading-(--leading-tight) tracking-(--tracking-display)">
          Tranh biện với AI
        </h1>
        <p className="max-w-[620px] text-(length:--text-body) leading-(--leading-body) text-label-secondary">
          Luyện tập một mình: học lại các chủ đề đã luyện, hoặc chọn nhanh một chủ đề mới để tranh biện cùng AI.
        </p>
      </div>

      {/* Active Debate Recovery Banner */}
      {activeDebateSession && (
        <div
          data-testid="active-debate-recovery-banner"
          className="flex flex-col gap-(--s-3) rounded-ap-lg bg-accent-soft p-(--s-4) sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 space-y-0.5">
            <p className="text-(length:--text-callout) font-semibold text-accent">Bạn đang có một phiên tranh biện chưa kết thúc</p>
            <p className="truncate text-(length:--text-callout) text-label-secondary">
              &ldquo;{activeDebateSession.topicTitle}&rdquo;
            </p>
          </div>
          <button
            type="button"
            data-testid="resume-active-debate-btn"
            onClick={() => navigate(activeDebateSession.url)}
            className="inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-(--s-2) rounded-ap-pill bg-accent px-(--s-5) text-(length:--text-callout) font-medium text-accent-contrast transition-[background-color,transform] duration-(--t-fast) ease-ap hover:bg-accent-hover active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40"
          >
            <span>Tiếp tục trận tranh biện</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* ── Suggested topics: the listed ones not practised yet, to start quickly ── */}
      <section className="space-y-(--s-4)" aria-labelledby="practice-suggestions-title">
        <h2 id="practice-suggestions-title" className={sectionTitle}>
          <span className={sectionIcon}>
            <Sparkles size={16} aria-hidden="true" />
          </span>
          <span>Chủ đề gợi ý</span>
        </h2>

        {topicsLoading ? (
          <div className={loadingBox} data-testid="suggestions-loading" role="status">
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            <span>Đang tải chủ đề...</span>
          </div>
        ) : topicsError ? (
          <div role="alert" className={errorBox}>
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-ap-danger" aria-hidden="true" />
            <div className="flex-1 space-y-(--s-2)">
              <p>{topicsError}</p>
              <button type="button" data-testid="topics-retry-load" onClick={() => void loadTopics()} className={retryButton}>
                <RefreshCw size={14} aria-hidden="true" /> Thử lại
              </button>
            </div>
          </div>
        ) : suggestions.length === 0 ? (
          <div data-testid="suggestions-empty" className={emptyBox}>
            <BookOpen size={26} className="mx-auto text-label-tertiary" aria-hidden="true" />
            <p className="text-(length:--text-callout) font-semibold">
              {listed.length > 0 ? "Bạn đã luyện hết các chủ đề hiện có" : "Chưa có chủ đề nào để gợi ý"}
            </p>
          </div>
        ) : (
          <>
            {showAllSuggestions && (
              <div className="flex flex-wrap gap-(--s-2)" role="group" aria-label="Lọc theo lĩnh vực">
                {[{ code: "all", label: "Tất cả" }, ...TOPIC_CATEGORIES].map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    data-testid={`suggestion-filter-${c.code}`}
                    aria-pressed={suggestionCategory === c.code}
                    onClick={() => setSuggestionCategory(c.code)}
                    className={`min-h-10 cursor-pointer rounded-ap-pill px-(--s-4) text-(length:--text-callout) font-medium transition-colors duration-(--t-fast) focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 ${
                      suggestionCategory === c.code
                        ? "bg-accent text-accent-contrast"
                        : "bg-canvas-secondary text-label-secondary hover:bg-accent-soft hover:text-label"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            <ul className="grid grid-cols-1 gap-(--s-4) md:grid-cols-2" data-testid="suggestion-list">
              {visibleSuggestions.map((topic) => {
                const topicId = topicIdOf(topic);
                return (
                  <li key={String(topicId ?? topic.title)} data-testid="suggested-topic" className={cardClass}>
                    <div className="flex h-full flex-col justify-between gap-(--s-4)">
                      <div className="min-w-0 space-y-(--s-3)">
                        <div className="flex items-center justify-between gap-(--s-3)">
                          <span className="text-(length:--text-caption) font-medium text-accent">
                            {topicCategoryLabel(topic.category)}
                          </span>
                          <span className="inline-flex items-center gap-(--s-2) text-(length:--text-caption) text-label-secondary">
                            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${difficultyOf(topic.difficulty).dot}`} />
                            {difficultyOf(topic.difficulty).label}
                          </span>
                        </div>
                        <h3 className="text-(length:--text-headline) font-semibold leading-(--leading-snug)">{topic.title}</h3>
                        {(topic.motion || topic.description) && (
                          <p className="line-clamp-2 text-(length:--text-callout) leading-(--leading-body) text-label-secondary">
                            {topic.motion || topic.description}
                          </p>
                        )}
                      </div>
                      <Link
                        to={topicPath(topic)}
                        state={{ topic }}
                        data-testid="start-suggested-btn"
                        className={`${textAction} self-start`}
                      >
                        <span>Luyện tập</span>
                        <ChevronRight size={16} className="transition-transform duration-(--t-base) group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>

            {visibleSuggestions.length === 0 && (
              <p className="py-(--s-4) text-center text-(length:--text-callout) text-label-secondary">Không còn chủ đề nào trong lĩnh vực này.</p>
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

        <p className="pt-(--s-1) text-center text-(length:--text-callout) text-label-secondary">
          Muốn xem chi tiết từng chủ đề?{" "}
          <Link to="/debater/topics" className="font-medium text-accent hover:underline focus-visible:outline-none focus-visible:underline">
            Mở thư viện chủ đề
          </Link>
        </p>
      </section>

      {/* ── History: the topics already practised with the AI ── */}
      <section className="space-y-(--s-4)" aria-labelledby="practice-history-title">
        <h2 id="practice-history-title" className={sectionTitle}>
          <span className={sectionIcon}>
            <History size={16} aria-hidden="true" />
          </span>
          <span>Lịch sử luyện tập</span>
        </h2>

        {historyLoading ? (
          <div className={loadingBox} data-testid="practiced-loading" role="status">
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            <span>Đang tải lịch sử luyện tập...</span>
          </div>
        ) : historyError ? (
          <div role="alert" className={errorBox}>
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-ap-danger" aria-hidden="true" />
            <div className="flex-1 space-y-(--s-2)">
              <p>{historyError}</p>
              <button type="button" data-testid="history-retry-load" onClick={() => void loadHistory()} className={retryButton}>
                <RefreshCw size={14} aria-hidden="true" /> Thử lại
              </button>
            </div>
          </div>
        ) : practiced.length === 0 ? (
          <div data-testid="practiced-empty" className={emptyBox}>
            <p className="text-(length:--text-callout) font-semibold">Bạn chưa luyện chủ đề nào với AI</p>
            <p className="text-(length:--text-callout) text-label-secondary">
              Chọn một chủ đề gợi ý ở trên để bắt đầu. Chủ đề đã hoàn thành sẽ xuất hiện ở đây để bạn học lại.
            </p>
          </div>
        ) : (
          <>
            <ul className="space-y-(--s-3)" data-testid="practiced-list">
              {visibleHistory.map((item) => {
                const source = findListedTopic(item, listed);
                const canRetry = Boolean(source);
                return (
                  <li key={item.key} data-testid="practiced-topic" className={cardClass}>
                    <div className="flex flex-col justify-between gap-(--s-3) sm:flex-row sm:items-center">
                      <div className="min-w-0 space-y-(--s-2)">
                        <h3 className="text-(length:--text-callout) font-semibold leading-(--leading-snug)">{item.title}</h3>
                        <p className="flex flex-wrap items-center gap-x-(--s-4) gap-y-1 text-(length:--text-caption) text-label-secondary">
                          <span>Đã luyện {item.count} lần</span>
                          {formatDate(item.lastPracticedAt) && <span>Gần nhất: {formatDate(item.lastPracticedAt)}</span>}
                          {item.lastSide && <span>Lần trước: {item.lastSide === "PRO" ? "Ủng hộ" : "Phản đối"}</span>}
                        </p>
                        {!canRetry && !topicsLoading && (
                          <p className="text-(length:--text-caption) text-ap-warning">
                            {topicsError
                              ? "Chưa tải được danh sách chủ đề nên chưa thể học lại."
                              : "Chủ đề này không còn trong danh sách nên chưa thể học lại."}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-(--s-2)">
                        <Link
                          to={`/debater/debate/${item.lastSessionId}/result`}
                          className="inline-flex min-h-11 items-center px-(--s-3) text-(length:--text-callout) font-medium text-accent hover:underline focus-visible:outline-none focus-visible:underline"
                        >
                          Xem kết quả
                        </Link>
                        {source ? (
                          <Link
                            to={topicPath(source)}
                            state={{ topic: source, defaultSide: item.lastSide }}
                            data-testid="retry-topic-btn"
                            className={softPill}
                          >
                            <RotateCcw size={14} aria-hidden="true" />
                            <span>Học lại</span>
                          </Link>
                        ) : (
                          <button type="button" data-testid="retry-topic-btn" disabled className={softPill}>
                            <RotateCcw size={14} aria-hidden="true" />
                            <span>Học lại</span>
                          </button>
                        )}
                      </div>
                    </div>
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
    </div>
  );
};

export default DebatePractice;

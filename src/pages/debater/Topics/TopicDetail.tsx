import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { Topic } from "../../../types";
import { difficultyOf } from "../../../utils/topicDifficulty";
import { ArrowRight, BookOpen, ChevronLeft, FileText, Loader2, Play } from "lucide-react";
import topicApi from "../../../api/topicApi";
import { debateApi } from "../../../api";
import { useCredit } from "../../../hooks/useCredit";
import { readActiveDebateSession } from "../../../hooks/useDebateNavigationGuard";
import AiVoicePicker from "../../../components/debate/AiVoicePicker";
import { topicCategoryLabel } from "../../../constants/topicCategories";
import TopicGuides from "../../../components/topic/TopicGuides";

const TopicDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { setBalance } = useCredit();

  const [topic, setTopic] = useState<Topic | null>(
    (location.state as { topic?: Topic })?.topic || null
  );
  const [loading, setLoading] = useState<boolean>(!topic);

  const [activeTab, setActiveTab] = useState<"overview" | "materials">("overview");
  // "Học lại" from the practice page brings the side of the last time
  const [selectedSide, setSelectedSide] = useState<"Ủng hộ" | "Phản đối">(
    (location.state as { defaultSide?: string } | null)?.defaultSide === "CON" ? "Phản đối" : "Ủng hộ"
  );
  const [selectedDifficulty, setSelectedDifficulty] = useState<"Dễ" | "Trung bình" | "Khó">("Trung bình");
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [backgroundOpen, setBackgroundOpen] = useState(false);
  const activeDebateSession = useMemo(() => readActiveDebateSession(), []);

  useEffect(() => {
    if (!topic && id) {
      setLoading(true);
      topicApi
        .getById(id)
        .then((res) => {
          if (res && res.success && res.data) {
            setTopic(res.data);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [id, topic]);

  if (loading) {
    return (
      <div role="status" className="mx-auto max-w-5xl space-y-(--s-3) py-(--s-9) text-center">
        <Loader2 size={28} className="mx-auto animate-spin text-accent" aria-hidden="true" />
        <p className="text-(length:--text-callout) text-label-secondary">Đang tải thông tin chi tiết chủ đề...</p>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="mx-auto max-w-5xl space-y-(--s-3) py-(--s-9) text-center">
        <p className="text-(length:--text-title) font-semibold">Không tìm thấy chủ đề tranh biện</p>
        <p className="text-(length:--text-callout) text-label-secondary">Chủ đề này không tồn tại hoặc chưa được tạo trên máy chủ.</p>
        <Link
          to="/debater/topics"
          className="mt-(--s-4) inline-flex h-11 items-center gap-(--s-2) rounded-ap-pill bg-accent px-(--s-5) text-(length:--text-callout) font-medium text-accent-contrast transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40"
        >
          <ChevronLeft size={16} aria-hidden="true" /> Quay lại danh sách chủ đề
        </Link>
      </div>
    );
  }

  // Resolve the canonical debatable Motion matching Backend DebateSideGuide.ResolveMotion
  const rawDesc = topic.description?.trim() || "";
  const rawTitle = topic.title?.trim() || "";
  const isMetaPrompt = /^(discuss|debate whether|analyze|explore|examine)\s+/i.test(rawDesc);
  const motion =
    topic.motion ||
    (isMetaPrompt ? rawTitle || rawDesc : rawDesc || rawTitle) ||
    "";

  // Always a new Backend session: continuing an unfinished one is the user's choice, through the banner below.
  const handleStartDebate = async () => {
    if (submitting) return;
    setSubmitting(true);
    setApiError(null);

    const role = selectedSide === "Ủng hộ" ? "PRO" : "CON";
    const topicId = Number(topic.topicId ?? topic.id ?? id);

    try {
      const res = await debateApi.createAiPracticeSession({
        topicId: Number.isInteger(topicId) && topicId > 0 ? topicId : undefined,
        title: topic.title,
        topic: motion,
        category: topic.category || "society",
        userSide: role === "PRO" ? 1 : 2,
        isAI: true,
        difficulty: selectedDifficulty === "Khó" ? "Hard" : selectedDifficulty === "Dễ" ? "Easy" : "Medium",
        turnTimeLimitSeconds: 180,
      });

      const sessionId = res?.data?.sessionId;
      if (!sessionId) {
        throw new Error("Không nhận được mã phiên tranh biện từ máy chủ.");
      }
      if (typeof res?.data?.currentUserBalance === "number") {
        setBalance(res.data.currentUserBalance);
      }
      navigate(
        `/debater/debate/${sessionId}?role=${role}&difficulty=${selectedDifficulty}&motion=${encodeURIComponent(motion)}`
      );
    } catch (err: unknown) {
      const e = err as { message?: string; response?: { data?: { message?: string } } };
      setApiError(e.response?.data?.message || e.message || "Lỗi khởi tạo phiên tranh biện với máy chủ.");
    } finally {
      setSubmitting(false);
    }
  };

  const level = difficultyOf(topic.difficulty);
  const sideOption = (checked: boolean, tone: "accent" | "danger" = "accent") =>
    `flex min-h-11 cursor-pointer items-center justify-center gap-(--s-2) rounded-ap-md border px-(--s-3) text-(length:--text-callout) font-medium transition-[background-color,border-color] duration-(--t-fast) has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-accent/30 ${
      checked
        ? tone === "danger"
          ? "border-ap-danger bg-ap-danger/10 text-label"
          : "border-accent bg-accent-soft text-accent"
        : "border-transparent bg-canvas-secondary text-label-secondary hover:text-label"
    }`;
  const sectionLabel = "text-(length:--text-caption) font-medium uppercase tracking-wider text-label-secondary";
  const surface = "rounded-ap-xl bg-elevated p-(--s-5) shadow-ap-sm";
  const background = topic.backgroundInfo || topic.description || "";

  return (
    // One screen on a desktop: the page does not scroll, the long texts fold (3 lines, "Xem thêm") and scroll inside their own box
    <div className="mx-auto flex max-w-6xl flex-col gap-(--s-5) animate-fade-in motion-reduce:animate-none lg:h-[calc(100dvh-9rem)] lg:overflow-hidden">
      {/* Back + an unfinished debate: one slim row */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-(--s-3)">
        <Link
          to="/debater/topics"
          className="inline-flex min-h-11 items-center gap-1 text-(length:--text-callout) font-medium text-accent hover:underline focus-visible:outline-none focus-visible:underline"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          <span>Quay lại danh sách chủ đề</span>
        </Link>

        {activeDebateSession && (
          <div
            data-testid="active-debate-recovery-banner"
            className="flex min-w-0 max-w-full items-center gap-(--s-3) rounded-ap-pill bg-accent-soft py-1 pl-(--s-4) pr-1"
          >
            <p className="min-w-0 truncate text-(length:--text-callout) text-label">
              <span className="font-semibold text-accent">Bạn đang có một phiên tranh biện chưa kết thúc</span>
              <span className="text-label-secondary"> · &ldquo;{activeDebateSession.topicTitle}&rdquo;</span>
            </p>
            <button
              type="button"
              data-testid="resume-active-debate-btn"
              onClick={() => navigate(activeDebateSession.url)}
              className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-(--s-2) rounded-ap-pill bg-accent px-(--s-4) text-(length:--text-callout) font-medium text-accent-contrast transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40"
            >
              <span>Tiếp tục trận tranh biện</span>
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-(--s-5) lg:grid-cols-12">
        {/* ── Left: the topic and what to read ── */}
        <div className="flex min-h-0 flex-col gap-(--s-4) lg:col-span-7">
          {/* The topic */}
          <section className="shrink-0 space-y-(--s-2)">
            <div className="flex items-center gap-(--s-4) text-(length:--text-caption)">
              <span className="font-medium text-accent">{topicCategoryLabel(topic.category)}</span>
              <span className="inline-flex items-center gap-(--s-2) text-label-secondary">
                <span aria-hidden="true" className={`h-2 w-2 rounded-full ${level.dot}`} />
                {level.label}
              </span>
            </div>

            <h1 className="line-clamp-2 text-(length:--text-title) font-semibold leading-(--leading-tight) tracking-(--tracking-display) text-balance">
              {topic.title}
            </h1>

            {(topic.motion || topic.description) && (
              <p className="line-clamp-2 text-(length:--text-callout) leading-(--leading-body) text-label-secondary">
                Kiến nghị: &ldquo;{motion}&rdquo;
              </p>
            )}
          </section>

          {/* Tabs */}
          <div role="tablist" aria-label="Nội dung chủ đề" className="inline-flex max-w-full shrink-0 gap-1 self-start overflow-x-auto rounded-ap-pill bg-canvas-secondary p-1">
            {(
              [
                { id: "overview" as const, label: "Tổng quan", icon: BookOpen },
                { id: "materials" as const, label: "Tài liệu tham khảo", icon: FileText },
              ]
            ).map(({ id: tabId, label, icon: Icon }) => (
              <button
                key={tabId}
                type="button"
                role="tab"
                id={`topic-tab-${tabId}`}
                aria-selected={activeTab === tabId}
                aria-controls={`topic-panel-${tabId}`}
                onClick={() => setActiveTab(tabId)}
                className={`inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-(--s-2) rounded-ap-pill px-(--s-4) text-(length:--text-callout) font-medium transition-[background-color,box-shadow,color] duration-(--t-base) ease-ap focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 ${
                  activeTab === tabId ? "bg-elevated text-label shadow-ap-sm" : "text-label-secondary hover:text-label"
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* The panel: it scrolls inside itself if a text is opened */}
          {activeTab === "overview" && (
            <div id="topic-panel-overview" role="tabpanel" aria-labelledby="topic-tab-overview" className="min-h-0 flex-1 space-y-(--s-4) lg:overflow-y-auto lg:pr-1">
              <TopicGuides proGuide={topic.proGuide} conGuide={topic.conGuide} />

              {background && (
                <section className={`${surface} space-y-(--s-2)`}>
                  <h2 className={sectionLabel}>Bối cảnh &amp; Mục tiêu</h2>
                  <div className={`grid grid-cols-1 gap-(--s-4) ${topic.imageUrl ? "sm:grid-cols-12" : ""} items-start`}>
                    <div className={topic.imageUrl ? "sm:col-span-9" : ""}>
                      <p className={`text-(length:--text-callout) leading-(--leading-body) ${backgroundOpen ? "" : "line-clamp-3"}`}>{background}</p>
                      {background.length > 150 && (
                        <button
                          type="button"
                          aria-expanded={backgroundOpen}
                          onClick={() => setBackgroundOpen((v) => !v)}
                          className="mt-(--s-1) inline-flex min-h-8 cursor-pointer items-center text-(length:--text-caption) font-medium text-accent hover:underline focus-visible:outline-none focus-visible:underline"
                        >
                          {backgroundOpen ? "Thu gọn" : "Xem thêm"}
                        </button>
                      )}
                    </div>
                    {topic.imageUrl && (
                      <div className="h-24 overflow-hidden rounded-ap-lg bg-canvas-secondary sm:col-span-3">
                        <img src={topic.imageUrl} alt={topic.title} className="h-full w-full object-cover" />
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          )}

          {activeTab === "materials" && (
            <div id="topic-panel-materials" role="tabpanel" aria-labelledby="topic-tab-materials" className={`${surface} min-h-0 flex-1 space-y-(--s-3) lg:overflow-y-auto`}>
              <h2 className={sectionLabel}>Tài liệu tham khảo</h2>
              {topic.materials && topic.materials.length > 0 ? (
                <div className="space-y-(--s-3)">
                  {topic.materials.map((mat) => (
                    <div key={mat.id} className="space-y-(--s-1) rounded-ap-lg bg-canvas-secondary p-(--s-4)">
                      <h3 className="text-(length:--text-callout) font-semibold">{mat.title}</h3>
                      <p className="text-(length:--text-callout) leading-(--leading-body) text-label-secondary">{mat.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-(--s-7) text-center text-(length:--text-callout) text-label-secondary">Chưa có tài liệu đính kèm.</p>
              )}
            </div>
          )}
        </div>

        {/* ── Right: the setup, one button ── */}
        <section
          className={`${surface} flex min-h-0 flex-col gap-(--s-4) lg:col-span-5 lg:overflow-y-auto`}
          aria-label="Thiết lập phiên tranh biện"
        >
          <h2 className={sectionLabel}>Thiết lập phiên tranh biện</h2>

          <fieldset className="space-y-(--s-2)">
            <legend className="mb-(--s-2) text-(length:--text-callout) font-semibold">Chọn phe của bạn</legend>
            <div className="grid grid-cols-2 gap-(--s-2)">
              <label className={sideOption(selectedSide === "Ủng hộ")}>
                <input
                  type="radio"
                  name="side"
                  checked={selectedSide === "Ủng hộ"}
                  onChange={() => setSelectedSide("Ủng hộ")}
                  className="sr-only"
                />
                <span>Ủng hộ (Pro)</span>
              </label>
              <label className={sideOption(selectedSide === "Phản đối", "danger")}>
                <input
                  type="radio"
                  name="side"
                  checked={selectedSide === "Phản đối"}
                  onChange={() => setSelectedSide("Phản đối")}
                  className="sr-only"
                />
                <span>Phản đối (Con)</span>
              </label>
            </div>
          </fieldset>

          <fieldset className="space-y-(--s-2)">
            <legend className="mb-(--s-2) text-(length:--text-callout) font-semibold">Độ khó của AI</legend>
            <div className="grid grid-cols-3 gap-(--s-2)">
              {(["Dễ", "Trung bình", "Khó"] as const).map((diff) => (
                <label key={diff} className={`${sideOption(selectedDifficulty === diff)} px-(--s-2)`}>
                  <input
                    type="radio"
                    name="difficulty"
                    checked={selectedDifficulty === diff}
                    onChange={() => setSelectedDifficulty(diff)}
                    className="sr-only"
                  />
                  <span>{diff}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="border-t border-separator pt-(--s-3)">
            <AiVoicePicker variant="compact" />
          </div>

          {/* The structure in one line: 8 minutes */}
          <p className="flex flex-wrap items-center justify-between gap-x-(--s-4) gap-y-1 border-t border-separator pt-(--s-3) text-(length:--text-callout) text-label-secondary">
            <span className="tabular-nums">Mở đầu 3&apos; · Phản biện 3&apos; · Kết luận 2&apos;</span>
            <span className="font-medium tabular-nums text-accent">Dự kiến 8 phút</span>
          </p>

          <div className="mt-auto space-y-(--s-3)">
            {apiError && (
              <p
                role="alert"
                data-testid="topic-start-error"
                className="rounded-ap-md bg-ap-danger/10 p-(--s-3) text-(length:--text-callout) text-label"
              >
                {apiError}
              </p>
            )}

            <button
              type="button"
              onClick={handleStartDebate}
              disabled={submitting}
              className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-(--s-2) rounded-ap-pill bg-accent px-(--s-6) text-(length:--text-body) font-medium text-accent-contrast transition-[background-color,transform] duration-(--t-fast) ease-ap hover:bg-accent-hover active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Play size={16} className="fill-current" aria-hidden="true" />}
              <span>Bắt đầu tranh biện</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default TopicDetail;

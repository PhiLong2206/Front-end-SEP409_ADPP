import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { Topic } from "../../../types";
import Badge from "../../../components/common/Badge";
import DifficultyBadge from "../../../components/topic/DifficultyBadge";
import { ArrowLeft, ArrowRight, BookOpen, FileText, Play, RefreshCw } from "lucide-react";
import topicApi from "../../../api/topicApi";
import { debateApi } from "../../../api";
import { readActiveDebateSession } from "../../../hooks/useDebateNavigationGuard";

const TopicDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [topic, setTopic] = useState<Topic | null>(
    (location.state as { topic?: Topic })?.topic || null
  );
  const [loading, setLoading] = useState<boolean>(!topic);

  const [activeTab, setActiveTab] = useState<"overview" | "materials">("overview");
  const [selectedSide, setSelectedSide] = useState<"Ủng hộ" | "Phản đối">("Ủng hộ");
  const [selectedDifficulty, setSelectedDifficulty] = useState<"Dễ" | "Trung bình" | "Khó">("Trung bình");
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
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
      <div className="space-y-6 max-w-5xl mx-auto py-20 text-center">
        <RefreshCw size={28} className="animate-spin text-[#008A64] mx-auto mb-2" />
        <p className="text-xs font-bold text-slate-600">Đang tải thông tin chi tiết chủ đề...</p>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto py-16 text-center">
        <p className="text-base font-bold text-slate-800">Không tìm thấy chủ đề tranh biện</p>
        <p className="text-xs text-slate-500 mt-1">Chủ đề này không tồn tại hoặc chưa được tạo trên máy chủ.</p>
        <Link
          to="/debater/topics"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-[#008A64] hover:bg-[#007457] text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
        >
          <ArrowLeft size={14} /> Quay lại danh sách chủ đề
        </Link>
      </div>
    );
  }

  // With a topicId the Backend debates Topic.Description, or the title when there is none.
  const motion = topic.motion || topic.description || topic.title;

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
        userSide: role === "PRO" ? 1 : 2,
        isAI: true,
        difficulty: selectedDifficulty === "Khó" ? "Hard" : selectedDifficulty === "Dễ" ? "Easy" : "Medium",
        turnTimeLimitSeconds: 180,
      });

      const sessionId = res?.data?.sessionId;
      if (!sessionId) {
        throw new Error("Không nhận được mã phiên tranh biện từ máy chủ.");
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back button */}
      <div>
        <Link
          to="/debater/topics"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-[#008A64] transition-colors"
        >
          <ArrowLeft size={15} />
          <span>Quay lại danh sách chủ đề</span>
        </Link>
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

      {/* Main Topic Header Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="primary" size="sm">{topic.category || "Chung"}</Badge>
          <DifficultyBadge difficulty={topic.difficulty} />
        </div>

        <h1 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight leading-snug">
          {topic.title}
        </h1>

        {(topic.motion || topic.description) && (
          <p className="text-xs sm:text-sm text-slate-600 italic">
            Kiến nghị: &ldquo;{motion}&rdquo;
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "overview"
              ? "border-[#008A64] text-[#008A64]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <BookOpen size={16} />
          <span>Tổng quan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("materials")}
          className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "materials"
              ? "border-[#008A64] text-[#008A64]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText size={16} />
          <span>Tài liệu tham khảo</span>
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Section: Bối cảnh */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Bối cảnh & Mục tiêu
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-start">
              <div className="sm:col-span-8 space-y-3 text-xs sm:text-sm text-slate-700 leading-relaxed">
                <p>{topic.backgroundInfo || topic.description}</p>
                <p className="text-slate-500">
                  Phiên luyện tập sẽ giúp bạn rèn luyện kỹ năng xây dựng luận điểm, phân tích lập luận và cung cấp bằng chứng thuyết phục trong tranh biện.
                </p>
              </div>

              {topic.imageUrl && (
                <div className="sm:col-span-4 h-36 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 shadow-xs">
                  <img
                    src={topic.imageUrl}
                    alt={topic.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section: Thiết lập phiên tranh biện (3 Columns) */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Thiết lập phiên tranh biện
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              {/* Column 1: Chọn phe */}
              <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-800 block">
                  Chọn phe của bạn
                </span>
                <div className="space-y-2">
                  <label className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer text-xs sm:text-sm font-semibold transition-all ${
                    selectedSide === "Ủng hộ"
                      ? "bg-[#ECFDF5] border-[#008A64] text-[#008A64]"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}>
                    <input
                      type="radio"
                      name="side"
                      checked={selectedSide === "Ủng hộ"}
                      onChange={() => setSelectedSide("Ủng hộ")}
                      className="accent-[#008A64]"
                    />
                    <span>Ủng hộ (Pro)</span>
                  </label>

                  <label className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer text-xs sm:text-sm font-semibold transition-all ${
                    selectedSide === "Phản đối"
                      ? "bg-rose-50 border-rose-400 text-rose-700"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}>
                    <input
                      type="radio"
                      name="side"
                      checked={selectedSide === "Phản đối"}
                      onChange={() => setSelectedSide("Phản đối")}
                      className="accent-rose-600"
                    />
                    <span>Phản đối (Con)</span>
                  </label>
                </div>
              </div>

              {/* Column 2: Độ khó của đối thủ */}
              <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-800 block">
                  Độ khó của AI
                </span>
                <div className="space-y-2">
                  {(["Dễ", "Trung bình", "Khó"] as const).map((diff) => (
                    <label
                      key={diff}
                      className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer text-xs sm:text-sm font-semibold transition-all ${
                        selectedDifficulty === diff
                          ? "bg-[#ECFDF5] border-[#008A64] text-[#008A64]"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="difficulty"
                        checked={selectedDifficulty === diff}
                        onChange={() => setSelectedDifficulty(diff)}
                        className="accent-[#008A64]"
                      />
                      <span>{diff}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Column 3: Cấu trúc tranh biện */}
              <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-800 block">
                  Cấu trúc thời gian
                </span>
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>• Mở đầu</span>
                    <span className="font-semibold text-slate-900 font-mono">3 phút</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Phản biện</span>
                    <span className="font-semibold text-slate-900 font-mono">3 phút</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Kết luận</span>
                    <span className="font-semibold text-slate-900 font-mono">2 phút</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200 text-xs text-[#008A64] font-bold">
                  Thời lượng dự kiến: 8 phút
                </div>
              </div>
            </div>

            {apiError && (
              <p role="alert" data-testid="topic-start-error" className="text-xs font-semibold text-rose-600">
                {apiError}
              </p>
            )}

            {/* Bottom Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <Link
                to="/debater/topics"
                className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-xs"
              >
                Quay lại
              </Link>

              <button
                type="button"
                onClick={handleStartDebate}
                disabled={submitting}
                className="px-7 py-3 bg-[#008A64] hover:bg-[#007457] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-bold rounded-2xl shadow-md shadow-[#008A64]/20 transition-all inline-flex items-center gap-2 hover:scale-102"
              >
                <Play size={15} className="fill-current" />
                <span>Bắt đầu tranh biện</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Materials */}
      {activeTab === "materials" && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Tài liệu tham khảo
          </h2>
          {topic.materials && topic.materials.length > 0 ? (
            <div className="space-y-3">
              {topic.materials.map((mat) => (
                <div key={mat.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-1.5">
                  <h3 className="font-bold text-sm text-slate-900">{mat.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{mat.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-8 text-center">Chưa có tài liệu đính kèm.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default TopicDetail;

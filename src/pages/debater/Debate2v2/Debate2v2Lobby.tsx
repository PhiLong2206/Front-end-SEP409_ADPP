import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  Flame,
  Swords,
  CheckCircle2,
  ArrowRight,
  Layers,
  Loader2,
  Inbox,
  AlertCircle,
  Check,
  X,
} from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import Modal from "../../../components/common/Modal";
import Input from "../../../components/common/Input";
import Button from "../../../components/common/Button";
import TopicSelectCombobox, { SelectedTopicOption } from "../../../components/topic/TopicSelectCombobox";
import { debateApi } from "../../../api";
import { SystemDebateSide } from "../../../types";
import { readActiveDebateSession } from "../../../hooks/useDebateNavigationGuard";

const Debate2v2Lobby: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const activeDebateSession = useMemo(() => readActiveDebateSession(), []);

  const [selectedTopic, setSelectedTopic] = useState<SelectedTopicOption | null>(null);
  const [isUserReady, setIsUserReady] = useState<boolean>(true);
  const [selectedUserRole, setSelectedUserRole] = useState<"PRO1" | "PRO2" | "CON1" | "CON2">("PRO1");
  const [roomTitle, setRoomTitle] = useState<string>("");
  const [timeLimit, setTimeLimit] = useState<number>(180);

  // API Call States
  const [isCreating2v2, setIsCreating2v2] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Join 2v2 Room Modal State
  const [showJoinModal, setShowJoinModal] = useState<boolean>(false);
  const [joinSessionId, setJoinSessionId] = useState<string>("");
  const [joinPreferredSide, setJoinPreferredSide] = useState<number | undefined>(undefined);
  const [isJoining, setIsJoining] = useState<boolean>(false);

  const handleCreate2v2Session = async () => {
    if (!selectedTopic) {
      setFeedbackMsg({ text: "Vui lòng chọn một chủ đề tranh biện hợp lệ từ danh sách.", type: "error" });
      return;
    }

    setIsCreating2v2(true);
    setFeedbackMsg(null);
    try {
      const userSide = selectedUserRole.startsWith("PRO") ? SystemDebateSide.PRO : SystemDebateSide.CON;
      const title = roomTitle.trim()
        ? (roomTitle.toLowerCase().includes("2v2") || roomTitle.toLowerCase().includes("2 vs 2")
            ? roomTitle.trim()
            : `[2v2] ${roomTitle.trim()}`)
        : `[2v2] ${selectedTopic.title.slice(0, 180)}`;

      const res = await debateApi.create2v2Session({
        topicId: selectedTopic.topicId,
        title,
        topic: selectedTopic.topicText,
        userSide,
        turnTimeLimitSeconds: timeLimit,
      });

      if (res?.success && res.data?.sessionId) {
        setFeedbackMsg({ text: `Đã tạo phòng 2v2 #${res.data.sessionId}! Đang chuyển hướng...`, type: "success" });
        navigate(`/debater/debate/${res.data.sessionId}`);
      } else {
        setFeedbackMsg({ text: res?.message || "Không thể tạo phòng tranh biện 2 vs 2.", type: "error" });
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setFeedbackMsg({ text: e.message || "Lỗi khi tạo phòng tranh biện 2 vs 2.", type: "error" });
    } finally {
      setIsCreating2v2(false);
    }
  };

  const handleJoin2v2Session = async () => {
    const idNum = parseInt(joinSessionId.trim(), 10);
    if (isNaN(idNum) || idNum <= 0) {
      setFeedbackMsg({ text: "Vui lòng nhập mã ID phòng hợp lệ (số nguyên).", type: "error" });
      return;
    }

    setIsJoining(true);
    try {
      const res = await debateApi.join2v2Session(idNum, {
        preferredSide: joinPreferredSide,
      });

      if (res?.success && res.data?.sessionId) {
        setShowJoinModal(false);
        navigate(`/debater/debate/${res.data.sessionId}`);
      } else {
        setFeedbackMsg({ text: res?.message || "Không thể tham gia phòng này (có thể đã đủ 4 người hoặc không tồn tại).", type: "error" });
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setFeedbackMsg({ text: e.message || "Lỗi khi tham gia phòng 2 vs 2.", type: "error" });
    } finally {
      setIsJoining(false);
    }
  };

  const fieldClass =
    "h-12 w-full rounded-ap-md border border-transparent bg-canvas-secondary px-(--s-4) text-(length:--text-body) text-label placeholder:text-label-tertiary outline-none transition-[box-shadow,border-color] duration-(--t-fast) ease-ap focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/25";
  const labelClass = "mb-(--s-2) block text-(length:--text-caption) font-medium text-label-secondary";
  const surface = "rounded-ap-xl bg-elevated p-(--s-6) shadow-ap-sm";
  const textAction =
    "inline-flex min-h-11 cursor-pointer items-center gap-(--s-2) text-(length:--text-callout) font-medium text-accent hover:underline focus-visible:outline-none focus-visible:underline";
  const slotTag = "rounded-full bg-canvas-secondary px-(--s-3) py-1 text-(length:--text-caption) text-label-secondary";
  const roleButton = (active: boolean) =>
    `min-h-9 cursor-pointer rounded-full px-(--s-4) text-(length:--text-callout) font-medium transition-colors duration-(--t-fast) focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 ${
      active ? "bg-accent text-accent-contrast" : "bg-canvas-secondary text-label-secondary hover:text-label"
    }`;

  return (
    <div className="mx-auto max-w-6xl space-y-(--s-7) pb-(--s-8) animate-fade-in motion-reduce:animate-none">
      {/* Active Debate Recovery Banner */}
      {activeDebateSession && (
        <div
          data-testid="active-debate-recovery-banner"
          className="flex flex-col gap-(--s-3) rounded-ap-lg bg-accent-soft p-(--s-4) sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 space-y-0.5">
            <p className="text-(length:--text-callout) font-semibold text-accent">Bạn đang có một trận tranh biện đang diễn ra</p>
            <p className="truncate text-(length:--text-callout) text-label-secondary">&ldquo;{activeDebateSession.topicTitle}&rdquo;</p>
          </div>
          <button
            type="button"
            data-testid="resume-active-debate-btn"
            onClick={() => navigate(activeDebateSession.url)}
            className="inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-(--s-2) rounded-ap-pill bg-accent px-(--s-5) text-(length:--text-callout) font-medium text-accent-contrast transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40"
          >
            <span>Tiếp tục trận tranh biện</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div
          role={feedbackMsg.type === "error" ? "alert" : "status"}
          className={`flex items-center justify-between gap-(--s-3) rounded-ap-md p-(--s-3) text-(length:--text-callout) ${
            feedbackMsg.type === "success" ? "bg-accent-soft text-label" : "bg-ap-danger/10 text-label"
          }`}
        >
          <div className="flex items-center gap-(--s-3)">
            {feedbackMsg.type === "success" ? (
              <Check size={18} className="shrink-0 text-accent" aria-hidden="true" />
            ) : (
              <AlertCircle size={18} className="shrink-0 text-ap-danger" aria-hidden="true" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            aria-label="Đóng thông báo"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-label-secondary hover:text-label focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* ─────────────  1. HEADER  ───────────── */}
      <section className="space-y-(--s-5) pt-(--s-4)">
        <div className="max-w-[720px] space-y-(--s-2)">
          <h1 className="text-(length:--text-hero) font-bold leading-(--leading-tight) tracking-(--tracking-display)">
            Tranh biện 2 vs 2
          </h1>
          <p className="text-(length:--text-body) leading-(--leading-body) text-label-secondary">
            Tranh biện đồng đội chuẩn WSDC: hai đội PRO và CON, mỗi đội gồm 2 thành viên phát biểu luân phiên theo lượt.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-(--s-5) gap-y-(--s-2)">
          <button
            type="button"
            onClick={handleCreate2v2Session}
            disabled={isCreating2v2 || !selectedTopic}
            data-testid="create-2v2-header-btn"
            className="inline-flex h-11 cursor-pointer items-center gap-(--s-2) rounded-ap-pill bg-accent-soft px-(--s-5) text-(length:--text-callout) font-medium text-accent transition-colors hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCreating2v2 ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Swords size={16} aria-hidden="true" />}
            <span>Tạo phòng 2vs2</span>
          </button>
          <button type="button" onClick={() => setShowJoinModal(true)} className={textAction}>
            <Inbox size={16} aria-hidden="true" />
            <span>Nhập mã vào phòng</span>
          </button>
        </div>

        {/* How it goes: three quiet steps */}
        <ol className="grid grid-cols-1 gap-(--s-4) rounded-ap-xl bg-canvas-secondary p-(--s-5) sm:grid-cols-3" aria-label="Quy trình phòng 2 vs 2">
          {[
            { n: 1, title: "Chọn chủ đề", text: "Chọn kiến nghị từ hệ thống và cấu hình phòng." },
            { n: 2, title: "Tạo phòng", text: "Nhấn “Tạo phòng 2vs2 ngay” để mở phòng chờ và chia sẻ mã phòng." },
            { n: 3, title: "Bắt đầu", text: "Khi đủ 4 người (2 PRO, 2 CON), chủ phòng bấm “Bắt đầu trận tranh biện ngay”." },
          ].map((step) => (
            <li key={step.n} className="flex gap-(--s-3)">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-elevated text-(length:--text-callout) font-medium text-accent shadow-ap-sm">
                {step.n}
              </span>
              <div>
                <p className="text-(length:--text-callout) font-semibold">{step.title}</p>
                <p className="text-(length:--text-callout) leading-(--leading-body) text-label-secondary">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ─────────────  2. TOPIC & ROOM  ───────────── */}
      <section className={`${surface} space-y-(--s-5)`}>
        <div className="flex items-center justify-between gap-(--s-3)">
          <h2 className="text-(length:--text-headline) font-semibold leading-(--leading-snug)">Thiết lập chủ đề &amp; cấu hình phòng 2 vs 2</h2>
          {selectedTopic && (
            <span className="text-(length:--text-caption) text-label-tertiary">Topic ID #{selectedTopic.topicId}</span>
          )}
        </div>

        <TopicSelectCombobox
          label="Chủ đề tranh biện *"
          selectedTopicId={selectedTopic?.topicId ?? null}
          onSelect={setSelectedTopic}
          placeholder="Tìm kiếm và chọn chủ đề tranh biện 2 vs 2 từ hệ thống..."
        />

        <div className="grid grid-cols-1 gap-(--s-4) sm:grid-cols-3">
          <div>
            <label htmlFor="d2v2-title" className={labelClass}>Tên phòng (Tùy chọn)</label>
            <input
              id="d2v2-title"
              type="text"
              value={roomTitle}
              onChange={(e) => setRoomTitle(e.target.value)}
              placeholder="Mặc định dùng tên chủ đề đã chọn..."
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="d2v2-side" className={labelClass}>Phe của bạn (Host)</label>
            <select
              id="d2v2-side"
              value={selectedUserRole.startsWith("PRO") ? "PRO" : "CON"}
              onChange={(e) => setSelectedUserRole(e.target.value === "PRO" ? "PRO1" : "CON1")}
              aria-label="Phe của bạn"
              className={fieldClass}
            >
              <option value="PRO">Đội Ủng hộ (Team PRO)</option>
              <option value="CON">Đội Phản đối (Team CON)</option>
            </select>
          </div>
          <div>
            <label htmlFor="d2v2-time" className={labelClass}>Thời gian mỗi lượt (giây)</label>
            <select
              id="d2v2-time"
              value={timeLimit}
              onChange={(e) => setTimeLimit(Number(e.target.value))}
              aria-label="Thời gian mỗi lượt"
              className={fieldClass}
            >
              <option value={60}>60 giây (Nhanh)</option>
              <option value={120}>120 giây (Tiêu chuẩn)</option>
              <option value={180}>180 giây (3 phút - Khuyến nghị)</option>
              <option value={240}>240 giây (4 phút)</option>
              <option value={300}>300 giây (5 phút)</option>
            </select>
          </div>
        </div>
      </section>

      {/* ─────────────  3. TEAMS  ───────────── */}
      <section aria-label="Hai đội" className="grid grid-cols-1 items-stretch gap-(--s-4) lg:grid-cols-[1fr_auto_1fr] lg:gap-(--s-5)">
        {/* TEAM PRO */}
        <div className="flex flex-col justify-between gap-(--s-5) rounded-ap-xl bg-accent-soft p-(--s-6)">
          <div className="space-y-(--s-4)">
            <div className="flex items-center justify-between gap-(--s-3)">
              <div className="flex items-center gap-(--s-3)">
                <div className="flex h-10 w-10 items-center justify-center rounded-ap-md bg-accent text-accent-contrast">
                  <Shield size={20} aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-(length:--text-headline) font-semibold leading-(--leading-snug)">Đội Ủng Hộ (Team PRO)</h3>
                  <p className="text-(length:--text-caption) text-label-secondary">Phe khẳng định kiến nghị</p>
                </div>
              </div>
              <span className="text-(length:--text-caption) font-semibold text-accent">PRO</span>
            </div>

            {/* PRO 1: the host */}
            <div className="space-y-(--s-3) rounded-ap-lg bg-elevated p-(--s-4) shadow-ap-sm">
              <div className="flex items-center justify-between gap-(--s-3)">
                <div className="flex min-w-0 items-center gap-(--s-3)">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-(--accent) to-(--accent-2) text-(length:--text-callout) font-semibold text-accent-contrast">
                    {user?.fullName?.slice(0, 2).toUpperCase() || "NL"}
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-(--s-2) text-(length:--text-callout) font-semibold">
                      <span className="truncate">{user?.fullName || "Nguyễn Phi Long"}</span>
                      <span className="rounded-full bg-accent-soft px-2 text-(length:--text-caption) font-medium text-accent">Bạn</span>
                    </p>
                    <p className="text-(length:--text-caption) text-label-secondary">PRO 1 · Người mở đầu (First Speaker)</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsUserReady(!isUserReady)}
                  aria-pressed={isUserReady}
                  className={`inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1 rounded-full px-(--s-4) text-(length:--text-caption) font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 ${
                    isUserReady ? "bg-accent text-accent-contrast" : "bg-canvas-secondary text-label-secondary hover:text-label"
                  }`}
                >
                  {isUserReady ? <CheckCircle2 size={14} aria-hidden="true" /> : null}
                  <span>{isUserReady ? "Đã sẵn sàng" : "Chưa sẵn sàng"}</span>
                </button>
              </div>
              <p className="text-(length:--text-caption) leading-(--leading-body) text-label-secondary">
                Nhiệm vụ: Trình bày định nghĩa kiến nghị &amp; đưa ra 2 luận điểm trọng tâm ban đầu.
              </p>
            </div>

            {/* PRO 2 */}
            <div className="space-y-(--s-3) rounded-ap-lg bg-elevated/60 p-(--s-4)">
              <div className="flex items-center justify-between gap-(--s-3)">
                <div className="flex items-center gap-(--s-3)">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-canvas-secondary text-(length:--text-callout) font-medium text-label-tertiary">
                    P2
                  </div>
                  <div>
                    <p className="text-(length:--text-callout) font-semibold">Thành viên PRO 2</p>
                    <p className="text-(length:--text-caption) text-label-secondary">PRO 2 · Người phản biện &amp; Củng cố</p>
                  </div>
                </div>
                <span className={slotTag}>Chờ ghép đội</span>
              </div>
              <p className="text-(length:--text-caption) leading-(--leading-body) text-label-secondary">
                Nhiệm vụ: Trực tiếp phản bác luận điểm của CON 1 và củng cố toàn diện case PRO.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-(--s-3) text-(length:--text-callout) text-label-secondary">
            <span>Vai trò chọn:</span>
            <div className="flex items-center gap-(--s-2)">
              <button type="button" onClick={() => setSelectedUserRole("PRO1")} aria-pressed={selectedUserRole === "PRO1"} className={roleButton(selectedUserRole === "PRO1")}>
                PRO 1
              </button>
              <button type="button" onClick={() => setSelectedUserRole("PRO2")} aria-pressed={selectedUserRole === "PRO2"} className={roleButton(selectedUserRole === "PRO2")}>
                PRO 2
              </button>
            </div>
          </div>
        </div>

        {/* VS */}
        <div className="flex items-center justify-center py-(--s-2) lg:py-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-elevated text-label-secondary shadow-ap-md">
            <Swords size={20} aria-hidden="true" />
          </div>
        </div>

        {/* TEAM CON */}
        <div className="flex flex-col justify-between gap-(--s-5) rounded-ap-xl bg-ap-danger/10 p-(--s-6)">
          <div className="space-y-(--s-4)">
            <div className="flex items-center justify-between gap-(--s-3)">
              <div className="flex items-center gap-(--s-3)">
                <div className="flex h-10 w-10 items-center justify-center rounded-ap-md bg-ap-danger text-white">
                  <Flame size={20} aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-(length:--text-headline) font-semibold leading-(--leading-snug)">Đội Phản Đối (Team CON)</h3>
                  <p className="text-(length:--text-caption) text-label-secondary">Phe bác bỏ kiến nghị</p>
                </div>
              </div>
              <span className="text-(length:--text-caption) font-semibold text-label">CON</span>
            </div>

            {[
              { id: "C1", name: "Thành viên CON 1", role: "CON 1 · Người mở đầu & Bác bỏ", task: "Nhiệm vụ: Phản bác định nghĩa của PRO và đưa ra hệ thống luận điểm đối lập." },
              { id: "C2", name: "Thành viên CON 2", role: "CON 2 · Người phản biện & Kết luận", task: "Nhiệm vụ: Củng cố lập trường bên Phản đối và chốt lại luận cứ then chốt." },
            ].map((slot) => (
              <div key={slot.id} className="space-y-(--s-3) rounded-ap-lg bg-elevated/60 p-(--s-4)">
                <div className="flex items-center justify-between gap-(--s-3)">
                  <div className="flex items-center gap-(--s-3)">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-canvas-secondary text-(length:--text-callout) font-medium text-label-tertiary">
                      {slot.id}
                    </div>
                    <div>
                      <p className="text-(length:--text-callout) font-semibold">{slot.name}</p>
                      <p className="text-(length:--text-caption) text-label-secondary">{slot.role}</p>
                    </div>
                  </div>
                  <span className={slotTag}>Chờ người tham gia</span>
                </div>
                <p className="text-(length:--text-caption) leading-(--leading-body) text-label-secondary">{slot.task}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-(--s-3) text-(length:--text-callout) text-label-secondary">
            <span>Trạng thái đội CON:</span>
            <span className="font-medium text-label">Chờ ghép đội sau khi tạo phòng</span>
          </div>
        </div>
      </section>

      {/* ─────────────  4. RULES  ───────────── */}
      <section className="rounded-ap-xl bg-elevated shadow-ap-sm" aria-label="Quy cách trận đấu WSDC 2 vs 2">
        <div className="flex items-center gap-(--s-3) px-(--s-6) pt-(--s-5)">
          <Layers size={18} className="text-label-tertiary" aria-hidden="true" />
          <h2 className="text-(length:--text-headline) font-semibold leading-(--leading-snug)">Quy cách trận đấu WSDC 2 vs 2</h2>
        </div>
        <dl className="grid grid-cols-2 divide-separator p-(--s-3) sm:grid-cols-4 sm:divide-x">
          {[
            { label: "Định dạng", value: "2 vs 2 (Team Match)", accent: false },
            { label: "Thời gian mỗi lượt", value: `${timeLimit} giây`, accent: true },
            { label: "Số vòng đấu", value: "3 vòng chuẩn", accent: false },
            { label: "Giám sát & Chấm điểm", value: "AI Rubric & Giám khảo", accent: false },
          ].map((item) => (
            <div key={item.label} className="space-y-(--s-1) px-(--s-4) py-(--s-3)">
              <dt className="text-(length:--text-caption) text-label-secondary">{item.label}</dt>
              <dd className={`text-(length:--text-callout) font-semibold ${item.accent ? "text-accent" : ""}`}>{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ─────────────  5. ACTIONS  ───────────── */}
      <div className="flex flex-col items-stretch justify-between gap-(--s-3) sm:flex-row sm:items-center">
        <button type="button" onClick={() => navigate("/debater/dashboard")} className={textAction}>
          Quay lại Dashboard
        </button>

        <div className="flex flex-col items-stretch gap-(--s-3) sm:flex-row sm:items-center sm:gap-(--s-5)">
          <button type="button" onClick={() => setShowJoinModal(true)} className={`${textAction} justify-center`}>
            <Inbox size={16} aria-hidden="true" />
            <span>Nhập mã phòng</span>
          </button>
          <button
            type="button"
            onClick={handleCreate2v2Session}
            disabled={isCreating2v2 || !selectedTopic}
            data-testid="create-2v2-submit-btn"
            className="inline-flex h-12 cursor-pointer items-center justify-center gap-(--s-2) rounded-ap-pill bg-accent px-(--s-6) text-(length:--text-body) font-medium text-accent-contrast transition-[background-color,transform] duration-(--t-fast) ease-ap hover:bg-accent-hover active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCreating2v2 ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Swords size={18} aria-hidden="true" />}
            <span>Tạo phòng 2vs2 ngay</span>
          </button>
        </div>
      </div>

      {/* Modal: Tham gia phòng 2v2 bằng ID */}
      <Modal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        title="Tham gia phòng 2 vs 2"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowJoinModal(false)}>Hủy</Button>
            <Button
              variant="primary"
              size="sm"
              disabled={isJoining || !joinSessionId.trim()}
              onClick={handleJoin2v2Session}
            >
              {isJoining ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              <span>Tham gia ngay</span>
            </Button>
          </>
        }
      >
        <div className="space-y-(--s-4)">
          <p className="text-(length:--text-callout) leading-(--leading-body) text-label-secondary">
            Nhập mã ID phiên tranh biện 2 vs 2 do bạn bè hoặc người tổ chức chia sẻ. Bạn có thể chọn phe ưu tiên hoặc để hệ thống tự động cân bằng số lượng thành viên (2 PRO / 2 CON).
          </p>

          <Input
            label="Mã ID phòng (Session ID) *"
            name="joinSessionId"
            type="number"
            placeholder="Ví dụ: 15"
            value={joinSessionId}
            onChange={(e) => setJoinSessionId(e.target.value)}
            required
            autoFocus
          />

          <div>
            <label htmlFor="d2v2-join-side" className={labelClass}>Phe mong muốn tham gia</label>
            <select
              id="d2v2-join-side"
              value={joinPreferredSide ?? ""}
              onChange={(e) => setJoinPreferredSide(e.target.value ? Number(e.target.value) : undefined)}
              className={fieldClass}
            >
              <option value="">Tự động xếp cân bằng (Khuyến nghị)</option>
              <option value={SystemDebateSide.PRO}>Phe Ủng hộ (Team PRO)</option>
              <option value={SystemDebateSide.CON}>Phe Phản đối (Team CON)</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Debate2v2Lobby;

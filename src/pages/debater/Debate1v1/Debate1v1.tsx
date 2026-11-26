import React, { useState, useEffect, useMemo } from "react";
import { isTeamDebateSession } from "../../../utils/debateRoomMode";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/common/Button";
import Modal from "../../../components/common/Modal";
import Input from "../../../components/common/Input";
import Badge from "../../../components/common/Badge";
import TopicSelectCombobox, {
  SelectedTopicOption,
} from "../../../components/topic/TopicSelectCombobox";
import { readActiveDebateSession } from "../../../hooks/useDebateNavigationGuard";
import {
  Plus,
  Check,
  Swords,
  AlertCircle,
  RefreshCw,
  Loader2,
  Send,
  X,
  Inbox,
  ArrowRight,
} from "lucide-react";
import { debateApi } from "../../../api";
import {
  ChallengeResponse,
  BackendChallengeStatus,
  SystemDebateSide,
  CreateChallengeRequest,
  CreateP2pSessionRequest,
  DebateHistoryItemDto,
} from "../../../types";

const Debate1v1: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"received" | "sent" | "find" | "history">("received");
  const activeDebateSession = useMemo(() => readActiveDebateSession(), []);

  // State for Challenges
  const [receivedChallenges, setReceivedChallenges] = useState<ChallengeResponse[]>([]);
  const [sentChallenges, setSentChallenges] = useState<ChallengeResponse[]>([]);
  const [historyList, setHistoryList] = useState<DebateHistoryItemDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Create Challenge Modal / Tab State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [selectedChallengeTopic, setSelectedChallengeTopic] = useState<SelectedTopicOption | null>(null);
  const [challengerSide, setChallengerSide] = useState<number>(SystemDebateSide.PRO);
  const [timeLimit, setTimeLimit] = useState<number>(180);
  const [isSubmittingChallenge, setIsSubmittingChallenge] = useState(false);

  // P2P Direct Room State (POST /api/Debate/p2p)
  const [showCreateP2pModal, setShowCreateP2pModal] = useState(false);
  const [p2pTitle, setP2pTitle] = useState<string>("");
  const [selectedP2pTopic, setSelectedP2pTopic] = useState<SelectedTopicOption | null>(null);
  const [p2pSide, setP2pSide] = useState<number>(SystemDebateSide.PRO);
  const [p2pTimeLimit, setP2pTimeLimit] = useState<number>(180);
  const [isSubmittingP2p, setIsSubmittingP2p] = useState(false);

  // Join P2P Room by ID State (POST /api/Debate/{id}/join)
  const [showJoinP2pModal, setShowJoinP2pModal] = useState(false);
  const [joinSessionId, setJoinSessionId] = useState<string>("");
  const [isSubmittingJoin, setIsSubmittingJoin] = useState(false);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [recRes, sentRes, histRes] = await Promise.allSettled([
        debateApi.getReceivedChallenges(),
        debateApi.getSentChallenges(),
        debateApi.getUserHistory(),
      ]);

      if (recRes.status === "fulfilled" && recRes.value?.success && Array.isArray(recRes.value.data)) {
        setReceivedChallenges(recRes.value.data);
      }
      if (sentRes.status === "fulfilled" && sentRes.value?.success && Array.isArray(sentRes.value.data)) {
        setSentChallenges(sentRes.value.data);
      }
      if (histRes.status === "fulfilled" && histRes.value?.success && Array.isArray(histRes.value.data)) {
        setHistoryList(histRes.value.data);
      }
    } catch (err) {
      console.warn("Failed fetching challenge data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleCreateChallenge = async () => {
    const userIdNum = parseInt(targetUserId, 10);
    if (isNaN(userIdNum) || userIdNum <= 0 || !selectedChallengeTopic) {
      setFeedbackMsg({
        text: "Vui lòng nhập ID người nhận hợp lệ và chọn một chủ đề tranh biện từ danh sách.",
        type: "error",
      });
      return;
    }

    setIsSubmittingChallenge(true);
    try {
      const payload: CreateChallengeRequest = {
        challengedUserId: userIdNum,
        topicId: selectedChallengeTopic.topicId,
        topic: selectedChallengeTopic.topicText,
        challengerPreferredSide: challengerSide,
        turnTimeLimitSeconds: timeLimit,
      };

      const res = await debateApi.createChallenge(payload);
      if (res?.success) {
        setFeedbackMsg({ text: "Đã gửi lời mời thách đấu thành công!", type: "success" });
        setShowCreateModal(false);
        setSelectedChallengeTopic(null);
        setTargetUserId("");
        setActiveTab("sent");
        fetchAllData();
      } else {
        setFeedbackMsg({ text: res?.message || "Không thể tạo lời mời thách đấu.", type: "error" });
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setFeedbackMsg({ text: e.message || "Lỗi khi gửi lời mời thách đấu.", type: "error" });
    } finally {
      setIsSubmittingChallenge(false);
    }
  };

  const handleCreateP2pRoom = async () => {
    if (!selectedP2pTopic || !selectedP2pTopic.topicId) {
      setFeedbackMsg({ text: "Vui lòng chọn một chủ đề tranh biện hợp lệ từ danh sách.", type: "error" });
      return;
    }

    setIsSubmittingP2p(true);
    try {
      const payload: CreateP2pSessionRequest = {
        topicId: selectedP2pTopic.topicId,
        title: p2pTitle.trim() || selectedP2pTopic.title,
        topic: selectedP2pTopic.topicText,
        userSide: p2pSide,
        turnTimeLimitSeconds: p2pTimeLimit,
      };

      const res = await debateApi.createP2pSession(payload);
      if (res?.success && res.data?.sessionId) {
        setFeedbackMsg({ text: `Đã tạo phòng P2P #${res.data.sessionId}! Đang vào phòng...`, type: "success" });
        setShowCreateP2pModal(false);
        setP2pTitle("");
        setSelectedP2pTopic(null);
        navigate(`/debater/debate/${res.data.sessionId}?mode=1v1`);
      } else {
        setFeedbackMsg({ text: res?.message || "Không thể tạo phòng tranh biện P2P.", type: "error" });
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setFeedbackMsg({ text: e.message || "Lỗi khi tạo phòng tranh biện P2P.", type: "error" });
    } finally {
      setIsSubmittingP2p(false);
    }
  };

  const handleJoinP2pRoom = async () => {
    const cleanedCode = joinSessionId.trim().replace(/^#/, "").toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(cleanedCode) && !/^\d+$/.test(cleanedCode)) {
      setFeedbackMsg({ text: "Vui lòng nhập mã phòng hợp lệ (6 ký tự chữ hoặc số).", type: "error" });
      return;
    }

    setIsSubmittingJoin(true);
    try {
      const res = await debateApi.joinP2pSessionByCode(cleanedCode);
      if (res?.success && res.data?.sessionId) {
        setFeedbackMsg({ text: `Đã tham gia phòng ${res.data.roomCode || `#${res.data.sessionId}`}! Đang chuyển hướng...`, type: "success" });
        setShowJoinP2pModal(false);
        setJoinSessionId("");
        navigate(`/debater/debate/${res.data.sessionId}?mode=1v1`);
      } else {
        setFeedbackMsg({
          text:
            res?.message ||
            "Không thể tham gia phòng này (có thể phòng đã đủ người hoặc không tồn tại).",
          type: "error",
        });
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setFeedbackMsg({ text: e.message || "Lỗi khi tham gia phòng P2P.", type: "error" });
    } finally {
      setIsSubmittingJoin(false);
    }
  };

  const handleAcceptChallenge = async (challengeId: number) => {
    setActionLoadingId(challengeId);
    try {
      const res = await debateApi.acceptChallenge(challengeId);
      if (res?.success) {
        setFeedbackMsg({ text: "Đã chấp nhận thách đấu! Chuyển tới phiên tranh biện...", type: "success" });
        if (res.data?.debateSessionId) {
          navigate(`/debater/debate/${res.data.debateSessionId}?mode=1v1`);
        } else {
          fetchAllData();
        }
      } else {
        setFeedbackMsg({ text: res?.message || "Không thể chấp nhận thách đấu.", type: "error" });
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setFeedbackMsg({ text: e.message || "Lỗi khi chấp nhận thách đấu.", type: "error" });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectChallenge = async (challengeId: number) => {
    setActionLoadingId(challengeId);
    try {
      const res = await debateApi.rejectChallenge(challengeId);
      if (res?.success) {
        setFeedbackMsg({ text: "Đã từ chối lời mời thách đấu.", type: "success" });
        fetchAllData();
      } else {
        setFeedbackMsg({ text: res?.message || "Không thể từ chối thách đấu.", type: "error" });
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setFeedbackMsg({ text: e.message || "Lỗi khi từ chối thách đấu.", type: "error" });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelChallenge = async (challengeId: number) => {
    setActionLoadingId(challengeId);
    try {
      const res = await debateApi.cancelChallenge(challengeId);
      if (res?.success) {
        setFeedbackMsg({ text: "Đã hủy lời mời thách đấu thành công.", type: "success" });
        fetchAllData();
      } else {
        setFeedbackMsg({ text: res?.message || "Không thể hủy lời mời.", type: "error" });
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setFeedbackMsg({ text: e.message || "Lỗi khi hủy lời mời.", type: "error" });
    } finally {
      setActionLoadingId(null);
    }
  };

  const getChallengeStatusBadge = (status: BackendChallengeStatus | number) => {
    const base = "rounded-full px-2.5 py-0.5 text-(length:--text-caption) font-medium";
    switch (status) {
      case 1:
        return <span className={`${base} bg-ap-warning/15 text-label`}>Đang chờ phản hồi</span>;
      case 2:
        return <span className={`${base} bg-accent-soft text-accent`}>Đã chấp nhận</span>;
      case 3:
        return <span className={`${base} bg-ap-danger/10 text-label`}>Đã từ chối</span>;
      case 4:
        return <span className={`${base} bg-canvas-secondary text-label-secondary`}>Đã hủy</span>;
      case 5:
        return <span className={`${base} bg-canvas-secondary text-label-tertiary`}>Hết hạn</span>;
      default:
        return <span className={`${base} bg-canvas-secondary text-label-secondary`}>Khác</span>;
    }
  };

  const pendingReceivedCount = receivedChallenges.filter((c) => c.status === 1).length;

  const TABS = [
    { id: "received" as const, label: "Lời mời nhận được", count: pendingReceivedCount, highlight: pendingReceivedCount > 0 },
    { id: "sent" as const, label: "Thách đấu đã gửi", count: sentChallenges.length, highlight: false },
    { id: "find" as const, label: "Tạo thách đấu mới", count: null, highlight: false },
    { id: "history" as const, label: "Lịch sử đối kháng", count: historyList.length, highlight: false },
  ];

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = -1;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    if (next >= 0) {
      event.preventDefault();
      setActiveTab(TABS[next].id);
      document.getElementById(`d1v1-tab-${TABS[next].id}`)?.focus();
    }
  };

  const fieldClass =
    "h-12 w-full rounded-ap-md border border-transparent bg-canvas-secondary px-(--s-4) text-(length:--text-body) text-label placeholder:text-label-tertiary outline-none transition-[box-shadow,border-color] duration-(--t-fast) ease-ap focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/25";
  const labelClass = "mb-(--s-2) block text-(length:--text-caption) font-medium text-label-secondary";
  const card = "rounded-ap-xl bg-elevated shadow-ap-sm";
  const emptyCard = `${card} space-y-(--s-3) px-(--s-6) py-(--s-8) text-center`;
  const emptyIcon = "mx-auto flex h-14 w-14 items-center justify-center rounded-ap-lg bg-canvas-secondary text-label-tertiary";
  const textAction =
    "inline-flex min-h-11 cursor-pointer items-center gap-(--s-2) text-(length:--text-callout) font-medium text-accent hover:underline focus-visible:outline-none focus-visible:underline";
  const quietButton =
    "inline-flex h-10 cursor-pointer items-center justify-center gap-(--s-2) rounded-ap-pill px-(--s-4) text-(length:--text-callout) font-medium shadow-[inset_0_0_0_1px_var(--separator)] transition-colors duration-(--t-fast) hover:bg-canvas-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-60";
  const sideLabel = (side: number | undefined) => (side === 1 ? "Ủng hộ (PRO)" : "Phản đối (CON)");
  const formatWhen = (iso: string) =>
    new Date(iso).toLocaleDateString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

  const renderChallengeCard = (challenge: ChallengeResponse, mode: "received" | "sent") => {
    const isActionLoading = actionLoadingId === challenge.challengeId;
    const isPending = challenge.status === 1;
    const person = mode === "received" ? challenge.challenger : challenge.challenged;
    const name =
      mode === "received"
        ? person?.fullName || "Người dùng"
        : `Gửi tới: ${challenge.challenged?.fullName || `User #${challenge.challenged?.userId}`}`;
    const initial = (person?.fullName || "?").trim().charAt(0).toUpperCase() || "?";

    return (
      <article
        key={challenge.challengeId}
        className={`${card} flex flex-col gap-(--s-4) p-(--s-6) transition-shadow duration-(--t-base) hover:shadow-ap-md sm:flex-row sm:items-center sm:justify-between`}
      >
        <div className="flex min-w-0 flex-1 gap-(--s-4)">
          <div
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-(--accent) to-(--accent-2) text-(length:--text-callout) font-semibold text-accent-contrast"
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1 space-y-(--s-2)">
            <div className="flex flex-wrap items-center gap-(--s-2)">
              <span className="text-(length:--text-callout) font-semibold">{name}</span>
              <span className="text-(length:--text-caption) text-label-tertiary">({person?.email})</span>
              {getChallengeStatusBadge(challenge.status)}
            </div>
            <p className="text-(length:--text-callout) leading-(--leading-body)">&ldquo;{challenge.topic}&rdquo;</p>
            <div className="flex flex-wrap items-center gap-x-(--s-4) gap-y-1 text-(length:--text-caption) text-label-secondary">
              <span>
                {mode === "received" ? "Phe đối thủ:" : "Phe của bạn:"}{" "}
                <strong className="font-medium text-label">{sideLabel(challenge.challengerPreferredSide)}</strong>
              </span>
              <span>
                {mode === "received" ? "Thời gian lượt:" : "Giới hạn lượt:"}{" "}
                <strong className="font-medium text-label">{challenge.turnTimeLimitSeconds}s</strong>
              </span>
              <span>
                {mode === "received" ? "Gửi lúc:" : "Thời gian:"} {formatWhen(challenge.createdAt)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-(--s-2) self-end sm:self-auto">
          {isPending && mode === "received" ? (
            <>
              <Button variant="secondary" size="sm" disabled={isActionLoading} onClick={() => handleRejectChallenge(challenge.challengeId)} className="text-xs">
                Từ chối
              </Button>
              <Button variant="primary" size="sm" disabled={isActionLoading} onClick={() => handleAcceptChallenge(challenge.challengeId)} className="text-xs">
                {isActionLoading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Chấp nhận
              </Button>
            </>
          ) : isPending && mode === "sent" ? (
            <button
              type="button"
              disabled={isActionLoading}
              onClick={() => handleCancelChallenge(challenge.challengeId)}
              className={`${quietButton} text-ap-danger`}
            >
              {isActionLoading ? "Đang hủy..." : "Hủy lời mời"}
            </button>
          ) : challenge.debateSessionId ? (
            <Button variant="primary" size="sm" onClick={() => navigate(`/debater/debate/${challenge.debateSessionId}?mode=1v1`)} className="text-xs">
              Vào phòng đấu <ArrowRight size={13} />
            </Button>
          ) : null}
        </div>
      </article>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-(--s-7) pb-(--s-8) animate-fade-in motion-reduce:animate-none">
      {/* Page header: plain and large, one filled button */}
      <section className="space-y-(--s-5) pt-(--s-4)">
        <div className="max-w-[680px] space-y-(--s-2)">
          <h1 className="text-(length:--text-hero) font-bold leading-(--leading-tight) tracking-(--tracking-display)">
            Tranh biện 1 vs 1
          </h1>
          <p className="text-(length:--text-body) leading-(--leading-body) text-label-secondary">
            Thách đấu trực tiếp và quản lý lời mời tranh biện với người học khác.
          </p>
        </div>

        {/* Active / Waiting 1v1 P2P Rooms Banner */}
        {(() => {
          const active1v1Rooms = historyList.filter((item) => {
            const isP2p = item.debateType === 2 || String(item.debateType) === "P2pMatch";
            const isTeam =
              item.isTeamDebate === true ||
              (typeof item.maxParticipants === "number" && item.maxParticipants > 2) ||
              item.title?.toLowerCase().includes("2v2") ||
              item.title?.toLowerCase().includes("2 vs 2");
            const isActiveStatus =
              item.status === 1 ||
              String(item.status) === "Waiting" ||
              item.status === 2 ||
              String(item.status) === "InProgress";
            return isP2p && !isTeam && isActiveStatus;
          });

          if (active1v1Rooms.length === 0) return null;

          return (
            <div className="space-y-2.5" data-testid="active-1v1-rooms-section">
              <p className="text-xs font-bold uppercase tracking-wider text-accent">
                Phòng 1 vs 1 của bạn đang mở ({active1v1Rooms.length})
              </p>
              <div className="space-y-2">
                {active1v1Rooms.map((room) => {
                  const isWaiting = room.status === 1 || String(room.status) === "Waiting";
                  return (
                    <div
                      key={room.sessionId}
                      className="flex flex-col gap-3 rounded-ap-lg border border-accent/25 bg-accent-soft/80 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              isWaiting
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full animate-pulse ${
                                isWaiting ? "bg-amber-500" : "bg-emerald-500"
                              }`}
                            />
                            {isWaiting ? "Đang chờ đối thủ" : "Chuẩn bị / Đang thi đấu"}
                          </span>
                          <span className="rounded-md bg-elevated px-2 py-0.5 font-mono text-xs font-bold text-accent">
                            Mã phòng: {room.roomCode || `#${room.sessionId}`}
                          </span>
                          {typeof room.participantCount === "number" && (
                            <span className="text-xs text-label-secondary">
                              ({room.participantCount}/{room.maxParticipants || 2} người)
                            </span>
                          )}
                        </div>
                        <p className="truncate text-sm font-semibold text-label">
                          {room.title || room.topic}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/debater/debate/${room.sessionId}?mode=1v1`)}
                        className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-ap-pill bg-accent px-4 text-xs font-semibold text-accent-contrast transition-colors hover:bg-accent-hover"
                      >
                        <span>Vào lại phòng</span>
                        <ArrowRight size={14} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <div className="flex flex-wrap items-center gap-x-(--s-5) gap-y-(--s-2)">
          <button
            type="button"
            data-testid="open-create-p2p-1v1-modal-btn"
            onClick={() => setShowCreateP2pModal(true)}
            className="inline-flex h-12 cursor-pointer items-center gap-(--s-2) rounded-ap-pill bg-accent px-(--s-6) text-(length:--text-body) font-medium text-accent-contrast transition-[background-color,transform] duration-(--t-fast) ease-ap hover:bg-accent-hover active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/40"
          >
            <Swords size={18} aria-hidden="true" />
            <span>Tạo phòng P2P</span>
          </button>
          <button type="button" onClick={() => setShowJoinP2pModal(true)} className={textAction}>
            <Inbox size={16} aria-hidden="true" />
            <span>Nhập mã vào phòng</span>
          </button>
          <button type="button" onClick={() => setShowCreateModal(true)} className={textAction}>
            <Plus size={16} aria-hidden="true" />
            <span>Thách đấu User</span>
          </button>
          <button
            type="button"
            onClick={fetchAllData}
            disabled={loading}
            aria-label="Làm mới"
            title="Làm mới"
            className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-label-secondary transition-colors hover:bg-canvas-secondary hover:text-label focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 disabled:opacity-60"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* Notification banner */}
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

      {/* Tabs */}
      <div role="tablist" aria-label="Các mục tranh biện 1 vs 1" className="inline-flex max-w-full gap-1 overflow-x-auto rounded-ap-pill bg-canvas-secondary p-1">
        {TABS.map((tab, index) => (
          <button
            key={tab.id}
            id={`d1v1-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`d1v1-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(e) => onTabKeyDown(e, index)}
            className={`inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-(--s-2) rounded-ap-pill px-(--s-4) text-(length:--text-callout) font-medium transition-[background-color,box-shadow,color] duration-(--t-base) ease-ap focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 ${
              activeTab === tab.id ? "bg-elevated text-label shadow-ap-sm" : "text-label-secondary hover:text-label"
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== null && tab.count > 0 && (
              <span
                className={`rounded-full px-2 text-(length:--text-caption) ${
                  tab.highlight ? "bg-accent text-accent-contrast" : "bg-accent-soft text-accent"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Lời mời nhận được ── */}
      {activeTab === "received" && (
        <div id="d1v1-panel-received" role="tabpanel" aria-labelledby="d1v1-tab-received" className="space-y-(--s-4)">
          {loading ? (
            <div role="status" className={emptyCard}>
              <Loader2 size={28} className="mx-auto animate-spin text-accent" aria-hidden="true" />
              <p className="text-(length:--text-callout) font-medium">Đang tải lời mời thách đấu...</p>
            </div>
          ) : receivedChallenges.length === 0 ? (
            <div className={emptyCard}>
              <div className={emptyIcon}>
                <Inbox size={26} aria-hidden="true" />
              </div>
              <p className="text-(length:--text-callout) font-semibold">Hiện chưa có lời mời thách đấu nào gửi tới bạn.</p>
              <p className="text-(length:--text-callout) text-label-secondary">Bạn có thể chủ động tạo lời thách đấu gửi tới người học khác!</p>
            </div>
          ) : (
            <div className="grid gap-(--s-3)">{receivedChallenges.map((c) => renderChallengeCard(c, "received"))}</div>
          )}
        </div>
      )}

      {/* ── Tab 2: Thách đấu đã gửi ── */}
      {activeTab === "sent" && (
        <div id="d1v1-panel-sent" role="tabpanel" aria-labelledby="d1v1-tab-sent" className="space-y-(--s-4)">
          {loading ? (
            <div role="status" className={emptyCard}>
              <Loader2 size={28} className="mx-auto animate-spin text-accent" aria-hidden="true" />
              <p className="text-(length:--text-callout) font-medium">Đang tải thách đấu đã gửi...</p>
            </div>
          ) : sentChallenges.length === 0 ? (
            <div className={emptyCard}>
              <div className={emptyIcon}>
                <Send size={26} aria-hidden="true" />
              </div>
              <p className="text-(length:--text-callout) font-semibold">Bạn chưa gửi lời mời thách đấu nào.</p>
              <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)} className="mt-2">
                Tạo lời thách đấu ngay
              </Button>
            </div>
          ) : (
            <div className="grid gap-(--s-3)">{sentChallenges.map((c) => renderChallengeCard(c, "sent"))}</div>
          )}
        </div>
      )}

      {/* ── Tab 3: Tạo thách đấu mới ── */}
      {activeTab === "find" && (
        <div id="d1v1-panel-find" role="tabpanel" aria-labelledby="d1v1-tab-find" className={`${card} mx-auto max-w-2xl space-y-(--s-5) p-(--s-6) sm:p-(--s-7)`}>
          <div>
            <h2 className="text-(length:--text-headline) font-semibold leading-(--leading-snug)">Thiết lập lời mời thách đấu 1 vs 1</h2>
            <p className="mt-(--s-1) text-(length:--text-callout) text-label-secondary">
              Nhập ID người dùng và chọn chủ đề từ ngân hàng đề để thách đấu trực tiếp.
            </p>
          </div>

          <div className="space-y-(--s-4)">
            <div>
              <label htmlFor="d1v1-target" className={labelClass}>
                ID Người nhận thách đấu (User ID)<span className="sr-only"> (bắt buộc)</span>
              </label>
              <input
                id="d1v1-target"
                type="number"
                placeholder="Ví dụ: 4 (hoặc ID của bạn bè)"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className={fieldClass}
              />
            </div>

            <TopicSelectCombobox
              selectedTopicId={selectedChallengeTopic?.topicId ?? null}
              onSelect={setSelectedChallengeTopic}
              label="Chủ đề tranh biện"
              placeholder="Chọn chủ đề tranh biện từ danh sách..."
              required
            />

            <div className="grid grid-cols-1 gap-(--s-3) sm:grid-cols-2">
              <div>
                <label htmlFor="d1v1-side" className={labelClass}>Phe của bạn</label>
                <select id="d1v1-side" value={challengerSide} onChange={(e) => setChallengerSide(Number(e.target.value))} className={fieldClass}>
                  <option value={SystemDebateSide.PRO}>Ủng hộ (PRO)</option>
                  <option value={SystemDebateSide.CON}>Phản đối (CON)</option>
                </select>
              </div>
              <div>
                <label htmlFor="d1v1-time" className={labelClass}>Thời gian mỗi lượt</label>
                <select id="d1v1-time" value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))} className={fieldClass}>
                  <option value={120}>2 phút (120 giây)</option>
                  <option value={180}>3 phút (180 giây)</option>
                  <option value={240}>4 phút (240 giây)</option>
                  <option value={300}>5 phút (300 giây)</option>
                </select>
              </div>
            </div>

            <Button
              variant="primary"
              size="md"
              disabled={isSubmittingChallenge || !targetUserId || !selectedChallengeTopic}
              onClick={handleCreateChallenge}
              className="mt-2 w-full"
            >
              {isSubmittingChallenge ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              <span>Gửi lời mời thách đấu</span>
            </Button>
          </div>
        </div>
      )}

      {/* ── Tab 4: Lịch sử đối kháng ── */}
      {activeTab === "history" && (
        <div id="d1v1-panel-history" role="tabpanel" aria-labelledby="d1v1-tab-history" className="space-y-(--s-4)">
          {historyList.length === 0 ? (
            <div className={emptyCard}>
              <div className={emptyIcon}>
                <Swords size={26} aria-hidden="true" />
              </div>
              <p className="text-(length:--text-callout) font-semibold">Chưa có trận đấu đối kháng P2P/1v1 nào hoàn thành.</p>
              <p className="text-(length:--text-callout) text-label-secondary">Hãy gửi thách đấu hoặc chấp nhận lời mời để bắt đầu thi đấu.</p>
            </div>
          ) : (
            <div className={`${card} overflow-x-auto`}>
              <table className="w-full text-left text-(length:--text-callout)">
                <thead>
                  <tr className="border-b border-separator text-(length:--text-caption) font-medium uppercase tracking-wider text-label-secondary">
                    <th className="px-(--s-5) py-(--s-3) font-medium">Mã / Chủ đề</th>
                    <th className="px-(--s-5) py-(--s-3) font-medium">Hình thức</th>
                    <th className="px-(--s-5) py-(--s-3) font-medium">Phe</th>
                    <th className="px-(--s-5) py-(--s-3) font-medium">Ngày đấu</th>
                    <th className="px-(--s-5) py-(--s-3) text-right font-medium">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-separator">
                  {historyList.map((item) => (
                    <tr key={item.sessionId} className="transition-colors hover:bg-canvas-secondary">
                      <td className="max-w-sm px-(--s-5) py-(--s-4)">
                        <div className="font-semibold">{item.title || item.topic}</div>
                        <div className="text-(length:--text-caption) text-label-tertiary">#{item.sessionId}</div>
                      </td>
                      <td className="whitespace-nowrap px-(--s-5) py-(--s-4) text-label-secondary">
                        {isTeamDebateSession({
                          isTeamDebate: item.isTeamDebate,
                          maxParticipants: item.maxParticipants,
                          title: item.title,
                        })
                          ? "Đồng đội 2v2"
                          : item.debateType === 3
                            ? "Thách đấu 1v1"
                            : "P2P Trực tiếp"}
                      </td>
                      <td className="whitespace-nowrap px-(--s-5) py-(--s-4)">
                        <Badge variant={item.userSide === 1 ? "primary" : "secondary"}>{sideLabel(item.userSide)}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-(--s-5) py-(--s-4) text-label-secondary">
                        {new Date(item.createdAt).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="px-(--s-5) py-(--s-4) text-right">
                        <Button
                          variant={item.status === 2 ? "primary" : "secondary"}
                          size="sm"
                          onClick={() => navigate(`/debater/debate/${item.sessionId}?mode=1v1`)}
                          className="text-xs"
                        >
                          {item.status === 2 ? "Tiếp tục trận tranh biện" : "Vào phòng"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Quick Create Challenge */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Gửi thách đấu 1 vs 1"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowCreateModal(false)}>
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={isSubmittingChallenge || !targetUserId || !selectedChallengeTopic}
              onClick={handleCreateChallenge}
            >
              {isSubmittingChallenge ? "Đang gửi..." : "Gửi lời mời"}
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <Input
            label="ID Người được thách đấu (User ID)"
            name="targetUserId"
            type="number"
            placeholder="Ví dụ: 4"
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            required
          />
          <TopicSelectCombobox
            selectedTopicId={selectedChallengeTopic?.topicId ?? null}
            onSelect={setSelectedChallengeTopic}
            label="Chủ đề tranh biện"
            placeholder="Chọn chủ đề từ ngân hàng đề..."
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Phe của bạn</label>
              <select
                value={challengerSide}
                onChange={(e) => setChallengerSide(Number(e.target.value))}
                className={fieldClass}
              >
                <option value={SystemDebateSide.PRO}>Ủng hộ (PRO)</option>
                <option value={SystemDebateSide.CON}>Phản đối (CON)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Thời gian mỗi lượt</label>
              <select
                value={timeLimit}
                onChange={(e) => setTimeLimit(Number(e.target.value))}
                className={fieldClass}
              >
                <option value={120}>2 phút (120s)</option>
                <option value={180}>3 phút (180s)</option>
                <option value={240}>4 phút (240s)</option>
                <option value={300}>5 phút (300s)</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal 1: Tạo phòng P2P 1 vs 1 (Clean & Compact with Real Topics API Selection) */}
      <Modal
        isOpen={showCreateP2pModal}
        onClose={() => setShowCreateP2pModal(false)}
        title="Khởi tạo phòng P2P (1 vs 1)"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowCreateP2pModal(false)}>
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              data-testid="submit-create-p2p-1v1-btn"
              disabled={isSubmittingP2p || !selectedP2pTopic}
              onClick={handleCreateP2pRoom}
            >
              {isSubmittingP2p ? <Loader2 size={15} className="animate-spin" /> : <Swords size={15} />}
              <span>Tạo phòng ngay</span>
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <div className="rounded-ap-md bg-accent-soft p-(--s-3) text-(length:--text-callout) leading-(--leading-body) text-label">
            Phòng P2P khởi tạo ở trạng thái <strong>Chờ đối thủ (Waiting)</strong>. Sau khi tạo, chia sẻ Mã phòng cho đối phương và bấm bắt đầu khi đủ 2 người.
          </div>

          <TopicSelectCombobox
            selectedTopicId={selectedP2pTopic?.topicId ?? null}
            onSelect={setSelectedP2pTopic}
            label="Chủ đề / Kiến nghị tranh biện"
            placeholder="Chọn chủ đề từ ngân hàng đề..."
            required
          />

          <Input
            label="Tiêu đề phòng (Tùy chọn)"
            name="p2pTitle"
            placeholder="Mặc định lấy theo tiêu đề chủ đề đã chọn..."
            value={p2pTitle}
            onChange={(e) => setP2pTitle(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>
                Phe bạn chọn (Host)
              </label>
              <select
                value={p2pSide}
                onChange={(e) => setP2pSide(Number(e.target.value))}
                className={fieldClass}
              >
                <option value={SystemDebateSide.PRO}>Ủng hộ (PRO)</option>
                <option value={SystemDebateSide.CON}>Phản đối (CON)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>
                Thời gian mỗi lượt
              </label>
              <select
                value={p2pTimeLimit}
                onChange={(e) => setP2pTimeLimit(Number(e.target.value))}
                className={fieldClass}
              >
                <option value={60}>1 phút (60s)</option>
                <option value={120}>2 phút (120s)</option>
                <option value={180}>3 phút (180s - Tiêu chuẩn)</option>
                <option value={240}>4 phút (240s)</option>
                <option value={300}>5 phút (300s)</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal 2: Tham gia phòng P2P bằng ID */}
      <Modal
        isOpen={showJoinP2pModal}
        onClose={() => setShowJoinP2pModal(false)}
        title="Tham gia phòng P2P bằng Mã phòng"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowJoinP2pModal(false)}>
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={isSubmittingJoin || !joinSessionId.trim()}
              onClick={handleJoinP2pRoom}
            >
              {isSubmittingJoin ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ArrowRight size={16} />
              )}
              <span>Tham gia ngay</span>
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-(length:--text-callout) leading-(--leading-body) text-label-secondary">
            Nhập mã ID phòng tranh biện (do người tạo phòng cung cấp). Hệ thống sẽ tự động xếp bạn vào phe đối diện với chủ phòng.
          </p>
          <Input
            label="Mã phòng (6 ký tự chữ hoặc số) *"
            name="joinSessionId"
            type="text"
            maxLength={6}
            placeholder="Ví dụ: A7K9P2"
            value={joinSessionId}
            onChange={(e) => setJoinSessionId(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())}
            required
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
};

export default Debate1v1;

import React, { useState } from "react";
import {
  X,
  Sparkles,
  Lightbulb,
  Award,
  BookOpen,
  Users,
  Gavel,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Shield,
  Flame,
} from "lucide-react";
import RebuttalSuggestion, { RebuttalTips } from "./RebuttalSuggestion";
import AICoachingPanel, { CoachingAdvice } from "./AICoachingPanel";
import { CRITERION_MAX_SCORE, OVERALL_MAX_SCORE } from "../../utils/debateScoring";
import {
  DebateRoomMode,
  DebateRoleInRoom,
  DebateTeamGroup,
  CaseFileResponse,
  ArgumentEvaluationResult,
  CompetitionMatchDetail,
} from "../../types";

export interface DebateSidebarProps {
  isOpen: boolean;
  mode: DebateRoomMode;
  userRoleInRoom?: DebateRoleInRoom;
  activeTab: string;
  proTeam: DebateTeamGroup;
  conTeam: DebateTeamGroup;
  currentRound: number;
  casePlan: CaseFileResponse | null;
  evaluationResult: ArgumentEvaluationResult | null;
  isEvaluating?: boolean;
  evaluatorError?: string | null;
  rebuttalTips?: RebuttalTips | null;
  coachingAdvice?: CoachingAdvice[];
  competitionMatch?: CompetitionMatchDetail | null;
  onTabChange: (tab: string) => void;
  onClose: () => void;
  onRequestCoaching?: () => void;
  onSubmitJudgeScore?: (scores: { logic: number; evidence: number; delivery: number; notes: string }) => void;
}

const DebateSidebar: React.FC<DebateSidebarProps> = ({
  isOpen,
  mode,
  userRoleInRoom = "Debater",
  activeTab,
  proTeam,
  conTeam,
  currentRound: _currentRound,
  casePlan,
  evaluationResult,
  isEvaluating = false,
  evaluatorError,
  rebuttalTips,
  coachingAdvice,
  competitionMatch,
  onTabChange,
  onClose,
  onRequestCoaching,
  onSubmitJudgeScore,
}) => {
  // Judge scoring state
  const [judgeLogicScore, setJudgeLogicScore] = useState(8);
  const [judgeEvidenceScore, setJudgeEvidenceScore] = useState(8);
  const [judgeDeliveryScore, setJudgeDeliveryScore] = useState(8);
  const [judgeNotes, setJudgeNotes] = useState("");
  const [judgeSubmitted, setJudgeSubmitted] = useState(false);

  const isJudge = userRoleInRoom === "Judge";

  // Tab definitions according to mode
  const getTabs = () => {
    if (mode === "ai") {
      return [
        { id: "coach", label: "AI Coach", icon: Lightbulb },
        { id: "evaluator", label: "Đánh giá", icon: Award },
        { id: "caseplan", label: "Case Plan", icon: BookOpen },
      ];
    }
    if (mode === "competition") {
      return [
        { id: "teams", label: "Đội hình", icon: Users },
        { id: "judge", label: isJudge ? "Chấm điểm" : "Giám khảo", icon: Gavel },
        { id: "coach", label: "Chiến thuật", icon: Lightbulb },
      ];
    }
    // 1v1 or 2v2
    return [
      { id: "teams", label: "Đội hình", icon: Users },
      { id: "evaluator", label: "Đánh giá", icon: Award },
      { id: "coach", label: "Chiến thuật", icon: Lightbulb },
    ];
  };

  const tabs = getTabs();

  const handleJudgeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmitJudgeScore) {
      onSubmitJudgeScore({
        logic: judgeLogicScore,
        evidence: judgeEvidenceScore,
        delivery: judgeDeliveryScore,
        notes: judgeNotes,
      });
    }
    setJudgeSubmitted(true);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed lg:static top-0 right-0 bottom-0 z-50 lg:z-auto
          w-[340px] sm:w-[380px] xl:w-[400px] h-full bg-white dark:bg-[#0E1E18] border-l border-slate-200 dark:border-[rgba(148,163,184,0.18)]
          flex flex-col transition-all duration-300 ease-in-out shadow-xl lg:shadow-none
          ${isOpen ? "translate-x-0" : "translate-x-full lg:hidden"}
        `}
      >
        {/* Sidebar Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-[#008A64] dark:text-[#34D399]" />
            <h2 className="font-bold text-[16px] text-slate-900 dark:text-[#F8FAFC]">
              {mode === "competition"
                ? "Bảng điều khiển Trận đấu"
                : mode === "ai"
                ? "Trợ lý tranh biện AI"
                : "Thông tin & Hỗ trợ trận đấu"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#172C23] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
          <div className={`grid grid-cols-${tabs.length} gap-1 bg-slate-100 dark:bg-[#091713] p-1 rounded-xl text-xs font-bold`}>
            {tabs.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTabChange(t.id)}
                  className={`py-2 px-1 rounded-lg text-center transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                    isActive
                      ? "bg-white dark:bg-[#163529] text-[#008A64] dark:text-[#34D399] shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  <Icon size={13} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* TAB: TEAMS (Đội hình 1v1 / 2v2 / Competition) */}
          {activeTab === "teams" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-[#F8FAFC] pb-2 border-b border-slate-100 dark:border-slate-800/80 text-[15px]">
                <Users size={18} className="text-[#008A64]" />
                <span>Danh sách thành viên hai đội</span>
              </div>

              {/* Team PRO */}
              <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-[rgba(16,185,129,0.08)] border border-emerald-200/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-[#008A64] dark:text-[#34D399] text-xs">
                    <Shield size={14} />
                    <span>{proTeam.teamName}</span>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold">
                    PRO
                  </span>
                </div>
                <div className="space-y-2">
                  {proTeam.members.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-white dark:bg-[#12231C] border border-emerald-100 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-[#F8FAFC]">
                          {m.speakerName} {m.isCurrentUser && "(Bạn)"}
                        </p>
                        <p className="text-[11px] text-slate-500">{m.roleTag || `Thành viên ${idx + 1}`}</p>
                      </div>
                      {m.hasSpokenInCurrentRound ? (
                        <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 size={11} /> Đã phát biểu
                        </span>
                      ) : m.isSpeakingNow ? (
                        <span className="text-[10px] text-emerald-600 font-bold animate-pulse">
                          Đang phát biểu
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Chờ lượt</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Team CON */}
              <div className="p-3.5 rounded-xl bg-rose-50/60 dark:bg-[rgba(244,63,94,0.08)] border border-rose-200/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-400 text-xs">
                    <Flame size={14} />
                    <span>{conTeam.teamName}</span>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 font-semibold">
                    CON
                  </span>
                </div>
                <div className="space-y-2">
                  {conTeam.members.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-white dark:bg-[#12231C] border border-rose-100 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-[#F8FAFC]">
                          {m.speakerName} {m.isCurrentUser && "(Bạn)"}
                        </p>
                        <p className="text-[11px] text-slate-500">{m.roleTag || `Thành viên ${idx + 1}`}</p>
                      </div>
                      {m.hasSpokenInCurrentRound ? (
                        <span className="text-[10px] text-rose-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 size={11} /> Đã phát biểu
                        </span>
                      ) : m.isSpeakingNow ? (
                        <span className="text-[10px] text-rose-600 font-bold animate-pulse">
                          Đang phát biểu
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Chờ lượt</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Speaker Order Timeline (2vs2) */}
              {(mode === "2v2" || mode === "competition") && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#091713] border border-slate-200/80 dark:border-slate-800 space-y-2.5 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-[#F8FAFC]">
                    <Clock size={14} className="text-[#008A64]" />
                    <span>Thứ tự lượt phát biểu 2vs2 (WSDC flow):</span>
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between p-1.5 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-medium">
                      <span>Vòng 1 (Mở đầu):</span>
                      <span className="font-bold">PRO 1 ➔ CON 1</span>
                    </div>
                    <div className="flex items-center justify-between p-1.5 rounded bg-purple-50 dark:bg-purple-950/30 text-purple-800 dark:text-purple-300 font-medium">
                      <span>Vòng 2 (Phản biện):</span>
                      <span className="font-bold">PRO 2 ➔ CON 2</span>
                    </div>
                    <div className="flex items-center justify-between p-1.5 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 font-medium">
                      <span>Vòng 3 (Kết luận):</span>
                      <span className="font-bold">CON 1 ➔ PRO 1</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 italic">
                    * Lượt phát biểu thực tế được điều phối bởi dữ liệu Backend khi trận đấu diễn ra.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB: JUDGE (Giám khảo trong Competition) */}
          {activeTab === "judge" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-[#F8FAFC] pb-2 border-b border-slate-100 dark:border-slate-800/80 text-[15px]">
                <Gavel size={18} className="text-amber-600" />
                <span>Hội đồng Giám khảo & Đánh giá</span>
              </div>

              {/* Judges Roster */}
              {competitionMatch?.judges && competitionMatch.judges.length > 0 ? (
                <div className="p-3 bg-slate-50 dark:bg-[#091713] rounded-xl border border-slate-200/80 space-y-2 text-xs">
                  <p className="font-bold text-slate-700 dark:text-slate-300">Danh sách giám khảo:</p>
                  <ul className="space-y-1">
                    {competitionMatch.judges.map((j, i) => (
                      <li key={i} className="flex items-center justify-between">
                        <span>{j.fullName}</span>
                        {j.isCurrentUser && (
                          <span className="text-amber-600 font-bold text-[10px]">(Bạn)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 dark:bg-[#091713] rounded-xl border border-slate-200/80 text-xs text-slate-500">
                  Chưa có thông tin danh sách giám khảo được chỉ định từ ban tổ chức.
                </div>
              )}

              {/* If current user is Judge -> show Judge Scoring Form */}
              {isJudge ? (
                <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-[rgba(245,158,11,0.08)] border border-amber-200/80 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300 text-xs uppercase tracking-wider">
                    <Award size={14} />
                    <span>Phiếu chấm điểm Giám khảo</span>
                  </div>

                  {judgeSubmitted ? (
                    <div className="py-4 text-center text-xs space-y-1 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 size={24} className="mx-auto text-emerald-600" />
                      <p className="font-bold">Đã nộp phiếu chấm điểm thành công!</p>
                      <p className="text-slate-500">Kết quả đã được ghi nhận vào hệ thống giải đấu.</p>
                    </div>
                  ) : (
                    <form onSubmit={handleJudgeSubmit} className="space-y-3 text-xs">
                      <div>
                        <div className="flex justify-between font-semibold mb-1">
                          <span>Logic & Lập luận:</span>
                          <span className="text-amber-700 font-bold">{judgeLogicScore}/10</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={judgeLogicScore}
                          onChange={(e) => setJudgeLogicScore(Number(e.target.value))}
                          className="w-full accent-amber-600 cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between font-semibold mb-1">
                          <span>Dẫn chứng & Bằng chứng:</span>
                          <span className="text-amber-700 font-bold">{judgeEvidenceScore}/10</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={judgeEvidenceScore}
                          onChange={(e) => setJudgeEvidenceScore(Number(e.target.value))}
                          className="w-full accent-amber-600 cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between font-semibold mb-1">
                          <span>Thuyết phục & Trình bày:</span>
                          <span className="text-amber-700 font-bold">{judgeDeliveryScore}/10</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={judgeDeliveryScore}
                          onChange={(e) => setJudgeDeliveryScore(Number(e.target.value))}
                          className="w-full accent-amber-600 cursor-pointer"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                          Nhận xét & Phán quyết:
                        </label>
                        <textarea
                          rows={3}
                          value={judgeNotes}
                          onChange={(e) => setJudgeNotes(e.target.value)}
                          placeholder="Nhập nhận xét chi tiết cho hai bên..."
                          className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12231C] text-xs resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Send size={13} />
                        <span>Xác nhận chấm điểm</span>
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 dark:bg-[#091713] rounded-xl border border-slate-200/80 text-xs text-slate-500">
                  Chỉ thành viên thuộc Ban Giám khảo mới có quyền chấm điểm trận đấu.
                </div>
              )}
            </div>
          )}

          {/* TAB: COACH / CHIẾN THUẬT */}
          {activeTab === "coach" && (
            <div className="space-y-4">
              <RebuttalSuggestion tips={rebuttalTips} />
              <AICoachingPanel
                costPerUse={2000}
                advice={coachingAdvice}
                onRequestCoaching={onRequestCoaching}
                isLoading={isEvaluating}
              />
            </div>
          )}

          {/* TAB: EVALUATOR (Đánh giá) */}
          {activeTab === "evaluator" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-[#F8FAFC] text-[15px]">
                  <Award size={18} className="text-[#008A64]" />
                  <span>Đánh giá & Chấm điểm</span>
                </div>
                {isEvaluating && (
                  <span className="text-xs text-[#008A64] font-semibold animate-pulse">
                    Đang chấm điểm...
                  </span>
                )}
              </div>

              {evaluatorError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{evaluatorError}</span>
                </div>
              )}

              {!evaluationResult ? (
                <div className="py-12 text-center text-slate-400 space-y-2.5">
                  <Award size={36} className="mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Chưa có kết quả chấm điểm
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed px-4">
                    Sau khi bạn gửi lập luận, hệ thống sẽ tự động phân tích theo rubric 5 tiêu chí: Logic, Dẫn chứng, Liên quan, Cấu trúc, Thuyết phục.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Overall Score */}
                  <div className="p-4 bg-[#ECFDF5] dark:bg-[rgba(16,185,129,0.12)] border border-[#008A64]/30 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#008A64] uppercase tracking-wider">
                        Điểm tổng kết
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-snug">
                        {evaluationResult.overall_reasoning}
                      </p>
                    </div>
                    <div className="text-2xl font-black text-[#008A64] dark:text-[#34D399] shrink-0 pl-3">
                      {evaluationResult.overall_score}/{OVERALL_MAX_SCORE}
                    </div>
                  </div>

                  {/* 5 Criteria */}
                  {evaluationResult.criteria && evaluationResult.criteria.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Chi tiết rubric
                      </p>
                      <div className="space-y-2">
                        {evaluationResult.criteria.map((c, i) => (
                          <div
                            key={i}
                            className="p-3 bg-slate-50 dark:bg-[#091713] rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                              <span>{c.name}</span>
                              <span className="text-[#008A64]">{c.score}/{c.max_score ?? CRITERION_MAX_SCORE}</span>
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                              {c.reasoning}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Strengths & Weaknesses */}
                  {evaluationResult.strengths?.length > 0 && (
                    <div className="space-y-1.5 p-3 rounded-xl bg-emerald-50/60 dark:bg-[rgba(16,185,129,0.08)] border border-emerald-200/60">
                      <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400">
                        Điểm mạnh:
                      </p>
                      <ul className="text-xs space-y-1 text-slate-700 dark:text-slate-300 list-disc list-inside">
                        {evaluationResult.strengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {evaluationResult.weaknesses?.length > 0 && (
                    <div className="space-y-1.5 p-3 rounded-xl bg-rose-50/60 dark:bg-[rgba(244,63,94,0.08)] border border-rose-200/60">
                      <p className="text-xs font-bold text-rose-800 dark:text-rose-400">
                        Cần cải thiện:
                      </p>
                      <ul className="text-xs space-y-1 text-slate-700 dark:text-slate-300 list-disc list-inside">
                        {evaluationResult.weaknesses.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB: CASE PLAN */}
          {activeTab === "caseplan" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-[#F8FAFC] pb-2 border-b border-slate-100 dark:border-slate-800/80 text-[15px]">
                <BookOpen size={18} className="text-[#008A64]" />
                <span>Hồ sơ lập luận AI (Case Plan)</span>
              </div>

              {!casePlan ? (
                <div className="py-12 text-center text-slate-400 space-y-2.5">
                  <BookOpen size={36} className="mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Chưa có Case Plan
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed px-4">
                    Case Plan được AI Opponent Service sinh ra trong giai đoạn chuẩn bị (Planning).
                  </p>
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  {(casePlan.content?.motion_reading || (casePlan.content as any)?.case_summary) && (
                    <div className="p-3.5 bg-slate-50 dark:bg-[#091713] rounded-xl border border-slate-200/80 space-y-1">
                      <p className="font-bold text-slate-800 dark:text-slate-200">Định nghĩa phạm vi &amp; Bối cảnh:</p>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                        {casePlan.content?.motion_reading || (casePlan.content as any)?.case_summary}
                      </p>
                    </div>
                  )}

                  {casePlan.content?.definitions && casePlan.content.definitions.length > 0 && (
                    <div className="p-3.5 bg-slate-50 dark:bg-[#091713] rounded-xl border border-slate-200/80 space-y-2">
                      <p className="font-bold text-slate-800 dark:text-slate-200">Thuật ngữ cốt lõi:</p>
                      <div className="space-y-1.5">
                        {casePlan.content.definitions.map((def, idx) => (
                          <p key={idx} className="text-slate-600 dark:text-slate-400">
                            <span className="font-semibold text-[#008A64]">{def.term}:</span> {def.meaning}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {casePlan.content?.arguments && casePlan.content.arguments.length > 0 && (
                    <div className="space-y-2.5">
                      <p className="font-bold text-slate-800 dark:text-slate-200">Các luận điểm chính của AI:</p>
                      {casePlan.content.arguments.map((arg) => (
                        <div
                          key={arg.id}
                          className="p-3.5 bg-slate-50 dark:bg-[#091713] rounded-xl border border-slate-200/80 space-y-1.5"
                        >
                          <p className="font-bold text-[#008A64]">
                            {arg.id}: {arg.title}
                          </p>
                          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                            <span className="font-semibold">Luận điểm:</span> {arg.claim}
                          </p>
                          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                            <span className="font-semibold">Lý lẽ:</span> {arg.reasoning}
                          </p>
                          {arg.example && (
                            <p className="italic text-slate-500 dark:text-slate-400 leading-relaxed">
                              <span className="font-semibold">Ví dụ:</span> {arg.example}
                            </p>
                          )}
                          {arg.impact && (
                            <p className="text-emerald-700 dark:text-emerald-400 leading-relaxed">
                              <span className="font-semibold">Tác động:</span> {arg.impact}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {!casePlan.content?.arguments &&
                    Array.isArray((casePlan.content as any)?.main_points) && (
                      <div className="space-y-2.5">
                        <p className="font-bold text-slate-800 dark:text-slate-200">Các luận điểm chính của AI:</p>
                        {(casePlan.content as any).main_points.map(
                          (pt: { title: string; description: string }, idx: number) => (
                            <div
                              key={idx}
                              className="p-3.5 bg-slate-50 dark:bg-[#091713] rounded-xl border border-slate-200/80 space-y-1"
                            >
                              <p className="font-bold text-[#008A64]">{pt.title}</p>
                              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                                {pt.description}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    )}

                  {casePlan.content?.anticipated_opponent_arguments &&
                    casePlan.content.anticipated_opponent_arguments.length > 0 && (
                      <div className="space-y-2.5">
                        <p className="font-bold text-slate-800 dark:text-slate-200">
                          Dự đoán phản biện của đối phương:
                        </p>
                        {casePlan.content.anticipated_opponent_arguments.map((item) => (
                          <div
                            key={item.id}
                            className="p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200/60 dark:border-amber-800/40 space-y-1.5"
                          >
                            <p className="font-semibold text-amber-800 dark:text-amber-300">
                              <span className="font-bold">Dự đoán bạn sẽ nói:</span> {item.learner_claim}
                            </p>
                            <p className="text-slate-600 dark:text-slate-300">
                              <span className="font-semibold text-slate-700 dark:text-slate-200">
                                AI chuẩn bị phản bác:
                              </span>{" "}
                              {item.planned_response}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                  {!casePlan.content?.anticipated_opponent_arguments &&
                    Array.isArray((casePlan.content as any)?.predicted_learner_arguments) && (
                      <div className="space-y-2.5">
                        <p className="font-bold text-slate-800 dark:text-slate-200">
                          Dự đoán phản biện của đối phương:
                        </p>
                        {(casePlan.content as any).predicted_learner_arguments.map(
                          (item: { point: string; planned_rebuttal: string }, idx: number) => (
                            <div
                              key={idx}
                              className="p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200/60 dark:border-amber-800/40 space-y-1.5"
                            >
                              <p className="font-semibold text-amber-800 dark:text-amber-300">
                                <span className="font-bold">Dự đoán bạn sẽ nói:</span> {item.point}
                              </p>
                              <p className="text-slate-600 dark:text-slate-300">
                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                  AI chuẩn bị phản bác:
                                </span>{" "}
                                {item.planned_rebuttal}
                              </p>
                            </div>
                          )
                        )}
                      </div>
                    )}

                  {casePlan.content?.weighing && (
                    <div className="p-3.5 bg-slate-50 dark:bg-[#091713] rounded-xl border border-slate-200/80 space-y-1">
                      <p className="font-bold text-slate-800 dark:text-slate-200">Cân nhắc tác động (Weighing):</p>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                        {casePlan.content.weighing}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default DebateSidebar;

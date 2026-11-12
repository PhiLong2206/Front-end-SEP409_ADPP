import React, { useEffect, useState } from "react";
import { useNavigate, Link, useLocation, useParams } from "react-router-dom";
import {
  Trophy,
  Swords,
  AlertCircle,
  Clock,
  FileText,
  Gavel,
  Target,
  CheckCircle2,
  RotateCcw,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { debateApi } from "../../../api";
import { useAuth } from "../../../hooks/useAuth";
import { isSameUserId } from "../../../utils/debateSpeaker";

export interface PlayerResult {
  name: string;
  avatar: string;
  role: "PRO" | "CON" | string;
  score: number;
}

export interface MatchResultDetail {
  id: string;
  topic: string;
  date: string;
  duration: string;
  rules: string;
  result: "WIN" | "LOSE" | "DRAW";
  playerA: PlayerResult;
  playerB: PlayerResult;
  scores: Record<string, number>;
  opponentScores: Record<string, number>;
  aiJudgeVerdict: string;
  judgeComments: string[];
  myStrengths: string[];
  myImprovements: string[];
  feedback?: string[];
}

function ScoreBar({ label, myScore, theirScore }: { label: string; myScore: number; theirScore: number }) {
  const maxPct = 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
        <span>{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-black text-[#008A64]">{myScore}</span>
          <span className="text-slate-300">vs</span>
          <span className="font-black text-rose-500">{theirScore}</span>
        </div>
      </div>
      <div className="flex gap-1 h-2">
        {/* My score */}
        <div className="flex-1 bg-slate-100 rounded-l-full overflow-hidden flex justify-end">
          <div
            className="h-full bg-[#008A64] rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, (myScore / maxPct) * 100))}%` }}
          />
        </div>
        {/* Their score */}
        <div className="flex-1 bg-slate-100 rounded-r-full overflow-hidden">
          <div
            className="h-full bg-rose-400 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, (theirScore / maxPct) * 100))}%` }}
          />
        </div>
      </div>
    </div>
  );
}

const Debate1v1Result: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { matchId } = useParams<{ matchId: string }>();
  const { user } = useAuth();
  const currentUserId = user?.userId ?? user?.id ?? null;

  const stateMatch = (location.state as { match?: MatchResultDetail })?.match || null;
  const [match, setMatch] = useState<MatchResultDetail | null>(stateMatch);
  const [loading, setLoading] = useState<boolean>(!stateMatch && Boolean(matchId));

  useEffect(() => {
    if (stateMatch) {
      setMatch(stateMatch);
      return;
    }

    const numId = parseInt(matchId || "", 10);
    if (!isNaN(numId) && numId > 0) {
      setLoading(true);
      Promise.allSettled([
        debateApi.getSessionDetails(numId),
        debateApi.getTranscript(numId),
        debateApi.getEvaluation(numId),
      ]).then(([sessionRes, transcriptRes, evalRes]) => {
        if (sessionRes.status === "fulfilled" && sessionRes.value?.success && sessionRes.value.data) {
          const s = sessionRes.value.data;
          const pro = s.participants.find((p) => p.side === 1 || String(p.side) === "PRO");
          const con = s.participants.find((p) => p.side === 2 || String(p.side) === "CON");

          const transcript = transcriptRes.status === "fulfilled" && transcriptRes.value?.success ? transcriptRes.value.data : null;
          const argCount = transcript?.arguments?.length || 0;
          const ev = evalRes.status === "fulfilled" && evalRes.value?.success ? evalRes.value.data : null;

          const isCurrentUserCon = con && currentUserId != null && isSameUserId(con.userId, currentUserId);
          const myParticipant = isCurrentUserCon ? con : pro;
          const oppParticipant = isCurrentUserCon ? pro : con;
          const myRole = isCurrentUserCon ? "CON" : "PRO";
          const oppRole = isCurrentUserCon ? "PRO" : "CON";

          const proEval = ev?.proEvaluation ?? null;
          const conEval = ev?.conEvaluation ?? null;
          const myEval = isCurrentUserCon ? conEval : proEval;
          const oppEval = isCurrentUserCon ? proEval : conEval;

          const proScore10 = ev?.overallScorePro ?? proEval?.overallScore ?? 0;
          const conScore10 = ev?.overallScoreCon ?? conEval?.overallScore ?? 0;
          const myScore100 = Math.round((isCurrentUserCon ? conScore10 : proScore10) * 10);
          const oppScore100 = Math.round((isCurrentUserCon ? proScore10 : conScore10) * 10);

          const winnerSide = (ev?.suggestedWinnerSide || "").toUpperCase();
          let resultStatus: "WIN" | "LOSE" | "DRAW" = "DRAW";
          if (winnerSide.includes(myRole)) {
            resultStatus = "WIN";
          } else if (winnerSide.includes(oppRole)) {
            resultStatus = "LOSE";
          } else if (myScore100 > oppScore100) {
            resultStatus = "WIN";
          } else if (myScore100 < oppScore100) {
            resultStatus = "LOSE";
          }

          const extractCriteria100 = (partEval: typeof proEval): Record<string, number> => {
            const out: Record<string, number> = {
              logic: 0,
              evidence: 0,
              relevance: 0,
              structure: 0,
              persuasiveness: 0,
            };
            const rounds = partEval?.roundEvaluations || [];
            if (rounds.length === 0) return out;
            const sums: Record<string, { total: number; count: number }> = {};
            rounds.forEach((r) => {
              (r.criteria || []).forEach((c) => {
                const n = (c.name || "").toLowerCase();
                const key = n.includes("logic")
                  ? "logic"
                  : n.includes("evidence") || n.includes("bằng chứng") || n.includes("dẫn chứng")
                  ? "evidence"
                  : n.includes("relevan") || n.includes("liên quan") || n.includes("trọng tâm")
                  ? "relevance"
                  : n.includes("struct") || n.includes("cấu trúc") || n.includes("bố cục")
                  ? "structure"
                  : "persuasiveness";
                if (!sums[key]) sums[key] = { total: 0, count: 0 };
                sums[key].total += Number(c.score || 0);
                sums[key].count += 1;
              });
            });
            Object.keys(out).forEach((k) => {
              if (sums[k] && sums[k].count > 0) {
                // Criterion score is 0-5 -> scale to 0-100
                out[k] = Math.round((sums[k].total / sums[k].count) * 20);
              }
            });
            return out;
          };

          setMatch({
            id: String(s.sessionId),
            topic: s.topic || s.title || "Tranh biện 1 vs 1",
            date: s.startedAt ? new Date(s.startedAt).toLocaleDateString("vi-VN") : new Date().toLocaleDateString("vi-VN"),
            duration: s.startedAt && s.endedAt ? `${Math.max(1, Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000))} phút` : "Hoàn thành",
            rules: "Luật WSDC chuẩn",
            result: resultStatus,
            playerA: {
              name: myParticipant?.speakerName || `Người tham gia ${myRole}`,
              avatar: (myParticipant?.speakerName || myRole).slice(0, 2).toUpperCase(),
              role: myRole,
              score: myScore100,
            },
            playerB: {
              name: oppParticipant?.speakerName || `Người tham gia ${oppRole}`,
              avatar: (oppParticipant?.speakerName || oppRole).slice(0, 2).toUpperCase(),
              role: oppRole,
              score: oppScore100,
            },
            scores: extractCriteria100(myEval),
            opponentScores: extractCriteria100(oppEval),
            aiJudgeVerdict:
              ev?.summary ||
              ev?.overallFeedback ||
              myEval?.progressTrend ||
              `Trận đấu gồm ${argCount} lượt phát biểu đã hoàn tất.`,
            judgeComments: [
              ...(myEval?.roundEvaluations?.map((r) => `Vòng ${r.roundNumber} (${r.stage}): ${r.consistencyNote}`).filter(Boolean) || []),
            ],
            myStrengths: myEval?.strengths || [],
            myImprovements: [
              ...(myEval?.weaknesses || []),
              ...(myEval?.suggestions || []),
            ],
          });
        }
      }).finally(() => {
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [stateMatch, matchId, currentUserId]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-20 text-center space-y-3">
        <Loader2 size={36} className="mx-auto text-[#008A64] animate-spin" />
        <p className="text-sm font-semibold text-slate-600">Đang tải kết quả trận đấu...</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 mx-auto flex items-center justify-center">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Không tìm thấy kết quả trận đấu</h2>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
          Trận đấu chưa có dữ liệu kết quả hoặc mã trận đấu không tồn tại trong hệ thống.
        </p>
        <div className="pt-2 flex items-center justify-center gap-3">
          <Link
            to="/debater/debate-1v1"
            className="px-5 py-2.5 bg-[#008A64] hover:bg-[#007457] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            Quay lại Tranh biện 1v1
          </Link>
          <Link
            to="/debater/history"
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
          >
            Xem lịch sử
          </Link>
        </div>
      </div>
    );
  }

  const isWin = match.result === "WIN";
  const isDraw = match.result === "DRAW";

  const scoreLabels: Record<string, string> = {
    logic: "Logic & Lập luận",
    evidence: "Bằng chứng",
    relevance: "Liên quan",
    structure: "Cấu trúc",
    persuasiveness: "Sức thuyết phục",
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-10">
      {/* Result Hero Banner */}
      <div
        className={`rounded-3xl p-6 sm:p-8 border shadow-lg text-white relative overflow-hidden ${
          isWin
            ? "bg-gradient-to-r from-[#008A64] to-emerald-400 border-[#008A64]/50"
            : isDraw
            ? "bg-gradient-to-r from-slate-600 to-slate-500 border-slate-400/50"
            : "bg-gradient-to-r from-rose-600 to-rose-400 border-rose-400/50"
        }`}
      >
        {/* Decorative circle */}
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10" />
        <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-white/5" />

        <div className="relative flex flex-col sm:flex-row items-center gap-6">
          {/* Trophy icon */}
          <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shrink-0">
            {isWin ? (
              <Trophy size={36} className="text-amber-300 fill-amber-300" />
            ) : isDraw ? (
              <Swords size={36} className="text-slate-300" />
            ) : (
              <AlertCircle size={36} className="text-rose-200" />
            )}
          </div>

          <div className="text-center sm:text-left">
            <p className="text-white/80 text-sm font-semibold uppercase tracking-widest mb-1">Kết quả trận đấu</p>
            <h1 className="text-4xl font-black">
              {isWin ? "Chiến thắng!" : isDraw ? "Hòa" : "Thất bại"}
            </h1>
            <p className="text-white/80 text-sm mt-1.5 max-w-md line-clamp-2">{match.topic}</p>
          </div>

          <div className="ml-auto text-center shrink-0">
            <p className="text-white/60 text-xs mb-1">Điểm của bạn</p>
            <p className="text-5xl font-black font-mono">{match.playerA.score}</p>
            <p className="text-white/60 text-sm">/ 100</p>
          </div>
        </div>

        {/* Match meta */}
        <div className="relative mt-5 pt-5 border-t border-white/20 flex flex-wrap gap-4 text-xs text-white/70">
          <div className="flex items-center gap-1.5"><Clock size={12} />{match.duration}</div>
          <div className="flex items-center gap-1.5"><FileText size={12} />{match.rules}</div>
          <div className="flex items-center gap-1.5"><Gavel size={12} />AI Judge</div>
          <div className="flex items-center gap-1.5">{match.date}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT: vs. card + score comparison */}
        <div className="lg:col-span-5 space-y-4">
          {/* Players */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">So sánh điểm số</h3>
            <div className="flex items-center justify-between gap-4">
              {/* Me */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-[#008A64] text-white font-black flex items-center justify-center text-sm">
                  {match.playerA.avatar}
                </div>
                <div className="text-center">
                  <p className="text-xs font-black text-slate-900">{match.playerA.name}</p>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#ECFDF5] text-[#008A64] border border-[#008A64]/30">
                    {match.playerA.role === "PRO" ? "Ủng hộ" : "Phản đối"}
                  </span>
                </div>
                <p className="text-3xl font-black text-slate-900 font-mono">{match.playerA.score}</p>
              </div>

              <div className="flex flex-col items-center gap-1">
                <span className="text-xl font-black text-slate-300">vs</span>
                {isWin && <span className="text-[10px] font-bold text-[#008A64]">BẠN THẮNG</span>}
                {match.result === "LOSE" && <span className="text-[10px] font-bold text-rose-500">BẠN THUA</span>}
                {isDraw && <span className="text-[10px] font-bold text-slate-500">HÒA</span>}
              </div>

              {/* Opponent */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-rose-500 text-white font-black flex items-center justify-center text-sm">
                  {match.playerB.avatar}
                </div>
                <div className="text-center">
                  <p className="text-xs font-black text-slate-900">{match.playerB.name}</p>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                    {match.playerB.role === "PRO" ? "Ủng hộ" : "Phản đối"}
                  </span>
                </div>
                <p className="text-3xl font-black text-slate-900 font-mono">{match.playerB.score}</p>
              </div>
            </div>

            {/* Score bars */}
            <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
              {Object.entries(scoreLabels).map(([key, label]) => (
                <ScoreBar
                  key={key}
                  label={label}
                  myScore={match.scores[key] ?? 0}
                  theirScore={match.opponentScores[key] ?? 0}
                />
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-5 mt-3 pt-3 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#008A64]" /><span className="text-slate-600">Bạn</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-rose-400" /><span className="text-slate-600">{match.playerB.name}</span></div>
            </div>
          </div>
        </div>

        {/* RIGHT: AI Judge verdict + strengths/improvements */}
        <div className="lg:col-span-7 space-y-4">
          {/* AI Judge verdict */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-violet-50 border border-violet-200">
                <Gavel size={15} className="text-violet-600" />
              </div>
              <h3 className="text-sm font-black text-slate-900">Phán quyết của AI Judge</h3>
            </div>
            <p className="text-sm text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-100 leading-relaxed">
              {match.aiJudgeVerdict}
            </p>
          </div>

          {/* Judge comments */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Nhận xét chi tiết của AI Judge</h3>
            <ul className="space-y-2">
              {match.judgeComments.map((comment, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <Target size={13} className="text-slate-400 mt-0.5 shrink-0" />
                  <span>{comment}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Strengths & improvements */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-2.5">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-[#008A64]" />
                <h3 className="text-xs font-bold text-emerald-700">Điểm mạnh của bạn</h3>
              </div>
              <ul className="space-y-2">
                {match.myStrengths.map((s, i) => (
                  <li key={i} className="text-xs text-slate-700 pl-3 border-l-2 border-[#008A64]/30 leading-relaxed">{s}</li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-2.5">
              <div className="flex items-center gap-1.5">
                <AlertCircle size={14} className="text-amber-500" />
                <h3 className="text-xs font-bold text-amber-700">Cần cải thiện</h3>
              </div>
              <ul className="space-y-2">
                {match.myImprovements.map((s, i) => (
                  <li key={i} className="text-xs text-slate-700 pl-3 border-l-2 border-amber-200 leading-relaxed">{s}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/debater/history"
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl inline-flex items-center gap-2 shadow-xs transition-all"
          >
            <FileText size={14} />Xem lịch sử trận
          </Link>
          <button
            type="button"
            onClick={() => navigate("/debater/debate-1v1")}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl inline-flex items-center gap-2 shadow-xs transition-all"
          >
            <RotateCcw size={14} />Tái đấu
          </button>
        </div>
        <button
          type="button"
          onClick={() => navigate("/debater/dashboard")}
          className="px-6 py-2.5 bg-[#008A64] hover:bg-[#007457] text-white text-xs font-bold rounded-xl shadow-sm inline-flex items-center gap-2 transition-all"
        >
          Quay về Dashboard <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default Debate1v1Result;

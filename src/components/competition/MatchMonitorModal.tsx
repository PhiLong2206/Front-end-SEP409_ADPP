import React, { useEffect, useState } from "react";
import {
  X,
  Radio,
  Shield,
  Eye,
  RefreshCw,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import debateApi from "../../api/debateApi";
import {
  TournamentMatch,
  DebateTranscriptResponse,
  ArgumentDetailDto,
} from "../../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  match: TournamentMatch | null;
  competitionTitle?: string;
}

const MatchMonitorModal: React.FC<Props> = ({
  isOpen,
  onClose,
  match,
  competitionTitle,
}) => {
  const [transcript, setTranscript] = useState<DebateTranscriptResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  const sessionId = match?.debateSessionId;

  const fetchTranscript = async () => {
    if (!sessionId) {
      setErrorMsg("Trận đấu này chưa được khởi tạo phòng tranh biện (chưa có DebateSession ID).");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await debateApi.getTranscript(sessionId);
      if (res && res.success && res.data) {
        setTranscript(res.data);
      } else {
        setErrorMsg(res?.message || "Không thể tải nội dung tranh biện.");
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setErrorMsg(e.message || "Lỗi kết nối khi tải biên bản trận đấu.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && sessionId) {
      fetchTranscript();
    } else if (isOpen && !sessionId) {
      setTranscript(null);
      setErrorMsg("Trận đấu này chưa có phiên tranh biện thực tế. Vui lòng bấm 'Chuẩn bị trận đấu' để tạo phiên trước khi giám sát.");
    }
  }, [isOpen, sessionId]);

  // Periodic polling for realtime updates if match is ongoing
  useEffect(() => {
    if (!isOpen || !sessionId || !autoRefresh) return;
    const interval = setInterval(() => {
      fetchTranscript();
    }, 6000);
    return () => clearInterval(interval);
  }, [isOpen, sessionId, autoRefresh]);

  if (!isOpen || !match) return null;

  const proName =
    match.proParticipant?.userName ||
    match.proParticipant?.teamName ||
    match.proParticipantName ||
    "Bên PRO (Chưa xác định)";
  const conName =
    match.conParticipant?.userName ||
    match.conParticipant?.teamName ||
    match.conParticipantName ||
    "Bên CON (Chưa xác định)";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-[#12231C] w-full max-w-4xl max-h-[92vh] rounded-3xl border border-slate-200 dark:border-[rgba(148,163,184,0.18)] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-[rgba(148,163,184,0.12)] bg-gradient-to-r from-slate-50 to-emerald-50/30 dark:from-[#0B1713] dark:to-[#12231C] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-[#008A64] flex items-center justify-center">
              <Eye size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-[#008A64] border border-emerald-300 dark:border-emerald-800">
                  GIÁM SÁT TRẬN #{match.matchNumber || match.matchId}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {match.roundName || `Vòng ${match.roundNumber || 1}`}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  <Radio size={12} className="animate-pulse text-amber-600" />
                  Chế độ chỉ đọc (Read-only)
                </span>
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100 tracking-tight mt-0.5">
                {competitionTitle ? `${competitionTitle} – ` : ""}Trực tiếp diễn biến trận đấu
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchTranscript}
              disabled={loading || !sessionId}
              className="p-2 text-slate-500 hover:text-[#008A64] hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              title="Làm mới nội dung"
            >
              <RefreshCw size={16} className={loading ? "animate-spin text-[#008A64]" : ""} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Match Overview Bar */}
        <div className="p-4 bg-slate-50 dark:bg-[#0B1713] border-b border-slate-200/80 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* PRO Side */}
          <div className="p-3 bg-white dark:bg-[#12231C] rounded-2xl border border-emerald-200 dark:border-emerald-800/40">
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
              Phe Ủng Hộ (PRO)
            </span>
            <p className="text-sm font-black text-slate-900 dark:text-slate-100 truncate mt-0.5">
              {proName}
            </p>
          </div>

          {/* Center Info */}
          <div className="p-3 bg-white dark:bg-[#12231C] rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-center items-center text-center">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-600 dark:text-slate-300">
                Trạng thái:
              </span>
              <span className="font-black px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px]">
                {match.status}
              </span>
            </div>
            {match.assignedJudgeName && (
              <span className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                <Shield size={11} className="text-purple-600" />
                Giám khảo: <strong>{match.assignedJudgeName}</strong>
              </span>
            )}
          </div>

          {/* CON Side */}
          <div className="p-3 bg-white dark:bg-[#12231C] rounded-2xl border border-rose-200 dark:border-rose-800/40 text-right">
            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block">
              Phe Phản Đối (CON)
            </span>
            <p className="text-sm font-black text-slate-900 dark:text-slate-100 truncate mt-0.5">
              {conName}
            </p>
          </div>
        </div>

        {/* Read-only Notice */}
        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200/60 dark:border-amber-900/40 text-amber-800 dark:text-amber-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-amber-600 shrink-0" />
            <span>
              <strong>Giao diện giám sát viên:</strong> Bạn đang theo dõi nội dung trực tiếp. Tính năng gửi phát biểu và ghi âm chỉ dành riêng cho thí sinh thi đấu.
            </span>
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded-sm accent-[#008A64]"
            />
            <span>Tự động cập nhật</span>
          </label>
        </div>

        {/* Transcript Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {errorMsg ? (
            <div className="p-8 text-center bg-rose-50/50 dark:bg-rose-950/20 rounded-2xl border border-rose-200 dark:border-rose-900/40 space-y-2">
              <AlertCircle size={28} className="text-rose-500 mx-auto" />
              <p className="text-xs font-bold text-rose-700 dark:text-rose-300">{errorMsg}</p>
              <p className="text-[11px] text-slate-500">
                Nếu phiên tranh biện chưa bắt đầu, bạn có thể quay lại sau khi ban tổ chức hoặc giám khảo khởi động trận đấu.
              </p>
            </div>
          ) : !transcript || transcript.arguments.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-3">
              <MessageSquare size={36} className="mx-auto text-slate-300 dark:text-slate-700" />
              <p className="text-xs font-bold">Chưa có lượt phát biểu nào được ghi nhận</p>
              <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                Khi các thí sinh bắt đầu gửi luận điểm phản biện, nội dung đối thoại sẽ hiển thị theo thời gian thực tại đây.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {transcript.arguments.map((arg: ArgumentDetailDto, idx: number) => {
                const isPro = arg.side === 1 || String(arg.side) === "PRO";
                return (
                  <div
                    key={arg.argumentId || idx}
                    className={`flex flex-col ${isPro ? "items-start" : "items-end"}`}
                  >
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                          isPro
                            ? "bg-emerald-100 text-[#008A64] dark:bg-emerald-950/70 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300"
                        }`}
                      >
                        {isPro ? "PRO" : "CON"}
                      </span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {arg.speakerName || (isPro ? proName : conName)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Lượt #{arg.turnOrder || idx + 1}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(arg.submittedAt).toLocaleTimeString("vi-VN")}
                      </span>
                    </div>

                    <div
                      className={`max-w-[85%] sm:max-w-[75%] p-4 rounded-2xl text-xs sm:text-sm leading-relaxed border shadow-xs ${
                        isPro
                          ? "bg-emerald-50/50 dark:bg-[#152a20] border-emerald-200 dark:border-emerald-800 text-slate-800 dark:text-slate-100 rounded-tl-xs"
                          : "bg-rose-50/40 dark:bg-[#2a171c] border-rose-200 dark:border-rose-900 text-slate-800 dark:text-slate-100 rounded-tr-xs"
                      }`}
                    >
                      {arg.content}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-[#0B1713] flex items-center justify-between text-xs text-slate-500">
          <span>
            DebateSession: <strong className="font-mono text-slate-700 dark:text-slate-300">#{sessionId || "Chưa có"}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition-colors cursor-pointer"
          >
            Đóng giám sát
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatchMonitorModal;

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Badge from "../../../components/common/Badge";
import { ArrowRight, Swords, Loader2, RefreshCw } from "lucide-react";
import { debateApi } from "../../../api";
import { DebateHistoryItemDto } from "../../../types";

const DebateHistory: React.FC = () => {
  const [historyList, setHistoryList] = useState<DebateHistoryItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await debateApi.getUserHistory();
      if (res?.success && Array.isArray(res.data)) {
        setHistoryList(res.data);
      } else {
        setHistoryList([]);
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Không thể tải lịch sử tranh biện");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const getModeLabel = (type: number) => {
    switch (type) {
      case 1:
        return "Luyện tập với AI";
      case 2:
        return "P2P Trực tiếp";
      case 3:
        return "Thách đấu 1v1";
      default:
        return "Tranh biện";
    }
  };

  // The Backend sends the enum as a number (3) or, depending on its JSON settings, as its name
  const isCompleted = (status: number | string) => status === 3 || String(status) === "Completed";

  const getStatusLabel = (status: number) => {
    switch (status) {
      case 1:
        return { text: "Chờ đối thủ", color: "bg-amber-50 text-amber-700 border-amber-200" };
      case 2:
        return { text: "Đang diễn ra", color: "bg-blue-50 text-blue-700 border-blue-200" };
      case 3:
        return { text: "Đã hoàn thành", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
      case 4:
        return { text: "Đã hủy", color: "bg-rose-50 text-rose-700 border-rose-200" };
      default:
        return { text: "Không xác định", color: "bg-slate-50 text-slate-700 border-slate-200" };
    }
  };


  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Trận của tôi
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Danh sách các phiên tranh biện và đánh giá đã hoàn thành của bạn.
          </p>
        </div>
        <button
          onClick={fetchHistory}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Làm mới
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <Loader2 size={32} className="mx-auto text-[#008A64] animate-spin" />
            <p className="text-sm font-semibold">Đang tải lịch sử tranh biện...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-500 space-y-2">
            <p className="text-sm font-semibold">{error}</p>
            <button
              onClick={fetchHistory}
              className="text-xs text-[#008A64] font-bold underline cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        ) : historyList.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <Swords size={32} className="mx-auto text-slate-300" />
            <p className="text-sm font-semibold">Chưa có phiên tranh biện nào.</p>
            <p className="text-xs text-slate-400">Hãy bắt đầu luyện tập với AI để ghi nhận kết quả và điểm số.</p>
            <Link
              to="/debater/debate"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#008A64] hover:bg-[#007457] text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              Luyện tập ngay
              <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 tracking-wider border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-5 py-3.5">Mã phiên / Chủ đề</th>
                  <th scope="col" className="px-5 py-3.5">Hình thức</th>
                  <th scope="col" className="px-5 py-3.5">Phe</th>
                  <th scope="col" className="px-5 py-3.5 text-center">Trạng thái</th>
                  <th scope="col" className="px-5 py-3.5">Ngày tạo</th>
                  <th scope="col" className="px-5 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyList.map((item) => {
                  const statusInfo = getStatusLabel(item.status);
                  const isPro = item.userSide === 1;
                  return (
                    <tr key={item.sessionId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 max-w-sm">
                        <div className="font-bold text-slate-900 line-clamp-1">{item.title || item.topic}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant="primary" size="sm">#{item.sessionId}</Badge>
                          <span className="text-[11px] text-slate-500 truncate">{item.topic}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-xs font-medium text-slate-700">
                        {getModeLabel(item.debateType)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                          isPro
                            ? "bg-[#ECFDF5] text-[#008A64] border border-[#008A64]/30"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}>
                          {isPro ? "Ủng hộ (PRO)" : "Phản đối (CON)"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${statusInfo.color}`}>
                          {statusInfo.text}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500 font-mono">
                        {new Date(item.createdAt).toLocaleDateString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric"
                        })}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap space-x-2">
                        {isCompleted(item.status) && (
                          <Link
                            to={`/debater/debate/${item.sessionId}/result`}
                            data-testid={`history-result-link-${item.sessionId}`}
                            className="px-3.5 py-1.5 bg-[#008A64] hover:bg-[#007457] text-white text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1.5 shadow-xs"
                          >
                            <span>Xem kết quả</span>
                            <ArrowRight size={13} />
                          </Link>
                        )}
                        <Link
                          to={`/debater/debate/${item.sessionId}`}
                          className="px-3.5 py-1.5 bg-white hover:bg-[#ECFDF5] border border-slate-200 text-[#008A64] text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1.5 shadow-xs"
                        >
                          <span>Vào phiên</span>
                          <ArrowRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebateHistory;


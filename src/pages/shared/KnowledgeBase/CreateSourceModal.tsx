import React, { useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { TOPIC_CATEGORIES } from "../../../constants/topicCategories";
import type {
  CreateKnowledgeSourceRequest,
  KnowledgeSourceType,
  KnowledgeTopic,
} from "../../../types";

interface CreateSourceModalProps {
  isOpen: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateKnowledgeSourceRequest) => Promise<void>;
}

const SOURCE_TYPES: { value: KnowledgeSourceType; label: string }[] = [
  { value: "document", label: "Tài liệu (Document)" },
  { value: "url", label: "Liên kết (URL)" },
  { value: "manual", label: "Nhập tay (Manual)" },
  { value: "dataset", label: "Bộ dữ liệu (Dataset)" },
];

const CreateSourceModal: React.FC<CreateSourceModalProps> = ({
  isOpen,
  isAdmin,
  onClose,
  onSubmit,
}) => {
  const [topic, setTopic] = useState<KnowledgeTopic>("education");
  const [sourceType, setSourceType] = useState<KnowledgeSourceType>("document");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [citation, setCitation] = useState("");
  const [publishedDate, setPublishedDate] = useState("");
  const [inputMode, setInputMode] = useState<"rawText" | "facts">("rawText");
  const [rawText, setRawText] = useState("");
  const [facts, setFacts] = useState<string[]>([""]);
  const [chunkSentences, setChunkSentences] = useState(3);
  const [chunkOverlap, setChunkOverlap] = useState(1);
  const [autoApprove, setAutoApprove] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFactChange = (index: number, value: string) => {
    setFacts((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const handleAddFactRow = () => {
    setFacts((prev) => [...prev, ""]);
  };

  const handleRemoveFactRow = (index: number) => {
    setFacts((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : [""]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Vui lòng nhập tiêu đề nguồn tài liệu.");
      return;
    }

    const cleanedFacts = facts.map((f) => f.trim()).filter(Boolean);
    const trimmedRawText = rawText.trim();

    if (inputMode === "rawText" && !trimmedRawText) {
      setError("Vui lòng dán nội dung văn bản (rawText) để hệ thống tách đoạn.");
      return;
    }
    if (inputMode === "facts" && cleanedFacts.length === 0) {
      setError("Vui lòng nhập ít nhất 1 dữ kiện (fact).");
      return;
    }
    if (inputMode === "rawText" && chunkOverlap >= chunkSentences) {
      setError("Số câu chồng lấp (chunkOverlap) phải nhỏ hơn số câu mỗi đoạn (chunkSentences).");
      return;
    }

    const payload: CreateKnowledgeSourceRequest = {
      topic,
      sourceType,
      title: trimmedTitle,
      url: url.trim() || null,
      citation: citation.trim() || null,
      publishedDate: publishedDate || null,
      rawText: inputMode === "rawText" ? trimmedRawText : null,
      facts: inputMode === "facts" ? cleanedFacts : [],
      autoApprove: isAdmin ? autoApprove : false,
      chunkSentences,
      chunkOverlap,
    };

    setSubmitting(true);
    try {
      await onSubmit(payload);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Không thể nạp nguồn tài liệu mới.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-source-title"
    >
      <div className="bg-white dark:bg-[#0F1C17] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2
              id="create-source-title"
              className="text-base sm:text-lg font-bold text-slate-900 dark:text-[#F8FAFC]"
            >
              Nạp tài liệu & dữ kiện mới
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Hệ thống tự động tách đoạn và tạo vector embedding cho RAG Evaluator
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300"
            >
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Danh mục chủ đề *
              </label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value as KnowledgeTopic)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#12231C] text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#008A64]/30"
              >
                {TOPIC_CATEGORIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Loại nguồn *
              </label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as KnowledgeSourceType)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#12231C] text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#008A64]/30"
              >
                {SOURCE_TYPES.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Tiêu đề nguồn *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Báo cáo UNESCO 2025"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#12231C] text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#008A64]/30"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Trích dẫn (Citation)
              </label>
              <input
                type="text"
                value={citation}
                onChange={(e) => setCitation(e.target.value)}
                placeholder="Ví dụ: UNESCO Global Report 2025"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#12231C] text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#008A64]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Ngày xuất bản
              </label>
              <input
                type="date"
                value={publishedDate}
                onChange={(e) => setPublishedDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#12231C] text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#008A64]/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              URL tham khảo
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.org/unesco"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#12231C] text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#008A64]/30"
            />
          </div>

          {/* Content mode switcher */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setInputMode("rawText")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  inputMode === "rawText"
                    ? "bg-[#ECFDF5] text-[#008A64] dark:bg-emerald-950/60 dark:text-[#34D399]"
                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                Dán văn bản dài (tự tách đoạn)
              </button>
              <button
                type="button"
                onClick={() => setInputMode("facts")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  inputMode === "facts"
                    ? "bg-[#ECFDF5] text-[#008A64] dark:bg-emerald-950/60 dark:text-[#34D399]"
                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                Nhập từng Fact thủ công
              </button>
            </div>

            {inputMode === "rawText" ? (
              <div className="space-y-3">
                <textarea
                  rows={5}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Dán nội dung báo cáo, bài viết hoặc số liệu vào đây. Hệ thống sẽ tự động chia đoạn theo câu và tạo vector embedding..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#12231C] text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#008A64]/30"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Số câu mỗi đoạn (chunkSentences)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={chunkSentences}
                      onChange={(e) => setChunkSentences(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#12231C] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Số câu chồng lấp (chunkOverlap &lt; {chunkSentences})
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={Math.max(0, chunkSentences - 1)}
                      value={chunkOverlap}
                      onChange={(e) => setChunkOverlap(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#12231C] text-sm"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {facts.map((fact, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <textarea
                      rows={2}
                      value={fact}
                      onChange={(e) => handleFactChange(idx, e.target.value)}
                      placeholder={`Dữ kiện #${idx + 1}...`}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#12231C] text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#008A64]/30"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveFactRow(idx)}
                      aria-label={`Xóa dòng ${idx + 1}`}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddFactRow}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#008A64] bg-[#ECFDF5] hover:bg-[#D1FAE5] dark:bg-emerald-950/40 dark:text-emerald-300 cursor-pointer"
                >
                  <Plus size={14} />
                  Thêm dòng dữ kiện
                </button>
              </div>
            )}
          </div>

          {isAdmin && (
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 cursor-pointer">
              <input
                type="checkbox"
                checked={autoApprove}
                onChange={(e) => setAutoApprove(e.target.checked)}
                className="accent-[#008A64] w-4 h-4"
              />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Tự động duyệt ngay tất cả dữ kiện tạo ra (chỉ Admin)
              </span>
            </label>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#008A64] hover:bg-[#007457] disabled:opacity-60 text-white text-xs font-bold shadow-sm cursor-pointer"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              <span>{submitting ? "Đang nạp dữ liệu..." : "Nạp nguồn tài liệu"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateSourceModal;

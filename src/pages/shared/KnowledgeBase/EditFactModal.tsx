import React, { useState } from "react";
import { Loader2, X } from "lucide-react";
import type { FactCardItem, UpdateFactCardRequest } from "../../../types";

interface EditFactModalProps {
  fact: FactCardItem | null;
  onClose: () => void;
  onSubmit: (factId: string, payload: UpdateFactCardRequest) => Promise<void>;
}

const EditFactModal: React.FC<EditFactModalProps> = ({ fact, onClose, onSubmit }) => {
  const [content, setContent] = useState(fact?.content ?? "");
  const [citation, setCitation] = useState(fact?.citation ?? "");
  const [publishedDate, setPublishedDate] = useState(fact?.published_date ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!fact) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!content.trim()) {
      setError("Nội dung dẫn chứng không được để trống.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(fact.id, {
        content: content.trim(),
        citation: citation.trim() || null,
        publishedDate: publishedDate || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật dữ kiện.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-fact-title"
    >
      <div className="bg-white dark:bg-[#0F1C17] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2
              id="edit-fact-title"
              className="text-base font-bold text-slate-900 dark:text-[#F8FAFC]"
            >
              Chỉnh sửa Fact Card
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Nếu thay đổi nội dung, hệ thống sẽ tự tính lại vector embedding
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300"
            >
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Nội dung dẫn chứng *
            </label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#12231C] text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#008A64]/30"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Trích dẫn (Citation)
              </label>
              <input
                type="text"
                value={citation}
                onChange={(e) => setCitation(e.target.value)}
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

          <div className="flex items-center justify-end gap-2 pt-2">
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
              <span>{submitting ? "Đang lưu..." : "Lưu thay đổi"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditFactModal;

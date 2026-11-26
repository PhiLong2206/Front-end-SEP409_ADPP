import React, { useState } from "react";
import { Mic, Send, Lightbulb } from "lucide-react";
import Button from "../../common/Button";

export interface ArgumentComposerProps {
  onSubmit: (content: string) => void;
  onOpenTips?: () => void;
  disabled?: boolean;
  isAiGenerating?: boolean;
  maxChars?: number;
}

const ArgumentComposer: React.FC<ArgumentComposerProps> = ({
  onSubmit,
  onOpenTips,
  disabled = false,
  isAiGenerating = false,
  maxChars = 2000,
}) => {
  const [content, setContent] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || disabled || isAiGenerating) return;
    onSubmit(content.trim());
    setContent("");
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4">
      <div className="flex items-center justify-between mb-2">
        <label htmlFor="argument-composer-input" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Lập luận của bạn
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenTips}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 bg-[#EAF2FF] px-2.5 py-1 rounded-lg border border-[#0B5ED7]/30 transition-colors"
          >
            <Lightbulb size={13} className="text-[#0B5ED7]" />
            <span>Gợi ý phản biện</span>
          </button>
          <span
            className={`text-xs ${
              content.length > maxChars * 0.9 ? "text-red-500 font-medium" : "text-slate-400"
            }`}
          >
            {content.length} / {maxChars}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <textarea
          id="argument-composer-input"
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, maxChars))}
          placeholder="Nhập nội dung lập luận hoặc phản biện của bạn..."
          disabled={disabled || isAiGenerating}
          rows={4}
          className="w-full p-3 text-sm bg-slate-50/70 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7] resize-none text-slate-800 placeholder:text-slate-400 transition-all"
        />

        <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={toggleRecording}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors ${
              isRecording
                ? "bg-red-50 border-red-200 text-red-600 animate-pulse"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Mic size={14} className={isRecording ? "text-red-600" : "text-slate-500"} />
            <span>{isRecording ? "Đang ghi âm..." : "Ghi âm giọng nói"}</span>
          </button>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!content.trim() || disabled || isAiGenerating}
            loading={isAiGenerating}
            className="px-5"
          >
            <span>Gửi lập luận</span>
            <Send size={13} />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ArgumentComposer;

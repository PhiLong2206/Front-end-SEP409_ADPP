export interface DebateMessageItem {
  id: string;
  speaker: "AI" | "Debater";
  speakerName: string;
  side: "Ủng hộ" | "Phản đối";
  stage: string;
  roundNumber: number;
  timestamp: string;
  content: string;
}

import { Bot, User as UserIcon } from "lucide-react";
import Badge from "../../common/Badge";

export interface DebateMessageProps {
  message: DebateMessageItem;
}

const DebateMessage: React.FC<DebateMessageProps> = ({ message }) => {
  const isAI = message.speaker === "AI";

  return (
    <div
      className={`p-5 rounded-2xl border transition-all ${
        isAI
          ? "bg-white border-slate-200 shadow-xs"
          : "bg-[#ECFDF5]/50 border-[#008A64]/20 shadow-xs"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${
              isAI
                ? "bg-slate-800 text-white"
                : "bg-[#008A64] text-white font-medium"
            }`}
          >
            {isAI ? <Bot size={15} /> : <UserIcon size={15} />}
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900 mr-2">
              {message.speakerName}
            </span>
            <Badge
              variant={message.side === "Ủng hộ" ? "primary" : "danger"}
              size="sm"
            >
              {message.side}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span>Vòng {message.roundNumber} ({message.stage})</span>
          <span>•</span>
          <span>{message.timestamp}</span>
        </div>
      </div>

      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line pl-9">
        {message.content}
      </p>
    </div>
  );
};

export default DebateMessage;

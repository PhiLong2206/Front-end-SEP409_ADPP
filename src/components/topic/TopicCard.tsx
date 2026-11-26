import React from "react";
import { Link } from "react-router-dom";
import Badge from "../common/Badge";
import DifficultyBadge from "./DifficultyBadge";
import { Topic } from "../../types";
import { ArrowUpRight } from "lucide-react";
import { topicCategoryLabel } from "../../constants/topicCategories";

export interface TopicCardProps {
  topic: Topic;
  showImage?: boolean;
}

const TopicCard: React.FC<TopicCardProps> = ({ topic, showImage = true }) => {
  return (
    <Link
      to={`/debater/topics/${topic.id}`}
      className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-lg hover:border-[#0B5ED7]/40 transition-all duration-300 flex flex-col overflow-hidden group relative"
    >
      {showImage && topic.imageUrl && (
        <div className="h-40 w-full overflow-hidden relative bg-slate-100">
          <img
            src={topic.imageUrl}
            alt={topic.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-95 group-hover:opacity-100"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent" />
          <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-slate-800 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
            <ArrowUpRight size={14} className="text-[#0B5ED7]" />
          </div>
        </div>
      )}

      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Badge variant="primary" size="sm">{topicCategoryLabel(topic.category)}</Badge>
            <DifficultyBadge difficulty={topic.difficulty} />
          </div>
          <h3 className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-2 leading-snug group-hover:text-[#0B5ED7] transition-colors">
            {topic.title}
          </h3>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span className="font-medium">Tranh biện ngay</span>
          <span className="font-bold text-[#0B5ED7] group-hover:translate-x-1 transition-transform">→</span>
        </div>
      </div>
    </Link>
  );
};

export default TopicCard;


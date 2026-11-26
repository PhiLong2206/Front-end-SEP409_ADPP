import React from "react";
import { Link } from "react-router-dom";
import Badge from "../common/Badge";
import DifficultyBadge from "./DifficultyBadge";
import { Topic } from "../../types";
import { BookOpen } from "lucide-react";
import { topicCategoryLabel } from "../../constants/topicCategories";

export interface TopicTableProps {
  topics: Topic[];
}

const TopicTable: React.FC<TopicTableProps> = ({ topics }) => {
  if (topics.length === 0) {
    return (
      <div className="py-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <BookOpen className="mx-auto text-slate-400 mb-2" size={32} />
        <p className="text-sm font-medium">Không tìm thấy chủ đề phù hợp</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 tracking-wider border-b border-slate-200">
            <tr>
              <th scope="col" className="px-5 py-3.5">Tiêu đề & Kiến nghị</th>
              <th scope="col" className="px-5 py-3.5">Danh mục</th>
              <th scope="col" className="px-5 py-3.5">Độ khó</th>
              <th scope="col" className="px-5 py-3.5 text-right">Lượt luyện</th>
              <th scope="col" className="px-5 py-3.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {topics.map((topic) => (
              <tr key={topic.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="px-5 py-4 max-w-md">
                  <div className="font-bold text-slate-900 text-sm line-clamp-1">{topic.title}</div>
                  <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">{topic.motion}</div>
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  <Badge variant="primary" size="sm">{topicCategoryLabel(topic.category)}</Badge>
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  <DifficultyBadge difficulty={topic.difficulty} />
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-right text-xs font-semibold text-slate-700 font-mono">
                  {(topic.practicesCount ?? 0).toLocaleString()}
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-right">
                  <div className="inline-flex items-center gap-2">
                    <Link
                      to={`/debater/topics/${topic.id}`}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 hover:text-slate-900 border border-slate-200 rounded-xl transition-colors shadow-xs"
                    >
                      Chi tiết
                    </Link>
                    <Link
                      to={`/debater/topics/${topic.id}`}
                      className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#0B5ED7] hover:bg-[#0a4fb4] rounded-xl transition-all shadow-sm shadow-[#0B5ED7]/20 hover:scale-102"
                    >
                      Bắt đầu
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TopicTable;

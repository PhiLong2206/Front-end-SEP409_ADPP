import React from "react";
import { NormalizedCriterion, PERCENT_MAX } from "../../utils/debateScoring";

export interface ScoreBreakdownProps {
  /** Already normalized — `percent` is 0..PERCENT_MAX, `null` when the criterion was not scored. */
  criteria: NormalizedCriterion[];
}

const getColorClass = (percent: number) => {
  if (percent >= 80) return "bg-[#008A64]";
  if (percent >= 70) return "bg-emerald-500";
  if (percent >= 50) return "bg-amber-500";
  return "bg-rose-500";
};

const ScoreBreakdown: React.FC<ScoreBreakdownProps> = ({ criteria }) => {
  return (
    <div className="space-y-4">
      {criteria.map((item) => (
        <div key={item.key} className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">{item.label}</span>
            <span className="font-bold text-slate-900 font-mono">
              {item.percent === null ? "—" : `${item.percent} / ${PERCENT_MAX}`}
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            {item.percent !== null && (
              <div
                className={`h-full rounded-full transition-all duration-500 shadow-xs ${getColorClass(item.percent)}`}
                style={{ width: `${item.percent}%` }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ScoreBreakdown;

import React from "react";
import { Check } from "lucide-react";

export interface DebateStepperProps {
  currentRound: number; // 1, 2, or 3
  onSelectRound?: (round: number) => void;
}

const DebateStepper: React.FC<DebateStepperProps> = ({ currentRound }) => {
  const steps = [
    { number: 1, label: "Mở đầu", duration: "3 phút" },
    { number: 2, label: "Phản biện", duration: "3 phút" },
    { number: 3, label: "Kết luận", duration: "2 phút" },
  ];

  return (
    <div className="flex items-center justify-between bg-white debate-panel-main px-6 py-4 rounded-2xl border border-slate-200 shadow-xs">
      {steps.map((step, idx) => {
        const isCompleted = step.number < currentRound;
        const isCurrent = step.number === currentRound;

        return (
          <React.Fragment key={step.number}>
            <div className="flex items-center gap-3.5">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-[15px] font-bold transition-all ${
                  isCompleted
                    ? "bg-[#008A64] text-white shadow-xs"
                    : isCurrent
                    ? "bg-[#008A64] text-white ring-4 ring-[#ECFDF5] dark:ring-emerald-950/60 shadow-xs"
                    : "bg-slate-100 text-slate-400 dark:bg-[#10231C] dark:text-[#94A3B8]"
                }`}
              >
                {isCompleted ? <Check size={16} strokeWidth={2.5} /> : step.number}
              </div>
              <div>
                <div
                  className={`text-[15px] sm:text-[16px] font-semibold transition-colors ${
                    isCurrent
                      ? "text-[#008A64] dark:text-[#34D399]"
                      : isCompleted
                      ? "text-slate-900 dark:text-[#F8FAFC]"
                      : "text-slate-400 dark:text-[#94A3B8]"
                  }`}
                >
                  Vòng {step.number} - {step.label}
                </div>
                <div
                  className={`text-[14px] ${
                    isCurrent
                      ? "text-[#008A64]/80 dark:text-[#34D399]/80"
                      : "text-slate-400 dark:text-[#94A3B8]"
                  }`}
                >
                  {step.duration}
                </div>
              </div>
            </div>

            {idx < steps.length - 1 && (
              <div
                className={`flex-1 mx-4 sm:mx-6 h-1 rounded-full transition-colors ${
                  step.number < currentRound
                    ? "bg-[#008A64]"
                    : "bg-slate-200 dark:bg-slate-700/80"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default DebateStepper;

import React from "react";
import { calculatePasswordStrength } from "../../utils/passwordValidator";

interface PasswordStrengthProps {
  password: string;
  className?: string;
  /** "apple": the calm look of the sign-in and sign-up screens. */
  appearance?: "default" | "apple";
}

const PasswordStrength: React.FC<PasswordStrengthProps> = ({ password, className = "", appearance = "default" }) => {
  if (!password) return null;

  const { score, label, colorClass } = calculatePasswordStrength(password);

  const getSegmentColor = (segmentIndex: number) => {
    if (segmentIndex > score) return "bg-slate-200";

    switch (score) {
      case 1:
        return "bg-rose-500";
      case 2:
        return "bg-amber-500";
      case 3:
        return "bg-orange-500";
      case 4:
        return "bg-blue-500";
      case 5:
        return "bg-blue-600";
      default:
        return "bg-slate-200";
    }
  };

  if (appearance === "apple") {
    const fill = score >= 4 ? "bg-accent" : score === 3 ? "bg-ap-warning" : "bg-ap-danger";
    return (
      <div className={`mt-(--s-3) flex flex-col gap-(--s-2) ${className}`} data-testid="password-strength">
        <div className="flex items-center justify-between text-(length:--text-caption)">
          <span className="text-label-secondary">Độ mạnh mật khẩu</span>
          <span className="font-medium text-label" aria-live="polite">
            {label}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-1" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((index) => (
            <div
              key={index}
              className={`h-1 rounded-full transition-colors duration-(--t-base) ${index <= score ? fill : "bg-separator"}`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 mb-3 animate-fade-in ${className}`}>
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="text-slate-600">Độ mạnh mật khẩu</span>
        <span className={`${colorClass} font-bold transition-colors duration-200`}>
          {label}
        </span>
      </div>

      {/* Segmented Strength Bar */}
      <div className="grid grid-cols-5 gap-1.5 h-1.5 w-full bg-slate-100 p-0.5 rounded-full">
        {[1, 2, 3, 4, 5].map((index) => (
          <div
            key={index}
            className={`h-full rounded-full transition-all duration-300 ${getSegmentColor(index)}`}
          />
        ))}
      </div>
    </div>
  );
};

export default PasswordStrength;

import React from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { checkPasswordRequirements } from "../../utils/passwordValidator";

interface PasswordRequirementsProps {
  password: string;
  className?: string;
  /** "apple": the calm look of the sign-in and sign-up screens. */
  appearance?: "default" | "apple";
}

const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({
  password,
  className = "",
  appearance = "default",
}) => {
  const requirements = checkPasswordRequirements(password);

  if (appearance === "apple") {
    return (
      <ul className={`mt-(--s-3) grid grid-cols-1 gap-(--s-2) sm:grid-cols-2 ${className}`} aria-label="Yêu cầu mật khẩu">
        {requirements.map((req) => (
          <li
            key={req.id}
            className={`inline-flex items-center gap-(--s-2) text-(length:--text-caption) transition-colors duration-(--t-base) ${
              req.met ? "text-label" : "text-label-secondary"
            }`}
          >
            {req.met ? (
              <CheckCircle2 size={14} className="shrink-0 text-accent" aria-hidden="true" />
            ) : (
              <Circle size={14} className="shrink-0 text-label-tertiary" aria-hidden="true" />
            )}
            <span>
              {req.label}
              <span className="sr-only">{req.met ? " (đã đạt)" : " (chưa đạt)"}</span>
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={`pt-1 pb-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs">
        {requirements.map((req) => (
          <div
            key={req.id}
            className={`inline-flex items-center gap-1.5 transition-colors duration-200 ${
              req.met ? "text-blue-700 font-semibold" : "text-slate-400 font-normal"
            }`}
          >
            {req.met ? (
              <CheckCircle2 size={13} className="text-blue-600 shrink-0" />
            ) : (
              <Circle size={13} className="text-slate-300 shrink-0" />
            )}
            <span>{req.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PasswordRequirements;

export interface PasswordRequirementItem {
  id: string;
  label: string;
  met: boolean;
}

export interface PasswordStrengthResult {
  score: number; // 0 to 5
  label: "Rất yếu" | "Yếu" | "Trung bình" | "Mạnh" | "Rất mạnh";
  colorClass: string;
  bgClass: string;
  requirements: PasswordRequirementItem[];
  isValid: boolean;
}

export const checkPasswordRequirements = (password: string): PasswordRequirementItem[] => {
  return [
    {
      id: "min_length",
      label: "8+ ký tự",
      met: password.length >= 8,
    },
    {
      id: "uppercase",
      label: "A-Z (chữ hoa)",
      met: /[A-Z]/.test(password),
    },
    {
      id: "lowercase",
      label: "a-z (chữ thường)",
      met: /[a-z]/.test(password),
    },
    {
      id: "number",
      label: "0-9 (chữ số)",
      met: /[0-9]/.test(password),
    },
    {
      id: "special",
      label: "!@#$ (ký tự đặc biệt)",
      met: /[^A-Za-z0-9]/.test(password),
    },
  ];
};

export const calculatePasswordStrength = (password: string): PasswordStrengthResult => {
  if (!password) {
    return {
      score: 0,
      label: "Rất yếu",
      colorClass: "text-slate-400",
      bgClass: "bg-slate-200",
      requirements: checkPasswordRequirements(""),
      isValid: false,
    };
  }

  const requirements = checkPasswordRequirements(password);
  const metCount = requirements.filter((r) => r.met).length;

  let score = metCount;
  // Extra bonus for long length
  if (password.length >= 12 && metCount >= 4) {
    score = 5;
  }

  let label: "Rất yếu" | "Yếu" | "Trung bình" | "Mạnh" | "Rất mạnh" = "Rất yếu";
  let colorClass = "text-rose-500";
  let bgClass = "bg-rose-500";

  switch (score) {
    case 1:
      label = "Rất yếu";
      colorClass = "text-rose-500";
      bgClass = "bg-rose-500";
      break;
    case 2:
      label = "Yếu";
      colorClass = "text-amber-500";
      bgClass = "bg-amber-500";
      break;
    case 3:
      label = "Trung bình";
      colorClass = "text-orange-500";
      bgClass = "bg-orange-500";
      break;
    case 4:
      label = "Mạnh";
      colorClass = "text-blue-500";
      bgClass = "bg-blue-500";
      break;
    case 5:
      label = "Rất mạnh";
      colorClass = "text-blue-600";
      bgClass = "bg-blue-600";
      break;
    default:
      label = "Rất yếu";
      colorClass = "text-rose-500";
      bgClass = "bg-rose-500";
      break;
  }

  return {
    score,
    label,
    colorClass,
    bgClass,
    requirements,
    isValid: metCount >= 4 && password.length >= 8,
  };
};

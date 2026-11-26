import React from "react";
import { CompetitionLifecycleStatus } from "../../../types";

interface Props {
  status: CompetitionLifecycleStatus | string;
  className?: string;
}

export const getStatusLabel = (status: string): string => {
  switch (status) {
    case "Draft":
      return "Bản nháp";
    case "OpenRegistration":
      return "Đang mở đăng ký";
    case "RegistrationClosed":
      return "Đã đóng đăng ký";
    case "Ongoing":
      return "Đang diễn ra";
    case "Completed":
      return "Đã hoàn thành";
    case "Cancelled":
      return "Đã hủy";
    default:
      return status;
  }
};

export const getStatusStyle = (status: string): string => {
  switch (status) {
    case "Draft":
      return "bg-slate-100 text-slate-600 border-slate-200";
    case "OpenRegistration":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "RegistrationClosed":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Ongoing":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "Completed":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "Cancelled":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
};

const CompetitionStatusBadge: React.FC<Props> = ({ status, className = "" }) => {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-colors ${getStatusStyle(
        status
      )} ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
          status === "OpenRegistration" || status === "Ongoing"
            ? "bg-blue-500 animate-pulse"
            : "bg-current opacity-70"
        }`}
      />
      {getStatusLabel(status)}
    </span>
  );
};

export default CompetitionStatusBadge;

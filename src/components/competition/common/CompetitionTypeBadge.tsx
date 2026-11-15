import React from "react";
import { User, Users } from "lucide-react";
import { CompetitionType } from "../../../types";

interface Props {
  type: CompetitionType | string;
  className?: string;
}

const CompetitionTypeBadge: React.FC<Props> = ({ type, className = "" }) => {
  const isTeam = type === "TEAM";

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
        isTeam
          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
          : "bg-teal-50 text-teal-700 border-teal-200"
      } ${className}`}
    >
      {isTeam ? <Users size={12} /> : <User size={12} />}
      {isTeam ? "Đồng đội (2 người)" : "Cá nhân"}
    </span>
  );
};

export default CompetitionTypeBadge;

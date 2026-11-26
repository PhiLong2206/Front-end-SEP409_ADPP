import React, { useState } from "react";
import { ChevronDown, ChevronUp, Target } from "lucide-react";
import { isLongGuide } from "../../topic/TopicGuides";

export type GuideSide = "pro" | "con";

interface TaskGuidePanelProps {
  /** The side of the current user in this session (from the participant), the one whose task is highlighted. */
  side: GuideSide;
  proGuide?: string | null;
  conGuide?: string | null;
  /** Open at first (the lobby and the preparation minute); folded to its title bar otherwise. */
  defaultOpen?: boolean;
  className?: string;
}

const SIDE_LABEL: Record<GuideSide, string> = {
  pro: "Phe Ủng hộ (PRO)",
  con: "Phe Phản đối (CON)",
};

/**
 * "Nhiệm vụ của bạn": the task of the user's side, highlighted, and the other side's task smaller in a fold. It is read
 * from the session, so a side swap shows the new task at once, and both people of a 2v2 team see the same text.
 */
const TaskGuidePanel: React.FC<TaskGuidePanelProps> = ({ side, proGuide, conGuide, defaultOpen = true, className = "" }) => {
  const mine = ((side === "pro" ? proGuide : conGuide) ?? "").trim();
  const other = ((side === "pro" ? conGuide : proGuide) ?? "").trim();
  const otherSide: GuideSide = side === "pro" ? "con" : "pro";
  // null: follow `defaultOpen`; the user's own choice wins once made
  const [openChoice, setOpenChoice] = useState<boolean | null>(null);
  const [expanded, setExpanded] = useState(false);
  const open = openChoice ?? defaultOpen;

  if (!mine && !other) return null;
  const long = isLongGuide(mine);
  const isPro = side === "pro";

  return (
    <section
      data-testid="task-guide-panel"
      data-side={side}
      aria-label="Nhiệm vụ của bạn"
      className={`rounded-ap-lg border ${
        isPro ? "border-accent/40 bg-accent-soft" : "border-ap-danger/40 bg-ap-danger/10"
      } ${className}`}
    >
      <button
        type="button"
        data-testid="task-guide-toggle"
        aria-expanded={open}
        onClick={() => setOpenChoice(!open)}
        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-(--s-3) rounded-ap-lg px-(--s-4) text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
      >
        <span className="flex items-center gap-(--s-2) text-(length:--text-callout) font-semibold">
          <Target size={16} className={isPro ? "text-accent" : "text-ap-danger"} aria-hidden="true" />
          <span>Nhiệm vụ của bạn</span>
          <span className="font-normal text-label-secondary">· {SIDE_LABEL[side]}</span>
        </span>
        {open ? (
          <ChevronUp size={16} className="text-label-secondary" aria-hidden="true" />
        ) : (
          <ChevronDown size={16} className="text-label-secondary" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div className="space-y-(--s-3) px-(--s-4) pb-(--s-4)">
          {mine && (
            <div>
              <p
                data-testid="task-guide-mine"
                className={`whitespace-pre-line text-(length:--text-body) font-medium leading-(--leading-body) text-label ${
                  long && !expanded ? "line-clamp-3" : ""
                }`}
              >
                {mine}
              </p>
              {long && (
                <button
                  type="button"
                  data-testid="task-guide-mine-toggle"
                  aria-expanded={expanded}
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-(--s-1) inline-flex min-h-8 cursor-pointer items-center text-(length:--text-caption) font-medium text-accent hover:underline focus-visible:outline-none focus-visible:underline"
                >
                  {expanded ? "Thu gọn" : "Xem thêm"}
                </button>
              )}
            </div>
          )}

          {other && (
            <details data-testid="task-guide-other" className="group text-(length:--text-caption) text-label-secondary">
              <summary className="flex min-h-8 cursor-pointer list-none items-center gap-(--s-2) font-medium hover:text-label focus-visible:outline-none focus-visible:underline">
                <ChevronDown size={14} className="transition-transform group-open:rotate-180" aria-hidden="true" />
                <span>Nhiệm vụ của {SIDE_LABEL[otherSide]}</span>
              </summary>
              <p className="mt-(--s-1) whitespace-pre-line leading-(--leading-body)">{other}</p>
            </details>
          )}
        </div>
      )}
    </section>
  );
};

export default TaskGuidePanel;

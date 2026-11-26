import React, { useState } from "react";

/** A guide longer than this (or with more than 3 lines) is shown in 3 lines with a "Xem thêm" button. */
export const GUIDE_PREVIEW_CHARS = 150;
const GUIDE_PREVIEW_LINES = 3;

export const isLongGuide = (text: string): boolean =>
  text.length > GUIDE_PREVIEW_CHARS || text.split(/\r?\n/).length > GUIDE_PREVIEW_LINES;

interface GuideBoxProps {
  side: "pro" | "con";
  text: string;
}

const GuideBox: React.FC<GuideBoxProps> = ({ side, text }) => {
  const [expanded, setExpanded] = useState(false);
  const long = isLongGuide(text);
  const isPro = side === "pro";

  return (
    <div
      data-testid={`topic-guide-${side}`}
      className={`rounded-ap-lg p-(--s-5) ${isPro ? "bg-accent-soft" : "bg-ap-danger/10"}`}
    >
      <h4 className="mb-(--s-2) flex items-center gap-(--s-2) text-(length:--text-callout) font-semibold">
        <span>{isPro ? "Phe Ủng hộ (PRO)" : "Phe Phản đối (CON)"}</span>
      </h4>
      <p
        data-testid={`topic-guide-${side}-text`}
        className={`whitespace-pre-line text-(length:--text-callout) leading-(--leading-body) text-label ${
          long && !expanded ? "line-clamp-3" : ""
        }`}
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          data-testid={`topic-guide-${side}-toggle`}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="mt-(--s-2) inline-flex min-h-8 cursor-pointer items-center text-(length:--text-caption) font-medium text-accent hover:underline focus-visible:outline-none focus-visible:underline"
        >
          {expanded ? "Thu gọn" : "Xem thêm"}
        </button>
      )}
    </div>
  );
};

export interface TopicGuidesProps {
  proGuide?: string | null;
  conGuide?: string | null;
  className?: string;
}

/** "Nhiệm vụ": what each side has to do in this topic, in two boxes. Nothing is shown when the topic has no guides. */
const TopicGuides: React.FC<TopicGuidesProps> = ({ proGuide, conGuide, className = "" }) => {
  const pro = proGuide?.trim() ?? "";
  const con = conGuide?.trim() ?? "";
  if (!pro && !con) return null;

  return (
    <section data-testid="topic-guides" aria-label="Nhiệm vụ" className={`space-y-(--s-3) ${className}`}>
      <h3 className="text-(length:--text-caption) font-medium uppercase tracking-wider text-label-secondary">Nhiệm vụ</h3>
      <div className="grid grid-cols-1 gap-(--s-3) sm:grid-cols-2">
        {pro && <GuideBox side="pro" text={pro} />}
        {con && <GuideBox side="con" text={con} />}
      </div>
    </section>
  );
};

export default TopicGuides;

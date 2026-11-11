import React from "react";
import { ShieldCheck, ExternalLink } from "lucide-react";
import type { EvidenceCitation, EvidenceLabel, EvidenceStatus } from "../../types";
import type { EvidenceRoundView } from "../../utils/debateScoring";

interface EvidenceCheckPanelProps {
  /** Evidence checks of the debater's graded rounds; the panel renders nothing when empty. */
  rounds?: EvidenceRoundView[];
}

const LABEL_ORDER: EvidenceLabel[] = ["SUPPORTED", "CONTRADICTED", "NOT_FOUND", "CONFLICTING"];

const LABEL_TEXT: Record<EvidenceLabel, string> = {
  SUPPORTED: "Đúng nguồn",
  CONTRADICTED: "Sai so với nguồn",
  NOT_FOUND: "Không tìm thấy trong kho",
  CONFLICTING: "Nguồn chưa thống nhất",
};

const LABEL_STYLE: Record<EvidenceLabel, string> = {
  SUPPORTED:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/50",
  CONTRADICTED: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800/50",
  NOT_FOUND:
    "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
  CONFLICTING:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/50",
};

/** Turns that were not checked claim by claim: a fixed message, never the evaluator's raw error. */
const STATUS_MESSAGE: Partial<Record<EvidenceStatus, string>> = {
  no_claims: "Lượt này không có số liệu/sự kiện cần kiểm chứng.",
  no_fact_base: "Chủ đề này chưa có kho dữ kiện đã duyệt.",
  unavailable: "Tạm thời không kiểm chứng được.",
};

const STANCE_TEXT = { supports: "xác nhận", contradicts: "trái ngược" } as const;

const URL_PATTERN = /https?:\/\/\S+/;

const CitationSource: React.FC<{ citation: EvidenceCitation["citation"] }> = ({ citation }) => {
  if (!citation) return null;
  const url = citation.match(URL_PATTERN)?.[0]?.replace(/[).,;]+$/, "");
  const name = (url ? citation.replace(url, "") : citation).replace(/[\s-]+$/, "").trim();
  return (
    <span className="text-slate-500 dark:text-slate-400">
      {name || "Nguồn"}
      {url && (
        <>
          {" · "}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-[#008A64] dark:text-[#34D399] hover:underline"
          >
            Xem nguồn <ExternalLink size={10} />
          </a>
        </>
      )}
    </span>
  );
};

const LabelChip: React.FC<{ label: EvidenceLabel; count?: number }> = ({ label, count }) => (
  <span
    data-testid={count === undefined ? undefined : `evidence-count-${label}`}
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${LABEL_STYLE[label] ?? LABEL_STYLE.NOT_FOUND}`}
  >
    {LABEL_TEXT[label] ?? label}
    {count !== undefined && <span className="font-mono">{count}</span>}
  </span>
);

const EvidenceCheckPanel: React.FC<EvidenceCheckPanelProps> = ({ rounds }) => {
  if (!rounds || rounds.length === 0) return null;

  const counts = LABEL_ORDER.map((label) => ({
    label,
    count: rounds.reduce(
      (sum, r) => sum + r.turns.reduce((s, t) => s + t.claims.filter((c) => c.label === label).length, 0),
      0
    ),
  }));

  return (
    <section
      data-testid="evidence-check-panel"
      className="bg-white dark:bg-[#10231C] p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-[#F8FAFC] tracking-tight flex items-center gap-2">
          <ShieldCheck size={18} className="text-[#008A64]" />
          Kiểm chứng số liệu
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {counts.map(({ label, count }) => (
            <LabelChip key={label} label={label} count={count} />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {rounds.map((round) => {
          const scoreChanged =
            round.scoreBefore !== null && round.scoreAfter !== null && round.scoreBefore !== round.scoreAfter;
          return (
            <div key={round.stage} data-testid={`evidence-round-${round.stage}`} className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Vòng {round.label}
                </p>
                {scoreChanged && (
                  <p data-testid={`evidence-score-${round.stage}`} className="text-[11px] text-slate-500 dark:text-slate-400">
                    Điểm Evidence: {round.scoreBefore} → {round.scoreAfter}
                    {round.ruleApplied && ` (${round.ruleApplied})`}
                  </p>
                )}
              </div>

              {round.turns.map((turn) => {
                const statusMessage = turn.claims.length === 0 ? STATUS_MESSAGE[turn.status] : undefined;
                return (
                  <div
                    key={turn.turnIndex}
                    className="p-3 bg-slate-50 dark:bg-[#091713] rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs"
                  >
                    <p className="text-slate-500 dark:text-slate-400 italic line-clamp-2">&ldquo;{turn.excerpt}&rdquo;</p>
                    {statusMessage && (
                      <p data-testid={`evidence-status-${turn.status}`} className="text-slate-600 dark:text-slate-300">
                        {statusMessage}
                      </p>
                    )}
                    {turn.claims.map((claim, idx) => (
                      <div
                        key={idx}
                        data-testid="evidence-claim"
                        className="p-2.5 bg-white dark:bg-[#123326] rounded-xl border border-slate-100 dark:border-slate-800 space-y-1.5"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-2">
                          <LabelChip label={claim.label} />
                          <p className="font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">{claim.claim}</p>
                        </div>
                        {claim.reason && (
                          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{claim.reason}</p>
                        )}
                        {claim.citations.length > 0 && (
                          <ul className="space-y-1 pl-2 border-l-2 border-slate-200 dark:border-slate-700">
                            {claim.citations.map((fact) => (
                              <li key={fact.fact_id} className="text-[11px] leading-relaxed space-y-0.5">
                                <p className="text-slate-600 dark:text-slate-300 line-clamp-3">
                                  {fact.stance && (
                                    <span className="font-bold text-slate-700 dark:text-slate-200">
                                      Nguồn {STANCE_TEXT[fact.stance]}:{" "}
                                    </span>
                                  )}
                                  {fact.content}
                                </p>
                                <CitationSource citation={fact.citation} />
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <p className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
        Không tìm thấy ≠ sai. Kho dữ kiện chỉ gồm nguồn đã được Organizer duyệt.
      </p>
    </section>
  );
};

export default EvidenceCheckPanel;

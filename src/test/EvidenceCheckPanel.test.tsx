import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import EvidenceCheckPanel from "../components/debate/EvidenceCheckPanel";
import { buildDebateResult, buildEvidenceRounds, toEvidenceTopic } from "../utils/debateScoring";
import type { EvidenceCheckSummary, RoundEvaluationResult } from "../types";

const check = (summary: Partial<EvidenceCheckSummary>): EvidenceCheckSummary => ({
  status: "checked",
  claims: [],
  counts: {},
  rule_applied: "",
  ...summary,
});

const round = (stage: RoundEvaluationResult["stage"], extra: Partial<RoundEvaluationResult> = {}): RoundEvaluationResult => ({
  stage,
  round_score: 7,
  criteria: [],
  consistency_note: "",
  strengths: [],
  weaknesses: [],
  suggestions: [],
  ...extra,
});

const checkedOpening = round("opening", {
  evidence_checks: [
    {
      turn_index: 0,
      excerpt: "Hơn 14.695 trường tiểu học, 40 lớp tập huấn",
      evidence_check: check({
        claims: [
          {
            claim: "VVOB tiếp cận hơn 14.695 trường tiểu học",
            label: "SUPPORTED",
            reason: "Khớp fact",
            citations: [
              {
                fact_id: "f1",
                content: "VVOB dự kiến tiếp cận hơn 14.695 trường",
                citation: "Thanh Niên - https://thanhnien.vn/bai-viet.htm",
                stance: "supports",
              },
            ],
          },
          {
            claim: "Dự án có 40 lớp tập huấn",
            label: "CONTRADICTED",
            reason: "Fact ghi 115 lớp",
            citations: [{ fact_id: "f2", content: "Có 115 lớp tập huấn", citation: null, stance: "contradicts" }],
          },
        ],
        counts: { SUPPORTED: 1, CONTRADICTED: 1 },
      }),
    },
  ],
  evidence_score_before: 3,
  evidence_score_after: 1,
  evidence_rule_applied: "1/2 claim CONTRADICTED",
});

describe("buildEvidenceRounds / toEvidenceTopic", () => {
  it("keeps the stage order, drops the technical error and rounds that were not checked", () => {
    const rounds = buildEvidenceRounds([
      round("closing", {
        evidence_checks: [
          { turn_index: 1, excerpt: "x", evidence_check: check({ status: "unavailable", error: "TimeoutError: verify 20 s" }) },
        ],
      }),
      round("rebuttal", { evidence_checks: [] }),
      checkedOpening,
    ])!;

    expect(rounds.map((r) => r.stage)).toEqual(["opening", "closing"]);
    expect(rounds[0]).toMatchObject({ label: "Mở đầu", scoreBefore: 3, scoreAfter: 1, ruleApplied: "1/2 claim CONTRADICTED" });
    expect(JSON.stringify(rounds)).not.toContain("TimeoutError");
    expect(rounds[1].turns[0]).not.toHaveProperty("error");
  });

  it("is undefined when no round was checked (old evaluator, no topic, RAG off)", () => {
    expect(buildEvidenceRounds([round("opening"), round("rebuttal", { evidence_checks: [] })])).toBeUndefined();
    const result = buildDebateResult({
      sessionId: "1",
      topicTitle: "t",
      sessionResult: null,
      roundResults: [round("opening")],
      lastTurnEvaluation: null,
    });
    expect(result?.evidenceRounds).toBeUndefined();
  });

  it("maps only the 4 fact-base topics", () => {
    expect(toEvidenceTopic("education")).toBe("education");
    expect(toEvidenceTopic(" Technology ")).toBe("technology");
    expect(toEvidenceTopic("politics")).toBeUndefined();
    expect(toEvidenceTopic(null)).toBeUndefined();
  });
});

describe("EvidenceCheckPanel", () => {
  it("renders nothing without checked rounds", () => {
    const { container, rerender } = render(<EvidenceCheckPanel rounds={undefined} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<EvidenceCheckPanel rounds={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("counts the claims per label, shows each claim with its source and the score change", () => {
    const second = round("closing", {
      evidence_checks: [
        {
          turn_index: 0,
          excerpt: "y",
          evidence_check: check({
            claims: [
              { claim: "c3", label: "NOT_FOUND", reason: "", citations: [] },
              { claim: "c4", label: "CONFLICTING", reason: "Hai nguồn khác nhau", citations: [] },
              { claim: "c5", label: "SUPPORTED", reason: "", citations: [] },
            ],
          }),
        },
      ],
      evidence_score_before: 2,
      evidence_score_after: 2,
      evidence_rule_applied: "Giữ nguyên",
    });
    render(<EvidenceCheckPanel rounds={buildEvidenceRounds([checkedOpening, second])} />);

    expect(screen.getByTestId("evidence-count-SUPPORTED")).toHaveTextContent("2");
    expect(screen.getByTestId("evidence-count-CONTRADICTED")).toHaveTextContent("1");
    expect(screen.getByTestId("evidence-count-NOT_FOUND")).toHaveTextContent("1");
    expect(screen.getByTestId("evidence-count-CONFLICTING")).toHaveTextContent("1");
    expect(screen.getAllByTestId("evidence-claim")).toHaveLength(5);

    const opening = screen.getByTestId("evidence-round-opening");
    expect(within(opening).getByText("Dự án có 40 lớp tập huấn")).toBeInTheDocument();
    expect(within(opening).getByText("Fact ghi 115 lớp")).toBeInTheDocument();
    expect(within(opening).getByRole("link", { name: /Xem nguồn/ })).toHaveAttribute("href", "https://thanhnien.vn/bai-viet.htm");
    expect(within(opening).getByText(/Thanh Niên/)).toBeInTheDocument();
    expect(screen.getByTestId("evidence-score-opening")).toHaveTextContent("Điểm Evidence: 3 → 1 (1/2 claim CONTRADICTED)");
    // Unchanged score: no line
    expect(screen.queryByTestId("evidence-score-closing")).not.toBeInTheDocument();
    expect(screen.getByText(/Không tìm thấy ≠ sai/)).toBeInTheDocument();
  });

  it("shows the 3 special states with a fixed message and never the raw error", () => {
    const rounds = buildEvidenceRounds([
      round("opening", {
        evidence_checks: [
          { turn_index: 0, excerpt: "a", evidence_check: check({ status: "no_claims" }) },
          { turn_index: 2, excerpt: "b", evidence_check: check({ status: "no_fact_base" }) },
          { turn_index: 4, excerpt: "c", evidence_check: check({ status: "unavailable", error: "OperationalError: db down" }) },
        ],
      }),
    ]);
    render(<EvidenceCheckPanel rounds={rounds} />);

    expect(screen.getByTestId("evidence-status-no_claims")).toHaveTextContent("Lượt này không có số liệu/sự kiện cần kiểm chứng.");
    expect(screen.getByTestId("evidence-status-no_fact_base")).toHaveTextContent("Chủ đề này chưa có kho dữ kiện đã duyệt.");
    expect(screen.getByTestId("evidence-status-unavailable")).toHaveTextContent("Tạm thời không kiểm chứng được.");
    expect(screen.queryByText(/OperationalError/)).not.toBeInTheDocument();
  });
});

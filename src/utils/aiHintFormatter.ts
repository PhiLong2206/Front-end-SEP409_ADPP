/**
 * Safely format AI Hint response (which can be a string, raw markdown, or a structured CoachingResult object)
 * into a clean, human-readable string for rendering in the UI.
 * Prevents "Objects are not valid as a React child" errors.
 */

export interface CoachingCriterionLike {
  name?: string;
  Name?: string;
  diagnosis?: string;
  Diagnosis?: string;
  methods?: string[];
  Methods?: string[];
  application?: string;
  Application?: string;
}

export interface IdeaDevelopmentLike {
  core_claim?: string;
  CoreClaim?: string;
  directions?: string[];
  Directions?: string[];
  evidence_to_look_for?: string[];
  EvidenceToLookFor?: string[];
}

export interface AiHintObjectLike {
  focus_criteria?: CoachingCriterionLike[];
  FocusCriteria?: CoachingCriterionLike[];
  idea_development?: IdeaDevelopmentLike;
  IdeaDevelopment?: IdeaDevelopmentLike;
  raw_model_output?: string;
  RawModelOutput?: string;
  message?: string;
  text?: string;
  [key: string]: unknown;
}

export function formatAiHintContent(hint: unknown): string {
  if (hint === null || hint === undefined) {
    return "";
  }

  if (typeof hint === "string") {
    return hint.trim();
  }

  if (typeof hint === "object") {
    const h = hint as AiHintObjectLike;
    const sections: string[] = [];

    // 1. Process idea_development (core claim, directions, suggested evidence)
    const idea = h.idea_development || h.IdeaDevelopment;
    if (idea && typeof idea === "object") {
      const coreClaim = idea.core_claim || idea.CoreClaim;
      if (coreClaim) {
        sections.push(`💡 Luận điểm cốt lõi:\n${coreClaim}`);
      }

      const directions = idea.directions || idea.Directions;
      if (Array.isArray(directions) && directions.length > 0) {
        sections.push(`🎯 Hướng phát triển lập luận:\n` + directions.map((d) => `• ${d}`).join("\n"));
      }

      const evidence = idea.evidence_to_look_for || idea.EvidenceToLookFor;
      if (Array.isArray(evidence) && evidence.length > 0) {
        sections.push(`🔍 Bằng chứng / Ví dụ cần bổ sung:\n` + evidence.map((e) => `• ${e}`).join("\n"));
      }
    }

    // 2. Process focus_criteria (diagnosis, methods, concrete application)
    const criteria = h.focus_criteria || h.FocusCriteria;
    if (Array.isArray(criteria) && criteria.length > 0) {
      const critBlocks = criteria
        .filter((c) => c && typeof c === "object")
        .map((c) => {
          const name = c.name || c.Name || "Tiêu chí";
          const diag = c.diagnosis || c.Diagnosis || "";
          const app = c.application || c.Application || "";
          const methods = (c.methods || c.Methods || []).filter(Boolean);

          const lines: string[] = [`📌 [${name}]: ${diag}`];
          if (methods.length > 0) {
            lines.push(`   - Phương pháp: ${methods.join(", ")}`);
          }
          if (app) {
            lines.push(`   - Áp dụng: ${app}`);
          }
          return lines.join("\n");
        });

      if (critBlocks.length > 0) {
        sections.push(`⚖️ Trọng tâm cải thiện:\n` + critBlocks.join("\n\n"));
      }
    }

    if (sections.length > 0) {
      return sections.join("\n\n");
    }

    if (typeof h.message === "string" && h.message.trim()) {
      return h.message.trim();
    }
    if (typeof h.text === "string" && h.text.trim()) {
      return h.text.trim();
    }

    // Strip raw_model_output to avoid leaking prompt traces, then display cleanly
    const { raw_model_output: _rm1, RawModelOutput: _rm2, ...rest } = h;
    const remaining = Object.keys(rest);
    if (remaining.length > 0) {
      return JSON.stringify(rest, null, 2);
    }
  }

  return String(hint);
}

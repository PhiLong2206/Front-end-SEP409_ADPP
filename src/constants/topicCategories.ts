/**
 * The fixed topic categories (same list as the backend's TopicCategories). The backend stores the code; the web shows
 * the label. There is no catch-all "General" category: every topic belongs to one of these.
 * The categories with a fact base get the evidence check of the AI Evaluator (on the result page).
 */
export interface TopicCategory {
  code: string;
  label: string;
  hasEvidence: boolean;
}

export const TOPIC_CATEGORIES: readonly TopicCategory[] = [
  { code: "education", label: "Giáo dục", hasEvidence: true },
  { code: "technology", label: "Công nghệ", hasEvidence: true },
  { code: "society", label: "Xã hội", hasEvidence: true },
];

/** Shown for a topic still outside the list (an old "General" topic, until an admin gives it a category). */
export const UNCATEGORIZED_LABEL = "Chưa phân loại";

/** The code of a category given as its code or its label (case and spaces ignored), or null. */
export function normalizeTopicCategory(value: string | null | undefined): string | null {
  const v = value?.trim().toLowerCase();
  if (!v) return null;
  const found = TOPIC_CATEGORIES.find((c) => c.code === v || c.label.toLowerCase() === v);
  return found ? found.code : null;
}

/** The label to show for a stored category. */
export function topicCategoryLabel(value: string | null | undefined): string {
  const code = normalizeTopicCategory(value);
  return code ? TOPIC_CATEGORIES.find((c) => c.code === code)!.label : UNCATEGORIZED_LABEL;
}

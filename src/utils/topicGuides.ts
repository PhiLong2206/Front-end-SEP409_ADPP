/**
 * The task descriptions of a topic (proGuide / conGuide) in the admin form.
 * Backend rules: a create without a guide uses the default text; an update that leaves a field out keeps the current
 * text; an update that sends "" goes back to the default text.
 */
export interface GuidePair {
  pro: string;
  con: string;
}

export interface TopicWithGuides {
  proGuide?: string | null;
  conGuide?: string | null;
  hasCustomGuides?: boolean;
}

/**
 * What the form starts with. A topic that still uses the default text starts EMPTY (the default shows only as the
 * placeholder), so saving the form can never write the default text into the database.
 */
export function initialGuideValues(topic?: TopicWithGuides | null): GuidePair {
  if (!topic || topic.hasCustomGuides !== true) return { pro: "", con: "" };
  return { pro: topic.proGuide ?? "", con: topic.conGuide ?? "" };
}

/** The default texts to show as placeholders (only a topic without its own guides has them in proGuide / conGuide). */
export function defaultGuidePlaceholders(topic?: TopicWithGuides | null): Partial<GuidePair> {
  if (!topic || topic.hasCustomGuides !== false) return {};
  return { pro: topic.proGuide ?? undefined, con: topic.conGuide ?? undefined };
}

/** Create: only a guide that was typed is sent; an empty one is left out, so the Backend uses its default. */
export function guidesForCreate(current: GuidePair): { proGuide?: string; conGuide?: string } {
  const out: { proGuide?: string; conGuide?: string } = {};
  if (current.pro.trim()) out.proGuide = current.pro.trim();
  if (current.con.trim()) out.conGuide = current.con.trim();
  return out;
}

/**
 * Update: only a guide that CHANGED is sent. Changed to a text: that text. Cleared (it had a custom text): "", which
 * means "back to the default". Untouched: left out, so the Backend keeps what it has.
 */
export function guidesForUpdate(initial: GuidePair, current: GuidePair): { proGuide?: string; conGuide?: string } {
  const out: { proGuide?: string; conGuide?: string } = {};
  if (current.pro !== initial.pro) out.proGuide = current.pro.trim();
  if (current.con !== initial.con) out.conGuide = current.con.trim();
  return out;
}

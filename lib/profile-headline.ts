/** The optional one-line headline a professional shows under their name. */

export const PROFILE_HEADLINE_MAX_LENGTH = 90;

function collapse(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
}

/** Display form: single line, null when empty, never longer than the limit. */
export function normalizeProfileHeadline(raw: unknown): string | null {
  const text = collapse(raw);
  if (!text) return null;
  if (text.length <= PROFILE_HEADLINE_MAX_LENGTH) return text;

  const room = text.slice(0, PROFILE_HEADLINE_MAX_LENGTH - 1);
  const lastSpace = room.lastIndexOf(" ");
  const cut = lastSpace > 0 ? room.slice(0, lastSpace) : room;
  return `${cut.replace(/[\s,.;:–-]+$/, "")}…`;
}

/** Validation for the settings form; an empty headline is allowed. */
export function profileHeadlineError(raw: unknown): "too_long" | null {
  return collapse(raw).length > PROFILE_HEADLINE_MAX_LENGTH ? "too_long" : null;
}

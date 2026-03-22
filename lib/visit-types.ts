/** Canonical visit categories for public booking (stored in appointments.visit_type). */
export const VISIT_TYPE_OPTIONS = [
  "First Consultation",
  "Follow-up",
  "Routine Check-up",
  "Urgency",
] as const;

export type VisitTypeOption = (typeof VISIT_TYPE_OPTIONS)[number];

const ALLOWED = new Set<string>(VISIT_TYPE_OPTIONS);

export const VISIT_NOTES_MAX_LENGTH = 200;

export function isValidVisitType(s: string): s is VisitTypeOption {
  return ALLOWED.has(s);
}

/** Returns canonical label or null if missing / invalid. */
export function parseVisitType(raw: unknown): VisitTypeOption | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return isValidVisitType(t) ? t : null;
}

/** Trim and clamp length; empty → null for DB. */
export function normalizeVisitNotes(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  return s.length > VISIT_NOTES_MAX_LENGTH
    ? s.slice(0, VISIT_NOTES_MAX_LENGTH)
    : s;
}

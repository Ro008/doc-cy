/** Max length for patient “reason for visit” on appointment requests (appointments.reason). */
export const APPOINTMENT_REASON_MAX_LENGTH = 2000;

/** Trim and clamp; empty → null (invalid for required booking field). */
export function normalizeAppointmentReason(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  return s.length > APPOINTMENT_REASON_MAX_LENGTH
    ? s.slice(0, APPOINTMENT_REASON_MAX_LENGTH)
    : s;
}

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

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

export type AppointmentStatusCode =
  | "REQUESTED"
  | "CONFIRMED"
  | "CANCELLED"
  | "NEEDS_RESCHEDULE"
  /** Closed after nobody answered before the visit time (backend pending). */
  | "EXPIRED";

/** Calendar export and “add to calendar” are only allowed once confirmed. */
export function isConfirmedForCalendar(
  status: string | null | undefined
): boolean {
  return String(status ?? "").trim().toUpperCase() === "CONFIRMED";
}

export function isCancelledAppointmentStatus(
  status: string | null | undefined
): boolean {
  return String(status ?? "").trim().toUpperCase() === "CANCELLED";
}

/**
 * A booking request nobody answered before its visit time.
 *
 * Frontend-ready, backend pending (see the commit that added this):
 * - "EXPIRED" is the status the backend will store once a doctor closes the
 *   request (not in the database yet).
 * - Until then, a REQUESTED row whose visit time has started counts as expired
 *   in the UI, so nothing needs a migration to look right.
 */
export function isExpiredRequest(
  row: { status: string | null | undefined; startIso: string },
  nowMs: number = Date.now(),
): boolean {
  const status = String(row.status ?? "").trim().toUpperCase();
  if (status === "EXPIRED") return true;
  if (status !== "REQUESTED") return false;
  const startMs = new Date(row.startIso).getTime();
  return Number.isFinite(startMs) && startMs <= nowMs;
}

export function isStoredExpiredStatus(status: string | null | undefined): boolean {
  return String(status ?? "").trim().toUpperCase() === "EXPIRED";
}

/**
 * Endpoint the agenda calls to close an expired request (backend pending).
 * Contract: POST { notifyPatient: boolean } → sets status EXPIRED (row kept for
 * stats), emails the patient when notifyPatient is true, and answers 200.
 */
export function closeExpiredRequestPath(appointmentId: string): string {
  return `/api/appointments/${encodeURIComponent(appointmentId)}/close-expired`;
}

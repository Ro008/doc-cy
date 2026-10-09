import { formatInTimeZone } from "date-fns-tz";
import { CY_TZ } from "@/lib/appointments";

/**
 * Dashboard "Missed requests" (user, 2026-10-08): booking requests nobody answered before their
 * time. The job stores them as EXPIRED and tells the patient; they leave the agenda, so this is
 * where she learns she missed them and can still call the patient. Lapsed proposals are not
 * these: they carry proposal_expires_at and are listed under "No new time chosen".
 * Closed per device, like "No new time chosen".
 */

/** Only the last week: older ones can't be saved by a call any more. */
export const MISSED_REQUEST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Shown at once on the dashboard; the rest behind "Show N more". */
export const MISSED_REQUESTS_SHOWN = 3;

export const MISSED_REQUESTS_DISMISSED_KEY = "doccy:dashboard:missed-requests-dismissed";

type MissedRow = {
  id?: string;
  status: string | null;
  appointment_datetime: string;
  proposal_expires_at: string | null;
};

export function isMissedRequest(row: MissedRow, nowMs: number): boolean {
  const status = String(row.status ?? "").trim().toUpperCase();
  if (status !== "EXPIRED" && status !== "REQUESTED") return false;
  // A lapsed proposal, not an unanswered request.
  if (row.proposal_expires_at) return false;
  const startMs = new Date(row.appointment_datetime).getTime();
  if (!Number.isFinite(startMs) || startMs > nowMs) return false;
  return nowMs - startMs <= MISSED_REQUEST_MAX_AGE_MS;
}

export function selectMissedRequests<T extends MissedRow>(
  rows: T[],
  nowMs: number,
  dismissedIds?: ReadonlySet<string>,
): T[] {
  return rows
    .filter((r) => isMissedRequest(r, nowMs) && !(r.id && dismissedIds?.has(r.id)))
    .sort((a, b) => new Date(b.appointment_datetime).getTime() - new Date(a.appointment_datetime).getTime());
}

export function missedRequestSummary(row: { appointment_datetime: string; patient_phone?: string | null }): {
  /** "Thu 8 Oct, 15:00": the time the patient asked for (Cyprus). */
  requestedLabel: string;
  call: { label: string; href: string } | null;
} {
  const phone = String(row.patient_phone ?? "").trim();
  const dial = phone.replace(/[^\d+]/g, "");
  return {
    requestedLabel: formatInTimeZone(new Date(row.appointment_datetime), CY_TZ, "EEE d MMM, HH:mm"),
    call: dial.replace(/\D/g, "").length >= 7 ? { label: phone, href: `tel:${dial}` } : null,
  };
}

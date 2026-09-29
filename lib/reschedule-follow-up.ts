import { formatInTimeZone } from "date-fns-tz";
import { CY_TZ } from "@/lib/appointments";

/**
 * Reschedules the doctor has to follow up on (dashboard "Needs your answer").
 *
 * CONTRACT for the backend (not in the database yet):
 * - RESCHEDULE_EXPIRED: final status the backend stores when a proposal expires with no choice
 *   (scheduled job). At that moment it also emails the patient ("your visit is no longer booked"
 *   + "Book a new time online" → public profile) — copy in lib/reschedule-emails.ts.
 *   Once it exists, add it to the dashboard query in app/dashboard/(home)/page.tsx.
 * - Until then, a NEEDS_RESCHEDULE row whose proposal_expires_at has passed counts as
 *   "no new time chosen" here, so nothing needs a migration to look right.
 * - "Close" calls the existing close-expired contract (lib/appointment-status.ts) with
 *   { notifyPatient: false }: the patient was already told; the row becomes EXPIRED.
 *   close-expired must accept RESCHEDULE_EXPIRED and lapsed NEEDS_RESCHEDULE rows.
 * - "Suggest other times" opens the review page; propose-reschedule and alternative-slots must
 *   accept these rows too (today they only take REQUESTED / CONFIRMED).
 * - appointments.rescheduled_from (timestamptz, nullable): set by
 *   POST /api/reschedule/[id]/request-other-time to the visit the patient moved away from.
 */
export const RESCHEDULE_EXPIRED_STATUS = "RESCHEDULE_EXPIRED";

/** Lapsed NEEDS_RESCHEDULE rows older than this are old data the backend never closed. */
const LAPSED_PROPOSAL_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

type FollowUpRow = {
  status: string | null;
  proposal_expires_at: string | null;
  appointment_datetime: string;
};

function statusOf(row: { status: string | null }): string {
  return String(row.status ?? "").trim().toUpperCase();
}

function timeMs(iso: string | null | undefined): number {
  return iso ? new Date(iso).getTime() : NaN;
}

function cyprusLabel(ms: number): string {
  return formatInTimeZone(new Date(ms), CY_TZ, "EEE d MMM, HH:mm");
}

/** The patient let the proposed times expire; the doctor decides what happens next. */
export function isRescheduleWithoutAnswer(row: FollowUpRow, nowMs: number): boolean {
  const status = statusOf(row);
  if (status === RESCHEDULE_EXPIRED_STATUS) return true;
  if (status !== "NEEDS_RESCHEDULE") return false;
  const expiresMs = timeMs(row.proposal_expires_at);
  if (!Number.isFinite(expiresMs) || expiresMs > nowMs) return false;
  return nowMs - expiresMs <= LAPSED_PROPOSAL_MAX_AGE_MS;
}

export function selectRescheduleWithoutAnswer<T extends FollowUpRow>(rows: T[], nowMs: number): T[] {
  return rows
    .filter((r) => isRescheduleWithoutAnswer(r, nowMs))
    .sort((a, b) => {
      const ea = timeMs(a.proposal_expires_at);
      const eb = timeMs(b.proposal_expires_at);
      if (Number.isFinite(ea) && Number.isFinite(eb) && ea !== eb) return ea - eb;
      return timeMs(a.appointment_datetime) - timeMs(b.appointment_datetime);
    });
}

export function rescheduleWithoutAnswerSummary(row: FollowUpRow): {
  /** "Tue 29 Sep, 15:00" — the visit before it was moved (Cyprus). */
  originalLabel: string;
  expiredLabel: string | null;
} {
  const expiresMs = timeMs(row.proposal_expires_at);
  return {
    originalLabel: cyprusLabel(timeMs(row.appointment_datetime)),
    expiredLabel: Number.isFinite(expiresMs) ? cyprusLabel(expiresMs) : null,
  };
}

/** Badge for a request the patient made from the reschedule link ("See other times"). */
export function askedForAnotherTimeLabel(row: { rescheduled_from?: string | null }): string | null {
  const fromMs = timeMs(row.rescheduled_from ?? null);
  if (!Number.isFinite(fromMs)) return null;
  return `Asked for another time · was ${cyprusLabel(fromMs)}`;
}

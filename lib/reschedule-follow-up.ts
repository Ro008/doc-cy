import { formatInTimeZone } from "date-fns-tz";
import { CY_TZ } from "@/lib/appointments";

/**
 * Proposals the patient let lapse (dashboard "No new time chosen"; user, 2026-10-04).
 * - The scheduled job stores plain EXPIRED once proposal_expires_at passes; the times are freed
 *   and nobody is emailed. proposal_expires_at tells it apart from an unanswered request.
 * - A NEEDS_RESCHEDULE row past its expiry counts too, until the job has run.
 * - Listed quietly with only "Close" (no re-suggest), which hides it on this device.
 */

/** Lapses older than this are not listed. */
const LAPSED_PROPOSAL_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/** localStorage key holding the ids she closed (per device is fine, user 2026-10-04). */
export const NO_NEW_TIME_DISMISSED_KEY = "doccy:dashboard:no-new-time-dismissed";

type FollowUpRow = {
  id?: string;
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

export function isRescheduleWithoutAnswer(row: FollowUpRow, nowMs: number): boolean {
  const status = statusOf(row);
  if (status !== "EXPIRED" && status !== "NEEDS_RESCHEDULE") return false;
  const expiresMs = timeMs(row.proposal_expires_at);
  if (!Number.isFinite(expiresMs) || expiresMs > nowMs) return false;
  return nowMs - expiresMs <= LAPSED_PROPOSAL_MAX_AGE_MS;
}

export function selectRescheduleWithoutAnswer<T extends FollowUpRow>(
  rows: T[],
  nowMs: number,
  dismissedIds?: ReadonlySet<string>,
): T[] {
  return rows
    .filter((r) => isRescheduleWithoutAnswer(r, nowMs) && !(r.id && dismissedIds?.has(r.id)))
    .sort((a, b) => {
      const ea = timeMs(a.proposal_expires_at);
      const eb = timeMs(b.proposal_expires_at);
      if (Number.isFinite(ea) && Number.isFinite(eb) && ea !== eb) return ea - eb;
      return timeMs(a.appointment_datetime) - timeMs(b.appointment_datetime);
    });
}

/** The stored list of closed ids; anything unreadable counts as none. */
export function parseDismissedIds(raw: string | null | undefined): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((v) => typeof v === "string")) return new Set();
    return new Set(parsed as string[]);
  } catch {
    return new Set();
  }
}

export function rescheduleWithoutAnswerSummary(row: FollowUpRow): {
  /** "Tue 29 Sep, 15:00" — the time the patient originally asked for (Cyprus). */
  originalLabel: string;
  expiredLabel: string | null;
} {
  const expiresMs = timeMs(row.proposal_expires_at);
  return {
    originalLabel: cyprusLabel(timeMs(row.appointment_datetime)),
    expiredLabel: Number.isFinite(expiresMs) ? cyprusLabel(expiresMs) : null,
  };
}

import { addMinutes } from "date-fns";

export type AppointmentIntervalRow = {
  id: string;
  appointment_datetime: string;
  duration_minutes: number | null | undefined;
};

/** Row shape for calendar blocking (includes temporary holds). */
export type DoctorAppointmentForBlocking = {
  id: string;
  status: string;
  appointment_datetime: string;
  duration_minutes: number | null | undefined;
  proposed_slots?: unknown;
  proposal_expires_at?: string | null;
};

function statusUpper(status: unknown): string {
  return String(status ?? "").toUpperCase();
}

/**
 * Blocking intervals for one appointment row. NEEDS_RESCHEDULE uses proposed_slots only
 * (original appointment_datetime is not held). Expired proposals contribute nothing.
 */
export function blockingIntervalsFromAppointment(
  row: DoctorAppointmentForBlocking,
  fallbackDurationMinutes: number,
  nowMs: number = Date.now()
): { start: Date; end: Date }[] {
  const st = statusUpper(row.status);
  if (st === "CANCELLED") return [];

  const dm = Number(row.duration_minutes);
  const duration =
    Number.isFinite(dm) && dm > 0 ? dm : Math.max(1, fallbackDurationMinutes);

  if (st === "NEEDS_RESCHEDULE") {
    const exp = row.proposal_expires_at
      ? new Date(row.proposal_expires_at).getTime()
      : 0;
    if (!exp || exp <= nowMs) return [];

    const raw = row.proposed_slots;
    let arr: unknown[] = [];
    if (Array.isArray(raw)) arr = raw;
    else if (typeof raw === "string") {
      try {
        const p = JSON.parse(raw) as unknown;
        if (Array.isArray(p)) arr = p;
      } catch {
        return [];
      }
    }
    const out: { start: Date; end: Date }[] = [];
    for (const item of arr) {
      const iso =
        typeof item === "string"
          ? item
          : item &&
              typeof item === "object" &&
              "start" in item &&
              typeof (item as { start?: unknown }).start === "string"
            ? (item as { start: string }).start
            : null;
      if (!iso) continue;
      const s = new Date(iso);
      if (Number.isNaN(s.getTime())) continue;
      out.push({ start: s, end: intervalEndUtc(iso, duration) });
    }
    return out;
  }

  if (st === "REQUESTED" || st === "CONFIRMED") {
    const s = new Date(row.appointment_datetime);
    if (Number.isNaN(s.getTime())) return [];
    return [
      {
        start: s,
        end: intervalEndUtc(row.appointment_datetime, duration),
      },
    ];
  }

  return [];
}

/** Whether [candidateStart, candidateStart + durationMinutes) hits any blocking interval. */
export function candidateOverlapsAnyBlockingInterval(
  candidateStartIso: string,
  durationMinutes: number,
  excludeAppointmentId: string | null,
  rows: DoctorAppointmentForBlocking[],
  fallbackDurationMinutes: number,
  nowMs: number = Date.now()
): boolean {
  const candidateStart = new Date(candidateStartIso);
  const candidateEnd = intervalEndUtc(candidateStartIso, durationMinutes);
  if (Number.isNaN(candidateStart.getTime())) return true;

  for (const row of rows) {
    if (excludeAppointmentId && row.id === excludeAppointmentId) continue;
    for (const iv of blockingIntervalsFromAppointment(
      row,
      fallbackDurationMinutes,
      nowMs
    )) {
      if (rangesOverlap(candidateStart, candidateEnd, iv.start, iv.end)) {
        return true;
      }
    }
  }
  return false;
}

export function intervalEndUtc(
  startIso: string,
  durationMinutes: number
): Date {
  const start = new Date(startIso);
  return addMinutes(start, Math.max(1, durationMinutes));
}

/** True if [aStart,aEnd) overlaps [bStart,bEnd) (half-open could use <=; we use strict intersection). */
export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

/**
 * Whether the candidate block [candidateStart, candidateStart + durationMin) overlaps
 * any other row (excluding excludeId). Others must be REQUESTED/CONFIRMED callers filter.
 */
export function overlapsOtherAppointments(
  candidateStartIso: string,
  durationMinutes: number,
  excludeId: string,
  others: AppointmentIntervalRow[],
  fallbackDurationMinutes: number
): boolean {
  const asBlocking: DoctorAppointmentForBlocking[] = others.map((o) => ({
    id: o.id,
    status: "REQUESTED",
    appointment_datetime: o.appointment_datetime,
    duration_minutes: o.duration_minutes,
  }));
  return candidateOverlapsAnyBlockingInterval(
    candidateStartIso,
    durationMinutes,
    excludeId,
    asBlocking,
    fallbackDurationMinutes
  );
}

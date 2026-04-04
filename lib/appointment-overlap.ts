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

/**
 * Normalize DB / PostgREST status for comparisons (trim, strip ZW*, collapse spaces to '_').
 * Handles rare variants like "NEEDS RESCHEDULE" vs NEEDS_RESCHEDULE enum label.
 */
export function normalizeBlockingStatus(raw: unknown): string {
  let s = String(raw ?? "")
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
  s = s.replace(/\s+/g, "_").toUpperCase();
  return s;
}

function coerceProposedSlotsArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      if (Array.isArray(p)) return p;
    } catch {
      return [];
    }
    return [];
  }
  if (raw && typeof raw === "object") {
    const vals = Object.values(raw as Record<string, unknown>);
    if (vals.length > 0 && vals.every((v) => typeof v === "string")) {
      return vals;
    }
  }
  return [];
}

/**
 * Blocking intervals for one appointment row.
 * - NEEDS_RESCHEDULE: never uses `appointment_datetime` (original request time is free).
 *   Only `proposed_slots` while `proposal_expires_at` is in the future.
 * - REQUESTED / CONFIRMED: [appointment_datetime, appointment_datetime + duration).
 * - Expired counter-offers: contribute nothing (must match public_doctor_occupied_datetimes).
 */
export function blockingIntervalsFromAppointment(
  row: DoctorAppointmentForBlocking,
  fallbackDurationMinutes: number,
  nowMs: number = Date.now()
): { start: Date; end: Date }[] {
  const st = normalizeBlockingStatus(row.status);
  if (st === "CANCELLED") return [];

  const dm = Number(row.duration_minutes);
  const duration =
    Number.isFinite(dm) && dm > 0 ? dm : Math.max(1, fallbackDurationMinutes);

  if (st === "NEEDS_RESCHEDULE") {
    const exp = row.proposal_expires_at
      ? new Date(row.proposal_expires_at).getTime()
      : 0;
    if (!exp || exp <= nowMs) return [];

    const arr = coerceProposedSlotsArray(row.proposed_slots);
    if (arr.length === 0) return [];
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

/**
 * Whether [candidateStart, candidateStart + durationMinutes) hits any blocking interval.
 * NEEDS_RESCHEDULE rows only block via proposed_slots (see blockingIntervalsFromAppointment).
 */
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

/** First blocking row that hits the candidate (for dev diagnostics). */
export function explainCandidateOverlap(
  candidateStartIso: string,
  durationMinutes: number,
  excludeAppointmentId: string | null,
  rows: DoctorAppointmentForBlocking[],
  fallbackDurationMinutes: number,
  nowMs: number = Date.now()
): { blockingAppointmentId: string; status: string } | null {
  const candidateStart = new Date(candidateStartIso);
  const candidateEnd = intervalEndUtc(candidateStartIso, durationMinutes);
  if (Number.isNaN(candidateStart.getTime())) return null;

  for (const row of rows) {
    if (excludeAppointmentId && row.id === excludeAppointmentId) continue;
    for (const iv of blockingIntervalsFromAppointment(
      row,
      fallbackDurationMinutes,
      nowMs
    )) {
      if (rangesOverlap(candidateStart, candidateEnd, iv.start, iv.end)) {
        return {
          blockingAppointmentId: row.id,
          status: normalizeBlockingStatus(row.status),
        };
      }
    }
  }
  return null;
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

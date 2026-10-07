import {
  clinicDisplayName,
  locationWeeklySchedule,
  type DoctorLocationRow,
} from "@/lib/doctor-locations";
import type { DayKey, WeeklySchedule } from "@/lib/doctor-settings";

export const AGENDA_APPOINTMENT_SELECT =
  "id, professional_id, patient_name, patient_phone, patient_email, patient_gender, patient_birthdate, is_new_patient, reason, appointment_datetime, status, duration_minutes, proposed_slots, proposal_expires_at, attendance, clinic_id, professional_notes, review_requested_at";

/** Statuses the agenda shows. Declined, cancelled and expired visits are kept (never
 *  deleted) but leave the agenda. */
export const AGENDA_VISIBLE_STATUSES = ["REQUESTED", "NEEDS_RESCHEDULE", "CONFIRMED"] as const;

export type AgendaWorkingHours = {
  weeklySchedule: WeeklySchedule;
  breakStart: string | null;
  breakEnd: string | null;
  slotDurationMinutes: number;
};

export type AgendaClinic = {
  /** Her clinic link (`professional_clinics.id`). */
  id: string;
  /** The clinic itself (`clinics.id`): what `appointments.clinic_id` stores. */
  clinicId?: string | null;
  name: string;
  hours: AgendaWorkingHours;
};

export type AgendaWorkingWindow = {
  enabled: boolean;
  start: number;
  end: number;
  breakStart: number | null;
  breakEnd: number | null;
};

export function locationToAgendaHours(location: DoctorLocationRow): AgendaWorkingHours {
  return {
    weeklySchedule: locationWeeklySchedule(location),
    breakStart: location.break_start ? String(location.break_start).slice(0, 5) : null,
    breakEnd: location.break_end ? String(location.break_end).slice(0, 5) : null,
    slotDurationMinutes:
      Number(location.slot_duration_minutes) > 0 ? Number(location.slot_duration_minutes) : 30,
  };
}

export function locationsToAgendaClinics(rows: readonly DoctorLocationRow[]): AgendaClinic[] {
  return rows.map((row, index) => ({
    id: row.id,
    clinicId: row.clinic_id ?? null,
    // Every screen shows the clinic's own name (user, 2026-10-03).
    name: row.clinic_name?.trim() || clinicDisplayName(row.label, index, rows.length),
    hours: locationToAgendaHours(row),
  }));
}

export function parseAgendaClockMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const [hRaw, mRaw] = String(time).split(":");
  const h = Number.parseInt(hRaw ?? "", 10);
  const m = Number.parseInt(mRaw ?? "", 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export function agendaWeekdayKey(d: Date): DayKey {
  const map: DayKey[] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return map[d.getDay()]!;
}

export function workingWindowForHours(
  hours: AgendaWorkingHours | null,
  d: Date,
  gridStartHour: number,
  gridEndHour: number,
): AgendaWorkingWindow {
  const gridStart = gridStartHour * 60;
  const gridEnd = gridEndHour * 60;
  if (!hours) {
    return {
      enabled: true,
      start: gridStart,
      end: gridEnd,
      breakStart: null,
      breakEnd: null,
    };
  }
  const dayCfg = hours.weeklySchedule[agendaWeekdayKey(d)];
  return {
    enabled: Boolean(dayCfg?.enabled),
    start: parseAgendaClockMinutes(dayCfg?.start_time) ?? gridStart,
    end: parseAgendaClockMinutes(dayCfg?.end_time) ?? gridEnd,
    breakStart: parseAgendaClockMinutes(hours.breakStart),
    breakEnd: parseAgendaClockMinutes(hours.breakEnd),
  };
}

export function unionAgendaWorkingWindows(
  windows: readonly AgendaWorkingWindow[],
): AgendaWorkingWindow {
  const enabled = windows.filter((w) => w.enabled);
  if (enabled.length === 0) {
    return {
      enabled: false,
      start: 8 * 60,
      end: 20 * 60,
      breakStart: null,
      breakEnd: null,
    };
  }
  if (enabled.length === 1) return enabled[0]!;
  return {
    enabled: true,
    start: Math.min(...enabled.map((w) => w.start)),
    end: Math.max(...enabled.map((w) => w.end)),
    breakStart: null,
    breakEnd: null,
  };
}

export type AgendaMinuteRange = { start: number; end: number };
export type AgendaClosedBand = AgendaMinuteRange & { kind: "off" | "break" };

/** When one clinic is open that day: its hours minus its break (minutes from midnight). */
export function agendaOpenIntervals(window: AgendaWorkingWindow): AgendaMinuteRange[] {
  if (!window.enabled || window.end <= window.start) return [];
  const { start, end, breakStart, breakEnd } = window;
  if (breakStart == null || breakEnd == null || breakEnd <= start || breakStart >= end || breakEnd <= breakStart) {
    return [{ start, end }];
  }
  return [
    { start, end: Math.max(start, breakStart) },
    { start: Math.min(end, breakEnd), end },
  ].filter((r) => r.end > r.start);
}

/**
 * What the agenda hatches for the shown clinics: every stretch of the grid where none of them is
 * open, counting each clinic's own break, so a gap between two clinics' hours is hatched too.
 * "break" when that stretch is a lunch break, "off" otherwise; "closed" when none opens that day
 * (user, 2026-10-07).
 */
export function agendaClosedBands(
  windows: readonly AgendaWorkingWindow[],
  gridStart: number,
  gridEnd: number,
): AgendaClosedBand[] | "closed" {
  const open = windows
    .flatMap(agendaOpenIntervals)
    .sort((a, b) => a.start - b.start);
  if (open.length === 0) return "closed";

  const bands: AgendaClosedBand[] = [];
  let cursor = gridStart;
  const closeUntil = (until: number) => {
    const end = Math.min(until, gridEnd);
    if (end > cursor) {
      const isBreak = windows.some(
        (w) =>
          w.enabled &&
          w.breakStart != null &&
          w.breakEnd != null &&
          w.breakStart <= cursor &&
          end <= w.breakEnd &&
          w.start <= cursor &&
          end <= w.end,
      );
      bands.push({ start: cursor, end, kind: isBreak ? "break" : "off" });
    }
  };
  for (const range of open) {
    closeUntil(range.start);
    cursor = Math.max(cursor, range.end);
    if (cursor >= gridEnd) return bands;
  }
  closeUntil(gridEnd);
  return bands;
}

/** Map an appointment to a clinic; unassigned rows follow the primary (first) clinic. */
/** Her clinic link for an appointment's clinic (`clinics.id`), else the first (primary). */
export function clinicIdForAppointment(
  appointmentClinicId: string | null | undefined,
  clinics: readonly Pick<AgendaClinic, "id" | "clinicId">[],
): string | null {
  const id = String(appointmentClinicId ?? "").trim();
  const match = id ? clinics.find((clinic) => clinic.clinicId === id) : undefined;
  return match?.id ?? clinics[0]?.id ?? null;
}

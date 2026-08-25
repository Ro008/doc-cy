import {
  clinicDisplayName,
  locationWeeklySchedule,
  type DoctorLocationRow,
} from "@/lib/doctor-locations";
import type { DayKey, WeeklySchedule } from "@/lib/doctor-settings";

export const AGENDA_APPOINTMENT_SELECT =
  "id, doctor_id, patient_name, patient_phone, reason, appointment_datetime, status, duration_minutes, proposed_slots, proposal_expires_at, attendance, location_id";

export type AgendaWorkingHours = {
  weeklySchedule: WeeklySchedule;
  breakStart: string | null;
  breakEnd: string | null;
  slotDurationMinutes: number;
};

export type AgendaClinic = {
  id: string;
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
    name: clinicDisplayName(row.label, index, rows.length),
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

/** Map an appointment to a clinic; unassigned rows follow the primary (first) clinic. */
export function clinicIdForAppointment(
  locationId: string | null | undefined,
  clinics: readonly Pick<AgendaClinic, "id">[],
): string | null {
  const id = String(locationId ?? "").trim();
  if (id && clinics.some((clinic) => clinic.id === id)) return id;
  return clinics[0]?.id ?? null;
}

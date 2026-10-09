import { formatInTimeZone } from "date-fns-tz";
import { CY_TZ, isRescheduleProposalLive } from "@/lib/appointments";
import { isNoShowAttendance } from "@/lib/appointment-attendance";
import {
  clinicIdForAppointment,
  parseAgendaClockMinutes,
  type AgendaClinic,
  type AgendaWorkingHours,
} from "@/lib/agenda-clinics";
import { agendaClinicEventColor } from "@/lib/doctor-locations";
import { coerceProposedSlotsArray } from "@/lib/appointment-overlap";
import { agendaHighlightHref } from "@/lib/agenda-highlight";
import type { DayKey } from "@/lib/doctor-settings";

/** Anchor of the "Needs your answer" section (agenda sidebar "Pending requests" links here). */
export const DASHBOARD_NEEDS_ANSWER_ID = "needs-your-answer";
export const DASHBOARD_NEEDS_ANSWER_HREF = `/dashboard#${DASHBOARD_NEEDS_ANSWER_ID}`;

export type DashboardClinicTag = { name: string; swatchClass: string };

/**
 * Clinic label + agenda colour for a dashboard row, so the doctor tells clinics apart at a glance
 * (same colours as the agenda). Null with a single clinic: nothing to tell apart.
 */
export function dashboardClinicTag(
  appointmentClinicId: string | null | undefined,
  clinics: readonly AgendaClinic[],
): DashboardClinicTag | null {
  if (clinics.length < 2) return null;
  const id = clinicIdForAppointment(appointmentClinicId, clinics);
  const index = clinics.findIndex((clinic) => clinic.id === id);
  if (index < 0) return null;
  return { name: clinics[index]!.name, swatchClass: agendaClinicEventColor(index).swatch };
}

export type PausedClinicNotice = { linkId: string; clinicName: string };

/**
 * The dashboard's paused banner (user, 2026-10-03): one line per paused clinic, named after
 * the clinic, minus the ones she closed (shown again once that clinic's pause changes).
 */
export function pausedClinicNotices(
  locations: readonly {
    id: string;
    clinic_name?: string | null;
    label: string | null;
    pause_online_bookings: boolean;
    pause_notice_dismissed_at?: string | null;
  }[],
): PausedClinicNotice[] {
  return locations
    .filter((l) => l.pause_online_bookings && !l.pause_notice_dismissed_at)
    .map((l) => ({
      linkId: l.id,
      clinicName: l.clinic_name?.trim() || l.label?.trim() || "your clinic",
    }));
}

export const DASHBOARD_APPOINTMENT_SELECT =
  "id, professional_id, patient_name, appointment_datetime, status, duration_minutes, created_at, is_new_patient, attendance, proposal_expires_at, proposed_slots, reason, clinic_id, patient_phone, patient_email, patient_gender, patient_birthdate, professional_notes, review_requested_at, booking_source";

export type DashboardAppointmentRow = {
  id: string;
  patient_name: string | null;
  appointment_datetime: string;
  status: string | null;
  duration_minutes: number | null;
  created_at: string | null;
  is_new_patient: boolean | null;
  attendance: string | null;
  proposal_expires_at: string | null;
  proposed_slots: unknown;
  reason: string | null;
  clinic_id: string | null;
  /** For "Missed requests": she can call the patient back. */
  patient_phone?: string | null;
  /** The rest is for the visit details window (components/agenda/VisitDetailsDialog.tsx). */
  professional_id?: string;
  patient_email?: string | null;
  patient_gender?: string | null;
  patient_birthdate?: string | null;
  professional_notes?: string | null;
  review_requested_at?: string | null;
  booking_source?: string | null;
};

export type TodayScheduleItem = {
  id: string;
  patientName: string;
  reason: string | null;
  /** The appointment's clinic (`clinics.id`). */
  clinicId: string | null;
  startIso: string;
  /** Minutes from Cyprus midnight. */
  startMinute: number;
  endMinute: number;
  rangeLabel: string;
  isPast: boolean;
  isNext: boolean;
  isNoShow: boolean;
  isNewPatient: boolean;
};

export type TodaySchedule = {
  startHour: number;
  endHour: number;
  /** Minutes from Cyprus midnight, or null when now is outside the window. */
  nowMinute: number | null;
  items: TodayScheduleItem[];
};

const DEFAULT_DURATION_MINUTES = 30;
const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 18;

function statusOf(row: { status: string | null }): string {
  return String(row.status ?? "").trim().toUpperCase();
}

function durationOf(row: { duration_minutes: number | null }): number {
  const d = row.duration_minutes;
  return typeof d === "number" && d > 0 ? d : DEFAULT_DURATION_MINUTES;
}

function timeMs(iso: string | null | undefined): number {
  return iso ? new Date(iso).getTime() : NaN;
}

function cyprusMinuteOfDay(ms: number): number {
  const d = new Date(ms);
  return Number(formatInTimeZone(d, CY_TZ, "H")) * 60 + Number(formatInTimeZone(d, CY_TZ, "m"));
}

function cyprusDateKeyOf(ms: number): string {
  return formatInTimeZone(new Date(ms), CY_TZ, "yyyy-MM-dd");
}

function clockLabel(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60) % 24;
  const m = minuteOfDay % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Open requests for future visits, the soonest visit first (user, 2026-10-09); for the
 * same time, the longest-waiting request first.
 */
export function selectPendingRequests<T extends DashboardAppointmentRow>(rows: T[], nowMs: number): T[] {
  return rows
    .filter((r) => statusOf(r) === "REQUESTED" && timeMs(r.appointment_datetime) > nowMs)
    .sort((a, b) => {
      const byVisit = timeMs(a.appointment_datetime) - timeMs(b.appointment_datetime);
      if (byVisit !== 0) return byVisit;
      const ca = timeMs(a.created_at);
      const cb = timeMs(b.created_at);
      const aHas = Number.isFinite(ca);
      const bHas = Number.isFinite(cb);
      if (aHas && bHas) return ca - cb;
      if (aHas !== bHas) return aHas ? -1 : 1;
      return 0;
    });
}

/** Requests where the doctor suggested other times and the patient has not chosen yet. */
export function selectAwaitingPatient<T extends DashboardAppointmentRow>(rows: T[], nowMs: number): T[] {
  return rows
    .filter((r) => isRescheduleProposalLive(r.status, r.proposal_expires_at, nowMs))
    .sort((a, b) => timeMs(a.appointment_datetime) - timeMs(b.appointment_datetime));
}

export function buildTodaySchedule(
  rows: DashboardAppointmentRow[],
  opts: { nowMs: number; startHour?: number; endHour?: number },
): TodaySchedule {
  const { nowMs } = opts;
  const todayKey = cyprusDateKeyOf(nowMs);

  const confirmed = rows
    .filter((r) => statusOf(r) === "CONFIRMED")
    .filter((r) => {
      const ms = timeMs(r.appointment_datetime);
      return Number.isFinite(ms) && cyprusDateKeyOf(ms) === todayKey;
    })
    .sort((a, b) => timeMs(a.appointment_datetime) - timeMs(b.appointment_datetime));

  let nextAssigned = false;
  const items = confirmed.map((r): TodayScheduleItem => {
    const startMs = timeMs(r.appointment_datetime);
    const duration = durationOf(r);
    const startMinute = cyprusMinuteOfDay(startMs);
    const endMinute = startMinute + duration;
    const isPast = startMs + duration * 60_000 <= nowMs;
    const isNext = !isPast && !nextAssigned;
    if (isNext) nextAssigned = true;
    return {
      id: r.id,
      patientName: (r.patient_name ?? "").trim() || "Patient",
      reason: r.reason?.trim() || null,
      clinicId: r.clinic_id,
      startIso: r.appointment_datetime,
      startMinute,
      endMinute,
      rangeLabel: `${clockLabel(startMinute)}–${clockLabel(endMinute)}`,
      isPast,
      isNext,
      isNoShow: isNoShowAttendance(r.attendance),
      isNewPatient: r.is_new_patient === true,
    };
  });

  let startHour = opts.startHour ?? DEFAULT_START_HOUR;
  let endHour = opts.endHour ?? DEFAULT_END_HOUR;
  for (const item of items) {
    startHour = Math.min(startHour, Math.floor(item.startMinute / 60));
    endHour = Math.max(endHour, Math.ceil(item.endMinute / 60));
  }

  const nowOfDay = cyprusMinuteOfDay(nowMs);
  const nowMinute = nowOfDay >= startHour * 60 && nowOfDay <= endHour * 60 ? nowOfDay : null;

  return { startHour, endHour, nowMinute, items };
}

export type TodayWorkingWindow = {
  startHour: number;
  endHour: number;
  breakStart: number | null;
  breakEnd: number | null;
};

const ISO_WEEKDAY_KEYS: readonly DayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

/**
 * Today's opening hours (Cyprus date) across the doctor's clinics, rounded out
 * to whole hours. Null when no clinic is open today. A break is shown only
 * for a single clinic, matching the agenda.
 */
export function todayWorkingWindow(
  hoursList: readonly AgendaWorkingHours[],
  nowMs: number,
): TodayWorkingWindow | null {
  const dayKey = ISO_WEEKDAY_KEYS[Number(formatInTimeZone(new Date(nowMs), CY_TZ, "i")) - 1];
  const open = hoursList
    .map((hours) => ({ hours, day: hours.weeklySchedule[dayKey] }))
    .filter(({ day }) => day?.enabled)
    .map(({ hours, day }) => ({
      hours,
      start: parseAgendaClockMinutes(day.start_time),
      end: parseAgendaClockMinutes(day.end_time),
    }))
    .filter((w): w is { hours: AgendaWorkingHours; start: number; end: number } =>
      w.start !== null && w.end !== null && w.end > w.start,
    );
  if (open.length === 0) return null;

  const single = open.length === 1 ? open[0].hours : null;
  return {
    startHour: Math.floor(Math.min(...open.map((w) => w.start)) / 60),
    endHour: Math.ceil(Math.max(...open.map((w) => w.end)) / 60),
    breakStart: single ? parseAgendaClockMinutes(single.breakStart) : null,
    breakEnd: single ? parseAgendaClockMinutes(single.breakEnd) : null,
  };
}

/**
 * Where the "now" dot goes in today's timeline: before the first visit that
 * has not started, or on the visit in progress (currentId) when there is one.
 */
export function nowMarkerPosition(
  items: readonly TodayScheduleItem[],
  nowMs: number,
): { beforeIndex: number; currentId: string | null } {
  const now = cyprusMinuteOfDay(nowMs);
  const firstUpcoming = items.findIndex((item) => item.startMinute > now);
  const beforeIndex = firstUpcoming === -1 ? items.length : firstUpcoming;
  const current = items.find((item) => item.startMinute <= now && now < item.endMinute);
  return { beforeIndex, currentId: current?.id ?? null };
}

export function todaySummaryLabel(items: TodayScheduleItem[]): string {
  if (items.length === 0) return "No appointments today";
  const first = items[0].startMinute;
  const last = Math.max(...items.map((i) => i.endMinute));
  const noun = items.length === 1 ? "appointment" : "appointments";
  return `${items.length} ${noun} · ${clockLabel(first)} to ${clockLabel(last)}`;
}

export function dashboardGreeting(nowMs: number): string {
  const hour = Number(formatInTimeZone(new Date(nowMs), CY_TZ, "H"));
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

export function requestedAgoLabel(createdIso: string | null | undefined, nowMs: number): string | null {
  const created = timeMs(createdIso);
  if (!Number.isFinite(created)) return null;
  const minutes = Math.floor((nowMs - created) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function startsInLabel(startIso: string, nowMs: number): string {
  const minutes = Math.ceil((timeMs(startIso) - nowMs) / 60_000);
  if (!(minutes > 0)) return "Now";
  if (minutes < 60) return `in ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `in ${h} h` : `in ${h} h ${m} min`;
}

export type AwaitingPatientSummary = {
  /** "Mon 28 Sep, 12:30", earliest first (Cyprus). */
  slotLabels: string[];
  /** "Sat 26 Sep, 20:06" (Cyprus), or null when unknown. */
  expiresLabel: string | null;
  /** Agenda on the first suggested day, pointing out the held times. */
  agendaHref: string;
};

/** What a doctor needs about times they suggested and the patient has not picked yet. */
export function awaitingPatientSummary(
  row: Pick<DashboardAppointmentRow, "id" | "appointment_datetime" | "proposed_slots" | "proposal_expires_at">,
): AwaitingPatientSummary {
  const slotMs = coerceProposedSlotsArray(row.proposed_slots)
    .map((v) => (typeof v === "string" ? new Date(v).getTime() : NaN))
    .filter((ms) => Number.isFinite(ms))
    .sort((a, b) => a - b);
  const label = (ms: number) => formatInTimeZone(new Date(ms), CY_TZ, "EEE d MMM, HH:mm");
  const expiresMs = timeMs(row.proposal_expires_at);
  const dayMs = slotMs[0] ?? timeMs(row.appointment_datetime);
  return {
    slotLabels: slotMs.map(label),
    expiresLabel: Number.isFinite(expiresMs) ? label(expiresMs) : null,
    agendaHref: agendaHighlightHref(cyprusDateKeyOf(dayMs), row.id),
  };
}

import {
  DAY_NAMES,
  buildWeeklyScheduleFromSettings,
  settingsToWeeklySlots,
  type DoctorSettingsRow,
  type WeeklySchedule,
  type WeeklySlotFromSettings,
} from "@/lib/doctor-settings";
import {
  clinicLocationFromParts,
  type ClinicLocation,
} from "@/lib/clinic-location";
import { isCyprusDistrict } from "@/lib/cyprus-districts";

export const MAX_DOCTOR_LOCATIONS = 5;

export const DOCTOR_LOCATION_SELECT =
  "id, doctor_id, is_primary, sort_order, label, district, clinic_address, town, latitude, longitude, clinic_place_id, pause_online_bookings, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_time, end_time, weekly_schedule, break_start, break_end, slot_duration_minutes, created_at, updated_at";

export type DoctorLocationRow = {
  id: string;
  doctor_id: string;
  is_primary: boolean;
  sort_order: number;
  label: string | null;
  district: string | null;
  clinic_address: string | null;
  town: string | null;
  latitude: number | null;
  longitude: number | null;
  clinic_place_id: string | null;
  pause_online_bookings: boolean;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  start_time: string;
  end_time: string;
  weekly_schedule?: DoctorSettingsRow["weekly_schedule"];
  break_start: string | null;
  break_end: string | null;
  slot_duration_minutes: number;
  created_at?: string;
  updated_at?: string;
};

export function sortDoctorLocations<T extends { is_primary?: boolean; sort_order?: number; created_at?: string }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => {
    if (Boolean(a.is_primary) !== Boolean(b.is_primary)) {
      return a.is_primary ? -1 : 1;
    }
    const order = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (order !== 0) return order;
    return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
  });
}

export const MAX_CLINIC_NAME_LENGTH = 40;

export function sanitizeClinicLabel(value: string | null | undefined): string | null {
  const trimmed = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_CLINIC_NAME_LENGTH);
  return trimmed || null;
}

export function clinicDefaultName(index: number, _total = 0): string {
  return `Clinic ${index + 1}`;
}

export function clinicDisplayName(
  label: string | null | undefined,
  index: number,
  total: number,
): string {
  return sanitizeClinicLabel(label) ?? clinicDefaultName(index, total);
}

/** Custom name if set, otherwise the caller’s fallback (e.g. translated “Clinic 1”). */
export function clinicTitleOrFallback(
  label: string | null | undefined,
  fallback: string,
): string {
  return sanitizeClinicLabel(label) ?? fallback;
}

export function workplaceTabLabel(index: number, total: number): string {
  return clinicDefaultName(index, total);
}

/** Distinct frame/tab colors so settings make it obvious which clinic is active. */
export const WORKPLACE_ACCENTS = [
  {
    tabSelected:
      "relative z-10 -mb-[2px] rounded-t-xl border-2 border-b-0 border-clinical-400 bg-clinical-500/10 px-4 py-2.5 text-xs font-semibold text-clinical-50",
    tabIdle:
      "rounded-t-lg border border-b-0 border-clinical-400/35 bg-slate-950/70 px-4 py-2 text-xs font-medium text-slate-400 hover:text-clinical-100",
    frame: "border-clinical-400 bg-clinical-500/10",
    tint: "bg-clinical-400",
    title: "text-clinical-200",
  },
  {
    tabSelected:
      "relative z-10 -mb-[2px] rounded-t-xl border-2 border-b-0 border-violet-400 bg-violet-500/10 px-4 py-2.5 text-xs font-semibold text-violet-50",
    tabIdle:
      "rounded-t-lg border border-b-0 border-violet-400/35 bg-slate-950/70 px-4 py-2 text-xs font-medium text-slate-400 hover:text-violet-100",
    frame: "border-violet-400 bg-violet-500/10",
    tint: "bg-violet-400",
    title: "text-violet-200",
  },
  {
    tabSelected:
      "relative z-10 -mb-[2px] rounded-t-xl border-2 border-b-0 border-amber-400 bg-amber-500/10 px-4 py-2.5 text-xs font-semibold text-amber-50",
    tabIdle:
      "rounded-t-lg border border-b-0 border-amber-400/35 bg-slate-950/70 px-4 py-2 text-xs font-medium text-slate-400 hover:text-amber-100",
    frame: "border-amber-400 bg-amber-500/10",
    tint: "bg-amber-400",
    title: "text-amber-200",
  },
  {
    tabSelected:
      "relative z-10 -mb-[2px] rounded-t-xl border-2 border-b-0 border-sky-400 bg-sky-500/10 px-4 py-2.5 text-xs font-semibold text-sky-50",
    tabIdle:
      "rounded-t-lg border border-b-0 border-sky-400/35 bg-slate-950/70 px-4 py-2 text-xs font-medium text-slate-400 hover:text-sky-100",
    frame: "border-sky-400 bg-sky-500/10",
    tint: "bg-sky-400",
    title: "text-sky-200",
  },
  {
    tabSelected:
      "relative z-10 -mb-[2px] rounded-t-xl border-2 border-b-0 border-rose-400 bg-rose-500/10 px-4 py-2.5 text-xs font-semibold text-rose-50",
    tabIdle:
      "rounded-t-lg border border-b-0 border-rose-400/35 bg-slate-950/70 px-4 py-2 text-xs font-medium text-slate-400 hover:text-rose-100",
    frame: "border-rose-400 bg-rose-500/10",
    tint: "bg-rose-400",
    title: "text-rose-200",
  },
] as const;

export function workplaceAccent(index: number): (typeof WORKPLACE_ACCENTS)[number] {
  const safeIndex = Number.isInteger(index) && index >= 0 ? index : 0;
  return WORKPLACE_ACCENTS[safeIndex % WORKPLACE_ACCENTS.length]!;
}

/** Light-profile clinic cards (patient booking). Distinct from dark settings tabs. */
export const PROFILE_CLINIC_ACCENTS = [
  {
    selected: "border-clinical-500 bg-clinical-50 ring-2 ring-clinical-400/80",
    idle: "border-ink-200 bg-white hover:border-clinical-400 hover:bg-clinical-50/60",
    number: "bg-clinical-500 text-white",
    numberIdle: "bg-ink-100 text-ink-700",
    cta: "text-clinical-800",
  },
  {
    selected: "border-violet-500 bg-violet-50 ring-2 ring-violet-400/80",
    idle: "border-ink-200 bg-white hover:border-violet-400 hover:bg-violet-50/60",
    number: "bg-violet-500 text-white",
    numberIdle: "bg-ink-100 text-ink-700",
    cta: "text-violet-800",
  },
  {
    selected: "border-amber-500 bg-amber-50 ring-2 ring-amber-400/80",
    idle: "border-ink-200 bg-white hover:border-amber-400 hover:bg-amber-50/60",
    number: "bg-amber-500 text-white",
    numberIdle: "bg-ink-100 text-ink-700",
    cta: "text-amber-900",
  },
  {
    selected: "border-sky-500 bg-sky-50 ring-2 ring-sky-400/80",
    idle: "border-ink-200 bg-white hover:border-sky-400 hover:bg-sky-50/60",
    number: "bg-sky-500 text-white",
    numberIdle: "bg-ink-100 text-ink-700",
    cta: "text-sky-800",
  },
  {
    selected: "border-rose-500 bg-rose-50 ring-2 ring-rose-400/80",
    idle: "border-ink-200 bg-white hover:border-rose-400 hover:bg-rose-50/60",
    number: "bg-rose-500 text-white",
    numberIdle: "bg-ink-100 text-ink-700",
    cta: "text-rose-800",
  },
] as const;

export function profileClinicAccent(index: number): (typeof PROFILE_CLINIC_ACCENTS)[number] {
  const safeIndex = Number.isInteger(index) && index >= 0 ? index : 0;
  return PROFILE_CLINIC_ACCENTS[safeIndex % PROFILE_CLINIC_ACCENTS.length]!;
}

/** Agenda calendar checkbox colors — same clinic order as settings tabs. Chip fill stays status-colored. */
export const AGENDA_CLINIC_EVENT_COLORS = [
  {
    swatch: "bg-clinical-400",
    empty: "border-clinical-400",
  },
  {
    swatch: "bg-violet-400",
    empty: "border-violet-400",
  },
  {
    swatch: "bg-amber-400",
    empty: "border-amber-400",
  },
  {
    swatch: "bg-sky-400",
    empty: "border-sky-400",
  },
  {
    swatch: "bg-rose-400",
    empty: "border-rose-400",
  },
] as const;

export function agendaClinicEventColor(index: number): (typeof AGENDA_CLINIC_EVENT_COLORS)[number] {
  const safeIndex = Number.isInteger(index) && index >= 0 ? index : 0;
  return AGENDA_CLINIC_EVENT_COLORS[safeIndex % AGENDA_CLINIC_EVENT_COLORS.length]!;
}

export function clinicAddressFirstLine(address: string | null | undefined): string {
  const line = String(address ?? "").trim().split("\n")[0]?.trim() ?? "";
  if (!line) return "";
  if (line.length <= 56) return line;
  return `${line.slice(0, 54).trim()}…`;
}

export function doctorLocationDisplayName(
  location: Pick<DoctorLocationRow, "label" | "clinic_address" | "district" | "town">,
  index: number,
  total: number,
): string {
  return clinicDisplayName(location.label, index, total);
}

export function locationToClinicLocation(location: DoctorLocationRow): ClinicLocation {
  return clinicLocationFromParts({
    address: location.clinic_address,
    latitude: location.latitude,
    longitude: location.longitude,
    placeId: location.clinic_place_id,
    district: location.district,
    town: location.town,
  });
}

export function locationToSettingsRow(
  location: DoctorLocationRow,
  global: Pick<
    DoctorSettingsRow,
    | "show_phone_public"
    | "holiday_mode_enabled"
    | "holiday_start_date"
    | "holiday_end_date"
    | "booking_horizon_days"
    | "minimum_notice_hours"
  > &
    Partial<DoctorSettingsRow>,
): DoctorSettingsRow {
  return {
    doctor_id: location.doctor_id,
    monday: Boolean(location.monday),
    tuesday: Boolean(location.tuesday),
    wednesday: Boolean(location.wednesday),
    thursday: Boolean(location.thursday),
    friday: Boolean(location.friday),
    saturday: Boolean(location.saturday),
    sunday: Boolean(location.sunday),
    start_time: location.start_time ?? "09:00:00",
    end_time: location.end_time ?? "17:00:00",
    weekly_schedule: location.weekly_schedule ?? null,
    break_start: location.break_start,
    break_end: location.break_end,
    pause_online_bookings: Boolean(location.pause_online_bookings),
    show_phone_public: Boolean(global.show_phone_public),
    holiday_mode_enabled: Boolean(global.holiday_mode_enabled),
    holiday_start_date: global.holiday_start_date ?? null,
    holiday_end_date: global.holiday_end_date ?? null,
    booking_horizon_days: Number(global.booking_horizon_days ?? 90),
    minimum_notice_hours: Number(global.minimum_notice_hours ?? 2),
    slot_duration_minutes:
      Number(location.slot_duration_minutes) > 0
        ? Number(location.slot_duration_minutes)
        : 30,
  };
}

export function locationWeeklySlots(location: DoctorLocationRow): WeeklySlotFromSettings[] {
  return settingsToWeeklySlots(
    locationToSettingsRow(location, {
      show_phone_public: false,
      holiday_mode_enabled: false,
      holiday_start_date: null,
      holiday_end_date: null,
      booking_horizon_days: 90,
      minimum_notice_hours: 2,
    }),
  );
}

export function locationWeeklySchedule(location: DoctorLocationRow): WeeklySchedule {
  return buildWeeklyScheduleFromSettings(
    locationToSettingsRow(location, {
      show_phone_public: false,
      holiday_mode_enabled: false,
      holiday_start_date: null,
      holiday_end_date: null,
      booking_horizon_days: 90,
      minimum_notice_hours: 2,
    }),
  );
}

export function parseLocationDistrict(value: unknown): string {
  const raw = String(value ?? "").trim();
  return isCyprusDistrict(raw) ? raw : raw;
}

export type DoctorLocationScheduleInput = {
  weeklySchedule?: WeeklySchedule;
  monday?: boolean;
  tuesday?: boolean;
  wednesday?: boolean;
  thursday?: boolean;
  friday?: boolean;
  saturday?: boolean;
  sunday?: boolean;
  startTime?: string;
  endTime?: string;
  breakEnabled?: boolean;
  breakStart?: string;
  breakEnd?: string;
  slotDurationMinutes?: number;
  pauseOnlineBookings?: boolean;
};

function toTime(value: string | undefined, fallback: string): string {
  if (!value || typeof value !== "string") return fallback;
  const parts = value.trim().split(":");
  const h = parts[0]?.padStart(2, "0") ?? "09";
  const m = parts[1]?.padStart(2, "0") ?? "00";
  return `${h}:${m}:00`;
}

export function locationScheduleColumns(input: DoctorLocationScheduleInput): {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  start_time: string;
  end_time: string;
  weekly_schedule: WeeklySchedule;
  break_start: string | null;
  break_end: string | null;
  slot_duration_minutes: number;
  pause_online_bookings?: boolean;
} {
  const startFallback = toTime(input.startTime, "09:00:00");
  const endFallback = toTime(input.endTime, "17:00:00");
  const weekly_schedule = DAY_NAMES.reduce((acc, day) => {
    const incoming = input.weeklySchedule?.[day];
    const legacyEnabled = Boolean(input[day]);
    acc[day] = {
      enabled:
        typeof incoming?.enabled === "boolean" ? incoming.enabled : legacyEnabled,
      start_time: incoming?.start_time
        ? toTime(incoming.start_time, "09:00:00")
        : startFallback,
      end_time: incoming?.end_time
        ? toTime(incoming.end_time, "17:00:00")
        : endFallback,
    };
    return acc;
  }, {} as WeeklySchedule);

  const slotMinutes = Number(input.slotDurationMinutes);
  const columns = {
    monday: weekly_schedule.monday.enabled,
    tuesday: weekly_schedule.tuesday.enabled,
    wednesday: weekly_schedule.wednesday.enabled,
    thursday: weekly_schedule.thursday.enabled,
    friday: weekly_schedule.friday.enabled,
    saturday: weekly_schedule.saturday.enabled,
    sunday: weekly_schedule.sunday.enabled,
    start_time: startFallback,
    end_time: endFallback,
    weekly_schedule,
    break_start: input.breakEnabled ? toTime(input.breakStart, "13:00:00") : null,
    break_end: input.breakEnabled ? toTime(input.breakEnd, "14:00:00") : null,
    slot_duration_minutes:
      Number.isInteger(slotMinutes) && slotMinutes > 0 ? slotMinutes : 30,
  };

  if (typeof input.pauseOnlineBookings === "boolean") {
    return { ...columns, pause_online_bookings: input.pauseOnlineBookings };
  }
  return columns;
}

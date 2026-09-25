import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, format } from "date-fns";
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";
import { appointmentToCyprusDate, CY_TZ } from "@/lib/appointments";
import type { DoctorSettingsRow } from "@/lib/doctor-settings";
import { normalizeMinimumNoticeHours, settingsToWeeklySlots } from "@/lib/doctor-settings";
import {
  loadDoctorSettingsForSlots,
  loadDoctorSettingsForSlotsByDoctorIds,
  type DoctorSettingsForSlots,
} from "@/lib/load-doctor-settings-for-slots";
import { loadDoctorLocationsByDoctorIds } from "@/lib/load-doctor-locations";
import {
  ACCOUNT_SETTINGS_FALLBACK,
  locationToSettingsRow,
  type DoctorLocationRow,
} from "@/lib/doctor-locations";
import {
  computePublicAvailabilityCalendar,
  FINDER_AVAILABILITY_CALENDAR_DAY_COUNT,
  type PublicAvailabilityCalendar,
  type PublicNextAvailableSlot,
} from "@/lib/public/compute-public-booking-slots";

const EMPTY_CALENDAR: PublicAvailabilityCalendar = { days: [], soonestSlot: null };

/**
 * One call returns the taken slot starts for many professionals, each row with
 * its clinic. The finder used to call public_doctor_occupied_datetimes once
 * per card and clinic (32% of Testing's database time); it now calls this once
 * per page. Same rules: the per-professional function wraps this one.
 */
export const OCCUPIED_BATCH_RPC = "public_professionals_occupied_datetimes";

export type OccupiedRow = {
  professional_id: string;
  location_id: string | null;
  appointment_datetime: string;
};

/** From yesterday to the day after the professional's last bookable day (Cyprus). */
function occupiedRange(settings: DoctorSettingsRow): { fromIso: string; toIso: string } {
  const maxHorizonDays = [14, 30, 90, 180].includes(Number(settings.booking_horizon_days))
    ? Number(settings.booking_horizon_days)
    : 90;

  const nowUtc = new Date();
  const fromIso = new Date(nowUtc.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const todayCyprus = utcToZonedTime(nowUtc, CY_TZ);
  const lastBookableDay = addDays(todayCyprus, maxHorizonDays);
  const occupiedRangeEndCyprus = addDays(lastBookableDay, 1);
  const toIso = zonedTimeToUtc(
    `${format(occupiedRangeEndCyprus, "yyyy-MM-dd")}T23:59:59.999`,
    CY_TZ,
  ).toISOString();
  return { fromIso, toIso };
}

async function loadOccupiedRows(
  supabase: SupabaseClient,
  professionalIds: string[],
  fromIso: string,
  toIso: string,
): Promise<OccupiedRow[] | null> {
  const { data, error } = await supabase.rpc(OCCUPIED_BATCH_RPC, {
    p_professional_ids: professionalIds,
    p_from: fromIso,
    p_to: toIso,
  });
  if (error) {
    console.error("[DocCy] finder availability calendar lookup failed:", error);
    return null;
  }
  return (data ?? []) as OccupiedRow[];
}

/**
 * One professional's taken slot starts (Cyprus "yyyy-MM-ddTHH:mm"), at one
 * clinic or, with no clinic, at all of them; up to their own horizon.
 */
export function takenSlotTimesFor(
  rows: readonly OccupiedRow[],
  target: { professionalId: string; locationId: string | null; toIso: string },
): string[] {
  const toMs = new Date(target.toIso).getTime();
  const keys = new Set<string>();
  for (const row of rows) {
    if (row.professional_id !== target.professionalId) continue;
    if (target.locationId && row.location_id !== target.locationId) continue;
    if (new Date(row.appointment_datetime).getTime() > toMs) continue;
    keys.add(format(appointmentToCyprusDate(row.appointment_datetime), "yyyy-MM-dd'T'HH:mm"));
  }
  return Array.from(keys).sort();
}

async function loadOccupiedSlotTimes(
  supabase: SupabaseClient,
  doctorId: string,
  settings: DoctorSettingsRow,
  locationId?: string | null,
): Promise<string[] | null> {
  const { fromIso, toIso } = occupiedRange(settings);
  const rows = await loadOccupiedRows(supabase, [doctorId], fromIso, toIso);
  if (!rows) return null;
  return takenSlotTimesFor(rows, { professionalId: doctorId, locationId: locationId ?? null, toIso });
}

async function loadDoctorAvailabilityContext(
  supabase: SupabaseClient,
  doctorId: string,
  preloaded?: DoctorSettingsForSlots | null,
): Promise<{
  settings: DoctorSettingsRow;
  weeklySlots: NonNullable<Awaited<ReturnType<typeof loadDoctorSettingsForSlots>>>["weeklySlots"];
  takenSlotTimes: string[];
} | null> {
  const loaded = preloaded ?? (await loadDoctorSettingsForSlots(supabase, doctorId));
  if (!loaded || loaded.weeklySlots.length === 0) return null;

  const { settings, weeklySlots } = loaded;
  if (settings.pause_online_bookings) return null;

  const takenSlotTimes = await loadOccupiedSlotTimes(
    supabase,
    doctorId,
    settings,
  );
  if (!takenSlotTimes) return null;

  return { settings, weeklySlots, takenSlotTimes };
}

function buildSlotParams(
  settings: DoctorSettingsRow,
  weeklySlots: NonNullable<Awaited<ReturnType<typeof loadDoctorSettingsForSlots>>>["weeklySlots"],
  takenSlotTimes: string[],
) {
  const maxHorizonDays = [14, 30, 90, 180].includes(Number(settings.booking_horizon_days))
    ? Number(settings.booking_horizon_days)
    : 90;
  const minimumNoticeHours = normalizeMinimumNoticeHours(
    settings.minimum_notice_hours,
  );

  return {
    weeklySlots,
    takenSlotTimes,
    breakStart: settings.break_start ? String(settings.break_start).slice(0, 5) : undefined,
    breakEnd: settings.break_end ? String(settings.break_end).slice(0, 5) : undefined,
    holidayModeEnabled: Boolean(settings.holiday_mode_enabled),
    holidayStartDate: settings.holiday_start_date,
    holidayEndDate: settings.holiday_end_date,
    bookingHorizonDays: maxHorizonDays,
    minimumNoticeHours,
  };
}

export async function loadDoctorAvailabilityCalendar(
  supabase: SupabaseClient,
  doctorId: string,
  dayCount = FINDER_AVAILABILITY_CALENDAR_DAY_COUNT,
): Promise<PublicAvailabilityCalendar> {
  const context = await loadDoctorAvailabilityContext(supabase, doctorId);
  if (!context) return { days: [], soonestSlot: null };

  const { settings, weeklySlots, takenSlotTimes } = context;
  return computePublicAvailabilityCalendar(buildSlotParams(settings, weeklySlots, takenSlotTimes), dayCount);
}

export async function loadDoctorNearestAvailableSlots(
  supabase: SupabaseClient,
  doctorId: string,
): Promise<PublicNextAvailableSlot[]> {
  const calendar = await loadDoctorAvailabilityCalendar(supabase, doctorId);
  if (!calendar.soonestSlot) return [];

  const slots: PublicNextAvailableSlot[] = [];
  for (const day of calendar.days) {
    for (const slot of day.slots) {
      slots.push({
        slotKey: slot.slotKey,
        timeLabel: slot.timeLabel,
        dayLabel: day.dateLabel,
        whenLabel: calendar.soonestSlot.whenLabel,
      });
      if (slots.length >= 3) return slots;
    }
  }
  return slots;
}

export async function loadOnlineBookingsPausedByDoctorId(
  supabase: SupabaseClient,
  doctorIds: string[],
): Promise<Map<string, boolean>> {
  const uniqueIds = Array.from(new Set(doctorIds.filter(Boolean)));
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("professional_settings")
    .select("professional_id, pause_online_bookings")
    .in("professional_id", uniqueIds);

  if (error) {
    console.error("[DocCy] finder pause_online_bookings lookup failed:", error);
    return new Map();
  }

  return new Map(
    (data ?? []).map((row) => [
      String((row as { professional_id: string }).professional_id),
      Boolean((row as { pause_online_bookings?: boolean | null }).pause_online_bookings),
    ]),
  );
}

export async function loadAvailabilityCalendarsByDoctorId(
  supabase: SupabaseClient,
  doctorIds: string[],
  dayCount = FINDER_AVAILABILITY_CALENDAR_DAY_COUNT,
): Promise<Map<string, PublicAvailabilityCalendar>> {
  const { calendars } = await loadFinderCardAvailabilityByDoctorId(
    supabase,
    doctorIds,
    dayCount,
  );
  return calendars;
}

/** Pause flags + calendars in one settings round-trip (finder cards). */
export type FinderLocationAvailability = {
  doctorId: string;
  location: DoctorLocationRow;
  paused: boolean;
  calendar: PublicAvailabilityCalendar;
};

export async function loadFinderCardAvailabilityByDoctorId(
  supabase: SupabaseClient,
  doctorIds: string[],
  dayCount = FINDER_AVAILABILITY_CALENDAR_DAY_COUNT,
  deps: {
    loadLocations?: (ids: string[]) => Promise<Map<string, DoctorLocationRow[]>>;
  } = {},
): Promise<{
  paused: Map<string, boolean>;
  calendars: Map<string, PublicAvailabilityCalendar>;
  locationsByDoctorId: Map<string, DoctorLocationRow[]>;
  byLocationId: Map<string, FinderLocationAvailability>;
}> {
  const uniqueIds = Array.from(new Set(doctorIds.filter(Boolean)));
  const paused = new Map<string, boolean>();
  const calendars = new Map<string, PublicAvailabilityCalendar>();
  const byLocationId = new Map<string, FinderLocationAvailability>();
  const loadLocations = deps.loadLocations ?? loadDoctorLocationsByDoctorIds;
  const locationsByDoctorId = uniqueIds.length
    ? await loadLocations(uniqueIds)
    : new Map<string, DoctorLocationRow[]>();
  if (uniqueIds.length === 0) {
    return { paused, calendars, locationsByDoctorId, byLocationId };
  }

  const settingsById = await loadDoctorSettingsForSlotsByDoctorIds(supabase, uniqueIds);

  // Every open calendar on the page, planned before any occupancy lookup.
  type Plan = {
    doctorId: string;
    location: DoctorLocationRow | null;
    settings: DoctorSettingsRow;
    weeklySlots: ReturnType<typeof settingsToWeeklySlots>;
    toIso: string;
  };
  const plans: Plan[] = [];

  for (const doctorId of uniqueIds) {
    const loaded = settingsById.get(doctorId) ?? null;
    const locations = locationsByDoctorId.get(doctorId) ?? [];

    if (locations.length === 0) {
      const doctorPaused = Boolean(loaded?.settings.pause_online_bookings);
      paused.set(doctorId, doctorPaused);
      if (doctorPaused) continue;
      if (!loaded || loaded.weeklySlots.length === 0) {
        calendars.set(doctorId, EMPTY_CALENDAR);
        continue;
      }
      plans.push({
        doctorId,
        location: null,
        settings: loaded.settings,
        weeklySlots: loaded.weeklySlots,
        toIso: occupiedRange(loaded.settings).toIso,
      });
      continue;
    }

    for (const location of locations) {
      const merged = locationToSettingsRow(location, loaded?.settings ?? ACCOUNT_SETTINGS_FALLBACK);
      if (location.pause_online_bookings || merged.pause_online_bookings) {
        byLocationId.set(location.id, { doctorId, location, paused: true, calendar: EMPTY_CALENDAR });
        continue;
      }
      const weeklySlots = settingsToWeeklySlots(merged);
      if (weeklySlots.length === 0) {
        byLocationId.set(location.id, { doctorId, location, paused: false, calendar: EMPTY_CALENDAR });
        continue;
      }
      plans.push({ doctorId, location, settings: merged, weeklySlots, toIso: occupiedRange(merged).toIso });
    }
  }

  // One call for the whole page, covering the longest horizon on it.
  let occupiedRows: OccupiedRow[] | null = [];
  if (plans.length > 0) {
    const fromIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const toIso = plans.reduce((max, plan) => (plan.toIso > max ? plan.toIso : max), plans[0].toIso);
    const ids = Array.from(new Set(plans.map((plan) => plan.doctorId)));
    occupiedRows = await loadOccupiedRows(supabase, ids, fromIso, toIso);
  }

  for (const plan of plans) {
    const calendar = !occupiedRows
      ? EMPTY_CALENDAR
      : computePublicAvailabilityCalendar(
          buildSlotParams(
            plan.settings,
            plan.weeklySlots,
            takenSlotTimesFor(occupiedRows, {
              professionalId: plan.doctorId,
              locationId: plan.location?.id ?? null,
              toIso: plan.toIso,
            }),
          ),
          dayCount,
        );
    if (plan.location) {
      byLocationId.set(plan.location.id, {
        doctorId: plan.doctorId,
        location: plan.location,
        paused: false,
        calendar,
      });
    } else {
      calendars.set(plan.doctorId, calendar);
    }
  }

  // A professional is paused only when every clinic is; the card shows the
  // first open clinic's calendar (clinics come in display order).
  for (const doctorId of uniqueIds) {
    const locations = locationsByDoctorId.get(doctorId) ?? [];
    if (locations.length === 0) continue;
    let anyOpen = false;
    let firstOpenCalendar: PublicAvailabilityCalendar | null = null;
    for (const location of locations) {
      const entry = byLocationId.get(location.id);
      if (!entry || entry.paused) continue;
      anyOpen = true;
      if (!firstOpenCalendar) firstOpenCalendar = entry.calendar;
    }
    paused.set(doctorId, !anyOpen);
    calendars.set(doctorId, firstOpenCalendar ?? EMPTY_CALENDAR);
  }

  return { paused, calendars, locationsByDoctorId, byLocationId };
}

/** @deprecated Use loadAvailabilityCalendarsByDoctorId */
export async function loadNearestAvailableSlotsByDoctorId(
  supabase: SupabaseClient,
  doctorIds: string[],
): Promise<Map<string, PublicNextAvailableSlot[]>> {
  const map = await loadAvailabilityCalendarsByDoctorId(supabase, doctorIds);
  return new Map(
    Array.from(map.entries()).map(([doctorId, calendar]) => {
      const slots: PublicNextAvailableSlot[] = [];
      if (calendar.soonestSlot) slots.push(calendar.soonestSlot);
      for (const day of calendar.days) {
        for (const slot of day.slots) {
          const entry = {
            slotKey: slot.slotKey,
            timeLabel: slot.timeLabel,
            dayLabel: day.dateLabel,
            whenLabel: calendar.soonestSlot?.whenLabel ?? day.weekdayLabel,
          };
          if (!slots.some((item) => item.slotKey === entry.slotKey)) {
            slots.push(entry);
          }
          if (slots.length >= 3) break;
        }
        if (slots.length >= 3) break;
      }
      return [doctorId, slots] as const;
    }),
  );
}

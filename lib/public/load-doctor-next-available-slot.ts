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

async function loadOccupiedSlotTimes(
  supabase: SupabaseClient,
  doctorId: string,
  settings: DoctorSettingsRow,
  locationId?: string | null,
): Promise<string[] | null> {
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

  const rpcArgs: {
    p_doctor_id: string;
    p_from: string;
    p_to: string;
    p_location_id?: string;
  } = {
    p_doctor_id: doctorId,
    p_from: fromIso,
    p_to: toIso,
  };
  if (locationId) rpcArgs.p_location_id = locationId;

  const { data: occupiedRows, error: occupiedErr } = await supabase.rpc(
    "public_doctor_occupied_datetimes",
    rpcArgs,
  );

  if (occupiedErr) {
    console.error("[DocCy] finder availability calendar lookup failed:", occupiedErr);
    return null;
  }

  return (occupiedRows ?? []).map((row: { appointment_datetime: string }) =>
    format(appointmentToCyprusDate(row.appointment_datetime), "yyyy-MM-dd'T'HH:mm"),
  );
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
    .from("doctor_settings")
    .select("doctor_id, pause_online_bookings")
    .in("doctor_id", uniqueIds);

  if (error) {
    console.error("[DocCy] finder pause_online_bookings lookup failed:", error);
    return new Map();
  }

  return new Map(
    (data ?? []).map((row) => [
      String((row as { doctor_id: string }).doctor_id),
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
  const locationsByDoctorId = uniqueIds.length
    ? await loadDoctorLocationsByDoctorIds(supabase, uniqueIds)
    : new Map<string, DoctorLocationRow[]>();
  if (uniqueIds.length === 0) {
    return { paused, calendars, locationsByDoctorId, byLocationId };
  }

  const settingsById = await loadDoctorSettingsForSlotsByDoctorIds(supabase, uniqueIds);

  await Promise.all(
    uniqueIds.map(async (doctorId) => {
      const loaded = settingsById.get(doctorId) ?? null;
      const locations = locationsByDoctorId.get(doctorId) ?? [];
      if (locations.length === 0) {
        const doctorPaused = Boolean(loaded?.settings.pause_online_bookings);
        paused.set(doctorId, doctorPaused);
        if (doctorPaused) return;
        const context = await loadDoctorAvailabilityContext(supabase, doctorId, loaded);
        calendars.set(doctorId, context
          ? computePublicAvailabilityCalendar(
              buildSlotParams(context.settings, context.weeklySlots, context.takenSlotTimes),
              dayCount,
            )
          : EMPTY_CALENDAR);
        return;
      }

      const locationResults = await Promise.all(
        locations.map(async (location) => {
          const locationPaused = Boolean(location.pause_online_bookings);
          if (locationPaused || !loaded) {
            const entry: FinderLocationAvailability = {
              doctorId,
              location,
              paused: locationPaused || !loaded,
              calendar: EMPTY_CALENDAR,
            };
            return entry;
          }
          const merged = locationToSettingsRow(location, loaded.settings);
          if (merged.pause_online_bookings) {
            return {
              doctorId,
              location,
              paused: true,
              calendar: EMPTY_CALENDAR,
            };
          }
          const weeklySlots = settingsToWeeklySlots(merged);
          const takenSlotTimes = await loadOccupiedSlotTimes(
            supabase,
            doctorId,
            merged,
            location.id,
          );
          const calendar =
            !takenSlotTimes || weeklySlots.length === 0
              ? EMPTY_CALENDAR
              : computePublicAvailabilityCalendar(
                  buildSlotParams(merged, weeklySlots, takenSlotTimes),
                  dayCount,
                );
          return {
            doctorId,
            location,
            paused: false,
            calendar,
          };
        }),
      );

      let anyOpen = false;
      let firstOpenCalendar: PublicAvailabilityCalendar | null = null;
      for (const entry of locationResults) {
        byLocationId.set(entry.location.id, entry);
        if (!entry.paused) {
          anyOpen = true;
          if (!firstOpenCalendar) firstOpenCalendar = entry.calendar;
        }
      }
      paused.set(doctorId, !anyOpen);
      calendars.set(doctorId, firstOpenCalendar ?? EMPTY_CALENDAR);
    }),
  );

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

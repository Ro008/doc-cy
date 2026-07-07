import { addDays, addHours, format } from "date-fns";
import { enGB } from "date-fns/locale";
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";
import { CY_TZ } from "@/lib/appointments";
import type { WeeklySlotFromSettings } from "@/lib/doctor-settings";

export const FINDER_CALENDAR_PREVIEW_SLOT_COUNT = 3;
export const FINDER_AVAILABILITY_CALENDAR_DAY_COUNT = 14;
export const FINDER_AVAILABILITY_VISIBLE_DAY_COUNT = 5;
export const FINDER_AVAILABILITY_MAX_SLOTS_PER_DAY = 4;

export type PublicNextAvailableSlot = {
  slotKey: string;
  dayLabel: string;
  timeLabel: string;
  whenLabel: string;
};

export type PublicAvailabilitySlot = {
  slotKey: string;
  timeLabel: string;
};

export type PublicAvailabilityDay = {
  dateKey: string;
  weekdayLabel: string;
  dateLabel: string;
  slots: PublicAvailabilitySlot[];
};

export type FinderAvailabilityDayHeader = Pick<
  PublicAvailabilityDay,
  "dateKey" | "weekdayLabel" | "dateLabel"
>;

/** Shared day columns for finder sticky nav (Cyprus wall clock, no doctor settings). */
export function buildFinderAvailabilityDayHeaders(
  dayCount = FINDER_AVAILABILITY_CALENDAR_DAY_COUNT,
): FinderAvailabilityDayHeader[] {
  if (dayCount <= 0) return [];

  const nowUtc = new Date();
  const nowCyprus = utcToZonedTime(nowUtc, CY_TZ);
  const days: FinderAvailabilityDayHeader[] = [];

  for (let offset = 0; offset < dayCount; offset++) {
    const cyprusDay = addDays(nowCyprus, offset);
    days.push({
      dateKey: format(cyprusDay, "yyyy-MM-dd"),
      weekdayLabel: format(cyprusDay, "EEE", { locale: enGB }).toUpperCase(),
      dateLabel: format(cyprusDay, "d MMM", { locale: enGB }),
    });
  }

  return days;
}

export type PublicAvailabilityCalendar = {
  days: PublicAvailabilityDay[];
  soonestSlot: PublicNextAvailableSlot | null;
};

export type ComputeAvailableSlotsParams = {
  weeklySlots: WeeklySlotFromSettings[];
  takenSlotTimes: string[];
  breakStart?: string;
  breakEnd?: string;
  holidayModeEnabled?: boolean;
  holidayStartDate?: string | null;
  holidayEndDate?: string | null;
  bookingHorizonDays?: number;
  minimumNoticeHours?: number;
};

type SlotGenerationContext = {
  weeklySlots: WeeklySlotFromSettings[];
  takenSet: Set<string>;
  breakStart?: string;
  breakEnd?: string;
  holidayActive: boolean;
  holidayStartDate: string | null;
  holidayEndDate: string | null;
  todayCyprusKey: string;
  tomorrowCyprusKey: string;
  nowCyprusTime: string;
  minimumNoticeCutoffUtc: Date;
  nowUtc: Date;
};

function normalizeBookingHorizonDays(value: number | undefined): number {
  return [14, 30, 90, 180].includes(Number(value)) ? Number(value) : 90;
}

function normalizeMinimumNoticeHours(value: number | undefined): number {
  return [1, 2, 12, 24].includes(Number(value)) ? Number(value) : 2;
}

function buildWhenLabel(dateKey: string, todayCyprusKey: string, tomorrowCyprusKey: string): string {
  if (dateKey === todayCyprusKey) return "Today";
  if (dateKey === tomorrowCyprusKey) return "Tomorrow";
  const [year, month, day] = dateKey.split("-").map(Number);
  return format(new Date(year, month - 1, day), "EEE", { locale: enGB });
}

function createSlotGenerationContext(params: ComputeAvailableSlotsParams): SlotGenerationContext | null {
  const {
    weeklySlots,
    takenSlotTimes,
    breakStart,
    breakEnd,
    holidayModeEnabled = false,
    holidayStartDate = null,
    holidayEndDate = null,
  } = params;

  if (weeklySlots.length === 0) return null;

  const nowUtc = new Date();
  const nowCyprus = utcToZonedTime(nowUtc, CY_TZ);

  return {
    weeklySlots,
    takenSet: new Set(takenSlotTimes),
    breakStart,
    breakEnd,
    holidayActive:
      Boolean(holidayModeEnabled) && Boolean(holidayStartDate) && Boolean(holidayEndDate),
    holidayStartDate,
    holidayEndDate,
    todayCyprusKey: format(nowCyprus, "yyyy-MM-dd"),
    tomorrowCyprusKey: format(addDays(nowCyprus, 1), "yyyy-MM-dd"),
    nowCyprusTime: format(nowCyprus, "HH:mm"),
    minimumNoticeCutoffUtc: addHours(
      nowUtc,
      normalizeMinimumNoticeHours(params.minimumNoticeHours),
    ),
    nowUtc,
  };
}

function collectAvailableSlotsForDay(
  ctx: SlotGenerationContext,
  cyprusDay: Date,
): PublicAvailabilitySlot[] {
  const dayCyprusKey = format(cyprusDay, "yyyy-MM-dd");
  const dayOfWeek = cyprusDay.getDay();

  if (
    ctx.holidayActive &&
    ctx.holidayStartDate &&
    ctx.holidayEndDate &&
    dayCyprusKey >= ctx.holidayStartDate &&
    dayCyprusKey <= ctx.holidayEndDate
  ) {
    return [];
  }

  const daySlots = ctx.weeklySlots.filter((slot) => slot.day_of_week === dayOfWeek);
  const results: PublicAvailabilitySlot[] = [];

  for (const slot of daySlots) {
    const [startHour, startMinute] = slot.start_time.split(":").map(Number);
    const [endHour, endMinute] = slot.end_time.split(":").map(Number);
    let cursorMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    while (cursorMinutes < endMinutes) {
      const slotHour = Math.floor(cursorMinutes / 60)
        .toString()
        .padStart(2, "0");
      const slotMinute = (cursorMinutes % 60).toString().padStart(2, "0");
      const timeLabel = `${slotHour}:${slotMinute}`;

      if (dayCyprusKey === ctx.todayCyprusKey && timeLabel < ctx.nowCyprusTime) {
        cursorMinutes += slot.duration;
        continue;
      }

      if (
        ctx.breakStart &&
        ctx.breakEnd &&
        timeLabel >= ctx.breakStart &&
        timeLabel < ctx.breakEnd
      ) {
        cursorMinutes += slot.duration;
        continue;
      }

      const slotLocal = `${dayCyprusKey}T${timeLabel}:00`;
      const slotUtcDate = zonedTimeToUtc(slotLocal, CY_TZ);
      if (slotUtcDate.getTime() < ctx.minimumNoticeCutoffUtc.getTime()) {
        cursorMinutes += slot.duration;
        continue;
      }

      const slotKey = `${dayCyprusKey}T${timeLabel}`;
      if (!ctx.takenSet.has(slotKey)) {
        results.push({ slotKey, timeLabel });
      }

      cursorMinutes += slot.duration;
    }
  }

  return results;
}

/** Consecutive calendar days with available slot times — for finder mini calendars. */
export function computePublicAvailabilityCalendar(
  params: ComputeAvailableSlotsParams,
  dayCount = FINDER_AVAILABILITY_CALENDAR_DAY_COUNT,
): PublicAvailabilityCalendar {
  const ctx = createSlotGenerationContext(params);
  if (!ctx || dayCount <= 0) {
    return { days: [], soonestSlot: null };
  }

  const normalizedBookingHorizonDays = normalizeBookingHorizonDays(params.bookingHorizonDays);
  const visibleDayCount = Math.min(dayCount, normalizedBookingHorizonDays + 1);
  const nowCyprus = utcToZonedTime(ctx.nowUtc, CY_TZ);
  const days: PublicAvailabilityDay[] = [];
  let soonestSlot: PublicNextAvailableSlot | null = null;

  for (let offset = 0; offset < visibleDayCount; offset++) {
    const cyprusDay = addDays(nowCyprus, offset);
    const dateKey = format(cyprusDay, "yyyy-MM-dd");
    const slots = collectAvailableSlotsForDay(ctx, cyprusDay);

    days.push({
      dateKey,
      weekdayLabel: format(cyprusDay, "EEE", { locale: enGB }).toUpperCase(),
      dateLabel: format(cyprusDay, "d MMM", { locale: enGB }),
      slots,
    });

    if (!soonestSlot && slots.length > 0) {
      const first = slots[0];
      soonestSlot = {
        slotKey: first.slotKey,
        timeLabel: first.timeLabel,
        dayLabel: format(cyprusDay, "EEE d MMM", { locale: enGB }),
        whenLabel: buildWhenLabel(dateKey, ctx.todayCyprusKey, ctx.tomorrowCyprusKey),
      };
    }
  }

  return { days, soonestSlot };
}

/** Mirrors BookingSection slot generation — returns the nearest bookable public slots. */
export function computeNearestAvailablePublicSlots(
  params: ComputeAvailableSlotsParams,
  limit = FINDER_CALENDAR_PREVIEW_SLOT_COUNT,
): PublicNextAvailableSlot[] {
  const calendar = computePublicAvailabilityCalendar(params);
  const ctx = createSlotGenerationContext(params);
  if (!ctx || limit <= 0) return [];

  const results: PublicNextAvailableSlot[] = [];
  for (const day of calendar.days) {
    for (const slot of day.slots) {
      results.push({
        slotKey: slot.slotKey,
        timeLabel: slot.timeLabel,
        dayLabel: `${day.weekdayLabel} ${day.dateLabel}`,
        whenLabel: buildWhenLabel(day.dateKey, ctx.todayCyprusKey, ctx.tomorrowCyprusKey),
      });
      if (results.length >= limit) return results;
    }
  }
  return results;
}

export function computeFirstAvailablePublicSlot(
  params: ComputeAvailableSlotsParams,
): PublicNextAvailableSlot | null {
  return computePublicAvailabilityCalendar(params).soonestSlot;
}

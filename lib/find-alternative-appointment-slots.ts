import { addDays, addHours, addMinutes, format } from "date-fns";
import { formatInTimeZone, utcToZonedTime, zonedTimeToUtc } from "date-fns-tz";
import { CY_TZ } from "@/lib/appointments";
import {
  type DoctorSettingsRow,
  type WeeklySlotFromSettings,
  isDateInHolidayRange,
  BOOKING_HORIZON_OPTIONS_DAYS,
  MIN_NOTICE_OPTIONS_HOURS,
  DEFAULT_BOOKING_HORIZON_DAYS,
  DEFAULT_MIN_NOTICE_HOURS,
} from "@/lib/doctor-settings";
import {
  candidateOverlapsAnyBlockingInterval,
  type DoctorAppointmentForBlocking,
} from "@/lib/appointment-overlap";

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function minutesRangeOverlapsBreak(
  startMin: number,
  endMin: number,
  breakStart?: string,
  breakEnd?: string
): boolean {
  if (!breakStart || !breakEnd) return false;
  const bs = hhmmToMinutes(breakStart.slice(0, 5));
  const be = hhmmToMinutes(breakEnd.slice(0, 5));
  return startMin < be && endMin > bs;
}

/** Add calendar days in Europe/Nicosia (anchor at local noon to avoid DST edges). */
function addCalendarDaysCyprus(ymd: string, daysToAdd: number): string {
  const noonUtc = zonedTimeToUtc(`${ymd}T12:00:00`, CY_TZ);
  const shifted = addDays(noonUtc, daysToAdd);
  return formatInTimeZone(shifted, CY_TZ, "yyyy-MM-dd");
}

/** JS getDay(): 0=Sun … 6=Sat — from a Cyprus calendar date. */
function cyprusYmdToJsDayOfWeek(ymd: string): number {
  const noonUtc = zonedTimeToUtc(`${ymd}T12:00:00`, CY_TZ);
  const isoDow = Number(formatInTimeZone(noonUtc, CY_TZ, "i"));
  return isoDow === 7 ? 0 : isoDow;
}

const ALTERNATIVE_SLOT_COUNT = 3;
/** Patient must have at least this much notice from "now" for any proposed start. */
const COUNTEROFFER_LEAD_HOURS = 3;

/**
 * First N bookable starts (UTC ISO) for a visit length, same rules as public booking grid,
 * excluding blocking intervals (incl. active NEEDS_RESCHEDULE holds).
 *
 * Search runs forward from the **requested appointment** calendar day/time in Cyprus (not from
 * today). Each candidate must be at least `COUNTEROFFER_LEAD_HOURS` after `nowUtc` and satisfy
 * minimum_notice_hours.
 */
export function findFirstAlternativeSlotStarts(opts: {
  settings: DoctorSettingsRow;
  weeklySlots: WeeklySlotFromSettings[];
  blockingRows: DoctorAppointmentForBlocking[];
  fallbackSlotDurationMinutes: number;
  visitDurationMinutes: number;
  excludeAppointmentId: string;
  /** Original requested visit start (UTC ISO) — search begins on this Cyprus date at this clock time. */
  searchFromAppointmentIso: string;
  avoidStartIso?: string | null;
  nowUtc?: Date;
}): string[] {
  const {
    settings,
    weeklySlots,
    blockingRows,
    fallbackSlotDurationMinutes,
    visitDurationMinutes,
    excludeAppointmentId,
    searchFromAppointmentIso,
    avoidStartIso,
    nowUtc = new Date(),
  } = opts;

  const breakStart = settings.break_start?.slice(0, 5);
  const breakEnd = settings.break_end?.slice(0, 5);

  const horizonDays = BOOKING_HORIZON_OPTIONS_DAYS.includes(
    settings.booking_horizon_days as (typeof BOOKING_HORIZON_OPTIONS_DAYS)[number]
  )
    ? settings.booking_horizon_days
    : DEFAULT_BOOKING_HORIZON_DAYS;
  const minNotice = MIN_NOTICE_OPTIONS_HOURS.includes(
    settings.minimum_notice_hours as (typeof MIN_NOTICE_OPTIONS_HOURS)[number]
  )
    ? settings.minimum_notice_hours
    : DEFAULT_MIN_NOTICE_HOURS;

  const minimumNoticeCutoffUtc = addHours(nowUtc, minNotice);
  const leadTimeCutoffUtc = addHours(nowUtc, COUNTEROFFER_LEAD_HOURS);
  const effectiveEarliestUtc = new Date(
    Math.max(minimumNoticeCutoffUtc.getTime(), leadTimeCutoffUtc.getTime())
  );

  const anchorUtc = new Date(searchFromAppointmentIso);
  const firstYmd = formatInTimeZone(anchorUtc, CY_TZ, "yyyy-MM-dd");
  const anchorTimeStr = formatInTimeZone(anchorUtc, CY_TZ, "HH:mm");

  const holidayActive =
    Boolean(settings.holiday_mode_enabled) &&
    Boolean(settings.holiday_start_date) &&
    Boolean(settings.holiday_end_date);

  const found: string[] = [];
  const avoidMs =
    avoidStartIso != null && avoidStartIso !== ""
      ? new Date(avoidStartIso).getTime()
      : null;

  for (
    let offset = 0;
    offset <= horizonDays && found.length < ALTERNATIVE_SLOT_COUNT;
    offset++
  ) {
    const dayCyprusKey = addCalendarDaysCyprus(firstYmd, offset);
    const dayOfWeek = cyprusYmdToJsDayOfWeek(dayCyprusKey);

    if (holidayActive && isDateInHolidayRange(settings, dayCyprusKey)) {
      continue;
    }

    const daySlots = weeklySlots.filter((s) => s.day_of_week === dayOfWeek);

    for (const s of daySlots) {
      if (found.length >= ALTERNATIVE_SLOT_COUNT) break;
      const [startHour, startMinute] = s.start_time.split(":").map(Number);
      const [endHour, endMinute] = s.end_time.split(":").map(Number);
      let cursorMinutes = (startHour ?? 0) * 60 + (startMinute ?? 0);
      const endMinutes = (endHour ?? 0) * 60 + (endMinute ?? 0);

      while (cursorMinutes < endMinutes && found.length < ALTERNATIVE_SLOT_COUNT) {
        const slotHour = Math.floor(cursorMinutes / 60)
          .toString()
          .padStart(2, "0");
        const slotMinute = (cursorMinutes % 60).toString().padStart(2, "0");
        const timeLabel = `${slotHour}:${slotMinute}`;

        if (dayCyprusKey === firstYmd && timeLabel < anchorTimeStr) {
          cursorMinutes += s.duration;
          continue;
        }

        if (
          breakStart &&
          breakEnd &&
          timeLabel >= breakStart &&
          timeLabel < breakEnd
        ) {
          cursorMinutes += s.duration;
          continue;
        }

        const slotLocal = `${dayCyprusKey}T${timeLabel}:00`;
        const slotUtcDate = zonedTimeToUtc(slotLocal, CY_TZ);
        if (slotUtcDate.getTime() < effectiveEarliestUtc.getTime()) {
          cursorMinutes += s.duration;
          continue;
        }

        const visitEndUtc = addMinutes(slotUtcDate, visitDurationMinutes);
        const startCy = utcToZonedTime(slotUtcDate, CY_TZ);
        const endCy = utcToZonedTime(visitEndUtc, CY_TZ);
        if (format(startCy, "yyyy-MM-dd") !== format(endCy, "yyyy-MM-dd")) {
          cursorMinutes += s.duration;
          continue;
        }

        const startMin = cursorMinutes;
        const endMin = startMin + visitDurationMinutes;
        if (endMin > endMinutes) {
          cursorMinutes += s.duration;
          continue;
        }
        if (minutesRangeOverlapsBreak(startMin, endMin, breakStart, breakEnd)) {
          cursorMinutes += s.duration;
          continue;
        }

        const iso = slotUtcDate.toISOString();
        if (
          avoidMs != null &&
          !Number.isNaN(avoidMs) &&
          Math.abs(slotUtcDate.getTime() - avoidMs) < 1000
        ) {
          cursorMinutes += s.duration;
          continue;
        }

        if (
          candidateOverlapsAnyBlockingInterval(
            iso,
            visitDurationMinutes,
            excludeAppointmentId,
            blockingRows,
            fallbackSlotDurationMinutes,
            nowUtc.getTime()
          )
        ) {
          cursorMinutes += s.duration;
          continue;
        }

        found.push(iso);
        cursorMinutes += s.duration;
      }
    }
  }

  return found;
}

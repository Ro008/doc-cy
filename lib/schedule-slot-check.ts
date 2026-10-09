import { addDays, addHours, format } from "date-fns";
import { utcToZonedTime } from "date-fns-tz";

import { candidateOverlapsAnyBlockingInterval, type DoctorAppointmentForBlocking } from "@/lib/appointment-overlap";
import { CY_TZ } from "@/lib/appointments";
import {
  buildWeeklyScheduleFromSettings,
  isDateInHolidayRange,
  isTimeWithinSettings,
  normalizeMinimumNoticeHours,
  type DoctorSettingsRow,
} from "@/lib/doctor-settings";

/**
 * Whether one start time fits a clinic's schedule (the clinic link's hours merged with
 * the account's holiday, horizon and notice: locationToSettingsRow) and the
 * professional's agenda (overlap with her visits in every clinic). Shared by online
 * booking (lib/online-booking-slot-check.ts) and by the times she proposes.
 */

export type ScheduleRefusalCode =
  | "holiday"
  | "beyond_horizon"
  | "minimum_notice"
  | "outside_hours"
  | "not_aligned"
  | "slot_taken";

export type ScheduleRefusal = { code: ScheduleRefusalCode; status: number; message: string };

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

export function scheduleSlotRefusal(input: {
  settingsRow: DoctorSettingsRow;
  appointmentUtc: Date;
  durationMinutes: number;
  blockingRows: DoctorAppointmentForBlocking[];
  /** The visit being moved: its own (held) times don't block it. */
  excludeAppointmentId?: string | null;
  now: Date;
}): ScheduleRefusal | null {
  const { settingsRow, appointmentUtc, now } = input;
  const cyLocal = utcToZonedTime(appointmentUtc, CY_TZ);
  const dateKey = format(cyLocal, "yyyy-MM-dd");

  if (isDateInHolidayRange(settingsRow, dateKey)) {
    return { code: "holiday", status: 403, message: "Bookings temporarily unavailable" };
  }

  const horizonDays = Number(settingsRow.booking_horizon_days ?? 90);
  const maxHorizonDays = [14, 30, 90, 180].includes(horizonDays) ? horizonDays : 90;
  if (dateKey > format(addDays(utcToZonedTime(now, CY_TZ), maxHorizonDays), "yyyy-MM-dd")) {
    return { code: "beyond_horizon", status: 400, message: "Requested time is outside the professional's booking horizon." };
  }

  const noticeHours = normalizeMinimumNoticeHours(settingsRow.minimum_notice_hours);
  if (appointmentUtc.getTime() < addHours(now, noticeHours).getTime()) {
    return { code: "minimum_notice", status: 400, message: "Requested time does not meet the minimum notice period." };
  }

  const dayOfWeek = cyLocal.getDay();
  const hours = cyLocal.getHours();
  const minutes = cyLocal.getMinutes();
  const hhmmss = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
  if (!isTimeWithinSettings(settingsRow, dayOfWeek, hhmmss)) {
    return { code: "outside_hours", status: 400, message: "Requested time is outside the professional's availability." };
  }

  const rawSlot = Number(settingsRow.slot_duration_minutes ?? 30);
  const slotMinutes = Number.isFinite(rawSlot) && rawSlot > 0 ? rawSlot : 30;
  const dayStartRaw = buildWeeklyScheduleFromSettings(settingsRow)[DAY_KEYS[dayOfWeek]]?.start_time ?? "09:00:00";
  const [startHour, startMinute] = dayStartRaw.split(":").map(Number);
  if ((hours * 60 + minutes - (startHour * 60 + startMinute)) % slotMinutes !== 0) {
    return { code: "not_aligned", status: 400, message: "Requested time is not aligned with the professional's slot duration." };
  }

  if (
    candidateOverlapsAnyBlockingInterval(
      appointmentUtc.toISOString(),
      input.durationMinutes,
      input.excludeAppointmentId ?? null,
      input.blockingRows,
      slotMinutes,
      now.getTime(),
    )
  ) {
    return { code: "slot_taken", status: 409, message: "That time was just booked. Please choose another time." };
  }
  return null;
}

import { computePublicAvailabilityCalendar } from "@/lib/public/compute-public-booking-slots";
import { settingsToWeeklySlots, type DoctorSettingsRow, type WeeklySlotFromSettings } from "@/lib/doctor-settings";

/**
 * What the booking calendar needs about one clinic: its weekly times, break and booking
 * limits, with her holiday. One helper for her profile and the Finder's pop-up (user,
 * 2026-10-17), so both offer the same times.
 */
export type ClinicBookingProps = {
  weeklySlots: WeeklySlotFromSettings[];
  breakStart: string | undefined;
  breakEnd: string | undefined;
  /** Paused at this clinic, or her access ended: no online bookings. */
  onlineBookingsPaused: boolean;
  holidayModeEnabled: boolean;
  holidayStartDate: string | null;
  holidayEndDate: string | null;
  bookingHorizonDays: number;
  minimumNoticeHours: number;
};

export function bookingPropsForSettingsRow(
  row: DoctorSettingsRow,
  { accessEnded }: { accessEnded: boolean },
): ClinicBookingProps {
  return {
    weeklySlots: settingsToWeeklySlots(row),
    breakStart: row.break_start ? row.break_start.slice(0, 5) : undefined,
    breakEnd: row.break_end ? row.break_end.slice(0, 5) : undefined,
    onlineBookingsPaused: accessEnded || Boolean(row.pause_online_bookings),
    holidayModeEnabled: Boolean(row.holiday_mode_enabled),
    holidayStartDate: row.holiday_start_date ?? null,
    holidayEndDate: row.holiday_end_date ?? null,
    bookingHorizonDays: row.booking_horizon_days ?? 90,
    minimumNoticeHours: row.minimum_notice_hours ?? 2,
  };
}

/** The clinic's days with their free times ("Choose a clinic" reads the next one); none when paused. */
export function clinicAvailabilityDays(booking: ClinicBookingProps, takenSlotTimes: string[]) {
  if (booking.onlineBookingsPaused) return [];
  const { onlineBookingsPaused: _paused, ...rules } = booking;
  return computePublicAvailabilityCalendar({ ...rules, takenSlotTimes }).days;
}

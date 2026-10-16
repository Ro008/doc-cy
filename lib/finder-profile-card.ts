import { ACCOUNT_SETTINGS_FALLBACK, locationToSettingsRow, type DoctorLocationRow } from "@/lib/doctor-locations";
import { buildWeeklyScheduleFromSettings, type DayKey } from "@/lib/doctor-settings";
import {
  clinicOpeningHours,
  formatOpeningDays,
  formatOpeningRanges,
} from "@/lib/public/clinic-opening-hours";
import type { PatientAges } from "@/lib/settings-profile-details";

/**
 * The Finder card as a summary of her profile (mockup L on the design canvas; user,
 * 2026-10-16): the profile's hero, the chosen clinic's week, and the clinic as the profile
 * shows it. The words here are the card's; the profile has its own messages.
 */

/** A listing's count line; nothing at all when nobody has asked yet (user, 2026-10-16). */
export function finderCardRequestCountText(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  return count === 1 ? "1 patient requested online booking" : `${count} patients requested online booking`;
}

/**
 * A paused clinic and an ended subscription read the same (user, 2026-10-16). Holiday mode
 * is not one of them: its card shows the next free day.
 */
export const FINDER_CARD_NO_ONLINE_BOOKING = {
  title: "Online booking not available at this clinic",
  body: "Call the clinic to book.",
} as const;

const PATIENTS_SEEN_TEXT: Record<PatientAges, string> = {
  adults: "Sees adults only",
  children: "Sees children only",
  all: "Sees adults and children",
};

/** "Patients I see", worded as the profile's hero; null when she has not chosen. */
export function finderCardPatientsSeenText(ages: PatientAges | null): string | null {
  return ages ? PATIENTS_SEEN_TEXT[ages] : null;
}

const WEEKDAY_SHORT: Record<DayKey, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

/** The clinic's opening hours, grouped as on the profile ("Wed–Fri 09:00–17:00"). */
export function finderCardOpeningHours(
  location: DoctorLocationRow | null,
): Array<{ days: string; hours: string }> {
  if (!location) return [];
  const row = locationToSettingsRow(location, ACCOUNT_SETTINGS_FALLBACK);
  return clinicOpeningHours(buildWeeklyScheduleFromSettings(row), {
    breakStart: row.break_start,
    breakEnd: row.break_end,
  }).map((group) => ({
    days: formatOpeningDays(group.days, (day) => WEEKDAY_SHORT[day]),
    hours: formatOpeningRanges(group.ranges),
  }));
}

import { BOOKING_LOCATION_QUERY } from "@/lib/booking-slot-param";
import type { PublicAvailabilityDay } from "@/lib/public/compute-public-booking-slots";
import {
  summarizeNextAvailabilityDays,
  type ProfileAvailabilityDay,
} from "@/lib/public/profile-next-availability";
import { PROFILE_SECTION_IDS } from "@/lib/public/profile-sections";

/**
 * The hero's "Next availability" card: one row per clinic that takes online
 * bookings, each with its first free time (user, 2026-10-13).
 */

export type ClinicAvailabilitySource = {
  id: string;
  title: string;
  /** Town, or district when there is no town. */
  place: string | null;
  /** Online booking is off at this clinic. */
  paused: boolean;
  /** That clinic's own calendar (its schedule, notice and horizon). */
  days: readonly PublicAvailabilityDay[];
};

export type ClinicNextAvailabilityRow = {
  locationId: string;
  title: string;
  place: string | null;
  /** The clinic the calendar below is showing. */
  selected: boolean;
  /** Null: bookable, but no free time in its horizon right now. */
  next: ProfileAvailabilityDay | null;
};

/** In her own clinic order: the page lists clinics the same way everywhere. */
export function clinicNextAvailabilityRows(input: {
  clinics: readonly ClinicAvailabilitySource[];
  selectedId: string | null;
  /** Her access has ended: no online booking anywhere. */
  bookingOffEverywhere: boolean;
}): ClinicNextAvailabilityRow[] {
  if (input.bookingOffEverywhere) return [];
  return input.clinics
    .filter((clinic) => !clinic.paused)
    .map((clinic) => ({
      locationId: clinic.id,
      title: clinic.title,
      place: clinic.place,
      selected: clinic.id === input.selectedId,
      next: summarizeNextAvailabilityDays(clinic.days, 1)[0] ?? null,
    }));
}

/**
 * The chosen clinic's row is a plain `#book` anchor (the calendar is already
 * its own); another clinic's row reloads the page for that clinic, where the
 * calendar opens on its first day with times.
 */
export function nextAvailabilityRowHref(input: {
  locale: string;
  slug: string;
  locationId: string;
  selected: boolean;
}): string {
  const anchor = `#${PROFILE_SECTION_IDS.book}`;
  if (input.selected) return anchor;
  return `/${input.locale}/${input.slug}?${BOOKING_LOCATION_QUERY}=${encodeURIComponent(input.locationId)}${anchor}`;
}

const BOOKING_HORIZONS = [14, 30, 90, 180];

/**
 * One professional, one agenda: her busy times are loaded once, far enough
 * ahead for the clinic with the longest horizon.
 */
export function widestBookingHorizonDays(
  horizons: ReadonlyArray<number | null | undefined>,
): number {
  if (horizons.length === 0) return 90;
  return Math.max(
    ...horizons.map((value) => (BOOKING_HORIZONS.includes(Number(value)) ? Number(value) : 90)),
  );
}

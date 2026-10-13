import { buildDoctorBookingHref } from "@/lib/booking-slot-param";
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
 * A row opens the details form for that clinic and time (user, 2026-10-13).
 * The chosen clinic's row is a plain `#book` anchor (the page asks the calendar
 * to open the time); another clinic's row loads the page for that clinic with
 * the time in `?slot=`, which BookingSection opens the same way as a finder link.
 * Without a free time it only switches clinic.
 */
export function nextAvailabilityRowHref(input: {
  locale: string;
  slug: string;
  locationId: string;
  selected: boolean;
  slotKey: string | null;
}): string {
  const anchor = `#${PROFILE_SECTION_IDS.book}`;
  if (input.selected) return anchor;
  return `/${input.locale}${buildDoctorBookingHref(input.slug, input.slotKey, input.locationId)}${anchor}`;
}

export type ClinicSwitchOption = {
  id: string;
  title: string;
  place: string | null;
  /** False: online booking is off there (the patient can still look and call). */
  bookable: boolean;
  href: string;
};

/**
 * The small "Change clinic" control above the calendar: the clinic being
 * booked, and her other clinics in her own order.
 */
export function clinicSwitchOptions(input: {
  clinics: ReadonlyArray<Pick<ClinicAvailabilitySource, "id" | "title" | "place" | "paused">>;
  selectedId: string | null;
  bookingOffEverywhere: boolean;
  locale: string;
  slug: string;
}): { current: { title: string; place: string | null } | null; others: ClinicSwitchOption[] } {
  const selected = input.clinics.find((clinic) => clinic.id === input.selectedId) ?? null;
  return {
    current: selected ? { title: selected.title, place: selected.place } : null,
    others: input.clinics
      .filter((clinic) => clinic.id !== input.selectedId)
      .map((clinic) => ({
        id: clinic.id,
        title: clinic.title,
        place: clinic.place,
        bookable: !input.bookingOffEverywhere && !clinic.paused,
        href: `/${input.locale}${buildDoctorBookingHref(input.slug, null, clinic.id)}`,
      })),
  };
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

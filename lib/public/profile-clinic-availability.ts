import { buildDoctorBookingHref } from "@/lib/booking-slot-param";
import type { PublicAvailabilityDay } from "@/lib/public/compute-public-booking-slots";
import {
  summarizeNextAvailabilityDays,
  type ProfileAvailabilityDay,
} from "@/lib/public/profile-next-availability";

/**
 * "Choose a clinic" on the public profile (user, 2026-10-13): every clinic of hers as one
 * choice, each with its next free time. Choosing one shows that clinic's details and
 * calendar below.
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

export type ClinicChooserRow = {
  id: string;
  title: string;
  place: string | null;
  /** The clinic whose details and calendar are showing. */
  selected: boolean;
  /** False: online booking is off there (the patient can still look and call). */
  bookable: boolean;
  /** Null: not bookable, or no free time in its horizon right now. */
  next: ProfileAvailabilityDay | null;
  /** The page for that clinic (`?location=`): the server draws its details and times. */
  href: string;
};

/** In her own clinic order: the page lists clinics the same way everywhere. */
export function clinicChooserRows(input: {
  clinics: readonly ClinicAvailabilitySource[];
  selectedId: string | null;
  /** Her access has ended: no online booking anywhere. */
  bookingOffEverywhere: boolean;
  locale: string;
  slug: string;
}): ClinicChooserRow[] {
  return input.clinics.map((clinic) => {
    const bookable = !input.bookingOffEverywhere && !clinic.paused;
    return {
      id: clinic.id,
      title: clinic.title,
      place: clinic.place,
      selected: clinic.id === input.selectedId,
      bookable,
      next: bookable ? (summarizeNextAvailabilityDays(clinic.days, 1)[0] ?? null) : null,
      href: `/${input.locale}${buildDoctorBookingHref(input.slug, null, clinic.id)}`,
    };
  });
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

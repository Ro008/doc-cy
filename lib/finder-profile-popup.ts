import type { ClinicBookingProps } from "@/lib/public/professional-booking-props";
import type { BookingViewerMode } from "@/lib/booking-viewer";

/**
 * The Finder's profile pop-up (mockup F; user, 2026-10-17): every card link to more about a
 * registered professional opens her profile over the Finder, with her calendar and the
 * booking form, so the patient never leaves the results.
 */

/** Who she is, from the card (the pop-up draws its hero at once, before anything loads). */
export type FinderPopupProfessional = {
  id: string;
  slug: string;
  name: string;
  avatarUrl: string;
  hasOwnPhoto: boolean;
  specialties: readonly string[];
  district: string | null;
  isGesy: boolean;
  /** "Greek, English"; empty when she lists none. */
  languages: string;
  patientsSeen: string | null;
  rating: { average: number; count: number } | null;
};

export type FinderPopupClinic = {
  /** `professional_clinics.id`. */
  id: string;
  title: string;
  place: string | null;
  bookable: boolean;
  /** Her next free time there, worded ("Fri 16 Oct", "09:00"); null when none or not bookable. */
  next: { day: string; time: string; dateKey: string; slotKey: string } | null;
  booking: ClinicBookingProps;
  publicPhoneAvailable: boolean;
};

/** GET /api/directory/professional-booking: what the pop-up loads (her profile shows the same). */
export type FinderPopupData = {
  ok: true;
  professionalId: string;
  headline: string | null;
  hasPersonalMobile: boolean;
  viewerMode: BookingViewerMode;
  services: Array<{ id: string; name: string }>;
  takenSlotTimes: string[];
  clinics: FinderPopupClinic[];
};

/** The card's clinic when she has it; else her first clinic with a free time; else her first. */
export function finderPopupInitialClinicId(
  clinics: readonly FinderPopupClinic[],
  requested: string | null,
): string | null {
  if (requested && clinics.some((clinic) => clinic.id === requested)) return requested;
  return (clinics.find((clinic) => clinic.bookable && clinic.next) ?? clinics[0])?.id ?? null;
}

export type FinderPopupChooserRow = {
  id: string;
  title: string;
  place: string | null;
  selected: boolean;
  bookable: boolean;
  day: string | null;
  time: string | null;
  dateKey: string | null;
  slotKey: string | null;
};

/** "Choose a clinic", as on her profile, in her clinic order. */
export function finderPopupChooserRows(
  clinics: readonly FinderPopupClinic[],
  selectedId: string | null,
): FinderPopupChooserRow[] {
  return clinics.map((clinic) => ({
    id: clinic.id,
    title: clinic.title,
    place: clinic.place,
    selected: clinic.id === selectedId,
    bookable: clinic.bookable,
    day: clinic.next?.day ?? null,
    time: clinic.next?.time ?? null,
    dateKey: clinic.next?.dateKey ?? null,
    slotKey: clinic.next?.slotKey ?? null,
  }));
}

/** The history entry the pop-up adds, so Back closes it (the Finder under it stays put). */
export const FINDER_POPUP_HISTORY_KEY = "doccyFinderPopup";

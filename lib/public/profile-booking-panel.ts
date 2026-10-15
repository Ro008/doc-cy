import type { ProfileClinicCard } from "@/lib/public/profile-clinic-cards";

/**
 * The booking panel on the public profile (user, 2026-10-13): her clinics to choose from,
 * and for the chosen one its address, opening hours, phone and map above its times.
 * Built from the clinic rows and the same cards "Clinics & contact" used.
 */

export type BookingPanelClinic = {
  /** The clinic row's id (the `location` in the URL), or the card's key when there are no rows. */
  id: string;
  title: string;
  /** Town, or the district when there is no town. */
  place: string;
  address: string;
  mapsUrl: string;
  /** Clinic id for the "Call" button, when that clinic has a phone. */
  phoneClinicId: string | null;
  /** Already formatted ("Mon–Fri", "09:00–17:00"). */
  hours: ReadonlyArray<{ days: string; hours: string }>;
  /** No online booking here: paused at this clinic, or her access has ended. */
  bookingOff: boolean;
  selected: boolean;
  /** False for a card that is not a clinic row (nothing to switch to). */
  selectable: boolean;
};

type PanelLocation = {
  id: string;
  town?: string | null;
  district?: string | null;
  pause_online_bookings?: boolean | null;
};

export function buildBookingPanelClinics(input: {
  locations: readonly PanelLocation[];
  cards: readonly ProfileClinicCard[];
  openingHours: Readonly<Record<string, ReadonlyArray<{ days: string; hours: string }>>>;
  selectedId: string | null;
  /** Her access has ended: no clinic takes online bookings. */
  bookingOffEverywhere: boolean;
}): BookingPanelClinic[] {
  const cardByKey = new Map(input.cards.map((card) => [card.key, card]));
  const fromCard = (card: ProfileClinicCard) => ({
    title: card.title,
    address: card.address,
    mapsUrl: card.mapsUrl,
    phoneClinicId: card.phoneClinicId,
    hours: input.openingHours[card.key] ?? [],
  });

  if (input.locations.length === 0) {
    return input.cards.map((card, index) => ({
      id: card.key,
      ...fromCard(card),
      place: "",
      bookingOff: input.bookingOffEverywhere,
      selected: index === 0,
      selectable: false,
    }));
  }

  const single = input.locations.length === 1;
  const clinics: BookingPanelClinic[] = [];
  for (const location of input.locations) {
    const card = cardByKey.get(location.id);
    if (!card) continue;
    clinics.push({
      id: location.id,
      ...fromCard(card),
      place: String(location.town ?? "").trim() || String(location.district ?? "").trim(),
      bookingOff: input.bookingOffEverywhere || Boolean(location.pause_online_bookings),
      selected: single || location.id === input.selectedId,
      selectable: true,
    });
  }
  return clinics;
}

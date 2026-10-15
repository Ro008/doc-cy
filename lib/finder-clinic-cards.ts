import { resolveFinderTownQuery } from "@/lib/cyprus-towns";
import { computeFinderDistanceKm, type Coordinates } from "@/lib/finder-distance";
import { orderUnifiedFinderResultsPhase1 } from "@/lib/finder-results-paging";

/**
 * One finder card per professional + clinic (user, 2026-10-15).
 *
 * A card stands for one clinic that matches the search: a Paphos search shows only her
 * Paphos clinic, and with no place searched each of her clinics is its own card. It
 * ranks by what a patient can do at that clinic, so her open clinic sits with the
 * bookable cards while her paused one comes after all of them.
 */

/** One clinic of a professional, as a finder card shows it. */
export type FinderCardPlace = {
  /** `clinics.id`. */
  clinicId: string;
  /** `professional_clinics.id` (`?location=` on booking links); null for listings. */
  linkId: string | null;
  district: string | null;
  town: string | null;
  latitude: number | null;
  longitude: number | null;
  /** No online booking at this clinic (`professional_clinics.pause_online_bookings`). */
  pausedOnline: boolean;
};

export type FinderClinicCardSource<R> = {
  kind: "registered" | "manual";
  professionalId: string;
  row: R;
  /** Her unarchived clinics, in her clinic order. */
  places: readonly FinderCardPlace[];
  /** Pro access (the online-booking entitlement); always false for a listing. */
  hasProAccess: boolean;
};

export type FinderClinicCard<R> = {
  key: string;
  kind: "registered" | "manual";
  professionalId: string;
  row: R;
  /** Null only for a professional with no clinic, shown when no place is searched. */
  place: FinderCardPlace | null;
  /** A patient can book online at this clinic. */
  hasOnlineBooking: boolean;
  isRegistered: boolean;
  distanceKm: number | null;
};

export type FinderPlaceFilter = {
  district: string;
  town: string;
  coords: Coordinates | null;
};

function sameDistrict(value: string | null, active: string): boolean {
  return String(value ?? "").trim().toLowerCase() === active.trim().toLowerCase();
}

function placeMatches(place: FinderCardPlace, filter: FinderPlaceFilter): boolean {
  if (filter.district.trim() && !sameDistrict(place.district, filter.district)) return false;
  if (filter.town.trim() && resolveFinderTownQuery(place.town) !== filter.town) return false;
  return true;
}

/** Every card the search shows: one per professional and matching clinic. */
export function buildFinderClinicCards<R>(
  sources: readonly FinderClinicCardSource<R>[],
  filter: FinderPlaceFilter,
): FinderClinicCard<R>[] {
  const hasPlaceFilter = Boolean(filter.district.trim() || filter.town.trim());
  const cards: FinderClinicCard<R>[] = [];
  for (const source of sources) {
    const isRegistered = source.kind === "registered";
    const places: (FinderCardPlace | null)[] = source.places.filter((p) => placeMatches(p, filter));
    // A professional with no clinic has nowhere to match; she stays findable by name
    // and specialty, as before.
    if (source.places.length === 0 && !hasPlaceFilter) places.push(null);
    for (const place of places) {
      cards.push({
        key: `${source.kind}-${source.professionalId}-${place?.clinicId ?? "none"}`,
        kind: source.kind,
        professionalId: source.professionalId,
        row: source.row,
        place,
        hasOnlineBooking: Boolean(isRegistered && source.hasProAccess && place && !place.pausedOnline),
        isRegistered,
        distanceKm: place
          ? computeFinderDistanceKm(filter.coords, place.latitude, place.longitude)
          : null,
      });
    }
  }
  return cards;
}

type CardGroup<R> = {
  kind: "registered" | "manual";
  row: R;
  hasOnlineBooking: boolean;
  isRegistered: boolean;
  distanceKm: null;
  cards: FinderClinicCard<R>[];
};

/**
 * Finder order, applied to cards:
 * 1. online booking open at the card's clinic;
 * 2. registered, no online booking at this clinic (paused, or access ended);
 * 3. unregistered listings, by their online-booking requests, highest first.
 *
 * Within a tier a professional's cards stay together in her clinic order, and the
 * professionals are shuffled (not the cards), so more clinics is not a better place.
 * Near me: each tier by the distance to each card's own clinic.
 */
export function orderFinderClinicCards<R extends object>(
  cards: readonly FinderClinicCard<R>[],
  options: {
    nearMe: boolean;
    shuffleSeed: string;
    pinTestProfiles?: boolean;
    getRequestCount: (card: FinderClinicCard<R>) => number;
  },
): FinderClinicCard<R>[] {
  if (options.nearMe) {
    return orderUnifiedFinderResultsPhase1(cards, {
      nearMe: true,
      shuffleSeed: options.shuffleSeed,
      pinTestProfiles: options.pinTestProfiles,
    });
  }

  const groups = new Map<string, CardGroup<R>>();
  for (const card of cards) {
    const groupKey = `${card.kind}|${card.professionalId}|${card.hasOnlineBooking}`;
    const group = groups.get(groupKey);
    if (group) {
      group.cards.push(card);
      continue;
    }
    groups.set(groupKey, {
      kind: card.kind,
      row: card.row,
      hasOnlineBooking: card.hasOnlineBooking,
      isRegistered: card.isRegistered,
      distanceKm: null,
      cards: [card],
    });
  }

  return orderUnifiedFinderResultsPhase1([...groups.values()], {
    nearMe: false,
    shuffleSeed: options.shuffleSeed,
    pinTestProfiles: options.pinTestProfiles,
    getUnregisteredRequestCount: (group) => options.getRequestCount(group.cards[0]!),
  }).flatMap((group) => group.cards);
}

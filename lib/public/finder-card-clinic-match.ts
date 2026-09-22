import type { ManualClinicRef } from "@/lib/manual-directory-clinics";

/**
 * Which clinic may be named above a rendered practice location.
 *
 * `professional_clinics.id` is the authoritative link: Stage 1 reused
 * `doctor_locations.id` for it, so a location resolves to exactly one clinic with no
 * guessing. Cards whose ids do not line up used to fall back to "the only linked
 * clinic" whenever the professional had a single location, which silently assumed
 * that location and that clinic were the same place.
 *
 * Verify breaks that assumption. A professional registers their own address, claims a
 * finder listing, and the absorb moves the listing's clinic onto them — so their one
 * linked clinic is somewhere they may no longer practise. The fallback then printed
 * the old clinic's name directly above the new address.
 *
 * So the fallback now has to agree with what is on screen: it applies only when the
 * clinic sits at the address being rendered, or when the location has no address of
 * its own to contradict. Otherwise the location renders as a plain address, which is
 * what registered cards showed before clinic names existed.
 */

const COUNTRY_SUFFIX = /\s*,?\s*cyprus$/;

/**
 * Comparison key for a street address: accent-folded, punctuation-free, single-spaced,
 * and without a trailing country, which only some sources carry.
 */
function addressKey(value: string | null | undefined): string {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return normalized.replace(COUNTRY_SUFFIX, "").trim();
}

/**
 * True when both strings name the same address. Deliberately exact after
 * normalization: a near miss is not evidence of the same place, and naming the wrong
 * clinic is worse than naming none.
 */
export function sameClinicAddress(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = addressKey(a);
  const right = addressKey(b);
  if (!left || !right) return false;
  return left === right;
}

export function clinicForRenderedLocation(input: {
  /** `null` for cards with no `doctor_locations` row, which render `clinic_address`. */
  locationId?: string | null;
  locationAddress?: string | null;
  byLocationId: Map<string, ManualClinicRef>;
  /** Every clinic linked to this professional, primary first. */
  candidates?: readonly ManualClinicRef[];
}): ManualClinicRef | null {
  const locationId = String(input.locationId ?? "").trim();
  const linked = locationId ? input.byLocationId.get(locationId) : undefined;
  if (linked) return linked;

  const candidates = input.candidates ?? [];
  if (candidates.length === 0) return null;

  // Nothing on screen to contradict a name, so a single linked clinic can stand in.
  const address = String(input.locationAddress ?? "").trim();
  if (!address) return candidates.length === 1 ? candidates[0] : null;

  // Otherwise the clinic has to be the one at this address — which is also what lets a
  // professional practising in two places keep the right name over each of them.
  return candidates.find((candidate) => sameClinicAddress(address, candidate.address)) ?? null;
}

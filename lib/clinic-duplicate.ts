/**
 * "Is this your clinic? Join it instead" (user, 2026-10-11): before she asks for a
 * clinic as new, look for one DocCy already has that is very likely the same place.
 * Address similarity alone is not duplication (two practices can share a building),
 * so a match needs the same Google place, or the same name close by.
 */

export type ClinicLookalike = {
  id: string;
  name: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
};

type Typed = { name: string; latitude: number | null; longitude: number | null; placeId: string | null };

const NEARBY_METRES = 300;

/** Lower case, no accents or punctuation, without words every clinic name has. */
export function clinicNameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9Ͱ-Ͽ]+/g, " ")
    .split(" ")
    .filter((word) => word && !["dr", "the", "clinic", "medical", "centre", "center", "ltd"].includes(word))
    .join(" ");
}

function metresApart(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const rad = Math.PI / 180;
  const x = (b.longitude - a.longitude) * rad * Math.cos(((a.latitude + b.latitude) / 2) * rad);
  const y = (b.latitude - a.latitude) * rad;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

/** The DocCy clinic that is very likely the one she is typing, or null. */
export function findClinicLookalike<T extends ClinicLookalike>(
  typed: Typed,
  candidates: readonly T[],
  takenIds: readonly string[] = [],
): T | null {
  const key = clinicNameKey(typed.name);
  for (const candidate of candidates) {
    if (takenIds.includes(candidate.id)) continue;
    if (typed.placeId && candidate.placeId && typed.placeId === candidate.placeId) return candidate;
    if (!key || clinicNameKey(candidate.name) !== key) continue;
    const pinned =
      typeof typed.latitude === "number" &&
      typeof typed.longitude === "number" &&
      typeof candidate.latitude === "number" &&
      typeof candidate.longitude === "number";
    // Same name: the same place when close by (or when either has no pin to compare).
    if (
      !pinned ||
      metresApart(
        { latitude: typed.latitude as number, longitude: typed.longitude as number },
        { latitude: candidate.latitude as number, longitude: candidate.longitude as number },
      ) <= NEARBY_METRES
    ) {
      return candidate;
    }
  }
  return null;
}

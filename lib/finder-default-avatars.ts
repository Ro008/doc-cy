/**
 * Default Finder avatars by private gender (directory_manual.gender).
 * Gender is never exposed in public views or client props — only used server-side
 * to pick a placeholder when no curated/custom photo exists.
 *
 * Clinics have no gender — use FINDER_DEFAULT_AVATAR_CLINIC (icon, not person).
 */

export type DirectoryGender = "male" | "female" | "unknown";

export const FINDER_DEFAULT_AVATAR_MALE = "/finder/avatars/default-male.webp";
export const FINDER_DEFAULT_AVATAR_FEMALE = "/finder/avatars/default-female.webp";
/** Small-size clinic/place icon (readable in a circle). */
export const FINDER_DEFAULT_AVATAR_CLINIC = "/finder/avatars/default-clinic.svg";
/**
 * Larger 3D clinic illustration — for OG shares, banners, empty states.
 * Not for tiny circular avatars (detail is unreadable there).
 */
export const FINDER_CLINIC_HERO_ILLUSTRATION = "/finder/avatars/clinic-hero.webp";
/** Neutral fallback when gender is missing. */
export const FINDER_DEFAULT_AVATAR_UNKNOWN = FINDER_DEFAULT_AVATAR_MALE;

const LEGACY_DEFAULT_AVATAR_PNG_TO_WEBP: Record<string, string> = {
  "/finder/avatars/default-male.png": FINDER_DEFAULT_AVATAR_MALE,
  "/finder/avatars/default-female.png": FINDER_DEFAULT_AVATAR_FEMALE,
};

/** Recently viewed stores the photo URL in localStorage; rewrite deleted PNG placeholders. */
export function rewriteLegacyFinderDefaultAvatarUrl(photoUrl: string | null | undefined): string | null {
  const raw = String(photoUrl ?? "").trim();
  if (!raw) return null;
  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const url = new URL(raw);
      const mapped = LEGACY_DEFAULT_AVATAR_PNG_TO_WEBP[url.pathname];
      if (mapped) return mapped;
      return raw;
    }
  } catch {
    // ignore
  }
  const path = raw.split("?")[0]?.split("#")[0] || raw;
  return LEGACY_DEFAULT_AVATAR_PNG_TO_WEBP[path] ?? raw;
}

export function normalizeDirectoryGender(value: unknown): DirectoryGender {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return "unknown";
  if (
    raw === "male" ||
    raw === "m" ||
    raw === "man" ||
    raw === "hombre" ||
    raw.startsWith("male")
  ) {
    return "male";
  }
  if (
    raw === "female" ||
    raw === "f" ||
    raw === "woman" ||
    raw === "mujer" ||
    raw.startsWith("female")
  ) {
    return "female";
  }
  return "unknown";
}

export function defaultFinderAvatarForGender(gender: DirectoryGender): string {
  if (gender === "female") return FINDER_DEFAULT_AVATAR_FEMALE;
  if (gender === "male") return FINDER_DEFAULT_AVATAR_MALE;
  return FINDER_DEFAULT_AVATAR_UNKNOWN;
}

/**
 * Prefer curated/custom photo; otherwise gender-based default.
 * Pass gender only from trusted server queries (service role / base table).
 */
export function resolveFinderDisplayPhotoUrl(input: {
  curatedOrCustomPhotoUrl?: string | null;
  gender?: unknown;
}): string {
  const curated = String(input.curatedOrCustomPhotoUrl ?? "").trim();
  if (curated) return curated;
  return defaultFinderAvatarForGender(normalizeDirectoryGender(input.gender));
}

/** Prefer clinic photo when present; otherwise clinic icon default. */
export function resolveClinicDisplayPhotoUrl(
  curatedOrCustomPhotoUrl?: string | null,
): string {
  const curated = String(curatedOrCustomPhotoUrl ?? "").trim();
  if (curated) return curated;
  return FINDER_DEFAULT_AVATAR_CLINIC;
}

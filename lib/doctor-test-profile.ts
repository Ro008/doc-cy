/**
 * QA / smoke doctors: auto-flagged at registration by email patterns.
 *
 * - Prod: hidden from Finder; still counted in Founding Members availability (marketing urgency).
 * - Integration: set NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES=1 so they appear in Finder too.
 * - Founder tier lock (RPC): test rows do not consume one of the 100 real founder slots at signup.
 *
 * Owner smoke aliases (e.g. rociosirvent+anastasiadoctor@gmail.com): DOC_CY_TEST_DOCTOR_EMAIL_MARKERS
 * or default marker below. CI domains (@test-doccy.com.cy, @*.testing) stay supported.
 */
const TEST_EMAIL_SUFFIXES = ["@test-doccy.com.cy", "@integration.test"] as const;

/** Subdomains like `andreas-nikos.integration@doccy.testing`. */
const TEST_EMAIL_DOMAIN_PATTERN = /@.+\.testing$/i;

const DEFAULT_OWNER_TEST_EMAIL_MARKERS = ["rociosirvent"] as const;

function getOwnerTestEmailMarkers(): string[] {
  const fromEnv = String(process.env.DOC_CY_TEST_DOCTOR_EMAIL_MARKERS ?? "")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : [...DEFAULT_OWNER_TEST_EMAIL_MARKERS];
}

export function isTestDoctorRegistrationEmail(email: string | null | undefined): boolean {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized.includes("@")) return false;

  if (getOwnerTestEmailMarkers().some((marker) => normalized.includes(marker))) {
    return true;
  }
  if (TEST_EMAIL_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) return true;
  return TEST_EMAIL_DOMAIN_PATTERN.test(normalized);
}

export function isTestProfileLike(row: {
  name?: string | null;
  slug?: string | null;
  email?: string | null;
  isTestProfile?: boolean | null;
}): boolean {
  if (row.isTestProfile === true) return true;
  const name = String(row.name ?? "");
  if (/\btest\b/i.test(name)) return true;
  const slug = String(row.slug ?? "");
  if (/^(booking-flow-|finder-card-|finder-ux-|finder-filter-)/i.test(slug)) return true;
  if (isTestDoctorRegistrationEmail(row.email)) return true;
  return false;
}

/** Integration / local QA only — never enable on production (mydoccy.com). */
export function finderIncludesRegisteredTestProfiles(): boolean {
  return (
    String(process.env.NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES ?? "").trim() === "1"
  );
}

/** Prod default: test doctors are omitted from Finder but still count toward founders display. */
export function isRegisteredDoctorHiddenFromFinder(row: {
  name?: string | null;
  slug?: string | null;
  email?: string | null;
  isTestProfile?: boolean | null;
}): boolean {
  if (finderIncludesRegisteredTestProfiles()) return false;
  return isTestProfileLike(row);
}

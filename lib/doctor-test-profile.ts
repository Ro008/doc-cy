/**
 * QA / smoke doctors: auto-flagged at registration by email patterns.
 *
 * - Prod: hidden from Finder; still counted in Founding Members availability (marketing urgency).
 * - Integration: set NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES=1 so they appear in Finder too.
 * - Founder tier lock (RPC): test rows do not consume one of the real founder slots at signup.
 *
 * Owner smoke aliases (e.g. rociosirvent+anastasiadoctor@gmail.com): DOC_CY_TEST_DOCTOR_EMAIL_MARKERS
 * or default marker below. CI domains (@test-doccy.com.cy, @*.testing) stay supported.
 */
const TEST_EMAIL_SUFFIXES = ["@test-doccy.com.cy", "@integration.test"] as const;

/** Subdomains like `andreas-nikos.integration@doccy.testing`. */
const TEST_EMAIL_DOMAIN_PATTERN = /@.+\.testing$/i;

const DEFAULT_OWNER_TEST_EMAIL_MARKERS = ["rociosirvent"] as const;

/** Manual prod QA: local-part+tag @gmail.com. Keep in sync with SQL is_test_doctor_registration_email. */
const GMAIL_PLUS_TEST_LOCAL_PARTS = ["doccyteam", "rociosirvent", "liviolanzo"] as const;

const GMAIL_PLUS_TEST_EMAIL_PATTERN = new RegExp(
  `^(${GMAIL_PLUS_TEST_LOCAL_PARTS.join("|")})\\+.+@gmail\\.com$`,
  "i",
);

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

  if (GMAIL_PLUS_TEST_EMAIL_PATTERN.test(normalized)) return true;
  if (getOwnerTestEmailMarkers().some((marker) => normalized.includes(marker))) {
    return true;
  }
  if (TEST_EMAIL_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) return true;
  return TEST_EMAIL_DOMAIN_PATTERN.test(normalized);
}

/**
 * Integration Playwright doctors use these name prefixes (see finder_*.integration.spec.ts).
 * Keep in sync with scripts/cleanup-test-doctors.mjs TEST_NAME_PREFIXES.
 */
/** Ephemeral claim clones. Keep in sync with SQL is_qa_claim_directory_listing. */
export const QA_CLAIM_DIRECTORY_NAME_PREFIX = "QA Claim ";
export const QA_CLAIM_DIRECTORY_SLUG_PREFIX = "qa-claim-";

export const INTEGRATION_TEST_NAME_PREFIXES = [
  "Booking Flow Doctor ",
  "Finder Card ",
  "Finder UX ",
  "Finder Filter ",
  "Prefix Cleanup ",
  "Register E2E ",
  QA_CLAIM_DIRECTORY_NAME_PREFIX,
] as const;

/**
 * Slug prefixes for ephemeral integration doctors.
 * Keep in sync with scripts/cleanup-test-doctors.mjs TEST_SLUG_PREFIXES.
 */
export const INTEGRATION_TEST_SLUG_PREFIXES = [
  "booking-flow-",
  "finder-card-",
  "finder-ux-",
  "finder-filter-",
  "qa-filter-",
  "qa-ux-",
  "qa-card-",
  "qa-prefix-",
  "finder-prefix-",
  "register-e2e-",
  QA_CLAIM_DIRECTORY_SLUG_PREFIX,
] as const;

/** Unregistered listing a test signup is allowed to absorb (never a real directory person). */
export function isQaClaimDirectoryListing(row: {
  name?: string | null;
  slug?: string | null;
} | null | undefined): boolean {
  if (!row) return false;
  const name = String(row.name ?? "");
  const slug = String(row.slug ?? "").toLowerCase();
  return (
    name.startsWith(QA_CLAIM_DIRECTORY_NAME_PREFIX) ||
    slug.startsWith(QA_CLAIM_DIRECTORY_SLUG_PREFIX)
  );
}

export function isTestProfileLike(row: {
  name?: string | null;
  slug?: string | null;
  email?: string | null;
  registration_email?: string | null;
  isTestProfile?: boolean | null;
}): boolean {
  if (row.isTestProfile === true) return true;
  const name = String(row.name ?? "");
  if (/\btest\b/i.test(name)) return true;
  if (INTEGRATION_TEST_NAME_PREFIXES.some((prefix) => name.startsWith(prefix))) return true;
  // Legacy names that still contain the nonce after a title-stripped display form.
  if (/^Finder Filter [AB] /i.test(name)) return true;
  const slug = String(row.slug ?? "").toLowerCase();
  if (INTEGRATION_TEST_SLUG_PREFIXES.some((prefix) => slug.startsWith(prefix))) return true;
  if (isTestDoctorRegistrationEmail(row.registration_email)) return true;
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

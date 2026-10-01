import type { SupabaseClient } from "@supabase/supabase-js";
import { firstNameFromProfessionalName } from "@/lib/doctor-display-name";
import { MAX_DOCTOR_LOCATIONS } from "@/lib/doctor-locations";
import { MAX_DOCTOR_SPECIALTIES } from "@/lib/doctor-specialties";
import {
  isQaClaimDirectoryListing,
  isTestDoctorRegistrationEmail,
  restrictTestSignupDirectoryClaimsToQaListings,
} from "@/lib/doctor-test-profile";
import { harmonizeFinderSpecialtyLabel } from "@/lib/finder-specialty-harmonize";
import { SPECIALTY_LINKS_SELECT, specialtyNamesForRow } from "@/lib/specialty-catalogue";

export const REGISTER_CLAIM_QUERY = "claim";

const PROFESSIONAL_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isProfessionalUuid(value: string | null | undefined): boolean {
  return PROFESSIONAL_UUID_RE.test(String(value ?? "").trim());
}

export function registerClaimPath(professionalId: string): string {
  return `/register?${REGISTER_CLAIM_QUERY}=${encodeURIComponent(professionalId.trim())}`;
}

export type DirectoryClaimListing = {
  id: string;
  slug?: string | null;
  name?: string | null;
  specialty?: string | null;
  specialties?: string[] | null;
  district?: string | null;
  email?: string | null;
};

export type DirectoryClaimInput = {
  name: string;
  email: string;
  district: string | null;
  specialties: readonly string[];
  isTestSignup?: boolean;
};

export type FuzzyDirectoryClaimMatch = {
  id: string;
  slug: string | null;
  reason: "email" | "name_specialty_district";
};

export type DirectoryClaimMatch = FuzzyDirectoryClaimMatch | {
  id: string;
  slug: string | null;
  reason: "card_link";
};

export type RegisterClaimClinic = {
  /** The DocCy clinic the listing is linked to: the form links it instead of proposing a copy. */
  clinicId: string | null;
  name: string;
  address: string;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  town: string | null;
  placeId: string | null;
};

export type RegisterClaimPrefill = {
  id: string;
  slug: string | null;
  name: string;
  firstName: string | null;
  specialty: string;
  specialties: Array<{ specialty: string; fromMaster: boolean }>;
  district: string | null;
  addressHint: string | null;
  clinics: RegisterClaimClinic[];
  /** From `professionals.gender`; null when the listing does not say. */
  gender: "female" | "male" | null;
  /**
   * "yes" only when the listing is a GeSY one. `is_gesy` defaults to false for
   * listings from other sources, which means "unknown", so it never prefills "no".
   */
  gesy: "yes" | null;
};

function claimGender(raw: string | null | undefined): "female" | "male" | null {
  const value = String(raw ?? "").trim().toLowerCase();
  return value === "female" || value === "male" ? value : null;
}

type ClaimClinicNested = {
  id?: string | null;
  name?: string | null;
  address?: string | null;
  district?: string | null;
  town?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_archived?: boolean | null;
};

type ClaimClinicJoinRow = {
  is_primary?: boolean | null;
  clinics?: ClaimClinicNested | ClaimClinicNested[] | null;
};

function unwrapClaimClinic(
  value: ClaimClinicJoinRow["clinics"],
): ClaimClinicNested | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

/** Linked workplaces for a claim, primary first. Never copies clinic phones. */
export function registerClaimClinicsFromJoin(
  links: readonly ClaimClinicJoinRow[],
  cap = MAX_DOCTOR_LOCATIONS,
): RegisterClaimClinic[] {
  const sorted = [...links].sort(
    (a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)),
  );
  const out: RegisterClaimClinic[] = [];
  for (const link of sorted) {
    const clinic = unwrapClaimClinic(link.clinics);
    if (!clinic || clinic.is_archived) continue;
    const address = String(clinic.address ?? "").trim();
    if (!address) continue;
    out.push({
      clinicId: String(clinic.id ?? "").trim() || null,
      name: String(clinic.name ?? "").trim(),
      address,
      district: String(clinic.district ?? "").trim() || null,
      latitude: typeof clinic.latitude === "number" ? clinic.latitude : null,
      longitude: typeof clinic.longitude === "number" ? clinic.longitude : null,
      town: String(clinic.town ?? "").trim() || null,
      placeId: null,
    });
    if (out.length >= cap) break;
  }
  return out;
}

/** Same conservative name key as duplicate review (exact, not fuzzy). */
export function normalizeClaimPersonName(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(dr|doctor|md|prof|mr|mrs|ms)\b\.?/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeEmail(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function listingSpecialtyKeys(row: DirectoryClaimListing): Set<string> {
  const raw = [
    String(row.specialty ?? "").trim(),
    ...(Array.isArray(row.specialties) ? row.specialties : []),
  ];
  const keys = new Set<string>();
  for (const item of raw) {
    const label = harmonizeFinderSpecialtyLabel(String(item ?? "").trim());
    if (label) keys.add(label.toLowerCase());
  }
  return keys;
}

function signupSpecialtyKeys(specialties: readonly string[]): Set<string> {
  const keys = new Set<string>();
  for (const item of specialties) {
    const label = harmonizeFinderSpecialtyLabel(String(item ?? "").trim());
    if (label) keys.add(label.toLowerCase());
  }
  return keys;
}

function specialtiesOverlap(signup: readonly string[], listing: DirectoryClaimListing): boolean {
  const a = signupSpecialtyKeys(signup);
  const b = listingSpecialtyKeys(listing);
  if (a.size === 0 || b.size === 0) return false;
  for (const key of a) {
    if (b.has(key)) return true;
  }
  return false;
}

/**
 * Claim only when exactly one unregistered listing matches.
 * Email wins when unique. Name+specialty+district is the fallback, also unique-only.
 * Ambiguous or conflicting matches create a new row instead.
 */
export function pickUniqueDirectoryClaim(
  input: DirectoryClaimInput,
  listings: readonly DirectoryClaimListing[],
): FuzzyDirectoryClaimMatch | null {
  if (input.isTestSignup) return null;

  const email = normalizeEmail(input.email);
  const name = normalizeClaimPersonName(input.name);
  const district = String(input.district ?? "").trim();
  if (!name) return null;

  const emailHits = email
    ? listings.filter((row) => normalizeEmail(row.email) === email)
    : [];
  const identityHits =
    district.length === 0
      ? []
      : listings.filter((row) => {
          if (normalizeClaimPersonName(row.name) !== name) return false;
          if (String(row.district ?? "").trim() !== district) return false;
          return specialtiesOverlap(input.specialties, row);
        });

  const uniqueEmail = emailHits.length === 1 ? emailHits[0] : null;
  const uniqueIdentity = identityHits.length === 1 ? identityHits[0] : null;

  if (emailHits.length > 1 || identityHits.length > 1) return null;
  if (uniqueEmail && uniqueIdentity && uniqueEmail.id !== uniqueIdentity.id) return null;

  const hit = uniqueEmail ?? uniqueIdentity;
  if (!hit?.id) return null;

  return {
    id: String(hit.id),
    slug: String(hit.slug ?? "").trim() || null,
    reason: uniqueEmail ? "email" : "name_specialty_district",
  };
}

export function pickExplicitDirectoryClaim(
  listing: { id: string; slug?: string | null; name?: string | null } | null | undefined,
  options?: { isTestSignup?: boolean },
): DirectoryClaimMatch | null {
  if (options?.isTestSignup && !isQaClaimDirectoryListing(listing)) return null;
  const id = String(listing?.id ?? "").trim();
  if (!id) return null;
  return {
    id,
    slug: String(listing?.slug ?? "").trim() || null,
    reason: "card_link",
  };
}

function listingSpecialtyLabels(row: {
  specialty?: string | null;
  specialties?: string[] | null;
}): string[] {
  const raw = [
    String(row.specialty ?? "").trim(),
    ...(Array.isArray(row.specialties) ? row.specialties : []),
  ];
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const item of raw) {
    // Map legacy directory labels (e.g. Gynecology) onto current GeSY register options.
    const label = harmonizeFinderSpecialtyLabel(String(item ?? "").trim());
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels.slice(0, MAX_DOCTOR_SPECIALTIES);
}

/**
 * `clinics` are the listing's clinics, primary first: its district and address hint
 * come from the first one (Point E5), never from copies on `professionals`.
 */
export function toRegisterClaimPrefill(
  row: {
    id: string;
    slug?: string | null;
    name?: string | null;
    specialty?: string | null;
    specialties?: string[] | null;
    district?: string | null;
    /** Never copied: the account mobile must be entered by the professional. */
    phone?: string | null;
    gender?: string | null;
    is_gesy?: boolean | null;
  },
  clinics: RegisterClaimClinic[] = [],
): RegisterClaimPrefill {
  const name = String(row.name ?? "").trim();
  const labels = listingSpecialtyLabels(row);
  return {
    id: String(row.id),
    slug: String(row.slug ?? "").trim() || null,
    name,
    firstName: firstNameFromProfessionalName(name),
    specialty: labels[0] ?? "",
    // Listing labels are approved (harmonized onto current names). The combobox
    // shows each as a pick when it is in the catalogue it was given, else as "Other".
    specialties: labels.map((specialty) => ({ specialty, fromMaster: true })),
    district: clinics[0]?.district ?? null,
    addressHint: String(clinics[0]?.address ?? "").trim() || null,
    clinics,
    gender: claimGender(row.gender),
    gesy: row.is_gesy === true ? "yes" : null,
  };
}

export type HistoricalAbsorbPair = {
  registeredId: string;
  unregisteredId: string;
  reason: "email" | "name_specialty_district";
};

/**
 * Unique registered↔unregistered twins only. Same rules as signup claim.
 * Ambiguous or conflicting matches stay in the internal review queue.
 */
export function pickUniqueHistoricalAbsorbPairs(
  registered: readonly {
    id: string;
    name: string;
    email?: string | null;
    district: string | null;
    specialties: readonly string[];
    isTestProfile?: boolean;
  }[],
  listings: readonly DirectoryClaimListing[],
): HistoricalAbsorbPair[] {
  const byUnregistered = new Map<string, HistoricalAbsorbPair>();
  const conflictedUnregistered = new Set<string>();
  const conflictedRegistered = new Set<string>();

  for (const row of registered) {
    if (row.isTestProfile) continue;
    const match = pickUniqueDirectoryClaim(
      {
        name: row.name,
        email: row.email ?? "",
        district: row.district,
        specialties: row.specialties,
        isTestSignup: false,
      },
      listings,
    );
    if (!match) continue;

    const existing = byUnregistered.get(match.id);
    if (existing && existing.registeredId !== row.id) {
      conflictedUnregistered.add(match.id);
      conflictedRegistered.add(existing.registeredId);
      conflictedRegistered.add(row.id);
      continue;
    }

    byUnregistered.set(match.id, {
      registeredId: row.id,
      unregisteredId: match.id,
      reason: match.reason,
    });
  }

  return [...byUnregistered.values()].filter(
    (pair) =>
      !conflictedUnregistered.has(pair.unregisteredId) &&
      !conflictedRegistered.has(pair.registeredId),
  );
}

/** Listing row with its approved labels (professional_specialties) as `specialties`. */
function withListingSpecialties<T extends { specialty_links?: unknown }>(
  row: T,
): Omit<T, "specialty_links"> & { specialties: string[] } {
  const { specialty_links: links, ...rest } = row;
  return { ...rest, specialties: specialtyNamesForRow({ specialty_links: links }) };
}

/**
 * Load an unregistered listing for the card → register CTA.
 * Returns null when the id is invalid, already registered, or archived.
 */
export async function loadUnregisteredProfessionalForRegisterClaim(
  supabase: SupabaseClient,
  professionalId: string,
): Promise<RegisterClaimPrefill | null> {
  const id = String(professionalId ?? "").trim();
  if (!isProfessionalUuid(id)) return null;

  const { data, error } = await supabase
    .from("professionals")
    .select(
      `id, slug, name, gender, is_gesy, ${SPECIALTY_LINKS_SELECT}`,
    )
    .eq("id", id)
    .eq("is_registered", false)
    .eq("is_archived", false)
    .maybeSingle();

  if (error) {
    console.error("[DocCy] register claim listing lookup failed", error);
    return null;
  }
  if (!data?.id) return null;

  const { data: linkRows, error: linkError } = await supabase
    .from("professional_clinics")
    .select(
      "is_primary, clinics ( id, name, address, district, town, latitude, longitude, is_archived )",
    )
    .eq("professional_id", id)
    .limit(MAX_DOCTOR_LOCATIONS);

  if (linkError) {
    console.error("[DocCy] register claim clinics lookup failed", linkError);
  }
  return toRegisterClaimPrefill(
    withListingSpecialties(data),
    linkError ? [] : registerClaimClinicsFromJoin((linkRows ?? []) as ClaimClinicJoinRow[]),
  );
}

/**
 * The listing a registration claims: only the one the applicant chose with
 * "Claim this Profile" (no automatic matching; founders search the directory for
 * unclaimed requests). It must still be unregistered. On production, test signup
 * emails may only claim QA clones (`QA Claim …` / `qa-claim-…`); on the testing
 * database that restriction is off so manual QA can claim real listings.
 */
export async function resolveRegisterClaimListing(
  supabase: SupabaseClient,
  input: { claimId: string | null | undefined; email: string },
): Promise<DirectoryClaimMatch | null> {
  const claimId = String(input.claimId ?? "").trim();
  if (!isProfessionalUuid(claimId)) return null;
  const listing = await loadUnregisteredProfessionalForRegisterClaim(supabase, claimId);
  const isTestSignup =
    isTestDoctorRegistrationEmail(input.email) && restrictTestSignupDirectoryClaimsToQaListings();
  return pickExplicitDirectoryClaim(listing, { isTestSignup });
}

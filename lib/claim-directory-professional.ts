import type { SupabaseClient } from "@supabase/supabase-js";
import { isCurrentRegistrationSpecialty } from "@/lib/cyprus-specialties";
import { firstNameFromProfessionalName } from "@/lib/doctor-display-name";
import { MAX_DOCTOR_SPECIALTIES } from "@/lib/doctor-specialties";
import { isTestDoctorRegistrationEmail } from "@/lib/doctor-test-profile";
import { escapeIlikePattern } from "@/lib/finder-results-paging";
import { harmonizeFinderSpecialtyLabel } from "@/lib/finder-specialty-harmonize";

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

export type RegisterClaimPrefill = {
  id: string;
  slug: string | null;
  name: string;
  firstName: string | null;
  specialty: string;
  specialties: Array<{ specialty: string; fromMaster: boolean }>;
  district: string | null;
  phone: string | null;
  addressHint: string | null;
};

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
  listing: { id: string; slug?: string | null } | null | undefined,
  options?: { isTestSignup?: boolean },
): DirectoryClaimMatch | null {
  if (options?.isTestSignup) return null;
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
    const label = String(item ?? "").trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels.slice(0, MAX_DOCTOR_SPECIALTIES);
}

export function toRegisterClaimPrefill(row: {
  id: string;
  slug?: string | null;
  name?: string | null;
  specialty?: string | null;
  specialties?: string[] | null;
  district?: string | null;
  phone?: string | null;
  address?: string | null;
  clinic_address?: string | null;
}): RegisterClaimPrefill {
  const name = String(row.name ?? "").trim();
  const labels = listingSpecialtyLabels(row);
  return {
    id: String(row.id),
    slug: String(row.slug ?? "").trim() || null,
    name,
    firstName: firstNameFromProfessionalName(name),
    specialty: labels[0] ?? "",
    specialties: labels.map((specialty) => ({
      specialty,
      fromMaster: isCurrentRegistrationSpecialty(specialty),
    })),
    district: String(row.district ?? "").trim() || null,
    phone: String(row.phone ?? "").trim() || null,
    addressHint:
      String(row.address ?? "").trim() || String(row.clinic_address ?? "").trim() || null,
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

function claimSelect() {
  return "id, slug, name, specialty, specialties, district, email";
}

async function loadUnregisteredListings(
  supabase: SupabaseClient,
  builder: () => ReturnType<SupabaseClient["from"]> extends never ? never : any,
): Promise<DirectoryClaimListing[]> {
  const { data, error } = await builder();
  if (error) {
    console.error("[DocCy] directory claim lookup failed", error);
    return [];
  }
  return (data ?? []) as DirectoryClaimListing[];
}

/**
 * Find an unregistered directory row this signup should become.
 * Test emails never claim a real listing.
 */
export async function findDirectoryProfessionalToClaim(
  supabase: SupabaseClient,
  input: {
    name: string;
    email: string;
    district: string | null;
    specialties: readonly string[];
  },
): Promise<FuzzyDirectoryClaimMatch | null> {
  const email = normalizeEmail(input.email);
  if (isTestDoctorRegistrationEmail(email)) return null;

  const name = String(input.name ?? "").trim();
  const district = String(input.district ?? "").trim() || null;
  const strippedName = normalizeClaimPersonName(name);
  const listings: DirectoryClaimListing[] = [];
  const seen = new Set<string>();

  const push = (rows: DirectoryClaimListing[]) => {
    for (const row of rows) {
      const id = String(row.id ?? "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      listings.push(row);
    }
  };

  if (email) {
    push(
      await loadUnregisteredListings(supabase, () =>
        supabase
          .from("professionals")
          .select(claimSelect())
          .eq("is_registered", false)
          .eq("is_archived", false)
          .ilike("email", escapeIlikePattern(email))
          .limit(5),
      ),
    );
  }

  if (district && (name || strippedName)) {
    const nameQueries = Array.from(
      new Set([name, strippedName].map((value) => value.trim()).filter(Boolean)),
    );
    for (const queryName of nameQueries) {
      push(
        await loadUnregisteredListings(supabase, () =>
          supabase
            .from("professionals")
            .select(claimSelect())
            .eq("is_registered", false)
            .eq("is_archived", false)
            .eq("district", district)
            .ilike("name", escapeIlikePattern(queryName))
            .limit(10),
        ),
      );
    }
  }

  return pickUniqueDirectoryClaim(
    {
      name,
      email,
      district,
      specialties: input.specialties,
      isTestSignup: false,
    },
    listings,
  );
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
    .select("id, slug, name, specialty, specialties, district, phone, address, clinic_address")
    .eq("id", id)
    .eq("is_registered", false)
    .eq("is_archived", false)
    .maybeSingle();

  if (error) {
    console.error("[DocCy] register claim listing lookup failed", error);
    return null;
  }
  if (!data?.id) return null;
  return toRegisterClaimPrefill(data);
}

/**
 * Prefer the listing UUID from the card CTA. Fall back to unique email / identity match.
 * Test signup emails never claim a real listing, even with an explicit id.
 */
export async function resolveSignupDirectoryClaim(
  supabase: SupabaseClient,
  input: {
    explicitClaimId?: string | null;
    name: string;
    email: string;
    district: string | null;
    specialties: readonly string[];
  },
): Promise<DirectoryClaimMatch | null> {
  if (isTestDoctorRegistrationEmail(input.email)) return null;

  const explicitId = String(input.explicitClaimId ?? "").trim();
  if (isProfessionalUuid(explicitId)) {
    const listing = await loadUnregisteredProfessionalForRegisterClaim(supabase, explicitId);
    const explicit = pickExplicitDirectoryClaim(listing);
    if (explicit) return explicit;
  }

  return findDirectoryProfessionalToClaim(supabase, {
    name: input.name,
    email: input.email,
    district: input.district,
    specialties: input.specialties,
  });
}

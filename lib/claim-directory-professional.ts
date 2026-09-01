import type { SupabaseClient } from "@supabase/supabase-js";
import { isTestDoctorRegistrationEmail } from "@/lib/doctor-test-profile";
import { escapeIlikePattern } from "@/lib/finder-results-paging";
import { harmonizeFinderSpecialtyLabel } from "@/lib/finder-specialty-harmonize";

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

export type DirectoryClaimMatch = {
  id: string;
  slug: string | null;
  reason: "email" | "name_specialty_district";
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
): DirectoryClaimMatch | null {
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
): Promise<DirectoryClaimMatch | null> {
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

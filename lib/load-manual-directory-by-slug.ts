import type { SupabaseClient } from "@supabase/supabase-js";
import type { CyprusDistrict } from "@/lib/cyprus-districts";
import { doctorDashboardDisplayName } from "@/lib/doctor-display-name";
import { resolveFinderDisplayPhotoUrl } from "@/lib/finder-default-avatars";
import { LISTING_CLINICS_SELECT, listingClinicLocations } from "@/lib/listing-clinic-location";
import {
  buildManualDirectoryClinicRefs,
  type ManualClinicJoinLink,
} from "@/lib/manual-directory-clinics";
import { fetchAllSupabaseRows } from "@/lib/supabase-fetch-all";
import { SPECIALTY_LINKS_SELECT, specialtyNamesForRow } from "@/lib/specialty-catalogue";
import { pickUniqueLegacyNameSlugAlias } from "@/lib/manual-directory-slug";
import { USER_EVENTS_TABLE } from "@/lib/user-events";

export type ManualDirectoryLandingClinic = {
  id: string | null;
  name: string;
  slug: string;
  isPrimary: boolean;
  address?: string | null;
  addressMapsLink?: string | null;
  district?: string | null;
  hasPhone: boolean;
};

export type ManualDirectoryLandingRow = {
  id: string;
  slug: string;
  name: string;
  displayName: string;
  specialty: string;
  specialties: string[];
  district: CyprusDistrict;
  address_maps_link: string;
  address: string | null;
  photoUrl: string;
  monthlyRequestCount: number;
  isGesy: boolean;
  latitude: number | null;
  longitude: number | null;
  /** Primary clinic (card CTA); prefer clinics[0] when multi. */
  clinic: { id?: string | null; name: string; slug: string } | null;
  /** All clinics this professional practices at (interlinking). */
  clinics: ManualDirectoryLandingClinic[];
};

/**
 * Retired name-only slug -> current slug, only when it uniquely identifies one
 * active listing. Shared by `resolveCanonicalManualDirectorySlug` and the
 * combined lookup below so both stay in sync without an extra round trip.
 */
async function resolveManualDirectorySlugAlias(
  supabase: SupabaseClient,
  normalizedSlug: string,
): Promise<string | null> {
  const aliasRes: {
    data: { slug?: string | null; name?: string | null }[] | null;
    error: { code?: string; message?: string } | null;
  } = await fetchAllSupabaseRows(() =>
    supabase
      .from("professionals")
      .select("slug, name")
      .eq("is_registered", false)
      .eq("is_archived", false)
      .like("slug", `${normalizedSlug}-%`),
  );

  if (aliasRes.error || !aliasRes.data?.length) return null;
  return pickUniqueLegacyNameSlugAlias(normalizedSlug, aliasRes.data);
}

/**
 * Canonical slug for a professional landing URL.
 * Exact slugs win (duplicate-proof). A retired name-only slug redirects only
 * when it uniquely identifies one active listing.
 */
export async function resolveCanonicalManualDirectorySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<string | null> {
  const normalizedSlug = String(slug ?? "").trim().toLowerCase();
  if (!normalizedSlug) return null;
  // PostgREST LIKE treats `_` / `%` as wildcards; public slugs never include them.
  if (/[%_]/.test(normalizedSlug)) return null;

  const exact = await supabase
    .from("professionals")
    .select("slug")
    .eq("is_registered", false)
    .eq("is_archived", false)
    .eq("slug", normalizedSlug)
    .maybeSingle();

  if (!exact.error && exact.data) {
    const current = String((exact.data as { slug?: string | null }).slug ?? "").trim();
    return current || normalizedSlug;
  }

  return resolveManualDirectorySlugAlias(supabase, normalizedSlug);
}

/**
 * After a directory row is absorbed into a registered account, the old slug
 * 308s to the surviving professional.
 */
export async function resolveAbsorbedProfessionalSlugRedirect(
  supabase: SupabaseClient,
  slug: string,
): Promise<string | null> {
  const normalizedSlug = String(slug ?? "").trim().toLowerCase();
  if (!normalizedSlug) return null;
  if (/[%_]/.test(normalizedSlug)) return null;

  const redirectRes = await supabase
    .from("professional_slug_redirects")
    .select("professional_id")
    .eq("slug", normalizedSlug)
    .maybeSingle();
  if (redirectRes.error || !redirectRes.data) return null;

  const professionalId = String(
    (redirectRes.data as { professional_id?: string }).professional_id ?? "",
  ).trim();
  if (!professionalId) return null;

  const targetRes = await supabase
    .from("professionals")
    .select("slug")
    .eq("id", professionalId)
    .eq("is_archived", false)
    .maybeSingle();
  if (targetRes.error || !targetRes.data) return null;

  const target = String((targetRes.data as { slug?: string | null }).slug ?? "").trim();
  if (!target || target.toLowerCase() === normalizedSlug) return null;
  return target;
}

type ManualDirectoryRawRow = {
  id: string;
  slug: string;
  name: string;
  specialty_links?: unknown;
  /** The listing's clinics: its location (Point E5). */
  listing_clinics?: unknown;
  is_gesy?: boolean | null;
  gender?: string | null;
};

/** Fetches the raw `professionals` row for an exact (already-lowercased) slug match. */
async function fetchManualDirectoryRawRow(
  supabase: SupabaseClient,
  normalizedSlugLower: string,
): Promise<ManualDirectoryRawRow | null> {
  const res = await supabase
    .from("professionals")
    .select(`id, slug, name, is_gesy, gender, ${LISTING_CLINICS_SELECT}, ${SPECIALTY_LINKS_SELECT}`)
    .eq("is_registered", false)
    .eq("is_archived", false)
    .eq("slug", normalizedSlugLower)
    .maybeSingle();

  if (res.error || !res.data) {
    return null;
  }

  return res.data as unknown as ManualDirectoryRawRow;
}

/** Builds the public landing shape (clinics, vote count) for an already-fetched raw row. */
async function buildManualDirectoryLandingRow(
  supabase: SupabaseClient,
  row: ManualDirectoryRawRow,
  normalizedSlug: string,
): Promise<ManualDirectoryLandingRow> {
  const manualId = String(row.id);
  let monthlyRequestCount = 0;

  const { data: requestRows } = await fetchAllSupabaseRows(() =>
    supabase
      .from(USER_EVENTS_TABLE)
      .select("id, visitor_key")
      .eq("event_type", "request_online_appointment")
      .eq("professional_id", manualId),
  );

  if (requestRows?.length) {
    const voters = new Set<string>();
    for (const r of requestRows) {
      const id = String((r as { id?: string }).id ?? "");
      const vk = (r as { visitor_key?: string | null }).visitor_key?.trim();
      voters.add(vk || `legacy:${id}`);
    }
    monthlyRequestCount = voters.size;
  }

  // District, address, map link and pin are the primary clinic's (Point E5).
  const place = listingClinicLocations(row)[0] ?? null;
  const specialties = specialtyNamesForRow(row);

  const clinics: ManualDirectoryLandingClinic[] = [];

  const joinRes = await supabase
    .from("professional_clinics")
    .select(
      "clinic_id, is_primary, clinics ( id, name, slug, address, address_maps_link, district, is_archived, phone )",
    )
    .eq("professional_id", manualId);

  if (!joinRes.error && joinRes.data?.length) {
    clinics.push(
      ...buildManualDirectoryClinicRefs(joinRes.data as unknown as ManualClinicJoinLink[]),
    );
  }

  const primary = clinics.find((c) => c.isPrimary) ?? clinics[0] ?? null;

  return {
    id: manualId,
    slug: String(row.slug ?? normalizedSlug),
    name: String(row.name ?? "Professional"),
    displayName: doctorDashboardDisplayName(String(row.name ?? "Professional")),
    specialty: specialties[0] ?? "Specialty not set",
    specialties,
    district: place?.district as CyprusDistrict,
    address_maps_link: place?.addressMapsLink ?? "",
    address: place?.address ?? null,
    photoUrl: resolveFinderDisplayPhotoUrl({
      curatedOrCustomPhotoUrl: null,
      gender: row.gender,
    }),
    monthlyRequestCount,
    isGesy: Boolean(row.is_gesy ?? false),
    latitude: place?.latitude ?? null,
    longitude: place?.longitude ?? null,
    clinic: primary ? { id: primary.id, name: primary.name, slug: primary.slug } : null,
    clinics,
  };
}

export async function loadManualDirectoryBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<ManualDirectoryLandingRow | null> {
  const normalizedSlug = String(slug ?? "").trim();
  if (!normalizedSlug) return null;

  const row = await fetchManualDirectoryRawRow(supabase, normalizedSlug.toLowerCase());
  if (!row) return null;

  return buildManualDirectoryLandingRow(supabase, row, normalizedSlug);
}

export type ManualDirectoryProfileLookup = {
  row: ManualDirectoryLandingRow | null;
  /**
   * The slug this professional actually lives at, when a matching row exists
   * or a unique legacy alias resolves to one. Compare against the requested slug
   * to decide whether to 301 redirect. `null` means no professional matches
   * this slug at all.
   */
  redirectSlug: string | null;
};

/**
 * Combines `resolveCanonicalManualDirectorySlug` + `loadManualDirectoryBySlug`
 * into a single exact-match query (falling back to the alias search only on a
 * miss), instead of two near-identical round trips per profile-page request.
 */
export async function resolveManualDirectoryProfileForSlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<ManualDirectoryProfileLookup> {
  const normalizedSlug = String(slug ?? "").trim();
  if (!normalizedSlug) return { row: null, redirectSlug: null };

  const rawRow = await fetchManualDirectoryRawRow(supabase, normalizedSlug.toLowerCase());
  if (rawRow) {
    const redirectSlug = String(rawRow.slug ?? "").trim() || normalizedSlug.toLowerCase();
    const row = await buildManualDirectoryLandingRow(supabase, rawRow, normalizedSlug);
    return { row, redirectSlug };
  }

  // PostgREST LIKE treats `_` / `%` as wildcards; public slugs never include them.
  if (/[%_]/.test(normalizedSlug.toLowerCase())) return { row: null, redirectSlug: null };

  const redirectSlug = await resolveManualDirectorySlugAlias(
    supabase,
    normalizedSlug.toLowerCase(),
  );
  return { row: null, redirectSlug };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CyprusDistrict } from "@/lib/cyprus-districts";
import { doctorDashboardDisplayName } from "@/lib/doctor-display-name";
import { getFinderManualPhotoUrl } from "@/lib/finder-manual-photos";
import { resolveFinderDisplayPhotoUrl } from "@/lib/finder-default-avatars";
import { parseOptionalCoordinates } from "@/lib/finder-distance";
import {
  buildManualDirectoryClinicRefs,
  type ManualClinicJoinLink,
} from "@/lib/manual-directory-clinics";
import { fetchAllSupabaseRows } from "@/lib/supabase-fetch-all";
import { SPECIALTY_LINKS_SELECT, specialtyNamesForRow } from "@/lib/specialty-catalogue";
import { pickUniqueLegacyNameSlugAlias } from "@/lib/manual-directory-slug";

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
  /** Phone exists server-side; value is never sent to the client. */
  hasPhone: boolean;
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

function slugLookupHasMissingColumn(
  error: { message?: string; code?: string } | null,
  column: string,
): boolean {
  if (!error) return false;
  if (String(error.message ?? "").toLowerCase().includes(column)) return true;
  return error.code === "42703";
}

/**
 * Retired name-only slug -> current slug, only when it uniquely identifies one
 * visible professional. Shared by `resolveCanonicalManualDirectorySlug` and the
 * combined lookup below so both stay in sync without an extra round trip.
 */
async function resolveManualDirectorySlugAlias(
  supabase: SupabaseClient,
  normalizedSlug: string,
): Promise<string | null> {
  let aliasRes: {
    data: {
      slug?: string | null;
      name?: string | null;
      finder_visible?: boolean | null;
    }[] | null;
    error: { code?: string; message?: string } | null;
  } = await fetchAllSupabaseRows(() =>
    supabase
      .from("professionals")
      .select("slug, name, finder_visible")
      .eq("is_registered", false)
      .eq("is_archived", false)
      .like("slug", `${normalizedSlug}-%`),
  );

  if (slugLookupHasMissingColumn(aliasRes.error, "finder_visible")) {
    const fallback = await fetchAllSupabaseRows(() =>
      supabase
        .from("professionals")
        .select("slug, name")
        .eq("is_registered", false)
        .eq("is_archived", false)
        .like("slug", `${normalizedSlug}-%`),
    );
    aliasRes = {
      data: (fallback.data ?? []).map((row) => ({
        slug: (row as { slug?: string | null }).slug,
        name: (row as { name?: string | null }).name,
      })),
      error: fallback.error,
    };
  }

  if (aliasRes.error || !aliasRes.data?.length) return null;
  return pickUniqueLegacyNameSlugAlias(normalizedSlug, aliasRes.data);
}

/**
 * Canonical slug for a professional landing URL.
 * Exact slugs win (duplicate-proof). A retired name-only slug redirects only
 * when it uniquely identifies one visible professional.
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
  specialty: string;
  specialties?: string[] | null;
  district: CyprusDistrict;
  address_maps_link: string;
  phone?: string | null;
  address?: string | null;
  is_gesy?: boolean | null;
  latitude?: unknown;
  longitude?: unknown;
  clinic_id?: string | null;
  gender?: string | null;
  finder_visible?: boolean | null;
};

/**
 * Fetches the raw `professionals` row for an exact (already-lowercased) slug
 * match, tolerating column drift across environments via progressively
 * narrower `select()` fallbacks. Returns the row regardless of `finder_visible`
 * so callers can distinguish "no such slug" from "exists but hidden".
 */
async function fetchManualDirectoryRawRow(
  supabase: SupabaseClient,
  normalizedSlugLower: string,
): Promise<ManualDirectoryRawRow | null> {
  let res = await supabase
    .from("professionals")
    .select(
      `id, slug, name, specialty, specialties, district, address_maps_link, phone, address, is_gesy, latitude, longitude, clinic_id, gender, finder_visible, ${SPECIALTY_LINKS_SELECT}`,
    )
    .eq("is_registered", false)
    .eq("is_archived", false)
    .eq("slug", normalizedSlugLower)
    .maybeSingle();

  if (
    res.error &&
    (String(res.error.message ?? "").toLowerCase().includes("finder_visible") ||
      String(res.error.message ?? "").toLowerCase().includes("specialties") ||
      (res.error as { code?: string }).code === "42703")
  ) {
    res = await supabase
      .from("professionals")
      .select(
        `id, slug, name, specialty, district, address_maps_link, phone, address, is_gesy, latitude, longitude, clinic_id, gender, ${SPECIALTY_LINKS_SELECT}`,
      )
      .eq("is_registered", false)
      .eq("is_archived", false)
      .eq("slug", normalizedSlugLower)
      .maybeSingle();
  }

  if (
    res.error &&
    (String(res.error.message ?? "").toLowerCase().includes("gender") ||
      (res.error as { code?: string }).code === "42703")
  ) {
    res = await supabase
      .from("professionals")
      .select(
        `id, slug, name, specialty, district, address_maps_link, phone, address, is_gesy, latitude, longitude, clinic_id, ${SPECIALTY_LINKS_SELECT}`,
      )
      .eq("is_registered", false)
      .eq("is_archived", false)
      .eq("slug", normalizedSlugLower)
      .maybeSingle();
  }

  if (
    res.error &&
    (String(res.error.message ?? "").toLowerCase().includes("clinic_id") ||
      (res.error as { code?: string }).code === "42703")
  ) {
    res = await supabase
      .from("professionals")
      .select(
        `id, slug, name, specialty, district, address_maps_link, phone, address, is_gesy, latitude, longitude, ${SPECIALTY_LINKS_SELECT}`,
      )
      .eq("is_registered", false)
      .eq("is_archived", false)
      .eq("slug", normalizedSlugLower)
      .maybeSingle();
  }

  if (res.error || !res.data) {
    return null;
  }

  return res.data as ManualDirectoryRawRow;
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
      .from("professional_patient_booking_requests")
      .select("id, voter_key")
      .eq("professional_id", manualId),
  );

  if (requestRows?.length) {
    const voters = new Set<string>();
    for (const r of requestRows) {
      const id = String((r as { id?: string }).id ?? "");
      const vk = (r as { voter_key?: string | null }).voter_key?.trim();
      voters.add(vk || `legacy:${id}`);
    }
    monthlyRequestCount = voters.size;
  }

  const addressMapsLink = String(row.address_maps_link ?? "");
  const coords = parseOptionalCoordinates(row.latitude, row.longitude);
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

  if (clinics.length === 0) {
    const clinicId = String(row.clinic_id ?? "").trim();
    if (clinicId) {
      const clinicRes = await supabase
        .from("clinics")
        .select("id, name, slug, address, address_maps_link, district, phone")
        .eq("id", clinicId)
        .eq("is_archived", false)
        .maybeSingle();
      if (!clinicRes.error && clinicRes.data) {
        clinics.push(
          ...buildManualDirectoryClinicRefs([
            {
              clinic_id: clinicId,
              is_primary: true,
              clinics: {
                id: clinicId,
                name: (clinicRes.data as { name?: string }).name,
                slug: (clinicRes.data as { slug?: string }).slug,
                address: (clinicRes.data as { address?: string | null }).address,
                address_maps_link: (clinicRes.data as { address_maps_link?: string | null })
                  .address_maps_link,
                district: (clinicRes.data as { district?: string | null }).district,
                phone: (clinicRes.data as { phone?: string | null }).phone,
                is_archived: false,
              },
            },
          ]),
        );
      }
    }
  }

  const primary = clinics.find((c) => c.isPrimary) ?? clinics[0] ?? null;

  return {
    id: manualId,
    slug: String(row.slug ?? normalizedSlug),
    name: String(row.name ?? "Professional"),
    displayName: doctorDashboardDisplayName(String(row.name ?? "Professional")),
    specialty: specialties[0] ?? "Specialty not set",
    specialties,
    district: row.district,
    address_maps_link: addressMapsLink,
    hasPhone: Boolean(String(row.phone ?? "").trim()),
    address: String(row.address ?? "").trim() || null,
    photoUrl: resolveFinderDisplayPhotoUrl({
      curatedOrCustomPhotoUrl: getFinderManualPhotoUrl(addressMapsLink),
      gender: row.gender,
    }),
    monthlyRequestCount,
    isGesy: Boolean(row.is_gesy ?? false),
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
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
  // Inpatient-only professionals are clinic-profile only (no public profile landing).
  if (!row || row.finder_visible === false) return null;

  return buildManualDirectoryLandingRow(supabase, row, normalizedSlug);
}

export type ManualDirectoryProfileLookup = {
  row: ManualDirectoryLandingRow | null;
  /**
   * The slug this professional actually lives at, when a matching row exists
   * (visible or not) or a unique legacy alias resolves to one. Compare against
   * the requested slug to decide whether to 301 redirect. `null` means no
   * professional (visible or hidden) matches this slug at all.
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
    // Inpatient-only professionals are clinic-profile only (no public profile landing).
    const row =
      rawRow.finder_visible === false
        ? null
        : await buildManualDirectoryLandingRow(supabase, rawRow, normalizedSlug);
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

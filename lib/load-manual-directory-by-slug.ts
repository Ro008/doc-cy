import type { SupabaseClient } from "@supabase/supabase-js";
import type { CyprusDistrict } from "@/lib/cyprus-districts";
import { doctorDashboardDisplayName } from "@/lib/doctor-display-name";
import { getFinderManualPhotoUrl } from "@/lib/finder-manual-photos";
import { resolveFinderDisplayPhotoUrl } from "@/lib/finder-default-avatars";
import { finderManualVoteBadgeSinceIso } from "@/lib/finder-manual-vote-badge";
import { parseOptionalCoordinates } from "@/lib/finder-distance";
import {
  buildManualDirectoryClinicRefs,
  type ManualClinicJoinLink,
} from "@/lib/manual-directory-clinics";
import { fetchAllSupabaseRows } from "@/lib/supabase-fetch-all";
import { harmonizeFinderSpecialtyList } from "@/lib/finder-specialty-harmonize";
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
  clinic: { name: string; slug: string } | null;
  /** All clinics this professional practices at (interlinking). */
  clinics: ManualDirectoryLandingClinic[];
};

function normalizeSpecialties(row: {
  specialty?: string | null;
  specialties?: string[] | null;
}): string[] {
  const fromArray = Array.isArray(row.specialties)
    ? row.specialties.map((s) => String(s ?? "").trim()).filter(Boolean)
    : [];
  const raw =
    fromArray.length > 0
      ? fromArray
      : [String(row.specialty ?? "").trim()].filter(Boolean);
  return harmonizeFinderSpecialtyList(raw);
}

function slugLookupHasMissingColumn(
  error: { message?: string; code?: string } | null,
  column: string,
): boolean {
  if (!error) return false;
  if (String(error.message ?? "").toLowerCase().includes(column)) return true;
  return error.code === "42703";
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
    .from("directory_manual")
    .select("slug")
    .eq("is_archived", false)
    .eq("slug", normalizedSlug)
    .maybeSingle();

  if (!exact.error && exact.data) {
    const current = String((exact.data as { slug?: string | null }).slug ?? "").trim();
    return current || normalizedSlug;
  }

  let aliasRes = await fetchAllSupabaseRows(() =>
    supabase
      .from("directory_manual")
      .select("slug, name, finder_visible")
      .eq("is_archived", false)
      .like("slug", `${normalizedSlug}-%`),
  );

  if (slugLookupHasMissingColumn(aliasRes.error, "finder_visible")) {
    aliasRes = await fetchAllSupabaseRows(() =>
      supabase
        .from("directory_manual")
        .select("slug, name")
        .eq("is_archived", false)
        .like("slug", `${normalizedSlug}-%`),
    );
  }

  if (aliasRes.error || !aliasRes.data?.length) return null;
  return pickUniqueLegacyNameSlugAlias(normalizedSlug, aliasRes.data);
}

export async function loadManualDirectoryBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<ManualDirectoryLandingRow | null> {
  const normalizedSlug = String(slug ?? "").trim();
  if (!normalizedSlug) return null;

  let res = await supabase
    .from("directory_manual")
    .select(
      "id, slug, name, specialty, specialties, district, address_maps_link, phone, address, is_gesy, latitude, longitude, clinic_id, gender, finder_visible",
    )
    .eq("is_archived", false)
    .eq("slug", normalizedSlug.toLowerCase())
    .maybeSingle();

  if (
    res.error &&
    (String(res.error.message ?? "").toLowerCase().includes("finder_visible") ||
      String(res.error.message ?? "").toLowerCase().includes("specialties") ||
      (res.error as { code?: string }).code === "42703")
  ) {
    res = await supabase
      .from("directory_manual")
      .select(
        "id, slug, name, specialty, district, address_maps_link, phone, address, is_gesy, latitude, longitude, clinic_id, gender",
      )
      .eq("is_archived", false)
      .eq("slug", normalizedSlug.toLowerCase())
      .maybeSingle();
  }

  if (
    res.error &&
    (String(res.error.message ?? "").toLowerCase().includes("gender") ||
      (res.error as { code?: string }).code === "42703")
  ) {
    res = await supabase
      .from("directory_manual")
      .select(
        "id, slug, name, specialty, district, address_maps_link, phone, address, is_gesy, latitude, longitude, clinic_id",
      )
      .eq("is_archived", false)
      .eq("slug", normalizedSlug.toLowerCase())
      .maybeSingle();
  }

  if (
    res.error &&
    (String(res.error.message ?? "").toLowerCase().includes("clinic_id") ||
      (res.error as { code?: string }).code === "42703")
  ) {
    res = await supabase
      .from("directory_manual")
      .select(
        "id, slug, name, specialty, district, address_maps_link, phone, address, is_gesy, latitude, longitude",
      )
      .eq("is_archived", false)
      .eq("slug", normalizedSlug.toLowerCase())
      .maybeSingle();
  }

  if (res.error || !res.data) {
    return null;
  }

  const row = res.data as {
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

  // Inpatient-only professionals are clinic-profile only (no public /finder/professional landing).
  if (row.finder_visible === false) {
    return null;
  }

  const manualId = String(row.id);
  const monthlySinceIso = finderManualVoteBadgeSinceIso();
  let monthlyRequestCount = 0;

  const { data: monthlyRequestRows } = await fetchAllSupabaseRows(() =>
    supabase
      .from("directory_manual_patient_booking_requests")
      .select("id, voter_key")
      .eq("manual_id", manualId)
      .gte("created_at", monthlySinceIso),
  );

  if (monthlyRequestRows?.length) {
    const voters = new Set<string>();
    for (const r of monthlyRequestRows) {
      const id = String((r as { id?: string }).id ?? "");
      const vk = (r as { voter_key?: string | null }).voter_key?.trim();
      voters.add(vk || `legacy:${id}`);
    }
    monthlyRequestCount = voters.size;
  }

  const addressMapsLink = String(row.address_maps_link ?? "");
  const coords = parseOptionalCoordinates(row.latitude, row.longitude);
  const specialties = normalizeSpecialties(row);

  const clinics: ManualDirectoryLandingClinic[] = [];

  const joinRes = await supabase
    .from("directory_manual_clinics")
    .select(
      "clinic_id, is_primary, clinics ( id, name, slug, address, address_maps_link, district, is_archived, phone )",
    )
    .eq("directory_manual_id", manualId);

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
    clinic: primary ? { name: primary.name, slug: primary.slug } : null,
    clinics,
  };
}

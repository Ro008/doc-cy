import type { SupabaseClient } from "@supabase/supabase-js";
import type { CyprusDistrict } from "@/lib/cyprus-districts";
import { doctorDashboardDisplayName } from "@/lib/doctor-display-name";
import { getFinderManualPhotoUrl } from "@/lib/finder-manual-photos";
import {
  resolveClinicDisplayPhotoUrl,
  resolveFinderDisplayPhotoUrl,
} from "@/lib/finder-default-avatars";
import { parseOptionalCoordinates } from "@/lib/finder-distance";
import { publicProfessionalProfilePath } from "@/lib/manual-directory-landing-path";
import { fetchAllSupabaseRowsForIdChunks } from "@/lib/supabase-fetch-all";
import { harmonizeFinderSpecialtyList } from "@/lib/finder-specialty-harmonize";

export type ClinicLandingProfessional = {
  id: string;
  slug: string | null;
  displayName: string;
  specialty: string;
  specialties: string[];
  district: CyprusDistrict;
  photoUrl: string;
  isGesy: boolean;
  profileHref: string | null;
  /** False for inpatient-only (still listed on clinic profile). */
  finderVisible: boolean;
};

export type ClinicLandingRow = {
  id: string;
  name: string;
  slug: string;
  district: CyprusDistrict;
  address: string | null;
  phone: string | null;
  address_maps_link: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Clinic place avatar (never gender-based). */
  photoUrl: string;
  professionals: ClinicLandingProfessional[];
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

export async function loadClinicBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<ClinicLandingRow | null> {
  const normalizedSlug = String(slug ?? "").trim().toLowerCase();
  if (!normalizedSlug) return null;

  const clinicRes = await supabase
    .from("clinics")
    .select(
      "id, name, slug, district, address, phone, address_maps_link, latitude, longitude",
    )
    .eq("is_archived", false)
    .eq("slug", normalizedSlug)
    .maybeSingle();

  if (clinicRes.error || !clinicRes.data) {
    return null;
  }

  const clinic = clinicRes.data as {
    id: string;
    name: string;
    slug: string;
    district: CyprusDistrict;
    address?: string | null;
    phone?: string | null;
    address_maps_link?: string | null;
    latitude?: unknown;
    longitude?: unknown;
  };

  const coords = parseOptionalCoordinates(clinic.latitude, clinic.longitude);

  const memberIds = new Set<string>();

  const joinRes = await supabase
    .from("professional_clinics")
    .select("professional_id")
    .eq("clinic_id", clinic.id);
  if (!joinRes.error && joinRes.data?.length) {
    for (const row of joinRes.data) {
      const id = String((row as { professional_id?: string }).professional_id ?? "");
      if (id) memberIds.add(id);
    }
  }

  // Legacy single FK (still populated as primary clinic by GeSY import).
  const legacyRes = await supabase
    .from("professionals")
    .select("id")
    .eq("is_archived", false)
    .eq("clinic_id", clinic.id);
  if (!legacyRes.error && legacyRes.data?.length) {
    for (const row of legacyRes.data) {
      const id = String((row as { id?: string }).id ?? "");
      if (id) memberIds.add(id);
    }
  }

  let professionals: ClinicLandingProfessional[] = [];
  if (memberIds.size > 0) {
    const docsRes = await fetchAllSupabaseRowsForIdChunks(
      Array.from(memberIds),
      (idChunk) =>
        supabase
          .from("professionals")
          .select(
            "id, slug, name, specialty, specialties, district, address_maps_link, is_gesy, gender, finder_visible",
          )
          .eq("is_archived", false)
          .in("id", idChunk)
          .order("specialty", { ascending: true })
          .order("name", { ascending: true }),
    );

    if (!docsRes.error && docsRes.data?.length) {
      professionals = docsRes.data.map((raw) => {
        const row = raw as {
          id: string;
          slug?: string | null;
          name: string | null;
          specialty: string | null;
          specialties?: string[] | null;
          district: CyprusDistrict;
          address_maps_link?: string | null;
          is_gesy?: boolean | null;
          gender?: string | null;
          finder_visible?: boolean | null;
        };
        const specialties = normalizeSpecialties(row);
        const slugValue = String(row.slug ?? "").trim() || null;
        return {
          id: String(row.id),
          slug: slugValue,
          displayName: doctorDashboardDisplayName(String(row.name ?? "Professional")),
          specialty: specialties[0] ?? "Specialty not set",
          specialties,
          district: row.district,
          photoUrl: resolveFinderDisplayPhotoUrl({
            curatedOrCustomPhotoUrl: getFinderManualPhotoUrl(
              String(row.address_maps_link ?? ""),
            ),
            gender: row.gender,
          }),
          isGesy: Boolean(row.is_gesy ?? false),
          // Inpatient-only: listed on the clinic, but no public professional landing.
          profileHref:
            slugValue && row.finder_visible !== false
              ? publicProfessionalProfilePath(slugValue)
              : null,
          finderVisible: row.finder_visible !== false,
        };
      });
    }
  }

  return {
    id: String(clinic.id),
    name: String(clinic.name ?? "Clinic").trim() || "Clinic",
    slug: String(clinic.slug ?? normalizedSlug),
    district: clinic.district,
    address: String(clinic.address ?? "").trim() || null,
    phone: String(clinic.phone ?? "").trim() || null,
    address_maps_link: String(clinic.address_maps_link ?? "").trim() || null,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    photoUrl: resolveClinicDisplayPhotoUrl(null),
    professionals,
  };
}

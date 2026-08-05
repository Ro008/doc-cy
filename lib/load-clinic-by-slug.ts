import type { SupabaseClient } from "@supabase/supabase-js";
import type { CyprusDistrict } from "@/lib/cyprus-districts";
import { doctorDashboardDisplayName } from "@/lib/doctor-display-name";
import { getFinderManualPhotoUrl } from "@/lib/finder-manual-photos";
import {
  resolveClinicDisplayPhotoUrl,
  resolveFinderDisplayPhotoUrl,
} from "@/lib/finder-default-avatars";
import { parseOptionalCoordinates } from "@/lib/finder-distance";
import { manualDirectoryLandingPath } from "@/lib/manual-directory-landing-path";

export type ClinicLandingProfessional = {
  id: string;
  slug: string | null;
  displayName: string;
  specialty: string;
  district: CyprusDistrict;
  photoUrl: string;
  isGesy: boolean;
  profileHref: string | null;
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

  let professionals: ClinicLandingProfessional[] = [];
  const docsRes = await supabase
    .from("directory_manual")
    .select(
      "id, slug, name, specialty, district, address_maps_link, is_gesy, gender",
    )
    .eq("is_archived", false)
    .eq("clinic_id", clinic.id)
    .order("specialty", { ascending: true })
    .order("name", { ascending: true });

  if (!docsRes.error && docsRes.data?.length) {
    professionals = docsRes.data.map((raw) => {
      const row = raw as {
        id: string;
        slug?: string | null;
        name: string | null;
        specialty: string | null;
        district: CyprusDistrict;
        address_maps_link?: string | null;
        is_gesy?: boolean | null;
        gender?: string | null;
      };
      const slugValue = String(row.slug ?? "").trim() || null;
      return {
        id: String(row.id),
        slug: slugValue,
        displayName: doctorDashboardDisplayName(String(row.name ?? "Professional")),
        specialty: String(row.specialty ?? "Specialty not set"),
        district: row.district,
        photoUrl: resolveFinderDisplayPhotoUrl({
          curatedOrCustomPhotoUrl: getFinderManualPhotoUrl(
            String(row.address_maps_link ?? ""),
          ),
          gender: row.gender,
        }),
        isGesy: Boolean(row.is_gesy ?? false),
        profileHref: slugValue ? manualDirectoryLandingPath(slugValue) : null,
      };
    });
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

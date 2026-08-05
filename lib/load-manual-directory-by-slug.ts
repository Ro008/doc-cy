import type { SupabaseClient } from "@supabase/supabase-js";
import type { CyprusDistrict } from "@/lib/cyprus-districts";
import { doctorDashboardDisplayName } from "@/lib/doctor-display-name";
import { getFinderManualPhotoUrl } from "@/lib/finder-manual-photos";
import { resolveFinderDisplayPhotoUrl } from "@/lib/finder-default-avatars";
import { finderManualVoteBadgeSinceIso } from "@/lib/finder-manual-vote-badge";
import { parseOptionalCoordinates } from "@/lib/finder-distance";

export type ManualDirectoryLandingRow = {
  id: string;
  slug: string;
  name: string;
  displayName: string;
  specialty: string;
  district: CyprusDistrict;
  address_maps_link: string;
  phone: string | null;
  address: string | null;
  photoUrl: string;
  monthlyRequestCount: number;
  isGesy: boolean;
  latitude: number | null;
  longitude: number | null;
  clinic: { name: string; slug: string } | null;
};

export async function loadManualDirectoryBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<ManualDirectoryLandingRow | null> {
  const normalizedSlug = String(slug ?? "").trim();
  if (!normalizedSlug) return null;

  let res = await supabase
    .from("directory_manual")
    .select(
      "id, slug, name, specialty, district, address_maps_link, phone, address, is_gesy, latitude, longitude, clinic_id, gender",
    )
    .eq("is_archived", false)
    .eq("slug", normalizedSlug.toLowerCase())
    .maybeSingle();

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

  if (
    res.error &&
    (String(res.error.message ?? "").toLowerCase().includes("is_gesy") ||
      (res.error as { code?: string }).code === "42703")
  ) {
    res = await supabase
      .from("directory_manual")
      .select(
        "id, slug, name, specialty, district, address_maps_link, phone, address, latitude, longitude",
      )
      .eq("is_archived", false)
      .eq("slug", normalizedSlug.toLowerCase())
      .maybeSingle();
  }

  if (
    res.error &&
    (String(res.error.message ?? "").toLowerCase().includes("address") ||
      (res.error as { code?: string }).code === "42703")
  ) {
    res = await supabase
      .from("directory_manual")
      .select(
        "id, slug, name, specialty, district, address_maps_link, phone, latitude, longitude",
      )
      .eq("is_archived", false)
      .eq("slug", normalizedSlug.toLowerCase())
      .maybeSingle();
  }

  if (
    res.error &&
    (String(res.error.message ?? "").toLowerCase().includes("slug") ||
      (res.error as { code?: string }).code === "42703")
  ) {
    return null;
  }

  if (res.error || !res.data) {
    return null;
  }

  const row = res.data as {
    id: string;
    slug: string;
    name: string;
    specialty: string;
    district: CyprusDistrict;
    address_maps_link: string;
    phone?: string | null;
    address?: string | null;
    is_gesy?: boolean | null;
    latitude?: unknown;
    longitude?: unknown;
    clinic_id?: string | null;
    gender?: string | null;
  };

  const manualId = String(row.id);
  const monthlySinceIso = finderManualVoteBadgeSinceIso();
  let monthlyRequestCount = 0;

  const { data: monthlyRequestRows } = await supabase
    .from("directory_manual_patient_booking_requests")
    .select("id, voter_key")
    .eq("manual_id", manualId)
    .gte("created_at", monthlySinceIso)
    .limit(5000);

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

  let clinic: { name: string; slug: string } | null = null;
  const clinicId = String(row.clinic_id ?? "").trim();
  if (clinicId) {
    const clinicRes = await supabase
      .from("clinics")
      .select("name, slug")
      .eq("id", clinicId)
      .eq("is_archived", false)
      .maybeSingle();
    if (!clinicRes.error && clinicRes.data) {
      const name = String((clinicRes.data as { name?: string }).name ?? "").trim();
      const clinicSlug = String((clinicRes.data as { slug?: string }).slug ?? "").trim();
      if (name && clinicSlug) {
        clinic = { name, slug: clinicSlug };
      }
    }
  }

  return {
    id: manualId,
    slug: String(row.slug ?? normalizedSlug),
    name: String(row.name ?? "Professional"),
    displayName: doctorDashboardDisplayName(String(row.name ?? "Professional")),
    specialty: String(row.specialty ?? "Specialty not set"),
    district: row.district,
    address_maps_link: addressMapsLink,
    phone: String(row.phone ?? "").trim() || null,
    address: String(row.address ?? "").trim() || null,
    photoUrl: resolveFinderDisplayPhotoUrl({
      curatedOrCustomPhotoUrl: getFinderManualPhotoUrl(addressMapsLink),
      gender: row.gender,
    }),
    monthlyRequestCount,
    isGesy: Boolean(row.is_gesy ?? false),
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    clinic,
  };
}

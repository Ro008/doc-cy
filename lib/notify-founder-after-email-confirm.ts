import { createServiceRoleClient } from "@/lib/supabase-service";
import { notifyFounderNewRegistration } from "@/lib/notify-founder-new-registration";
import { professionalAccountEmail } from "@/lib/professional-account-contact";
import { stripPlusCodePrefix } from "@/lib/clinic-location-pin";

/**
 * After the professional confirms signup email, notify the founder for license review.
 * Best-effort — confirmation redirect must not depend on Resend.
 */
export async function notifyFounderAfterRegisterEmailConfirm(
  authUserId: string,
): Promise<void> {
  const userId = String(authUserId ?? "").trim();
  if (!userId) return;

  const service = createServiceRoleClient();
  if (!service) {
    console.error("[DocCy] Founder notify after email confirm skipped: no service role");
    return;
  }

  const { data, error } = await service
    .from("professionals")
    .select(
      "id, name, email, registration_email, phone, mobile_number, specialty, license_number, languages, avatar_url, district, town, clinic_address, latitude, longitude, clinic_place_id, is_specialty_approved, ghs_code, address_maps_link",
    )
    .eq("auth_user_id", userId)
    .eq("is_registered", true)
    .maybeSingle();

  if (error) {
    console.error("[DocCy] Founder notify after email confirm lookup failed", error.message);
    return;
  }
  if (!data?.id) {
    console.warn("[DocCy] Founder notify after email confirm: no professional for auth user");
    return;
  }

  const row = data as {
    id: string;
    name?: string | null;
    email?: string | null;
    registration_email?: string | null;
    phone?: string | null;
    mobile_number?: string | null;
    specialty?: string | null;
    license_number?: string | null;
    languages?: string[] | string | null;
    avatar_url?: string | null;
    district?: string | null;
    town?: string | null;
    clinic_address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    clinic_place_id?: string | null;
    is_specialty_approved?: boolean | null;
    ghs_code?: string | null;
    address_maps_link?: string | null;
  };

  const [{ data: specialtyRows }, { data: locationRows }] = await Promise.all([
    service
      .from("doctor_specialties")
      .select("specialty, license_number, is_approved")
      .eq("doctor_id", row.id),
    service
      .from("doctor_locations")
      .select(
        "district, town, clinic_address, latitude, longitude, clinic_place_id, is_primary, sort_order",
      )
      .eq("doctor_id", row.id)
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true }),
  ]);

  const languages = Array.isArray(row.languages)
    ? row.languages.map((l) => String(l).trim()).filter(Boolean)
    : row.languages
      ? [String(row.languages).trim()].filter(Boolean)
      : [];

  const specialties = (specialtyRows ?? [])
    .map((s) => ({
      specialty: String((s as { specialty?: string }).specialty ?? "").trim(),
      licenseNumber:
        String((s as { license_number?: string | null }).license_number ?? "").trim() ||
        null,
      isApproved: Boolean((s as { is_approved?: boolean | null }).is_approved),
    }))
    .filter((s) => Boolean(s.specialty));

  let locations = (locationRows ?? []).map((loc) => ({
    district: String((loc as { district?: string | null }).district ?? "").trim() || null,
    town: String((loc as { town?: string | null }).town ?? "").trim() || null,
    address:
      stripPlusCodePrefix(
        String((loc as { clinic_address?: string | null }).clinic_address ?? ""),
      ) || null,
    latitude:
      typeof (loc as { latitude?: number | null }).latitude === "number"
        ? (loc as { latitude: number }).latitude
        : null,
    longitude:
      typeof (loc as { longitude?: number | null }).longitude === "number"
        ? (loc as { longitude: number }).longitude
        : null,
    placeId:
      String((loc as { clinic_place_id?: string | null }).clinic_place_id ?? "").trim() ||
      null,
    isPrimary: Boolean((loc as { is_primary?: boolean | null }).is_primary),
  }));

  if (locations.length === 0) {
    const address = stripPlusCodePrefix(String(row.clinic_address ?? "")) || null;
    const district = String(row.district ?? "").trim() || null;
    const town = String(row.town ?? "").trim() || null;
    if (address || district || town) {
      locations = [
        {
          district,
          town,
          address,
          latitude: typeof row.latitude === "number" ? row.latitude : null,
          longitude: typeof row.longitude === "number" ? row.longitude : null,
          placeId: String(row.clinic_place_id ?? "").trim() || null,
          isPrimary: true,
        },
      ];
    }
  }

  await notifyFounderNewRegistration({
    doctorId: row.id,
    fullName: String(row.name ?? "").trim() || "Professional",
    email: professionalAccountEmail(row),
    phone:
      String(row.mobile_number ?? "").trim() || String(row.phone ?? "").trim() || "—",
    specialty: String(row.specialty ?? "").trim() || "—",
    primaryLicenseNumber: String(row.license_number ?? "").trim() || null,
    needsSpecialtyReview: row.is_specialty_approved === false,
    claimedDirectory:
      Boolean(String(row.ghs_code ?? "").trim()) ||
      Boolean(String(row.address_maps_link ?? "").trim()),
    languages,
    specialties,
    locations,
    hasAvatar: Boolean(String(row.avatar_url ?? "").trim()),
  });
}

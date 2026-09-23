import { createServiceRoleClient } from "@/lib/supabase-service";
import { notifyFounderNewRegistration } from "@/lib/notify-founder-new-registration";
import { professionalAccountEmail } from "@/lib/professional-account-contact";
import { stripPlusCodePrefix } from "@/lib/clinic-location-pin";
import { loadDoctorLocations } from "@/lib/load-doctor-locations";
import {
  classifyPendingRegistrationOrigin,
  parseDirectoryClaimSource,
} from "@/lib/pending-registration-origin";
import {
  hasPendingSpecialty,
  loadSpecialtyEntries,
  primarySpecialtyEntry,
} from "@/lib/specialty-catalogue";

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

  let { data, error } = await service
    .from("professionals")
    .select(
      "id, name, email, registration_email, phone, mobile_number, languages, avatar_url, district, town, clinic_address, latitude, longitude, clinic_place_id, directory_claim_source",
    )
    .eq("auth_user_id", userId)
    .eq("is_registered", true)
    .maybeSingle();

  if (error && /directory_claim_source/i.test(String(error.message ?? ""))) {
    const fallback = await service
      .from("professionals")
      .select(
        "id, name, email, registration_email, phone, mobile_number, languages, avatar_url, district, town, clinic_address, latitude, longitude, clinic_place_id",
      )
      .eq("auth_user_id", userId)
      .eq("is_registered", true)
      .maybeSingle();
    data = fallback.data as typeof data;
    error = fallback.error;
  }

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
    languages?: string[] | string | null;
    avatar_url?: string | null;
    district?: string | null;
    town?: string | null;
    clinic_address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    clinic_place_id?: string | null;
    directory_claim_source?: string | null;
  };

  const [specialtyEntries, locationRows] = await Promise.all([
    loadSpecialtyEntries(service, row.id),
    loadDoctorLocations(row.id),
  ]);

  const languages = Array.isArray(row.languages)
    ? row.languages.map((l) => String(l).trim()).filter(Boolean)
    : row.languages
      ? [String(row.languages).trim()].filter(Boolean)
      : [];

  const specialties = specialtyEntries.map((entry) => ({
    specialty: entry.name,
    licenseNumber: entry.licenseNumber,
    isApproved: entry.isApproved,
  }));
  const primarySpecialty = primarySpecialtyEntry(specialtyEntries);

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

  const claimSource = parseDirectoryClaimSource(row.directory_claim_source);
  const origin = classifyPendingRegistrationOrigin({ claimSource });

  await notifyFounderNewRegistration({
    doctorId: row.id,
    fullName: String(row.name ?? "").trim() || "Professional",
    email: professionalAccountEmail(row),
    phone:
      String(row.mobile_number ?? "").trim() || String(row.phone ?? "").trim() || "—",
    specialty: primarySpecialty?.name || "—",
    primaryLicenseNumber: primarySpecialty?.licenseNumber ?? null,
    needsSpecialtyReview: hasPendingSpecialty(specialtyEntries),
    claimedDirectory: origin.kind === "claimed",
    originKind: origin.kind,
    originLabel: origin.label,
    languages,
    specialties,
    locations,
    hasAvatar: Boolean(String(row.avatar_url ?? "").trim()),
  });
}

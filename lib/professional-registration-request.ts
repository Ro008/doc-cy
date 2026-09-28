import type { DoctorSpecialtyEntryValidated } from "@/lib/doctor-specialties";
import type { ResolvedRegisterClinicLocation } from "@/lib/register-clinic-location";
import { MAX_DOCTOR_LOCATIONS } from "@/lib/doctor-locations";
import { normalizeCyprusClinicPhone } from "@/lib/clinic-phone";

/**
 * `professional_registration` requests: the whole sign-up form as one request.
 * `details` (version 1) describe the professional to create, in business terms;
 * founders read them in the Requests section and approving applies them.
 * The database adds `founders_club` at submit (whether a place was reserved).
 */

export const PROFESSIONAL_REGISTRATION_REQUEST_TYPE = "professional_registration";
export const PROFESSIONAL_REGISTRATION_DETAILS_VERSION = 1;

/** Private bucket: registration photos wait here until a founder approves them. */
export const REGISTRATION_UPLOADS_BUCKET = "request-uploads";

export type RegistrationSpecialty = {
  name: string;
  /** false = an "Other" label, not in the catalogue yet. */
  from_catalogue: boolean;
  license_number: string;
};

export type RegistrationClinic = {
  /** An existing DocCy clinic the professional picked; null = a proposed new clinic. */
  clinic_id: string | null;
  /** The name given for a proposed clinic (a picked clinic keeps its own). */
  name: string | null;
  address: string;
  district: string;
  town: string | null;
  latitude: number;
  longitude: number;
  place_id: string | null;
  /**
   * A proposed clinic's phone (8 national digits), required since 2026-09-28: the
   * public Call button shows it. null for a picked DocCy clinic (it keeps its own)
   * and in requests submitted before then.
   */
  phone: string | null;
};

export type ProfessionalRegistrationDetails = {
  first_name: string;
  last_name: string;
  gender: "male" | "female";
  gesy: boolean;
  email: string;
  mobile: string;
  languages: string[];
  /** null only in approved_details: founders removed the photo. */
  photo: { bucket: typeof REGISTRATION_UPLOADS_BUCKET; path: string } | null;
  specialties: RegistrationSpecialty[];
  clinics: RegistrationClinic[];
  /** The unregistered listing the applicant claimed ("Claim this Profile"), if any. */
  claimed_professional_id: string | null;
  disclaimer_accepted: true;
  /** Set by the database at submit. */
  founders_club?: boolean;
};

export type ProfessionalRegistrationInput = {
  firstName: string;
  lastName: string;
  gender: string;
  gesy: string;
  email: string;
  mobile: string;
  languages: string[];
  photoPath: string;
  specialties: DoctorSpecialtyEntryValidated[];
  clinics: Array<ResolvedRegisterClinicLocation & { clinicId: unknown; name: unknown; phone: unknown }>;
  claimedProfessionalId: unknown;
  disclaimerAccepted: boolean;
};

export type RegistrationDetailsErrorCode =
  | "validation"
  | "gender"
  | "gesy"
  | "clinic_address"
  | "clinic_name"
  | "clinic_phone"
  | "clinic_duplicate";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidOrNull(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return UUID_PATTERN.test(text) ? text.toLowerCase() : null;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

export function buildProfessionalRegistrationDetails(
  input: ProfessionalRegistrationInput,
):
  | { ok: true; details: ProfessionalRegistrationDetails }
  | { ok: false; code: RegistrationDetailsErrorCode } {
  const firstName = text(input.firstName);
  const lastName = text(input.lastName);
  const email = text(input.email);
  const mobile = text(input.mobile);
  const photoPath = text(input.photoPath);
  const languages = input.languages.map(text).filter(Boolean);
  if (
    !firstName ||
    !lastName ||
    !email ||
    !mobile ||
    !photoPath ||
    languages.length === 0 ||
    input.specialties.length === 0 ||
    input.disclaimerAccepted !== true
  ) {
    return { ok: false, code: "validation" };
  }

  const gender = text(input.gender).toLowerCase();
  if (gender !== "male" && gender !== "female") return { ok: false, code: "gender" };

  const gesy = text(input.gesy).toLowerCase();
  if (gesy !== "yes" && gesy !== "no") return { ok: false, code: "gesy" };

  if (input.clinics.length === 0 || input.clinics.length > MAX_DOCTOR_LOCATIONS) {
    return { ok: false, code: "clinic_address" };
  }
  const clinics: RegistrationClinic[] = [];
  const pickedIds = new Set<string>();
  for (const clinic of input.clinics) {
    const clinicId = uuidOrNull(clinic.clinicId);
    const name = text(clinic.name) || null;
    if (!clinicId && !name) return { ok: false, code: "clinic_name" };
    const phone = clinicId ? null : normalizeCyprusClinicPhone(text(clinic.phone));
    if (!clinicId && !phone) return { ok: false, code: "clinic_phone" };
    if (clinicId) {
      if (pickedIds.has(clinicId)) return { ok: false, code: "clinic_duplicate" };
      pickedIds.add(clinicId);
    }
    clinics.push({
      clinic_id: clinicId,
      name: clinicId ? null : name,
      address: clinic.clinicAddress,
      district: clinic.district,
      town: clinic.town,
      latitude: clinic.latitude,
      longitude: clinic.longitude,
      place_id: clinic.clinicPlaceId,
      phone,
    });
  }

  return {
    ok: true,
    details: {
      first_name: firstName,
      last_name: lastName,
      gender,
      gesy: gesy === "yes",
      email,
      mobile,
      languages,
      photo: { bucket: REGISTRATION_UPLOADS_BUCKET, path: photoPath },
      specialties: input.specialties.map((entry) => ({
        name: entry.specialty,
        from_catalogue: entry.isApproved,
        license_number: text(entry.licenseNumber),
      })),
      clinics,
      claimed_professional_id: uuidOrNull(input.claimedProfessionalId),
      disclaimer_accepted: true,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Reads stored version-1 details back; null when the shape doesn't match. */
export function parseProfessionalRegistrationDetails(
  value: unknown,
): ProfessionalRegistrationDetails | null {
  if (!isRecord(value)) return null;
  const photo = value.photo;
  if (
    typeof value.first_name !== "string" ||
    typeof value.last_name !== "string" ||
    (value.gender !== "male" && value.gender !== "female") ||
    typeof value.gesy !== "boolean" ||
    typeof value.email !== "string" ||
    typeof value.mobile !== "string" ||
    !Array.isArray(value.languages) ||
    (photo !== null && (!isRecord(photo) || typeof photo.path !== "string")) ||
    !Array.isArray(value.specialties) ||
    !Array.isArray(value.clinics)
  ) {
    return null;
  }
  const details: ProfessionalRegistrationDetails = {
    first_name: value.first_name,
    last_name: value.last_name,
    gender: value.gender,
    gesy: value.gesy,
    email: value.email,
    mobile: value.mobile,
    languages: value.languages.map(String),
    photo: isRecord(photo) ? { bucket: REGISTRATION_UPLOADS_BUCKET, path: String(photo.path) } : null,
    specialties: value.specialties.filter(isRecord).map((s) => ({
      name: String(s.name ?? ""),
      from_catalogue: s.from_catalogue === true,
      license_number: String(s.license_number ?? ""),
    })),
    clinics: value.clinics.filter(isRecord).map((c) => ({
      clinic_id: typeof c.clinic_id === "string" ? c.clinic_id : null,
      name: typeof c.name === "string" ? c.name : null,
      address: String(c.address ?? ""),
      district: String(c.district ?? ""),
      town: typeof c.town === "string" ? c.town : null,
      latitude: Number(c.latitude),
      longitude: Number(c.longitude),
      place_id: typeof c.place_id === "string" ? c.place_id : null,
      phone: typeof c.phone === "string" && c.phone.trim() ? c.phone : null,
    })),
    claimed_professional_id:
      typeof value.claimed_professional_id === "string" ? value.claimed_professional_id : null,
    disclaimer_accepted: true,
  };
  if (typeof value.founders_club === "boolean") details.founders_club = value.founders_club;
  return details;
}

export function registrationPhotoPath(authUserId: string, random: string): string {
  return `${PROFESSIONAL_REGISTRATION_REQUEST_TYPE}/${authUserId}/photo-${random}.jpg`;
}

export function registrationRequesterName(details: Pick<ProfessionalRegistrationDetails, "first_name" | "last_name">): string {
  return `${details.first_name} ${details.last_name}`.trim();
}

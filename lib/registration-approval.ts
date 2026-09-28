import { isCyprusDistrict } from "@/lib/cyprus-districts";
import { buildDoctorSlugCandidates } from "@/lib/doctor-slug";
import { MAX_DOCTOR_LOCATIONS } from "@/lib/doctor-locations";
import {
  professionalContactUniqueViolation,
  type ProfessionalContactUse,
} from "@/lib/professional-contact";
import {
  REGISTRATION_UPLOADS_BUCKET,
  type ProfessionalRegistrationDetails,
  type RegistrationClinic,
} from "@/lib/professional-registration-request";

/**
 * Founders' review of a professional_registration request (Requests section).
 * Every field is editable (the result is stored as approved_details) except the
 * email, which is the applicant's login, and the Founders' Club place reserved at
 * submit. The photo can be removed. An unclaimed request becomes a claim when a
 * founder pastes the public URL of an unregistered listing.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PUBLIC_LOCALES = new Set(["en", "el"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

export function validateApprovedRegistrationDetails(
  original: ProfessionalRegistrationDetails,
  edited: unknown,
): { ok: true; details: ProfessionalRegistrationDetails } | { ok: false; message: string } {
  if (!isRecord(edited)) return fail("The request details are missing.");

  if (text(edited.email).toLowerCase() !== original.email.trim().toLowerCase()) {
    return fail("The email is the applicant's login and can't be changed.");
  }

  const firstName = text(edited.first_name);
  const lastName = text(edited.last_name);
  if (!firstName || !lastName) return fail("Enter the first and last name.");

  if (edited.gender !== "male" && edited.gender !== "female") return fail("Choose a gender.");
  if (typeof edited.gesy !== "boolean") return fail("Say whether they work with GeSY.");

  const mobile = text(edited.mobile);
  if (!mobile) return fail("Enter the mobile number.");

  const languages = Array.isArray(edited.languages) ? edited.languages.map(text).filter(Boolean) : [];
  if (languages.length === 0) return fail("Choose at least one language.");

  let photo: ProfessionalRegistrationDetails["photo"] = null;
  if (edited.photo !== null && edited.photo !== undefined) {
    const path = isRecord(edited.photo) ? text(edited.photo.path) : "";
    if (!path.startsWith("professional_registration/")) return fail("The photo is not a registration upload.");
    photo = { bucket: REGISTRATION_UPLOADS_BUCKET, path };
  }

  const specialtiesRaw = Array.isArray(edited.specialties) ? edited.specialties : [];
  const specialties = specialtiesRaw.filter(isRecord).map((s) => ({
    name: text(s.name),
    from_catalogue: s.from_catalogue === true,
    license_number: text(s.license_number),
  }));
  if (specialties.length === 0 || specialties.some((s) => !s.name)) {
    return fail("Every specialty needs a name, and at least one specialty is required.");
  }
  const specialtyKeys = new Set(specialties.map((s) => s.name.toLowerCase()));
  if (specialtyKeys.size !== specialties.length) return fail("The same specialty is listed twice.");

  const clinicsRaw = Array.isArray(edited.clinics) ? edited.clinics : [];
  if (clinicsRaw.length === 0 || clinicsRaw.length > MAX_DOCTOR_LOCATIONS) {
    return fail(`Keep between 1 and ${MAX_DOCTOR_LOCATIONS} clinics.`);
  }
  const clinics: RegistrationClinic[] = [];
  const clinicIds = new Set<string>();
  for (const raw of clinicsRaw) {
    if (!isRecord(raw)) return fail("A clinic is unreadable.");
    const clinicId = text(raw.clinic_id);
    if (clinicId) {
      if (!UUID_PATTERN.test(clinicId)) return fail("A clinic id is not valid.");
      if (clinicIds.has(clinicId.toLowerCase())) return fail("The same clinic twice: remove one of them.");
      clinicIds.add(clinicId.toLowerCase());
    }
    const name = text(raw.name);
    const address = text(raw.address);
    const district = text(raw.district);
    if (!clinicId) {
      if (!name) return fail("Every new clinic needs a name.");
      if (!address) return fail("Every new clinic needs an address.");
    }
    if (!isCyprusDistrict(district)) return fail(`Unknown district "${district}".`);
    const latitude = Number(raw.latitude);
    const longitude = Number(raw.longitude);
    clinics.push({
      clinic_id: clinicId ? clinicId.toLowerCase() : null,
      name: clinicId ? null : name,
      address,
      district,
      town: text(raw.town) || null,
      latitude: Number.isFinite(latitude) ? latitude : 0,
      longitude: Number.isFinite(longitude) ? longitude : 0,
      place_id: text(raw.place_id) || null,
    });
  }

  let claimedId: string | null = null;
  if (edited.claimed_professional_id !== null && edited.claimed_professional_id !== undefined && edited.claimed_professional_id !== "") {
    const id = text(edited.claimed_professional_id);
    if (!UUID_PATTERN.test(id)) return fail("The claimed listing is not valid: check the listing URL.");
    claimedId = id.toLowerCase();
  }

  const details: ProfessionalRegistrationDetails = {
    first_name: firstName,
    last_name: lastName,
    gender: edited.gender,
    gesy: edited.gesy,
    email: original.email,
    mobile,
    languages,
    photo,
    specialties,
    clinics,
    claimed_professional_id: claimedId,
    disclaimer_accepted: true,
  };
  if (typeof original.founders_club === "boolean") details.founders_club = original.founders_club;
  return { ok: true, details };
}

/**
 * The slug of a public profile URL (`/en/<slug>`, `/el/<slug>`, legacy
 * `/finder/professional/<slug>`), from a full URL or a path. Anything else: null.
 */
export function parseListingUrl(value: string): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  let pathname: string;
  try {
    if (raw.startsWith("/")) {
      pathname = new URL(raw, "https://placeholder.invalid").pathname;
    } else {
      const url = new URL(raw);
      if (url.protocol !== "https:" && url.protocol !== "http:") return null;
      pathname = url.pathname;
    }
  } catch {
    return null;
  }
  const parts = pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  let slug: string | undefined;
  if (parts.length === 2 && PUBLIC_LOCALES.has(parts[0]!.toLowerCase())) slug = parts[1];
  if (parts.length === 3 && parts[0] === "finder" && parts[1] === "professional") slug = parts[2];
  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) return null;
  return slug.toLowerCase();
}

/** Whether a claimed listing keeps its slug: it still matches the approved name. */
export function claimedListingKeepsSlug(
  listingSlug: string | null | undefined,
  input: { name: string; district: string | null },
): boolean {
  const current = String(listingSlug ?? "").trim().toLowerCase();
  if (!current) return false;
  const candidates = buildDoctorSlugCandidates({
    name: input.name,
    district: input.district,
    authUserId: "00000000-0000-0000-0000-000000000000",
  });
  return candidates.some((candidate) => candidate.toLowerCase() === current);
}

/** Where the approved photo lives in the public avatars bucket (same layout as before). */
export function approvedAvatarPath(authUserId: string, random: string): string {
  return `profiles/${authUserId}/avatar-${random}.jpg`;
}

/** A message founders can act on, from the database's refusal. */
const APPROVAL_EMAIL_IN_USE =
  "This email is already used by another professional. Deny the request, or ask the applicant to sign in to their existing profile.";
const APPROVAL_MOBILE_IN_USE =
  "This mobile number is already used by another professional. Correct it to the applicant's own mobile, or deny the request.";

/** Why a registration can't be approved with these contact details, if it can't. */
export function registrationContactConflictMessage(use: ProfessionalContactUse): string | null {
  // 'account' can't happen here: the applicant's own login is excluded, and the email is their login.
  if (use.email === "professional") return APPROVAL_EMAIL_IN_USE;
  if (use.mobile) return APPROVAL_MOBILE_IN_USE;
  return null;
}

export function approvalErrorMessage(error: {
  code?: string | null;
  message?: string | null;
  details?: string | null;
}): string {
  const message = String(error.message ?? "").trim();
  // A race the pre-check missed: the unique index is the real barrier.
  const contact = professionalContactUniqueViolation(error);
  if (contact === "email") return APPROVAL_EMAIL_IN_USE;
  if (contact === "mobile") return APPROVAL_MOBILE_IN_USE;
  switch (error.code) {
    case "55000":
    case "P0002":
    case "22023":
      return message.charAt(0).toUpperCase() + message.slice(1);
    case "42501":
      return "Only active founders can decide requests.";
    default:
      return "Could not approve this request. Try again in a moment.";
  }
}

/**
 * Column lists for `doctors` / `doctors_public` queries.
 * Keep public-facing selects free of signup and account fields (email, internal_email,
 * license_*, auth_user_id). Use `doctors_public` via service_role on the server
 * (anon/authenticated SELECT revoked — includes conditional phone, avatar_url).
 */
export const DOCTOR_FIELD_LIST_PUBLIC_PROFILE =
  "id, name, specialty, specialties, bio, clinic_address, district, slug, status, languages, is_gesy, is_specialty_approved" as const;

export const DOCTOR_FIELD_LIST_PUBLIC_PROFILE_NO_GESY =
  "id, name, specialty, specialties, bio, clinic_address, district, slug, status, languages, is_specialty_approved" as const;

export const DOCTOR_FIELD_LIST_PUBLIC_PROFILE_NO_LANG =
  "id, name, specialty, specialties, bio, clinic_address, district, slug, status, is_specialty_approved" as const;

export const DOCTOR_FIELD_LIST_PUBLIC_PROFILE_BASE =
  "id, name, specialty, specialties, bio, clinic_address, slug, status, is_specialty_approved" as const;

export const DOCTOR_FIELD_LIST_METADATA =
  "name, specialty, specialties, status, district, is_specialty_approved" as const;

/** Metadata select without `district` when the column/view is unavailable. */
export const DOCTOR_FIELD_LIST_METADATA_NO_DISTRICT =
  "name, specialty, specialties, status, is_specialty_approved" as const;

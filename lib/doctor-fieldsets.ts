/**
 * Column lists for public reads of `professionals`.
 *
 * These lists *are* the safety boundary. They used to be the column list of the
 * `doctors_public` view; that view was dropped, so public read paths now select
 * `professionals` directly and must pass one of these. Keep them free of signup and
 * account fields (email, internal_email, license_*, auth_user_id, mobile_number).
 *
 * Read via service_role on the server only, and always alongside the view's old
 * WHERE clause: `is_registered = true AND is_archived = false`. Phone is never in
 * these lists — it is resolved separately through `publicPhoneForProfessional`.
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
  "name, specialty, specialties, status, district, is_specialty_approved, avatar_url" as const;

/** Metadata select without `district` when the column/view is unavailable. */
export const DOCTOR_FIELD_LIST_METADATA_NO_DISTRICT =
  "name, specialty, specialties, status, is_specialty_approved, avatar_url" as const;

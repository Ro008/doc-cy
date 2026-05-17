/**
 * Column lists for `doctors` / `doctors_public` queries.
 * Keep public-facing selects free of signup and account fields (email, phone,
 * internal_email, license_*, auth_user_id) so PostgREST never returns them to anon clients.
 */
export const DOCTOR_FIELD_LIST_PUBLIC_PROFILE =
  "id, name, specialty, bio, clinic_address, district, slug, status, languages" as const;

export const DOCTOR_FIELD_LIST_PUBLIC_PROFILE_NO_LANG =
  "id, name, specialty, bio, clinic_address, district, slug, status" as const;

export const DOCTOR_FIELD_LIST_PUBLIC_PROFILE_BASE =
  "id, name, specialty, bio, clinic_address, slug, status" as const;

export const DOCTOR_FIELD_LIST_METADATA =
  "name, specialty, status, district" as const;

/** Metadata select without `district` when the column/view is unavailable. */
export const DOCTOR_FIELD_LIST_METADATA_NO_DISTRICT =
  "name, specialty, status" as const;

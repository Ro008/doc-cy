/**
 * Column lists for `doctors` / `doctors_public` queries.
 * Keep public-facing selects free of signup and account fields (email, phone,
 * internal_email, license_*, auth_user_id) so PostgREST never returns them to anon clients.
 */
export const DOCTOR_FIELD_LIST_PUBLIC_PROFILE =
  "id, name, specialty, bio, clinic_address, slug, status, languages" as const;

export const DOCTOR_FIELD_LIST_PUBLIC_PROFILE_NO_LANG =
  "id, name, specialty, bio, clinic_address, slug, status" as const;

export const DOCTOR_FIELD_LIST_METADATA =
  "name, specialty, status" as const;

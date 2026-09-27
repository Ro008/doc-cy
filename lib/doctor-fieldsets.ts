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
 *
 * Specialties are not columns here: readers embed `professional_specialties`
 * (see `SPECIALTY_ROWS_SELECT` in lib/specialty-catalogue). Nor is location: district and
 * address come from the professional's clinics (`primaryClinicLocationFields`), never
 * from the copies on `professionals` (Point E).
 */
export const DOCTOR_FIELD_LIST_PUBLIC_PROFILE =
  "id, name, bio, slug, status, languages, is_gesy" as const;

export const DOCTOR_FIELD_LIST_PUBLIC_PROFILE_NO_GESY =
  "id, name, bio, slug, status, languages" as const;

export const DOCTOR_FIELD_LIST_PUBLIC_PROFILE_NO_LANG =
  "id, name, bio, slug, status" as const;

export const DOCTOR_FIELD_LIST_PUBLIC_PROFILE_BASE =
  "id, name, bio, slug, status" as const;

export const DOCTOR_FIELD_LIST_METADATA =
  "id, name, status, avatar_url" as const;

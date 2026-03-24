export type DoctorRow = {
  id: string;
  name?: string | null;
  email?: string | null;
  slug?: string | null;
  phone?: string;
  specialty?: string | null;
  clinic_address?: string | null;
  /** Spoken languages for directory / filters */
  languages?: string[] | null;
  auth_user_id?: string | null;
  /** Verification: `pending` | `verified` | `rejected` (public profile + API booking only when verified). */
  status?: string | null;
  /** false when custom “Other” specialty awaits founder review */
  is_specialty_approved?: boolean | null;
  /** `founder` = first 100 locked pricing; `standard` otherwise */
  subscription_tier?: "founder" | "standard" | null;
};


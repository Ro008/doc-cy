export type DoctorRow = {
  id: string;
  name?: string | null;
  email?: string | null;
  slug?: string | null;
  phone?: string;
  specialty?: string | null;
  /** Spoken languages for directory / filters */
  languages?: string[] | null;
  auth_user_id?: string | null;
  status?: string | null;
};


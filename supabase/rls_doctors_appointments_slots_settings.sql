-- Row Level Security for core tables + safe public read paths.
-- Run in Supabase SQL Editor after reviewing. Safe to re-run (drops/recreates policies).
--
-- Model (matches app expectations):
--   doctors.auth_user_id → auth.users.id for the owning doctor.
--   appointments: only the owning doctor may SELECT/UPDATE/DELETE rows; anyone may INSERT
--     for a verified doctor (public booking). Server-side booking uses the service role.
--   doctor_settings: world-readable (availability for booking UI); only the doctor may write.
--   slots: if the table exists, world SELECT; only the doctor may write.
--
-- Public slot blocking without exposing appointment rows: RPC public_doctor_occupied_datetimes.

-- ─── Helper: doctor owned by current auth user ─────────────────────────────
CREATE OR REPLACE FUNCTION public.is_doctor_owner(p_doctor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.doctors d
    WHERE d.id = p_doctor_id
      AND d.auth_user_id IS NOT NULL
      AND d.auth_user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_doctor_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_doctor_owner(uuid) TO authenticated;

-- ─── Occupied times for booking UI (no patient PII) ─────────────────────────
CREATE OR REPLACE FUNCTION public.public_doctor_occupied_datetimes(
  p_doctor_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE (appointment_datetime timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.appointment_datetime
  FROM public.appointments a
  INNER JOIN public.doctors d ON d.id = a.doctor_id
  WHERE a.doctor_id = p_doctor_id
    AND d.status = 'verified'
    AND upper(trim(coalesce(a.status, 'REQUESTED'))) <> 'CANCELLED'
    AND a.appointment_datetime >= p_from
    AND a.appointment_datetime <= p_to;
$$;

REVOKE ALL ON FUNCTION public.public_doctor_occupied_datetimes(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_doctor_occupied_datetimes(uuid, timestamptz, timestamptz) TO anon, authenticated;

-- ═══ doctors ═══════════════════════════════════════════════════════════════
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS doctors_select_public ON public.doctors;
CREATE POLICY doctors_select_public
  ON public.doctors
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS doctors_insert_own_profile ON public.doctors;
CREATE POLICY doctors_insert_own_profile
  ON public.doctors
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS doctors_update_own_profile ON public.doctors;
CREATE POLICY doctors_update_own_profile
  ON public.doctors
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS doctors_delete_own_profile ON public.doctors;
CREATE POLICY doctors_delete_own_profile
  ON public.doctors
  FOR DELETE
  TO authenticated
  USING (auth.uid() = auth_user_id);

-- ═══ appointments ════════════════════════════════════════════════════════════
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointments_select_doctor ON public.appointments;
CREATE POLICY appointments_select_doctor
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (public.is_doctor_owner(doctor_id));

DROP POLICY IF EXISTS appointments_insert_public_booking ON public.appointments;
CREATE POLICY appointments_insert_public_booking
  ON public.appointments
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.doctors d
      WHERE d.id = doctor_id
        AND d.status = 'verified'
    )
  );

DROP POLICY IF EXISTS appointments_update_doctor ON public.appointments;
CREATE POLICY appointments_update_doctor
  ON public.appointments
  FOR UPDATE
  TO authenticated
  USING (public.is_doctor_owner(doctor_id))
  WITH CHECK (public.is_doctor_owner(doctor_id));

DROP POLICY IF EXISTS appointments_delete_doctor ON public.appointments;
CREATE POLICY appointments_delete_doctor
  ON public.appointments
  FOR DELETE
  TO authenticated
  USING (public.is_doctor_owner(doctor_id));

-- ═══ doctor_settings ═══════════════════════════════════════════════════════
ALTER TABLE public.doctor_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS doctor_settings_select_public ON public.doctor_settings;
CREATE POLICY doctor_settings_select_public
  ON public.doctor_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS doctor_settings_insert_owner ON public.doctor_settings;
CREATE POLICY doctor_settings_insert_owner
  ON public.doctor_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_doctor_owner(doctor_id));

DROP POLICY IF EXISTS doctor_settings_update_owner ON public.doctor_settings;
CREATE POLICY doctor_settings_update_owner
  ON public.doctor_settings
  FOR UPDATE
  TO authenticated
  USING (public.is_doctor_owner(doctor_id))
  WITH CHECK (public.is_doctor_owner(doctor_id));

DROP POLICY IF EXISTS doctor_settings_delete_owner ON public.doctor_settings;
CREATE POLICY doctor_settings_delete_owner
  ON public.doctor_settings
  FOR DELETE
  TO authenticated
  USING (public.is_doctor_owner(doctor_id));

-- ═══ slots (optional table) ═══════════════════════════════════════════════
DO $$
BEGIN
  IF to_regclass('public.slots') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS slots_select_public ON public.slots';
    EXECUTE $p$
      CREATE POLICY slots_select_public
        ON public.slots
        FOR SELECT
        TO anon, authenticated
        USING (true)
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS slots_insert_owner ON public.slots';
    EXECUTE $p$
      CREATE POLICY slots_insert_owner
        ON public.slots
        FOR INSERT
        TO authenticated
        WITH CHECK (public.is_doctor_owner(doctor_id))
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS slots_update_owner ON public.slots';
    EXECUTE $p$
      CREATE POLICY slots_update_owner
        ON public.slots
        FOR UPDATE
        TO authenticated
        USING (public.is_doctor_owner(doctor_id))
        WITH CHECK (public.is_doctor_owner(doctor_id))
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS slots_delete_owner ON public.slots';
    EXECUTE $p$
      CREATE POLICY slots_delete_owner
        ON public.slots
        FOR DELETE
        TO authenticated
        USING (public.is_doctor_owner(doctor_id))
    $p$;
  END IF;
END $$;

-- ═══ Optional: column-safe public view ═════════════════════════════════════
-- Query this from PostgREST instead of `doctors` when you only need directory-safe fields.
-- Excludes signup/account columns such as email, phone, internal_email, license_*, auth_user_id.
-- Run doctors_add_languages.sql + doctors_specialty_cleanup.sql first if `languages` /
-- `is_specialty_approved` are missing.
DROP VIEW IF EXISTS public.doctors_public;
CREATE VIEW public.doctors_public AS
SELECT
  d.id,
  d.name,
  d.specialty,
  d.bio,
  d.clinic_address,
  d.slug,
  d.status,
  d.languages,
  d.created_at,
  d.is_specialty_approved
FROM public.doctors d;

GRANT SELECT ON public.doctors_public TO anon, authenticated;

COMMENT ON VIEW public.doctors_public IS
  'Public directory / profile fields only. Do not add email, phone, internal_email, or license columns.';

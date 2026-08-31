-- Close leftover world-readable SELECT on public.doctors.
--
-- Early product loaded public profiles from the browser with the anon key, via
-- policy doctors_select_public (FOR SELECT TO anon, authenticated USING (true)).
-- That exposed email, phone, and license_number on PostgREST.
--
-- The app now reads registered doctors with service_role (SSR / API). Logged-in
-- doctors still use doctors_select_own (own row only). Anon must not SELECT this table.

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS doctors_select_public ON public.doctors;

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'doctors'
      AND cmd = 'SELECT'
      AND (
        'anon' = ANY (roles)
        OR 'public' = ANY (roles)
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.doctors', pol.policyname);
  END LOOP;
END
$$;

DROP POLICY IF EXISTS doctors_select_own ON public.doctors;
CREATE POLICY doctors_select_own
  ON public.doctors
  FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_user_id);

REVOKE ALL ON TABLE public.doctors FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.doctors TO authenticated;
GRANT ALL ON TABLE public.doctors TO service_role;

COMMENT ON TABLE public.doctors IS
  'Registered doctor accounts. Anon has no table privilege. Authenticated SELECT is own row only (doctors_select_own). Public pages use service_role / doctors_public.';

-- Remove leftover public.doctors. Identity lives on public.professionals.
-- doctors_public remains as a compatibility view over registered professionals.

DO $$
DECLARE
  leftover int;
BEGIN
  SELECT count(*)::int INTO leftover
  FROM public.doctors d
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.professionals p
    WHERE p.id = d.id
      AND p.is_registered = true
  );

  IF leftover > 0 THEN
    RAISE EXCEPTION
      'Cannot drop public.doctors: % registered rows are missing from professionals',
      leftover;
  END IF;
END
$$;

DROP POLICY IF EXISTS doctor_services_owner_insert ON public.doctor_services;
CREATE POLICY doctor_services_owner_insert
  ON public.doctor_services
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.professionals p
      WHERE p.id = doctor_services.doctor_id
        AND p.is_registered = true
        AND p.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS doctor_services_owner_update ON public.doctor_services;
CREATE POLICY doctor_services_owner_update
  ON public.doctor_services
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.professionals p
      WHERE p.id = doctor_services.doctor_id
        AND p.is_registered = true
        AND p.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.professionals p
      WHERE p.id = doctor_services.doctor_id
        AND p.is_registered = true
        AND p.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS doctor_services_owner_delete ON public.doctor_services;
CREATE POLICY doctor_services_owner_delete
  ON public.doctor_services
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.professionals p
      WHERE p.id = doctor_services.doctor_id
        AND p.is_registered = true
        AND p.auth_user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS doctors_sync_professionals ON public.doctors;
DROP TRIGGER IF EXISTS doctors_sync_professionals_delete ON public.doctors;
DROP TRIGGER IF EXISTS doctors_create_primary_location ON public.doctors;
DROP FUNCTION IF EXISTS public.sync_professional_from_doctor();

DROP VIEW IF EXISTS public.doctors_public;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname, c.conrelid::regclass AS tbl
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.doctors'::regclass
  LOOP
    RAISE EXCEPTION
      'Cannot drop public.doctors: leftover FK %.% still points at it',
      r.tbl,
      r.conname;
  END LOOP;
END
$$;

DROP TABLE public.doctors;

CREATE VIEW public.doctors_public
WITH (security_invoker = false)
AS
SELECT
  p.id,
  p.name,
  p.specialty,
  p.specialties,
  p.bio,
  p.clinic_address,
  p.slug,
  p.status,
  p.languages,
  p.created_at,
  p.is_specialty_approved,
  p.is_gesy,
  p.district,
  p.town,
  p.avatar_url,
  p.latitude,
  p.longitude,
  CASE
    WHEN coalesce(ds.show_phone_public, false) THEN nullif(btrim(p.phone), '')
    ELSE NULL
  END AS phone
FROM public.professionals p
LEFT JOIN public.doctor_settings ds ON ds.doctor_id = p.id
WHERE p.is_registered = true
  AND p.is_archived = false;

REVOKE SELECT ON public.doctors_public FROM anon, authenticated;
GRANT SELECT ON public.doctors_public TO service_role;

COMMENT ON VIEW public.doctors_public IS
  'Compatibility view: registered professionals only. Base table is public.professionals.';

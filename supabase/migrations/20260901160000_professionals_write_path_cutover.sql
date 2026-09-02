-- Signup/agenda write path: professionals is the identity table.
-- Retarget FKs, move register + owner checks, drop doctors → professionals sync.

ALTER TABLE public.professionals
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

DROP TRIGGER IF EXISTS doctors_sync_professionals ON public.doctors;
DROP TRIGGER IF EXISTS doctors_sync_professionals_delete ON public.doctors;

-- ---------------------------------------------------------------------------
-- FKs that pointed at doctors now point at professionals (same UUIDs).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  del_action text;
  upd_action text;
  fk_cols text;
BEGIN
  FOR r IN
    SELECT
      c.oid AS con_oid,
      c.conname,
      c.conrelid AS tbl_oid,
      c.confdeltype,
      c.confupdtype,
      c.conkey
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.doctors'::regclass
  LOOP
    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY u.ord)
    INTO fk_cols
    FROM unnest(r.conkey) WITH ORDINALITY AS u(attnum, ord)
    JOIN pg_attribute a
      ON a.attrelid = r.tbl_oid
     AND a.attnum = u.attnum;

    del_action := CASE r.confdeltype
      WHEN 'c' THEN 'ON DELETE CASCADE'
      WHEN 'n' THEN 'ON DELETE SET NULL'
      WHEN 'r' THEN 'ON DELETE RESTRICT'
      WHEN 'd' THEN 'ON DELETE SET DEFAULT'
      ELSE ''
    END;
    upd_action := CASE r.confupdtype
      WHEN 'c' THEN 'ON UPDATE CASCADE'
      WHEN 'n' THEN 'ON UPDATE SET NULL'
      WHEN 'r' THEN 'ON UPDATE RESTRICT'
      WHEN 'd' THEN 'ON UPDATE SET DEFAULT'
      ELSE ''
    END;

    EXECUTE format(
      'ALTER TABLE %s DROP CONSTRAINT %I',
      r.tbl_oid::regclass,
      r.conname
    );
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES public.professionals(id) %s %s',
      r.tbl_oid::regclass,
      r.conname,
      fk_cols,
      del_action,
      upd_action
    );
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- SQL helpers that still named public.doctors (except register + dropped sync).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  def text;
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname NOT IN (
        'register_doctor_with_founder_lock',
        'sync_professional_from_doctor'
      )
      AND pg_get_functiondef(p.oid) LIKE '%public.doctors%'
  LOOP
    def := pg_get_functiondef(r.oid);
    IF def IS NULL OR def NOT LIKE 'CREATE%FUNCTION%' THEN
      CONTINUE;
    END IF;
    def := replace(def, 'public.doctors', 'public.professionals');
    BEGIN
      EXECUTE def;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'skip rewrite %: %', r.oid, SQLERRM;
    END;
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public.is_doctor_owner(p_doctor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.professionals p
    WHERE p.id = p_doctor_id
      AND p.is_registered = true
      AND p.auth_user_id IS NOT NULL
      AND p.auth_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.register_doctor_with_founder_lock(
  p_auth_user_id uuid,
  p_name text,
  p_specialty text,
  p_email text,
  p_phone text,
  p_languages text[],
  p_license_number text,
  p_license_file_url text,
  p_slug text,
  p_is_specialty_approved boolean
)
RETURNS TABLE (doctor_id uuid, subscription_tier text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  founder_count int;
  tier text;
  new_id uuid;
  v_is_test boolean;
BEGIN
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'p_auth_user_id is required';
  END IF;

  v_is_test := public.is_test_doctor_registration_email(p_email);

  PERFORM pg_advisory_xact_lock(87201401, 3400);

  SELECT count(*)::int INTO founder_count
  FROM public.professionals
  WHERE subscription_tier = 'founder'
    AND is_registered = true
    AND coalesce(is_test_profile, false) = false;

  IF founder_count < 50 THEN
    tier := 'founder';
  ELSE
    tier := 'standard';
  END IF;

  INSERT INTO public.professionals (
    auth_user_id,
    name,
    specialty,
    specialties,
    email,
    phone,
    languages,
    license_number,
    license_file_url,
    status,
    slug,
    is_specialty_approved,
    subscription_tier,
    is_test_profile,
    is_registered,
    has_online_booking,
    finder_visible,
    is_archived
  )
  VALUES (
    p_auth_user_id,
    p_name,
    p_specialty,
    CASE
      WHEN p_specialty IS NOT NULL AND btrim(p_specialty) <> '' THEN ARRAY[btrim(p_specialty)]
      ELSE '{}'::text[]
    END,
    p_email,
    p_phone,
    p_languages,
    p_license_number,
    p_license_file_url,
    'pending',
    p_slug,
    p_is_specialty_approved,
    tier,
    v_is_test,
    true,
    true,
    true,
    false
  )
  RETURNING id INTO new_id;

  RETURN QUERY
  SELECT new_id AS doctor_id, tier AS subscription_tier;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_primary_doctor_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT coalesce(NEW.is_registered, false) THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.doctor_locations WHERE doctor_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.doctor_locations (
    doctor_id,
    is_primary,
    sort_order,
    district,
    clinic_address,
    town,
    latitude,
    longitude,
    clinic_place_id
  )
  VALUES (
    NEW.id,
    true,
    0,
    NEW.district,
    NEW.clinic_address,
    NEW.town,
    NEW.latitude,
    NEW.longitude,
    NEW.clinic_place_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS doctors_create_primary_location ON public.doctors;
DROP TRIGGER IF EXISTS professionals_create_primary_location ON public.professionals;
CREATE TRIGGER professionals_create_primary_location
  AFTER INSERT ON public.professionals
  FOR EACH ROW
  WHEN (NEW.is_registered = true)
  EXECUTE PROCEDURE public.create_primary_doctor_location();

DROP POLICY IF EXISTS appointments_insert_public_booking ON public.appointments;
CREATE POLICY appointments_insert_public_booking
  ON public.appointments
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.professionals p
      WHERE p.id = doctor_id
        AND p.is_registered = true
        AND p.status = 'verified'
    )
  );

DROP POLICY IF EXISTS doctor_specialties_select_own ON public.doctor_specialties;
CREATE POLICY doctor_specialties_select_own
  ON public.doctor_specialties
  FOR SELECT
  TO authenticated
  USING (
    doctor_id IN (
      SELECT p.id FROM public.professionals p
      WHERE p.auth_user_id = auth.uid()
        AND p.is_registered = true
    )
  );

DROP POLICY IF EXISTS doctor_specialty_change_requests_select_own
  ON public.doctor_specialty_change_requests;
CREATE POLICY doctor_specialty_change_requests_select_own
  ON public.doctor_specialty_change_requests
  FOR SELECT
  TO authenticated
  USING (
    doctor_id IN (
      SELECT p.id FROM public.professionals p
      WHERE p.auth_user_id = auth.uid()
        AND p.is_registered = true
    )
  );

DROP VIEW IF EXISTS public.doctors_public;
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
  'Server-only registered professional public profile fields, sourced from professionals.';

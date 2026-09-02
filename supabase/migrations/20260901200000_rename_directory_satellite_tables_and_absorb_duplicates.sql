-- Rename leftover directory_manual_* satellite tables/columns to professional_*.
-- Absorb unique historical twins (registered + unregistered) into the registered UUID.
-- directory_manual_public is dropped; doctors_public stays as the registered profile view.

-- ---------------------------------------------------------------------------
-- 1) Rename satellite tables and FK columns (idempotent: retry after a failed apply)
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.directory_manual_clinics
  RENAME TO professional_clinics;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'professional_clinics'
      AND column_name = 'directory_manual_id'
  ) THEN
    ALTER TABLE public.professional_clinics
      RENAME COLUMN directory_manual_id TO professional_id;
  END IF;
END
$$;

ALTER INDEX IF EXISTS directory_manual_clinics_clinic_id_idx
  RENAME TO professional_clinics_clinic_id_idx;

ALTER INDEX IF EXISTS directory_manual_clinics_primary_idx
  RENAME TO professional_clinics_primary_idx;

COMMENT ON TABLE public.professional_clinics IS
  'Professionals may practice at multiple clinics. Clinic profiles list members via this join.';

ALTER TABLE IF EXISTS public.directory_manual_patient_booking_requests
  RENAME TO professional_patient_booking_requests;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'professional_patient_booking_requests'
      AND column_name = 'manual_id'
  ) THEN
    ALTER TABLE public.professional_patient_booking_requests
      RENAME COLUMN manual_id TO professional_id;
  END IF;
END
$$;

ALTER INDEX IF EXISTS directory_manual_patient_booking_requests_manual_created_idx
  RENAME TO professional_patient_booking_requests_professional_created_idx;

ALTER INDEX IF EXISTS directory_manual_patient_booking_requests_manual_voter_created_idx
  RENAME TO professional_patient_booking_requests_professional_voter_created_idx;

COMMENT ON TABLE public.professional_patient_booking_requests IS
  'Patient votes asking an unregistered listing to offer online booking.';

ALTER TABLE IF EXISTS public.directory_manual_call_to_book_clicks
  RENAME TO professional_call_to_book_clicks;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'professional_call_to_book_clicks'
      AND column_name = 'manual_id'
  ) THEN
    ALTER TABLE public.professional_call_to_book_clicks
      RENAME COLUMN manual_id TO professional_id;
  END IF;
END
$$;

ALTER INDEX IF EXISTS directory_manual_call_to_book_clicks_manual_created_idx
  RENAME TO professional_call_to_book_clicks_professional_created_idx;

ALTER INDEX IF EXISTS directory_manual_call_to_book_clicks_created_idx
  RENAME TO professional_call_to_book_clicks_created_idx;

COMMENT ON TABLE public.professional_call_to_book_clicks IS
  'Anonymous Show-phone clicks on directory cards. Inserted only via server API (service role).';

DROP VIEW IF EXISTS public.directory_manual_public;

-- ---------------------------------------------------------------------------
-- 2) Former GeSY / directory slugs after absorb
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.professional_slug_redirects (
  slug text PRIMARY KEY,
  professional_id uuid NOT NULL REFERENCES public.professionals (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS professional_slug_redirects_professional_id_idx
  ON public.professional_slug_redirects (professional_id);

COMMENT ON TABLE public.professional_slug_redirects IS
  'Old public slugs that should 308 to a surviving professional after a directory absorb.';

ALTER TABLE public.professional_slug_redirects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.professional_slug_redirects FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.professional_slug_redirects TO service_role;

-- ---------------------------------------------------------------------------
-- 3) Name key (mirrors lib/claim-directory-professional.ts)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_professional_person_name(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT trim(both FROM regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          lower(normalize(coalesce(value, ''), NFD)),
          E'[\\u0300-\\u036f]',
          '',
          'g'
        ),
        '\y(dr|doctor|md|prof|mr|mrs|ms)\y\.?',
        '',
        'g'
      ),
      '[^a-z0-9[:space:]]',
      ' ',
      'g'
    ),
    '[[:space:]]+',
    ' ',
    'g'
  ));
$$;

-- ---------------------------------------------------------------------------
-- 4) Absorb unregistered row into the registered UUID (keep appointments / auth)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.absorb_unregistered_into_registered(
  p_registered_id uuid,
  p_unregistered_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registered public.professionals%ROWTYPE;
  v_unregistered public.professionals%ROWTYPE;
  v_old_slug text;
  v_new_slug text;
  v_ghs text;
BEGIN
  IF p_registered_id IS NULL OR p_unregistered_id IS NULL THEN
    RAISE EXCEPTION 'absorb_unregistered_into_registered requires both ids';
  END IF;
  IF p_registered_id = p_unregistered_id THEN
    RAISE EXCEPTION 'cannot absorb a professional into itself';
  END IF;

  SELECT * INTO v_registered
  FROM public.professionals
  WHERE id = p_registered_id
  FOR UPDATE;
  IF NOT FOUND OR v_registered.is_registered IS NOT TRUE THEN
    RAISE EXCEPTION 'registered professional % not found', p_registered_id;
  END IF;

  SELECT * INTO v_unregistered
  FROM public.professionals
  WHERE id = p_unregistered_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unregistered professional % not found', p_unregistered_id;
  END IF;
  IF v_unregistered.is_registered IS TRUE THEN
    RAISE EXCEPTION 'source professional % is registered; refuse absorb', p_unregistered_id;
  END IF;
  IF v_unregistered.is_archived IS TRUE THEN
    RETURN;
  END IF;

  INSERT INTO public.professional_clinics (professional_id, clinic_id, is_primary, created_at)
  SELECT p_registered_id, pc.clinic_id, pc.is_primary, pc.created_at
  FROM public.professional_clinics pc
  WHERE pc.professional_id = p_unregistered_id
  ON CONFLICT (professional_id, clinic_id) DO NOTHING;

  DELETE FROM public.professional_clinics
  WHERE professional_id = p_unregistered_id;

  UPDATE public.professional_patient_booking_requests
  SET professional_id = p_registered_id
  WHERE professional_id = p_unregistered_id;

  UPDATE public.professional_call_to_book_clicks
  SET professional_id = p_registered_id
  WHERE professional_id = p_unregistered_id;

  v_old_slug := nullif(btrim(coalesce(v_unregistered.slug, '')), '');
  v_new_slug := nullif(btrim(coalesce(v_registered.slug, '')), '');
  IF v_old_slug IS NOT NULL AND lower(v_old_slug) IS DISTINCT FROM lower(coalesce(v_new_slug, '')) THEN
    INSERT INTO public.professional_slug_redirects (slug, professional_id)
    VALUES (lower(v_old_slug), p_registered_id)
    ON CONFLICT (slug) DO UPDATE
      SET professional_id = EXCLUDED.professional_id;
  END IF;

  -- Archive first so ghs_code / slug unique indexes (active rows only) are free.
  UPDATE public.professionals
  SET is_archived = true, updated_at = now()
  WHERE id = p_unregistered_id;

  v_ghs := nullif(btrim(coalesce(v_registered.ghs_code, '')), '');
  IF v_ghs IS NULL THEN
    v_ghs := nullif(btrim(coalesce(v_unregistered.ghs_code, '')), '');
    IF v_ghs IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.professionals p
      WHERE p.id <> p_registered_id
        AND p.is_archived = false
        AND p.ghs_code = v_ghs
    ) THEN
      v_ghs := v_registered.ghs_code;
    END IF;
  ELSE
    v_ghs := v_registered.ghs_code;
  END IF;

  UPDATE public.professionals
  SET
    ghs_code = v_ghs,
    clinic_id = coalesce(v_registered.clinic_id, v_unregistered.clinic_id),
    is_gesy = coalesce(v_registered.is_gesy, false) OR coalesce(v_unregistered.is_gesy, false),
    address_maps_link = CASE
      WHEN nullif(btrim(coalesce(v_registered.address_maps_link, '')), '') IS NOT NULL
        THEN v_registered.address_maps_link
      ELSE v_unregistered.address_maps_link
    END,
    address = CASE
      WHEN nullif(btrim(coalesce(v_registered.address, '')), '') IS NOT NULL
        THEN v_registered.address
      ELSE v_unregistered.address
    END,
    town = CASE
      WHEN nullif(btrim(coalesce(v_registered.town, '')), '') IS NOT NULL
        THEN v_registered.town
      ELSE v_unregistered.town
    END,
    latitude = coalesce(v_registered.latitude, v_unregistered.latitude),
    longitude = coalesce(v_registered.longitude, v_unregistered.longitude),
    specialties = (
      SELECT coalesce(array_agg(DISTINCT btrim(x)), '{}'::text[])
      FROM unnest(
        coalesce(v_registered.specialties, '{}'::text[])
        || coalesce(v_unregistered.specialties, '{}'::text[])
        || CASE
             WHEN nullif(btrim(coalesce(v_registered.specialty, '')), '') IS NOT NULL
               THEN ARRAY[btrim(v_registered.specialty)]
             ELSE '{}'::text[]
           END
        || CASE
             WHEN nullif(btrim(coalesce(v_unregistered.specialty, '')), '') IS NOT NULL
               THEN ARRAY[btrim(v_unregistered.specialty)]
             ELSE '{}'::text[]
           END
      ) AS x
      WHERE btrim(x) <> ''
    ),
    updated_at = now()
  WHERE id = p_registered_id;
END;
$$;

REVOKE ALL ON FUNCTION public.absorb_unregistered_into_registered(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.absorb_unregistered_into_registered(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.absorb_unregistered_into_registered(uuid, uuid) IS
  'Move clinic links, votes, and clicks onto the registered professional, then archive the unregistered twin.';

-- ---------------------------------------------------------------------------
-- 5) One-time unique pairs only (email XOR name+specialty+district). Skip tests.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  rec record;
  absorbed int := 0;
BEGIN
  FOR rec IN
    WITH registered AS (
      SELECT
        p.id,
        lower(trim(p.email)) AS email_key,
        public.normalize_professional_person_name(p.name) AS name_key,
        nullif(btrim(p.district::text), '') AS district,
        p.specialty,
        p.specialties
      FROM public.professionals p
      WHERE p.is_registered = true
        AND p.is_archived = false
        AND coalesce(p.is_test_profile, false) = false
        AND public.is_test_doctor_registration_email(p.email) IS NOT TRUE
    ),
    unreg AS (
      SELECT
        p.id,
        lower(trim(p.email)) AS email_key,
        public.normalize_professional_person_name(p.name) AS name_key,
        nullif(btrim(p.district::text), '') AS district,
        p.specialty,
        p.specialties
      FROM public.professionals p
      WHERE p.is_registered = false
        AND p.is_archived = false
        AND coalesce(p.is_test_profile, false) = false
    ),
    email_hits AS (
      SELECT r.id AS registered_id, u.id AS unregistered_id
      FROM registered r
      JOIN unreg u
        ON r.email_key IS NOT NULL
       AND r.email_key <> ''
       AND r.email_key = u.email_key
    ),
    email_ok AS (
      SELECT e.registered_id, e.unregistered_id
      FROM email_hits e
      WHERE NOT EXISTS (
        SELECT 1 FROM email_hits o
        WHERE o.registered_id = e.registered_id
          AND o.unregistered_id <> e.unregistered_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM email_hits o
        WHERE o.unregistered_id = e.unregistered_id
          AND o.registered_id <> e.registered_id
      )
    ),
    identity_hits AS (
      SELECT r.id AS registered_id, u.id AS unregistered_id
      FROM registered r
      JOIN unreg u
        ON r.name_key <> ''
       AND r.name_key = u.name_key
       AND r.district IS NOT NULL
       AND r.district = u.district
       AND (
         (
           nullif(btrim(coalesce(r.specialty, '')), '') IS NOT NULL
           AND lower(btrim(r.specialty)) = lower(btrim(coalesce(u.specialty, '')))
         )
         OR (
           nullif(btrim(coalesce(r.specialty, '')), '') IS NOT NULL
           AND EXISTS (
             SELECT 1
             FROM unnest(coalesce(u.specialties, '{}'::text[])) s
             WHERE lower(btrim(s)) = lower(btrim(r.specialty))
           )
         )
         OR (
           nullif(btrim(coalesce(u.specialty, '')), '') IS NOT NULL
           AND EXISTS (
             SELECT 1
             FROM unnest(coalesce(r.specialties, '{}'::text[])) s
             WHERE lower(btrim(s)) = lower(btrim(u.specialty))
           )
         )
       )
    ),
    identity_ok AS (
      SELECT e.registered_id, e.unregistered_id
      FROM identity_hits e
      WHERE NOT EXISTS (
        SELECT 1 FROM identity_hits o
        WHERE o.registered_id = e.registered_id
          AND o.unregistered_id <> e.unregistered_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM identity_hits o
        WHERE o.unregistered_id = e.unregistered_id
          AND o.registered_id <> e.registered_id
      )
    ),
    combined AS (
      SELECT registered_id, unregistered_id FROM email_ok
      UNION
      SELECT registered_id, unregistered_id FROM identity_ok
    ),
    conflicted_registered AS (
      SELECT registered_id
      FROM combined
      GROUP BY registered_id
      HAVING count(DISTINCT unregistered_id) > 1
    ),
    conflicted_unregistered AS (
      SELECT unregistered_id
      FROM combined
      GROUP BY unregistered_id
      HAVING count(DISTINCT registered_id) > 1
    )
    SELECT c.registered_id, c.unregistered_id
    FROM combined c
    WHERE NOT EXISTS (
      SELECT 1 FROM conflicted_registered x WHERE x.registered_id = c.registered_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM conflicted_unregistered x WHERE x.unregistered_id = c.unregistered_id
    )
  LOOP
    PERFORM public.absorb_unregistered_into_registered(rec.registered_id, rec.unregistered_id);

    UPDATE public.directory_duplicate_suggestions
    SET status = 'merged', resolved_at = now(), updated_at = now()
    WHERE manual_id = rec.unregistered_id
      AND doctor_id = rec.registered_id
      AND status = 'pending';

    UPDATE public.directory_duplicate_suggestions
    SET status = 'dismissed', resolved_at = now(), updated_at = now()
    WHERE manual_id = rec.unregistered_id
      AND status = 'pending';

    absorbed := absorbed + 1;
  END LOOP;

  RAISE NOTICE 'Absorbed % unique historical directory duplicates', absorbed;
END
$$;

-- Remove leftover public.directory_manual. Identity lives on public.professionals.
-- directory_manual_public remains as a compatibility view over unregistered rows.
-- Join/vote/click tables keep their column names; FKs now point at professionals.

DO $$
DECLARE
  leftover int;
BEGIN
  SELECT count(*)::int INTO leftover
  FROM public.directory_manual d
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.professionals p
    WHERE p.id = d.id
  );

  IF leftover > 0 THEN
    RAISE EXCEPTION
      'Cannot drop public.directory_manual: % rows are missing from professionals',
      leftover;
  END IF;
END
$$;

DROP TRIGGER IF EXISTS directory_manual_sync_professionals ON public.directory_manual;
DROP TRIGGER IF EXISTS directory_manual_sync_professionals_delete ON public.directory_manual;
DROP FUNCTION IF EXISTS public.sync_professional_from_directory_manual();

DROP VIEW IF EXISTS public.directory_manual_public;

-- ---------------------------------------------------------------------------
-- FKs that pointed at directory_manual now point at professionals (same UUIDs).
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
      AND c.confrelid = 'public.directory_manual'::regclass
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

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname, c.conrelid::regclass AS tbl
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.directory_manual'::regclass
  LOOP
    RAISE EXCEPTION
      'Cannot drop public.directory_manual: leftover FK %.% still points at it',
      r.tbl,
      r.conname;
  END LOOP;
END
$$;

DROP TABLE public.directory_manual;

CREATE VIEW public.directory_manual_public
WITH (security_invoker = false)
AS
SELECT
  p.id,
  p.name,
  p.specialty,
  p.specialties,
  p.district,
  p.town,
  p.address_maps_link,
  p.phone,
  p.address,
  p.is_gesy,
  p.latitude,
  p.longitude,
  p.slug,
  p.clinic_id,
  p.finder_visible,
  p.is_archived,
  p.created_at,
  p.updated_at
FROM public.professionals p
WHERE p.is_registered = false
  AND p.is_archived = false;

REVOKE SELECT ON public.directory_manual_public FROM anon, authenticated;
GRANT SELECT ON public.directory_manual_public TO service_role;

COMMENT ON VIEW public.directory_manual_public IS
  'Compatibility view: unregistered professionals only. Base table is public.professionals.';

COMMENT ON TABLE public.professionals IS
  'Unified health-professional identity (registered accounts + directory listings).';

-- Clinics entity + optional link from manual directory professionals.
-- Finder continues to list professionals only; clinics are for enrichment / clinic profiles.

CREATE TABLE IF NOT EXISTS public.clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  district public.cyprus_district NOT NULL,
  address text,
  phone text,
  address_maps_link text,
  latitude double precision,
  longitude double precision,
  ghs_code text,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinics_slug_unique UNIQUE (slug)
);

COMMENT ON TABLE public.clinics IS
  'Healthcare facilities (clinics/hospitals). Linked from directory_manual via clinic_id. Not searchable in Finder (v1).';

CREATE INDEX IF NOT EXISTS clinics_district_idx
  ON public.clinics (district)
  WHERE is_archived = false;

ALTER TABLE public.directory_manual
  ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS directory_manual_clinic_id_idx
  ON public.directory_manual (clinic_id)
  WHERE clinic_id IS NOT NULL AND is_archived = false;

COMMENT ON COLUMN public.directory_manual.clinic_id IS
  'Optional clinic this professional practices at. Used to enrich finder cards and clinic profiles.';

-- Public clinic view (safe columns only; no internal ops fields beyond ghs_code kept off public)
DROP VIEW IF EXISTS public.clinics_public;

CREATE VIEW public.clinics_public
WITH (security_invoker = false)
AS
SELECT
  id,
  name,
  slug,
  district,
  address,
  phone,
  address_maps_link,
  latitude,
  longitude,
  is_archived,
  created_at,
  updated_at
FROM public.clinics
WHERE is_archived = false;

GRANT SELECT ON public.clinics_public TO anon, authenticated;

COMMENT ON VIEW public.clinics_public IS
  'Public clinic profile fields. Excludes ghs_code. Finder does not search clinics (v1).';

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT/UPDATE/DELETE for anon/authenticated on base table.
-- Server routes and migrations use service_role (bypasses RLS).

-- Recreate directory_manual_public to expose clinic_id for card enrichment
DROP VIEW IF EXISTS public.directory_manual_public;

CREATE VIEW public.directory_manual_public
WITH (security_invoker = false)
AS
SELECT
  id,
  name,
  specialty,
  district,
  address_maps_link,
  phone,
  address,
  is_gesy,
  latitude,
  longitude,
  slug,
  clinic_id,
  is_archived,
  created_at,
  updated_at
FROM public.directory_manual
WHERE is_archived = false;

GRANT SELECT ON public.directory_manual_public TO anon, authenticated;

COMMENT ON VIEW public.directory_manual_public IS
  'Public manual finder fields only. Excludes ghs_code, email, gender. Includes clinic_id for enrichment.';

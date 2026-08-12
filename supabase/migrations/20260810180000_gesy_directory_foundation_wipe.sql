-- GeSY manual directory foundation:
-- 1) Wipe existing manual directory + clinics (full replace ahead of GeSY batches).
-- 2) Add multi-specialty (text[]), finder visibility, segment, and professional↔clinic join.
-- 3) Re-seed anti-scrape canaries (must survive the wipe).
--
-- Does NOT touch public.doctors / registration / is_gesy on registered doctors.

-- ---------------------------------------------------------------------------
-- Wipe (cascades: directory_manual_patient_booking_requests, directory_duplicate_suggestions)
-- ---------------------------------------------------------------------------
DELETE FROM public.directory_manual;
DELETE FROM public.clinics;

-- ---------------------------------------------------------------------------
-- directory_manual: GeSY-oriented columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.directory_manual
  ADD COLUMN IF NOT EXISTS specialties text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.directory_manual
  ADD COLUMN IF NOT EXISTS finder_visible boolean NOT NULL DEFAULT true;

ALTER TABLE public.directory_manual
  ADD COLUMN IF NOT EXISTS segment text;

COMMENT ON COLUMN public.directory_manual.specialty IS
  'Primary specialty label (first of specialties[]). Kept for display + legacy filters.';

COMMENT ON COLUMN public.directory_manual.specialties IS
  'All GeSY specialties for this professional (split from Excel "a; b"). Used for finder filters.';

COMMENT ON COLUMN public.directory_manual.finder_visible IS
  'When false, hide from /finder (e.g. inpatient-only). Still visible on linked clinic profiles.';

COMMENT ON COLUMN public.directory_manual.segment IS
  'GeSY provider segment label from import (ops). Not a public filter in v1.';

COMMENT ON COLUMN public.directory_manual.is_gesy IS
  'Manual GeSY listings are true after GeSY import. Registered doctors keep their own doctors.is_gesy toggle.';

COMMENT ON COLUMN public.directory_manual.clinic_id IS
  'Primary clinic for card enrichment. Full membership is directory_manual_clinics.';

CREATE INDEX IF NOT EXISTS directory_manual_specialties_gin_idx
  ON public.directory_manual USING gin (specialties);

CREATE INDEX IF NOT EXISTS directory_manual_finder_visible_idx
  ON public.directory_manual (finder_visible)
  WHERE is_archived = false AND finder_visible = true;

CREATE UNIQUE INDEX IF NOT EXISTS directory_manual_ghs_code_active_uidx
  ON public.directory_manual (ghs_code)
  WHERE ghs_code IS NOT NULL AND is_archived = false;

CREATE UNIQUE INDEX IF NOT EXISTS clinics_ghs_code_active_uidx
  ON public.clinics (ghs_code)
  WHERE ghs_code IS NOT NULL AND is_archived = false;

-- ---------------------------------------------------------------------------
-- Many-to-many: professional <-> clinics
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.directory_manual_clinics (
  directory_manual_id uuid NOT NULL REFERENCES public.directory_manual (id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics (id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (directory_manual_id, clinic_id)
);

CREATE INDEX IF NOT EXISTS directory_manual_clinics_clinic_id_idx
  ON public.directory_manual_clinics (clinic_id);

CREATE INDEX IF NOT EXISTS directory_manual_clinics_primary_idx
  ON public.directory_manual_clinics (directory_manual_id)
  WHERE is_primary = true;

COMMENT ON TABLE public.directory_manual_clinics IS
  'Professionals may practice at multiple clinics. Clinic profiles list members via this join.';

ALTER TABLE public.directory_manual_clinics ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies: service_role only (same pattern as directory_manual base table).

-- ---------------------------------------------------------------------------
-- Public view: expose specialties + finder_visible; keep ghs/email/gender private
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.directory_manual_public;

CREATE VIEW public.directory_manual_public
WITH (security_invoker = false)
AS
SELECT
  id,
  name,
  specialty,
  specialties,
  district,
  address_maps_link,
  phone,
  address,
  is_gesy,
  latitude,
  longitude,
  slug,
  clinic_id,
  finder_visible,
  is_archived,
  created_at,
  updated_at
FROM public.directory_manual
WHERE is_archived = false;

REVOKE SELECT ON public.directory_manual_public FROM anon, authenticated;
GRANT SELECT ON public.directory_manual_public TO service_role;

COMMENT ON VIEW public.directory_manual_public IS
  'Server-only manual finder fields (service_role). Excludes ghs_code, email, gender, segment. Includes specialties + finder_visible.';

-- ---------------------------------------------------------------------------
-- Re-seed anti-scrape canaries (GeSY-aligned specialty labels where a bridge exists)
-- ---------------------------------------------------------------------------
INSERT INTO public.directory_manual (
  id,
  name,
  specialty,
  specialties,
  district,
  address_maps_link,
  phone,
  latitude,
  longitude,
  slug,
  address,
  is_archived,
  is_gesy,
  finder_visible
)
VALUES
  (
    'c0418010-d0cc-4a01-8001-cafebabe0001'::uuid,
    'Melina Orphanidou',
    'Clinical Dietitian',
    ARRAY['Clinical Dietitian']::text[],
    'Famagusta'::public.cyprus_district,
    'https://maps.google.com/?cid=9048173620148202601&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA',
    '+35799041801',
    35.12641::double precision,
    33.94371::double precision,
    'melina-orphanidou-famagusta',
    'Famagusta, Cyprus',
    false,
    false,
    true
  ),
  (
    'c0418020-d0cc-4a01-8002-cafebabe0002'::uuid,
    'Stavros Pelides',
    'Otorhinolaryngology',
    ARRAY['Otorhinolaryngology']::text[],
    'Famagusta'::public.cyprus_district,
    'https://maps.google.com/?cid=9048173620148202602&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA',
    '+35799041802',
    35.12711::double precision,
    33.94421::double precision,
    'stavros-pelides-famagusta',
    'Famagusta, Cyprus',
    false,
    false,
    true
  ),
  (
    'c0418030-d0cc-4a01-8003-cafebabe0003'::uuid,
    'Ioanna Meletiou',
    'Rheumatology',
    ARRAY['Rheumatology']::text[],
    'Larnaca'::public.cyprus_district,
    'https://maps.google.com/?cid=9048173620148202603&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA',
    '+35799041803',
    34.92211::double precision,
    33.62341::double precision,
    'ioanna-meletiou-larnaca',
    'Larnaca, Cyprus',
    false,
    false,
    true
  ),
  (
    'c0418040-d0cc-4a01-8004-cafebabe0004'::uuid,
    'Kyriakos Demetriades',
    'Respiratory Medicine',
    ARRAY['Respiratory Medicine']::text[],
    'Famagusta'::public.cyprus_district,
    'https://maps.google.com/?cid=9048173620148202604&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA',
    '+35799041804',
    35.12801::double precision,
    33.94501::double precision,
    'kyriakos-demetriades-famagusta',
    'Famagusta, Cyprus',
    false,
    false,
    true
  ),
  (
    'c0418050-d0cc-4a01-8005-cafebabe0005'::uuid,
    'Marilena Sofocleous',
    'Renal Diseases',
    ARRAY['Renal Diseases']::text[],
    'Larnaca'::public.cyprus_district,
    'https://maps.google.com/?cid=9048173620148202605&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA',
    '+35799041805',
    34.92301::double precision,
    33.62411::double precision,
    'marilena-sofocleous-larnaca',
    'Larnaca, Cyprus',
    false,
    false,
    true
  ),
  (
    'c0418060-d0cc-4a01-8006-cafebabe0006'::uuid,
    'Petros Athanasiades',
    'Gastroenterology',
    ARRAY['Gastroenterology']::text[],
    'Famagusta'::public.cyprus_district,
    'https://maps.google.com/?cid=9048173620148202606&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA',
    '+35799041806',
    35.12881::double precision,
    33.94581::double precision,
    'petros-athanasiades-famagusta',
    'Famagusta, Cyprus',
    false,
    false,
    true
  );

-- Health Finder foundation:
-- 1) Canonical district support on registered professionals
-- 2) Manual directory table (SEO/manual curation)
-- 3) Duplicate suggestion queue for founder review workflow

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'cyprus_district'
  ) THEN
    CREATE TYPE public.cyprus_district AS ENUM (
      'Nicosia',
      'Limassol',
      'Paphos',
      'Larnaca',
      'Famagusta'
    );
  END IF;
END $$;

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS district public.cyprus_district;

CREATE INDEX IF NOT EXISTS doctors_status_district_specialty_idx
  ON public.doctors (status, district, specialty);

CREATE TABLE IF NOT EXISTS public.directory_manual (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  specialty text NOT NULL,
  district public.cyprus_district NOT NULL,
  address_maps_link text NOT NULL,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS directory_manual_district_specialty_idx
  ON public.directory_manual (district, specialty)
  WHERE is_archived = false;


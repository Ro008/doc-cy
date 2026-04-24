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

CREATE TABLE IF NOT EXISTS public.directory_duplicate_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manual_id uuid NOT NULL REFERENCES public.directory_manual(id) ON DELETE CASCADE,
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  score numeric(5,4) NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'dismissed', 'merged')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS directory_duplicate_unique_pair_idx
  ON public.directory_duplicate_suggestions (manual_id, doctor_id);

CREATE INDEX IF NOT EXISTS directory_duplicate_status_created_idx
  ON public.directory_duplicate_suggestions (status, created_at DESC);

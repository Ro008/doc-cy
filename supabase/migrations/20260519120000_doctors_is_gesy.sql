-- GESY provider flag for registered professionals (directory + public profile badge).
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS is_gesy boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.doctors.is_gesy IS
  'When true, show a GESY provider badge on finder cards and public profile.';

-- Expose on doctors_public for anon profile reads (no PII).
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
  d.is_specialty_approved,
  d.is_gesy
FROM public.doctors d;

GRANT SELECT ON public.doctors_public TO anon, authenticated;

COMMENT ON VIEW public.doctors_public IS
  'Public directory / profile fields only. Do not add email, phone, internal_email, or license columns.';

-- One Call button on the public profile: choose mobile vs directory phone.
-- mobile_number stays off the public views except as the opted-in Call number.

ALTER TABLE public.doctor_settings
  ADD COLUMN IF NOT EXISTS public_phone_source text NOT NULL DEFAULT 'directory';

UPDATE public.doctor_settings
SET public_phone_source = 'directory'
WHERE public_phone_source IS NULL
   OR btrim(public_phone_source) = '';

ALTER TABLE public.doctor_settings
  DROP CONSTRAINT IF EXISTS doctor_settings_public_phone_source_check;

ALTER TABLE public.doctor_settings
  ADD CONSTRAINT doctor_settings_public_phone_source_check
  CHECK (public_phone_source IN ('mobile', 'directory'));

COMMENT ON COLUMN public.doctor_settings.public_phone_source IS
  'Which professionals phone is used for the public Call button when show_phone_public is true.';

CREATE OR REPLACE VIEW public.doctors_public
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
    WHEN coalesce(ds.show_phone_public, false) THEN
      CASE
        WHEN coalesce(ds.public_phone_source, 'directory') = 'mobile'
          THEN nullif(btrim(p.mobile_number), '')
        ELSE nullif(btrim(p.phone), '')
      END
    ELSE NULL
  END AS phone
FROM public.professionals p
LEFT JOIN public.doctor_settings ds ON ds.doctor_id = p.id
WHERE p.is_registered = true
  AND p.is_archived = false;

REVOKE SELECT ON public.doctors_public FROM anon, authenticated;
GRANT SELECT ON public.doctors_public TO service_role;

COMMENT ON VIEW public.doctors_public IS
  'Compatibility view: registered professionals only. Phone only when show_phone_public, from mobile_number or directory phone.';

CREATE OR REPLACE VIEW public.professionals_public
WITH (security_invoker = false)
AS
SELECT
  p.id,
  p.name,
  p.specialty,
  p.specialties,
  p.bio,
  p.clinic_address,
  p.address,
  p.address_maps_link,
  p.slug,
  p.status,
  p.languages,
  p.created_at,
  p.updated_at,
  p.is_specialty_approved,
  p.is_gesy,
  p.district,
  p.town,
  p.avatar_url,
  p.latitude,
  p.longitude,
  p.clinic_id,
  p.finder_visible,
  p.is_archived,
  p.is_registered,
  p.has_online_booking,
  p.is_test_profile,
  CASE
    WHEN p.is_registered AND coalesce(ds.show_phone_public, false) THEN
      CASE
        WHEN coalesce(ds.public_phone_source, 'directory') = 'mobile'
          THEN nullif(btrim(p.mobile_number), '')
        ELSE nullif(btrim(p.phone), '')
      END
    ELSE NULL
  END AS phone
FROM public.professionals p
LEFT JOIN public.doctor_settings ds ON ds.doctor_id = p.id
WHERE p.is_archived = false;

REVOKE SELECT ON public.professionals_public FROM anon, authenticated;
GRANT SELECT ON public.professionals_public TO service_role;

COMMENT ON VIEW public.professionals_public IS
  'Server-only unified directory fields (service_role). Registered Call phone only when show_phone_public.';

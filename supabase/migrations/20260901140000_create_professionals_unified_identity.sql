-- Unified professional identity (expand-only).
--
-- Copies registered doctors + manual directory into public.professionals.
-- Does NOT drop doctors / directory_manual and does NOT retarget FKs.
-- The app keeps reading the old tables until the cutover PR.
--
-- Product flags:
--   is_registered        = completed signup (sticky true until row delete)
--   has_online_booking   = entitlement to the online-booking product
--                          (granted on register / launching offer; later revoked
--                          if they cancel a paid subscription — NOT the clinic
--                          Accepting/Paused toggle)
--   is_test_profile      = QA / smoke (prod finder hides these)

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
CREATE TABLE public.professionals (
  id uuid PRIMARY KEY,

  name text NOT NULL,
  specialty text NOT NULL,
  specialties text[] NOT NULL DEFAULT '{}'::text[],
  slug text,
  district public.cyprus_district,
  town text,

  phone text,
  email text,
  avatar_url text,
  bio text,
  languages text[] NOT NULL DEFAULT '{}'::text[],
  gender text,
  is_gesy boolean NOT NULL DEFAULT false,

  clinic_address text,
  address text,
  address_maps_link text,
  latitude double precision,
  longitude double precision,
  clinic_place_id text,
  clinic_id uuid REFERENCES public.clinics (id) ON DELETE SET NULL,

  ghs_code text,
  segment text,

  finder_visible boolean NOT NULL DEFAULT true,
  is_archived boolean NOT NULL DEFAULT false,

  is_registered boolean NOT NULL DEFAULT false,
  has_online_booking boolean NOT NULL DEFAULT false,
  is_test_profile boolean NOT NULL DEFAULT false,

  auth_user_id uuid UNIQUE,
  status text,
  license_number text,
  license_file_url text,
  is_specialty_approved boolean,
  subscription_tier text,
  specialty_requires_standard_at timestamptz,
  auth_session_revoked_after timestamptz,
  auth_keep_session_id uuid,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT professionals_booking_requires_registered
    CHECK (NOT has_online_booking OR is_registered),
  CONSTRAINT professionals_registered_requires_auth
    CHECK (NOT is_registered OR auth_user_id IS NOT NULL),
  CONSTRAINT professionals_status_check
    CHECK (status IS NULL OR status IN ('pending', 'verified', 'rejected')),
  CONSTRAINT professionals_registered_requires_status
    CHECK (NOT is_registered OR status IS NOT NULL),
  CONSTRAINT professionals_unregistered_no_status
    CHECK (is_registered OR status IS NULL),
  CONSTRAINT professionals_subscription_tier_check
    CHECK (
      subscription_tier IS NULL
      OR subscription_tier IN ('founder', 'standard')
    )
);

COMMENT ON TABLE public.professionals IS
  'Unified health-professional identity (registered accounts + directory listings). Expand-only: doctors and directory_manual remain until app cutover.';

COMMENT ON COLUMN public.professionals.is_registered IS
  'True after signup (self-serve or admin on their behalf). Sticky; only row deletion clears it.';

COMMENT ON COLUMN public.professionals.has_online_booking IS
  'Entitlement to the online-booking product. True on register (launching offer). Later false if they cancel a paid subscription. Independent of per-clinic pause_online_bookings.';

COMMENT ON COLUMN public.professionals.is_test_profile IS
  'QA / smoke profiles. Production Finder hides these unless NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES=1.';

COMMENT ON COLUMN public.professionals.auth_user_id IS
  'Supabase Auth user. Required when is_registered; null for directory-only rows.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX professionals_finder_state_idx
  ON public.professionals (is_archived, finder_visible, is_registered, has_online_booking);

CREATE INDEX professionals_district_specialty_idx
  ON public.professionals (district, specialty)
  WHERE is_archived = false;

CREATE INDEX professionals_town_idx
  ON public.professionals (town)
  WHERE is_archived = false AND town IS NOT NULL;

CREATE INDEX professionals_specialties_gin_idx
  ON public.professionals USING gin (specialties);

CREATE INDEX professionals_finder_visible_idx
  ON public.professionals (finder_visible)
  WHERE is_archived = false AND finder_visible = true;

CREATE INDEX professionals_clinic_id_idx
  ON public.professionals (clinic_id)
  WHERE clinic_id IS NOT NULL AND is_archived = false;

CREATE INDEX professionals_is_test_profile_idx
  ON public.professionals (is_test_profile)
  WHERE is_test_profile = true;

CREATE UNIQUE INDEX professionals_slug_unique_lower_idx
  ON public.professionals (lower(trim(slug)))
  WHERE slug IS NOT NULL AND trim(slug) <> '' AND is_archived = false;

CREATE UNIQUE INDEX professionals_ghs_code_active_uidx
  ON public.professionals (ghs_code)
  WHERE ghs_code IS NOT NULL AND is_archived = false;

-- ---------------------------------------------------------------------------
-- Sticky is_registered
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.professionals_prevent_unregister()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_registered IS TRUE AND NEW.is_registered IS FALSE THEN
    RAISE EXCEPTION
      'professionals.is_registered cannot revert to false; delete the row to remove the account';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER professionals_prevent_unregister
  BEFORE UPDATE OF is_registered ON public.professionals
  FOR EACH ROW
  EXECUTE PROCEDURE public.professionals_prevent_unregister();

-- ---------------------------------------------------------------------------
-- Collision checks + backfill
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  id_collisions int;
BEGIN
  SELECT count(*)::int INTO id_collisions
  FROM public.directory_manual m
  INNER JOIN public.doctors d ON d.id = m.id;

  IF id_collisions > 0 THEN
    RAISE EXCEPTION
      'professionals backfill: % UUID collisions between doctors and directory_manual',
      id_collisions;
  END IF;
END
$$;

INSERT INTO public.professionals (
  id,
  name,
  specialty,
  specialties,
  slug,
  district,
  town,
  phone,
  email,
  avatar_url,
  bio,
  languages,
  gender,
  is_gesy,
  clinic_address,
  address,
  address_maps_link,
  latitude,
  longitude,
  clinic_place_id,
  clinic_id,
  ghs_code,
  segment,
  finder_visible,
  is_archived,
  is_registered,
  has_online_booking,
  is_test_profile,
  auth_user_id,
  status,
  license_number,
  license_file_url,
  is_specialty_approved,
  subscription_tier,
  specialty_requires_standard_at,
  auth_session_revoked_after,
  auth_keep_session_id,
  created_at,
  updated_at
)
SELECT
  d.id,
  d.name,
  d.specialty,
  CASE
    WHEN coalesce(array_length(d.specialties, 1), 0) > 0 THEN d.specialties
    WHEN d.specialty IS NOT NULL AND btrim(d.specialty) <> '' THEN ARRAY[btrim(d.specialty)]
    ELSE '{}'::text[]
  END,
  d.slug,
  d.district,
  d.town,
  d.phone,
  d.email,
  d.avatar_url,
  d.bio,
  coalesce(d.languages, '{}'::text[]),
  NULL,
  coalesce(d.is_gesy, false),
  d.clinic_address,
  NULL,
  NULL,
  d.latitude,
  d.longitude,
  d.clinic_place_id,
  NULL,
  NULL,
  NULL,
  true,
  false,
  true,
  true,
  coalesce(d.is_test_profile, false),
  d.auth_user_id,
  coalesce(nullif(btrim(d.status), ''), 'pending'),
  d.license_number,
  d.license_file_url,
  d.is_specialty_approved,
  d.subscription_tier,
  d.specialty_requires_standard_at,
  d.auth_session_revoked_after,
  d.auth_keep_session_id,
  coalesce(d.created_at, now()),
  coalesce(d.created_at, now())
FROM public.doctors d;

INSERT INTO public.professionals (
  id,
  name,
  specialty,
  specialties,
  slug,
  district,
  town,
  phone,
  email,
  avatar_url,
  bio,
  languages,
  gender,
  is_gesy,
  clinic_address,
  address,
  address_maps_link,
  latitude,
  longitude,
  clinic_place_id,
  clinic_id,
  ghs_code,
  segment,
  finder_visible,
  is_archived,
  is_registered,
  has_online_booking,
  is_test_profile,
  auth_user_id,
  status,
  license_number,
  license_file_url,
  is_specialty_approved,
  subscription_tier,
  specialty_requires_standard_at,
  auth_session_revoked_after,
  auth_keep_session_id,
  created_at,
  updated_at
)
SELECT
  m.id,
  m.name,
  m.specialty,
  CASE
    WHEN coalesce(array_length(m.specialties, 1), 0) > 0 THEN m.specialties
    WHEN m.specialty IS NOT NULL AND btrim(m.specialty) <> '' THEN ARRAY[btrim(m.specialty)]
    ELSE '{}'::text[]
  END,
  CASE
    WHEN m.slug IS NULL OR btrim(m.slug) = '' THEN m.slug
    WHEN EXISTS (
      SELECT 1
      FROM public.professionals p
      WHERE p.is_archived = false
        AND p.slug IS NOT NULL
        AND btrim(p.slug) <> ''
        AND lower(trim(p.slug)) = lower(trim(m.slug))
    ) THEN left(
      trim(both '-' from concat(btrim(m.slug), '-dir-', substr(replace(m.id::text, '-', ''), 1, 6))),
      80
    )
    ELSE m.slug
  END,
  m.district,
  m.town,
  m.phone,
  m.email,
  NULL,
  NULL,
  '{}'::text[],
  m.gender,
  coalesce(m.is_gesy, false),
  NULL,
  m.address,
  m.address_maps_link,
  m.latitude,
  m.longitude,
  NULL,
  m.clinic_id,
  m.ghs_code,
  m.segment,
  coalesce(m.finder_visible, true),
  coalesce(m.is_archived, false),
  false,
  false,
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  m.created_at,
  coalesce(m.updated_at, m.created_at, now())
FROM public.directory_manual m;

-- ---------------------------------------------------------------------------
-- RLS (same posture as doctors / directory_manual: no anon dumps)
-- ---------------------------------------------------------------------------
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.professionals FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.professionals TO authenticated;
GRANT ALL ON TABLE public.professionals TO service_role;

CREATE POLICY professionals_select_own
  ON public.professionals
  FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_user_id);

CREATE POLICY professionals_update_own
  ON public.professionals
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = auth_user_id)
  WITH CHECK (auth.uid() = auth_user_id);

-- ---------------------------------------------------------------------------
-- Public view (service_role only)
-- ---------------------------------------------------------------------------
CREATE VIEW public.professionals_public
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
    WHEN p.is_registered AND coalesce(ds.show_phone_public, false)
      THEN nullif(btrim(p.phone), '')
    ELSE NULL
  END AS phone
FROM public.professionals p
LEFT JOIN public.doctor_settings ds ON ds.doctor_id = p.id
WHERE p.is_archived = false;

REVOKE SELECT ON public.professionals_public FROM anon, authenticated;
GRANT SELECT ON public.professionals_public TO service_role;

COMMENT ON VIEW public.professionals_public IS
  'Server-only unified directory fields (service_role). Excludes email, ghs_code, gender, segment, license, auth. Phone only when a registered professional opts into show_phone_public.';

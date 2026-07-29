-- Harden public directory reads:
-- 1) Anon/authenticated clients use safe views (column-filtered, definer-owned).
-- 2) Direct SELECT on base tables is blocked for anon (no email/phone/ghs_code dumps).
-- 3) Authenticated doctors can still SELECT their own doctors row.

-- ─── doctors_public: safe columns + conditional phone ───────────────────────
DROP VIEW IF EXISTS public.doctors_public;

CREATE VIEW public.doctors_public
WITH (security_invoker = false)
AS
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
  d.is_gesy,
  d.district,
  d.avatar_url,
  d.latitude,
  d.longitude,
  CASE
    WHEN COALESCE(ds.show_phone_public, false) THEN NULLIF(BTRIM(d.phone), '')
    ELSE NULL
  END AS phone
FROM public.doctors d
LEFT JOIN public.doctor_settings ds ON ds.doctor_id = d.id;

GRANT SELECT ON public.doctors_public TO anon, authenticated;

COMMENT ON VIEW public.doctors_public IS
  'Public directory / profile fields only. Phone is included only when show_phone_public is true. Do not add email, internal_email, or license columns.';

-- ─── doctors: remove world-readable base-table SELECT ───────────────────────
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS doctors_select_public ON public.doctors;

DROP POLICY IF EXISTS doctors_select_own ON public.doctors;
CREATE POLICY doctors_select_own
  ON public.doctors
  FOR SELECT
  TO authenticated
  USING (auth.uid() = auth_user_id);

-- ─── directory_manual_public: finder-safe columns only ────────────────────
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
  is_archived,
  created_at,
  updated_at
FROM public.directory_manual
WHERE is_archived = false;

GRANT SELECT ON public.directory_manual_public TO anon, authenticated;

COMMENT ON VIEW public.directory_manual_public IS
  'Public manual finder fields only. Excludes ghs_code, email, gender (internal/GeSY ops).';

-- ─── directory_manual: block direct base-table reads ──────────────────────
ALTER TABLE public.directory_manual ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE/DELETE policies for anon or authenticated.
-- Server routes and migrations use service_role (bypasses RLS).

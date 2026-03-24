-- subscription_tier: locks Founding Member pricing to the first 100 rows with tier 'founder'.
-- Run in Supabase SQL Editor (safe to re-run with IF NOT EXISTS).

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'standard';

ALTER TABLE public.doctors
  DROP CONSTRAINT IF EXISTS doctors_subscription_tier_check;

ALTER TABLE public.doctors
  ADD CONSTRAINT doctors_subscription_tier_check
  CHECK (subscription_tier IN ('founder', 'standard'));

COMMENT ON COLUMN public.doctors.subscription_tier IS
  'Billing tier: founder (first 100 locked €19) or standard. Set atomically at registration.';

-- Atomic registration: advisory lock + count founders + INSERT in one transaction (no double 100th slot).
CREATE OR REPLACE FUNCTION public.register_doctor_with_founder_lock(
  p_auth_user_id uuid,
  p_name text,
  p_specialty text,
  p_email text,
  p_phone text,
  p_languages text[],
  p_license_number text,
  p_license_file_url text,
  p_slug text,
  p_is_specialty_approved boolean
)
RETURNS TABLE (doctor_id uuid, subscription_tier text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  founder_count int;
  tier text;
  new_id uuid;
BEGIN
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'p_auth_user_id is required';
  END IF;

  PERFORM pg_advisory_xact_lock(87201401, 3400);

  SELECT COUNT(*)::int INTO founder_count
  FROM public.doctors
  WHERE subscription_tier = 'founder';

  IF founder_count < 100 THEN
    tier := 'founder';
  ELSE
    tier := 'standard';
  END IF;

  INSERT INTO public.doctors (
    auth_user_id,
    name,
    specialty,
    email,
    phone,
    languages,
    license_number,
    license_file_url,
    status,
    slug,
    is_specialty_approved,
    subscription_tier
  )
  VALUES (
    p_auth_user_id,
    p_name,
    p_specialty,
    p_email,
    p_phone,
    p_languages,
    p_license_number,
    p_license_file_url,
    'pending',
    p_slug,
    p_is_specialty_approved,
    tier
  )
  RETURNING id INTO new_id;

  RETURN QUERY
  SELECT new_id AS doctor_id, tier AS subscription_tier;
END;
$$;

REVOKE ALL ON FUNCTION public.register_doctor_with_founder_lock(
  uuid, text, text, text, text, text[], text, text, text, boolean
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.register_doctor_with_founder_lock(
  uuid, text, text, text, text, text[], text, text, text, boolean
) TO service_role;

-- ─── Backfill (run once after adding the column) ───────────────────────────
-- Option A — mark every existing doctor as founder (small / staging DBs only):
--   UPDATE public.doctors SET subscription_tier = 'founder';
--
-- Option B — only the first 100 by signup time (recommended for production):
--   UPDATE public.doctors d
--   SET subscription_tier = 'founder'
--   FROM (
--     SELECT id
--     FROM public.doctors
--     ORDER BY created_at ASC NULLS LAST, id ASC
--     LIMIT 100
--   ) x
--   WHERE d.id = x.id;
--
-- Option C — founders only for specific emails/slugs:
--   UPDATE public.doctors
--   SET subscription_tier = 'founder'
--   WHERE lower(email) IN ('you@example.com');

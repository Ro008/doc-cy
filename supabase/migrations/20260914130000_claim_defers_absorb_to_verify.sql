-- Card-link claims must NOT mutate the claimed finder listing at signup time.
-- The listing stays live/untouched (same slug, same card in /finder) for the
-- whole pending review window. The registration is always a fresh row that
-- just remembers which listing it intends to claim (claim_listing_id). The
-- actual merge (absorb_unregistered_into_registered) only happens when a
-- founder clicks Verify (see app/api/internal/doctors/verification/route.ts).
--
-- This also removes the need to ever "un-register" a row on Reject: since the
-- claimed listing was never touched, Reject just deletes the failed pending
-- application and the original listing is exactly as it always was.

ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS claim_listing_id uuid
    REFERENCES public.professionals(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.professionals.claim_listing_id IS
  'Unregistered finder listing this pending registration intends to claim (card_link). Set at signup, consumed by absorb_unregistered_into_registered at founder Verify. The referenced listing is never mutated before Verify.';

-- Drop the previous signature (CONVERT-or-fail semantics) before recreating.
DROP FUNCTION IF EXISTS public.register_doctor_with_founder_lock(
  uuid, text, text, text, text, text[], text, text, text, boolean, uuid, text
);

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
  p_is_specialty_approved boolean,
  p_claim_listing_id uuid DEFAULT NULL,
  p_directory_claim_source text DEFAULT NULL
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
  v_is_test boolean;
  v_specialties text[];
  v_registration_email text;
  v_mobile_number text;
BEGIN
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'p_auth_user_id is required';
  END IF;

  v_registration_email := nullif(btrim(p_email), '');
  v_mobile_number := nullif(btrim(p_phone), '');
  v_is_test := public.is_test_doctor_registration_email(p_email);

  PERFORM pg_advisory_xact_lock(87201401, 3400);

  SELECT count(*)::int INTO founder_count
  FROM public.professionals AS prof
  WHERE prof.subscription_tier = 'founder'
    AND prof.is_registered = true
    AND coalesce(prof.is_test_profile, false) = false;

  IF founder_count < 50 THEN
    tier := 'founder';
  ELSE
    tier := 'standard';
  END IF;

  v_specialties := CASE
    WHEN p_specialty IS NOT NULL AND btrim(p_specialty) <> '' THEN ARRAY[btrim(p_specialty)]
    ELSE '{}'::text[]
  END;

  -- Always a fresh row. A claimed listing (p_claim_listing_id) is only
  -- referenced, never converted here — it stays untouched until Verify.
  INSERT INTO public.professionals (
    auth_user_id,
    name,
    specialty,
    specialties,
    registration_email,
    mobile_number,
    languages,
    license_number,
    license_file_url,
    status,
    slug,
    is_specialty_approved,
    subscription_tier,
    is_test_profile,
    is_registered,
    has_online_booking,
    finder_visible,
    is_archived,
    claim_listing_id,
    directory_claim_source
  )
  VALUES (
    p_auth_user_id,
    p_name,
    p_specialty,
    v_specialties,
    v_registration_email,
    v_mobile_number,
    p_languages,
    p_license_number,
    p_license_file_url,
    'pending',
    p_slug,
    p_is_specialty_approved,
    tier,
    v_is_test,
    true,
    true,
    true,
    false,
    p_claim_listing_id,
    nullif(btrim(coalesce(p_directory_claim_source, '')), '')
  )
  RETURNING id INTO new_id;

  RETURN QUERY
  SELECT new_id, tier;
END;
$$;

COMMENT ON FUNCTION public.register_doctor_with_founder_lock(
  uuid, text, text, text, text, text[], text, text, text, boolean, uuid, text
) IS
  'Creates a registered professional (always INSERT). p_claim_listing_id/p_directory_claim_source are stored as-is for the founder review queue; the claimed listing is absorbed only at founder Verify.';

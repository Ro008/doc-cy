-- Test signups may convert QA claim clones only (name `QA Claim %` or slug `qa-claim-%`).
-- Real directory people remain unclaimable by rociosirvent+ / CI test emails.
-- Keep in sync with lib/doctor-test-profile.ts QA_CLAIM_DIRECTORY_* prefixes.

CREATE OR REPLACE FUNCTION public.is_qa_claim_directory_listing(p_name text, p_slug text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    coalesce(p_name, '') LIKE 'QA Claim %'
    OR lower(coalesce(p_slug, '')) LIKE 'qa-claim-%';
$$;

COMMENT ON FUNCTION public.is_qa_claim_directory_listing(text, text) IS
  'True for ephemeral testing clones used by the local claim-register e2e. Never true for real directory listings.';

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
  p_claim_professional_id uuid DEFAULT NULL
)
RETURNS TABLE (doctor_id uuid, subscription_tier text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
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

  IF p_claim_professional_id IS NOT NULL THEN
    UPDATE public.professionals AS p
    SET
      auth_user_id = p_auth_user_id,
      name = p_name,
      specialty = p_specialty,
      specialties = CASE
        WHEN coalesce(array_length(p.specialties, 1), 0) > 0
          AND p_specialty IS NOT NULL
          AND btrim(p_specialty) <> ''
          AND NOT (btrim(p_specialty) = ANY (p.specialties))
        THEN p.specialties || ARRAY[btrim(p_specialty)]
        WHEN coalesce(array_length(p.specialties, 1), 0) > 0 THEN p.specialties
        ELSE v_specialties
      END,
      registration_email = v_registration_email,
      mobile_number = v_mobile_number,
      languages = p_languages,
      license_number = p_license_number,
      license_file_url = p_license_file_url,
      status = 'pending',
      slug = CASE
        WHEN p.slug IS NOT NULL AND btrim(p.slug) <> '' THEN p.slug
        ELSE p_slug
      END,
      is_specialty_approved = p_is_specialty_approved,
      subscription_tier = tier,
      is_test_profile = v_is_test,
      is_registered = true,
      has_online_booking = true,
      finder_visible = true,
      is_archived = false,
      updated_at = now()
    WHERE p.id = p_claim_professional_id
      AND p.is_registered = false
      AND p.is_archived = false
      AND (
        v_is_test IS NOT TRUE
        OR public.is_qa_claim_directory_listing(p.name, p.slug)
      )
    RETURNING p.id INTO new_id;
  END IF;

  IF new_id IS NULL THEN
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
      is_archived
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
      false
    )
    RETURNING id INTO new_id;
  END IF;

  RETURN QUERY
  SELECT new_id, tier;
END;
$$;

COMMENT ON FUNCTION public.register_doctor_with_founder_lock(
  uuid, text, text, text, text, text[], text, text, text, boolean, uuid
) IS
  'Creates a registered professional, or converts p_claim_professional_id when still unregistered. Test emails may only convert QA Claim clones.';

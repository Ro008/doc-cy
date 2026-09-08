-- RETURNS TABLE (subscription_tier text) creates a PL/pgSQL variable of that name.
-- Unqualified "subscription_tier" in the founder COUNT / INSERT / UPDATE then errors:
--   42702 column reference "subscription_tier" is ambiguous
-- Registration fell through to the JS fallback. Qualify columns and prefer table names.

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
BEGIN
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'p_auth_user_id is required';
  END IF;

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

  IF p_claim_professional_id IS NOT NULL AND v_is_test IS NOT TRUE THEN
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
      email = p_email,
      phone = p_phone,
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
      is_test_profile = false,
      is_registered = true,
      has_online_booking = true,
      finder_visible = true,
      is_archived = false,
      updated_at = now()
    WHERE p.id = p_claim_professional_id
      AND p.is_registered = false
      AND p.is_archived = false
    RETURNING p.id INTO new_id;
  END IF;

  IF new_id IS NULL THEN
    INSERT INTO public.professionals (
      auth_user_id,
      name,
      specialty,
      specialties,
      email,
      phone,
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
      p_email,
      p_phone,
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
  'Creates a registered professional, or converts p_claim_professional_id when it is still an unregistered directory row.';

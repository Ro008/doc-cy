-- Keep public.professionals in sync while doctors / directory_manual remain
-- the write path. Finder reads professionals. has_online_booking is entitlement
-- (set true on first registered insert) and is NOT updated from pause toggles.

CREATE OR REPLACE FUNCTION public.sync_professional_from_doctor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_specialties text[];
  v_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.professionals
    WHERE id = OLD.id
      AND is_registered = true;
    RETURN OLD;
  END IF;

  v_specialties := CASE
    WHEN coalesce(array_length(NEW.specialties, 1), 0) > 0 THEN NEW.specialties
    WHEN NEW.specialty IS NOT NULL AND btrim(NEW.specialty) <> '' THEN ARRAY[btrim(NEW.specialty)]
    ELSE '{}'::text[]
  END;
  v_status := coalesce(nullif(btrim(NEW.status), ''), 'pending');

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
    is_gesy,
    clinic_address,
    latitude,
    longitude,
    clinic_place_id,
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
  VALUES (
    NEW.id,
    NEW.name,
    NEW.specialty,
    v_specialties,
    NEW.slug,
    NEW.district,
    NEW.town,
    NEW.phone,
    NEW.email,
    NEW.avatar_url,
    NEW.bio,
    coalesce(NEW.languages, '{}'::text[]),
    coalesce(NEW.is_gesy, false),
    NEW.clinic_address,
    NEW.latitude,
    NEW.longitude,
    NEW.clinic_place_id,
    true,
    false,
    true,
    true,
    coalesce(NEW.is_test_profile, false),
    NEW.auth_user_id,
    v_status,
    NEW.license_number,
    NEW.license_file_url,
    NEW.is_specialty_approved,
    NEW.subscription_tier,
    NEW.specialty_requires_standard_at,
    NEW.auth_session_revoked_after,
    NEW.auth_keep_session_id,
    coalesce(NEW.created_at, now()),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    specialty = EXCLUDED.specialty,
    specialties = EXCLUDED.specialties,
    slug = EXCLUDED.slug,
    district = EXCLUDED.district,
    town = EXCLUDED.town,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    avatar_url = EXCLUDED.avatar_url,
    bio = EXCLUDED.bio,
    languages = EXCLUDED.languages,
    is_gesy = EXCLUDED.is_gesy,
    clinic_address = EXCLUDED.clinic_address,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    clinic_place_id = EXCLUDED.clinic_place_id,
    finder_visible = true,
    is_archived = false,
    is_registered = true,
    -- Keep existing entitlement; grant it when converting a directory row.
    has_online_booking = CASE
      WHEN public.professionals.is_registered THEN public.professionals.has_online_booking
      ELSE true
    END,
    is_test_profile = EXCLUDED.is_test_profile,
    auth_user_id = EXCLUDED.auth_user_id,
    status = EXCLUDED.status,
    license_number = EXCLUDED.license_number,
    license_file_url = EXCLUDED.license_file_url,
    is_specialty_approved = EXCLUDED.is_specialty_approved,
    subscription_tier = EXCLUDED.subscription_tier,
    specialty_requires_standard_at = EXCLUDED.specialty_requires_standard_at,
    auth_session_revoked_after = EXCLUDED.auth_session_revoked_after,
    auth_keep_session_id = EXCLUDED.auth_keep_session_id,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS doctors_sync_professionals ON public.doctors;
CREATE TRIGGER doctors_sync_professionals
  AFTER INSERT OR UPDATE ON public.doctors
  FOR EACH ROW
  EXECUTE PROCEDURE public.sync_professional_from_doctor();

DROP TRIGGER IF EXISTS doctors_sync_professionals_delete ON public.doctors;
CREATE TRIGGER doctors_sync_professionals_delete
  AFTER DELETE ON public.doctors
  FOR EACH ROW
  EXECUTE PROCEDURE public.sync_professional_from_doctor();

CREATE OR REPLACE FUNCTION public.sync_professional_from_directory_manual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_specialties text[];
  v_slug text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.professionals
    WHERE id = OLD.id
      AND is_registered = false;
    RETURN OLD;
  END IF;

  v_specialties := CASE
    WHEN coalesce(array_length(NEW.specialties, 1), 0) > 0 THEN NEW.specialties
    WHEN NEW.specialty IS NOT NULL AND btrim(NEW.specialty) <> '' THEN ARRAY[btrim(NEW.specialty)]
    ELSE '{}'::text[]
  END;

  v_slug := NEW.slug;
  IF v_slug IS NOT NULL AND btrim(v_slug) <> '' THEN
    IF EXISTS (
      SELECT 1
      FROM public.professionals p
      WHERE p.id <> NEW.id
        AND p.is_archived = false
        AND p.slug IS NOT NULL
        AND btrim(p.slug) <> ''
        AND lower(trim(p.slug)) = lower(trim(v_slug))
    ) THEN
      v_slug := left(
        trim(both '-' from concat(btrim(v_slug), '-dir-', substr(replace(NEW.id::text, '-', ''), 1, 6))),
        80
      );
    END IF;
  END IF;

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
    languages,
    gender,
    is_gesy,
    address,
    address_maps_link,
    latitude,
    longitude,
    clinic_id,
    ghs_code,
    segment,
    finder_visible,
    is_archived,
    is_registered,
    has_online_booking,
    is_test_profile,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.name,
    NEW.specialty,
    v_specialties,
    v_slug,
    NEW.district,
    NEW.town,
    NEW.phone,
    NEW.email,
    '{}'::text[],
    NEW.gender,
    coalesce(NEW.is_gesy, false),
    NEW.address,
    NEW.address_maps_link,
    NEW.latitude,
    NEW.longitude,
    NEW.clinic_id,
    NEW.ghs_code,
    NEW.segment,
    coalesce(NEW.finder_visible, true),
    coalesce(NEW.is_archived, false),
    false,
    false,
    false,
    coalesce(NEW.created_at, now()),
    coalesce(NEW.updated_at, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    specialty = EXCLUDED.specialty,
    specialties = EXCLUDED.specialties,
    slug = EXCLUDED.slug,
    district = EXCLUDED.district,
    town = EXCLUDED.town,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    gender = EXCLUDED.gender,
    is_gesy = EXCLUDED.is_gesy,
    address = EXCLUDED.address,
    address_maps_link = EXCLUDED.address_maps_link,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    clinic_id = EXCLUDED.clinic_id,
    ghs_code = EXCLUDED.ghs_code,
    segment = EXCLUDED.segment,
    finder_visible = EXCLUDED.finder_visible,
    is_archived = EXCLUDED.is_archived,
    updated_at = now()
  WHERE public.professionals.is_registered = false;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS directory_manual_sync_professionals ON public.directory_manual;
CREATE TRIGGER directory_manual_sync_professionals
  AFTER INSERT OR UPDATE ON public.directory_manual
  FOR EACH ROW
  EXECUTE PROCEDURE public.sync_professional_from_directory_manual();

DROP TRIGGER IF EXISTS directory_manual_sync_professionals_delete ON public.directory_manual;
CREATE TRIGGER directory_manual_sync_professionals_delete
  AFTER DELETE ON public.directory_manual
  FOR EACH ROW
  EXECUTE PROCEDURE public.sync_professional_from_directory_manual();

COMMENT ON FUNCTION public.sync_professional_from_doctor() IS
  'Mirrors registered doctors into professionals. Grants has_online_booking on first insert / directory claim; does not copy pause_online_bookings.';

COMMENT ON FUNCTION public.sync_professional_from_directory_manual() IS
  'Mirrors unregistered directory rows into professionals. Will not overwrite a registered professional with the same id.';

-- Bug: absorb_unregistered_into_registered was unioning the unregistered
-- listing's specialties/specialty into the REGISTERED professional's public
-- `specialties` array. That column drives public badges directly (finder
-- card + profile), with no doctor_specialties / is_specialty_approved
-- backing — so an absorbed listing could silently add an unlicensed
-- specialty badge to a verified doctor's public profile.
--
-- Confirmed in testing: registering with only "Biochemistry"
-- (doctor_specialties has exactly one approved row), then Verify-absorbing an
-- unregistered "Gynecology" listing via a manually pasted URL, resulted in
-- professionals.specialties = ["Biochemistry", "Gynecology"] — a specialty
-- the doctor never submitted or got license-approved for.
--
-- Fix: a registered professional's specialties are governed solely by
-- doctor_specialties (synced via sync_doctor_specialties_to_doctor). Absorb
-- must never touch that column — drop the specialties merge entirely.

CREATE OR REPLACE FUNCTION public.absorb_unregistered_into_registered(
  p_registered_id uuid,
  p_unregistered_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registered public.professionals%ROWTYPE;
  v_unregistered public.professionals%ROWTYPE;
  v_old_slug text;
  v_new_slug text;
  v_ghs text;
BEGIN
  IF p_registered_id IS NULL OR p_unregistered_id IS NULL THEN
    RAISE EXCEPTION 'absorb_unregistered_into_registered requires both ids';
  END IF;
  IF p_registered_id = p_unregistered_id THEN
    RAISE EXCEPTION 'cannot absorb a professional into itself';
  END IF;

  SELECT * INTO v_registered
  FROM public.professionals
  WHERE id = p_registered_id
  FOR UPDATE;
  IF NOT FOUND OR v_registered.is_registered IS NOT TRUE THEN
    RAISE EXCEPTION 'registered professional % not found', p_registered_id;
  END IF;

  SELECT * INTO v_unregistered
  FROM public.professionals
  WHERE id = p_unregistered_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unregistered professional % not found', p_unregistered_id;
  END IF;
  IF v_unregistered.is_registered IS TRUE THEN
    RAISE EXCEPTION 'source professional % is registered; refuse absorb', p_unregistered_id;
  END IF;
  IF v_unregistered.is_archived IS TRUE THEN
    RETURN;
  END IF;

  INSERT INTO public.professional_clinics (professional_id, clinic_id, is_primary, created_at)
  SELECT p_registered_id, pc.clinic_id, pc.is_primary, pc.created_at
  FROM public.professional_clinics pc
  WHERE pc.professional_id = p_unregistered_id
  ON CONFLICT (professional_id, clinic_id) DO NOTHING;

  DELETE FROM public.professional_clinics
  WHERE professional_id = p_unregistered_id;

  UPDATE public.professional_patient_booking_requests
  SET professional_id = p_registered_id
  WHERE professional_id = p_unregistered_id;

  UPDATE public.professional_call_to_book_clicks
  SET professional_id = p_registered_id
  WHERE professional_id = p_unregistered_id;

  v_old_slug := nullif(btrim(coalesce(v_unregistered.slug, '')), '');
  v_new_slug := nullif(btrim(coalesce(v_registered.slug, '')), '');
  IF v_old_slug IS NOT NULL AND lower(v_old_slug) IS DISTINCT FROM lower(coalesce(v_new_slug, '')) THEN
    INSERT INTO public.professional_slug_redirects (slug, professional_id)
    VALUES (lower(v_old_slug), p_registered_id)
    ON CONFLICT (slug) DO UPDATE
      SET professional_id = EXCLUDED.professional_id;
  END IF;

  -- Archive first so ghs_code / slug unique indexes (active rows only) are free.
  UPDATE public.professionals
  SET is_archived = true, updated_at = now()
  WHERE id = p_unregistered_id;

  v_ghs := nullif(btrim(coalesce(v_registered.ghs_code, '')), '');
  IF v_ghs IS NULL THEN
    v_ghs := nullif(btrim(coalesce(v_unregistered.ghs_code, '')), '');
    IF v_ghs IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.professionals p
      WHERE p.id <> p_registered_id
        AND p.is_archived = false
        AND p.ghs_code = v_ghs
    ) THEN
      v_ghs := v_registered.ghs_code;
    END IF;
  ELSE
    v_ghs := v_registered.ghs_code;
  END IF;

  -- Intentionally does NOT touch `specialty` / `specialties`: those are owned
  -- by doctor_specialties (license-backed) via sync_doctor_specialties_to_doctor
  -- and must never be augmented by an absorbed unregistered listing.
  UPDATE public.professionals
  SET
    ghs_code = v_ghs,
    clinic_id = coalesce(v_registered.clinic_id, v_unregistered.clinic_id),
    is_gesy = coalesce(v_registered.is_gesy, false) OR coalesce(v_unregistered.is_gesy, false),
    address_maps_link = CASE
      WHEN nullif(btrim(coalesce(v_registered.address_maps_link, '')), '') IS NOT NULL
        THEN v_registered.address_maps_link
      ELSE v_unregistered.address_maps_link
    END,
    address = CASE
      WHEN nullif(btrim(coalesce(v_registered.address, '')), '') IS NOT NULL
        THEN v_registered.address
      ELSE v_unregistered.address
    END,
    town = CASE
      WHEN nullif(btrim(coalesce(v_registered.town, '')), '') IS NOT NULL
        THEN v_registered.town
      ELSE v_unregistered.town
    END,
    latitude = coalesce(v_registered.latitude, v_unregistered.latitude),
    longitude = coalesce(v_registered.longitude, v_unregistered.longitude),
    updated_at = now()
  WHERE id = p_registered_id;
END;
$$;

COMMENT ON FUNCTION public.absorb_unregistered_into_registered(uuid, uuid) IS
  'Archives the unregistered listing into the registered professional (clinics, booking requests, call-to-book clicks, slug redirect, address/ghs/gesy fields). Never touches specialty/specialties on the registered row — those stay governed by doctor_specialties.';

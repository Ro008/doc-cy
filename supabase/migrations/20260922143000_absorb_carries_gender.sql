-- Absorb dropped `gender` on the floor.
--
-- Registration never asks for gender, so a registered row carries NULL. The scraped
-- listing it absorbs does know it (GeSY `genderCd`). Every other identity field the
-- listing holds is carried across with a coalesce — ghs_code, address, town, the
-- coordinates — but gender was left out, so the merge actively lost it.
--
-- That is visible: with no uploaded photo, the finder and the clinic roster fall back
-- to a placeholder chosen from gender, and FINDER_DEFAULT_AVATAR_UNKNOWN is the male
-- illustration. A verified woman absorbed from GeSY was rendered as a generic man.
--
-- Same rule as the other fields: the registered row wins when it has a value, the
-- listing fills the gap. Identical to 20260914150000 apart from the `gender` line;
-- it still never touches specialties (now owned by professional_specialties).

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
  -- by professional_specialties (license-backed) and must never be augmented by an
  -- absorbed unregistered listing.
  UPDATE public.professionals
  SET
    ghs_code = v_ghs,
    clinic_id = coalesce(v_registered.clinic_id, v_unregistered.clinic_id),
    is_gesy = coalesce(v_registered.is_gesy, false) OR coalesce(v_unregistered.is_gesy, false),
    gender = CASE
      WHEN nullif(btrim(coalesce(v_registered.gender, '')), '') IS NOT NULL
        THEN v_registered.gender
      ELSE v_unregistered.gender
    END,
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
  'Archives the unregistered listing into the registered professional (clinics, booking requests, call-to-book clicks, slug redirect, address/gender/ghs/gesy fields). Never touches specialties - those stay governed by professional_specialties.';

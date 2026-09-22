-- Point D1: keep professional_clinics an exact mirror of doctor_locations.
--
-- Stage 1 (20260918093247) backfilled one clinic + join row per location, reusing
-- doctor_locations.id as the join-row id, but nothing kept them in step afterwards:
-- every writer (register, settings, the locations API, the verify route, the
-- create-primary-location trigger) still writes doctor_locations only. New locations
-- got no join row and edited ones drifted.
--
-- A trigger covers every writer at once and changes no app code, so the read cutover
-- (D2) can switch tables without changing anything anyone sees. Deliberately additive
-- and backward-compatible; doctor_locations stays the source of truth until D3.
--
-- Rules, per location L of professional P:
-- - The join row with id = L.id follows L's schedule, pause, label, primary flag and
--   sort order.
-- - Its clinic follows L's address:
--   * address unchanged: keep the clinic (a clinic only this row uses, with no
--     ghs_code, also takes L's town, district, coordinates and place id);
--   * P already has a join row that mirrors no location, at a clinic with L's address
--     (an absorbed GeSY listing, whose address the verify route copies verbatim):
--     L takes that row over, so no doctor-named duplicate of the clinic appears;
--   * a clinic only this row uses, with no ghs_code: updated in place;
--   * otherwise (GeSY or shared clinics are never edited): a new clinic named after P,
--     as Stage 1 did.
-- - A location with no address or no valid district gets no join row until it has
--   both (clinics.district is NOT NULL).
-- - Deleting L deletes its join row. Clinics are never deleted here.

-- ---------------------------------------------------------------------------
-- 1) A clinic for a location, named after the professional (as Stage 1 did).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_clinic_for_professional_location(
  p_location_id uuid,
  p_district public.cyprus_district
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_loc public.doctor_locations%ROWTYPE;
  v_name text;
  v_base text;
  v_slug text;
  v_n integer := 1;
  v_clinic_id uuid;
BEGIN
  SELECT * INTO v_loc FROM public.doctor_locations WHERE id = p_location_id;

  SELECT p.name INTO v_name FROM public.professionals p WHERE p.id = v_loc.doctor_id;
  v_name := coalesce(nullif(btrim(v_name), ''), 'Clinic');

  v_base := trim(BOTH '-' FROM regexp_replace(
    lower(translate(
      v_name,
      'áàâäãåÁÀÂÄÃÅéèêëÉÈÊËíìîïÍÌÎÏóòôöõÓÒÔÖÕúùûüÚÙÛÜñÑçÇýÿÝ',
      'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUnNcCyyY'
    )),
    '[^a-z0-9]+', '-', 'g'
  ));
  IF v_base = '' THEN
    v_base := 'clinic';
  END IF;

  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM public.clinics c WHERE c.slug = v_slug) LOOP
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n::text;
  END LOOP;

  INSERT INTO public.clinics (
    name, slug, district, address, town, latitude, longitude, clinic_place_id
  )
  VALUES (
    v_name, v_slug, p_district, btrim(v_loc.clinic_address), v_loc.town,
    v_loc.latitude, v_loc.longitude, v_loc.clinic_place_id
  )
  RETURNING id INTO v_clinic_id;

  RETURN v_clinic_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) Bring one location's join row (and clinic) in line with it. Idempotent.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mirror_location_to_professional_clinic(p_location_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_loc public.doctor_locations%ROWTYPE;
  v_addr text;
  v_district public.cyprus_district;
  v_has_row boolean;
  v_clinic public.clinics%ROWTYPE;
  v_owned boolean := false;
  v_adopt_id uuid;
  v_adopt_clinic uuid;
  v_new_clinic uuid;
BEGIN
  SELECT * INTO v_loc FROM public.doctor_locations WHERE id = p_location_id;
  IF NOT FOUND THEN
    DELETE FROM public.professional_clinics WHERE id = p_location_id;
    RETURN;
  END IF;

  v_addr := nullif(btrim(v_loc.clinic_address), '');
  IF v_loc.district IN (
    SELECT unnest(enum_range(NULL::public.cyprus_district))::text
  ) THEN
    v_district := v_loc.district::public.cyprus_district;
  END IF;

  SELECT c.* INTO v_clinic
  FROM public.professional_clinics pc
  JOIN public.clinics c ON c.id = pc.clinic_id
  WHERE pc.id = v_loc.id;
  v_has_row := FOUND;

  IF v_has_row THEN
    v_owned := v_clinic.ghs_code IS NULL AND NOT EXISTS (
      SELECT 1 FROM public.professional_clinics pc
      WHERE pc.clinic_id = v_clinic.id AND pc.id <> v_loc.id
    );
  END IF;

  IF v_has_row AND lower(btrim(v_clinic.address)) IS NOT DISTINCT FROM lower(v_addr) THEN
    -- Same place. Only a clinic this location owns takes its details.
    IF v_owned THEN
      UPDATE public.clinics c
      SET address = v_addr,
          district = coalesce(v_district, c.district),
          town = v_loc.town,
          latitude = v_loc.latitude,
          longitude = v_loc.longitude,
          clinic_place_id = v_loc.clinic_place_id,
          updated_at = now()
      WHERE c.id = v_clinic.id
        AND (c.address, c.district, c.town, c.latitude, c.longitude, c.clinic_place_id)
            IS DISTINCT FROM
            (v_addr, coalesce(v_district, c.district), v_loc.town, v_loc.latitude,
             v_loc.longitude, v_loc.clinic_place_id);
    END IF;
  ELSIF v_addr IS NULL THEN
    -- No address to place it at: keep whatever link exists, create none.
    IF NOT v_has_row THEN
      RETURN;
    END IF;
  ELSE
    -- A link of this professional that mirrors no location, at this address.
    SELECT pc.id, pc.clinic_id INTO v_adopt_id, v_adopt_clinic
    FROM public.professional_clinics pc
    JOIN public.clinics c ON c.id = pc.clinic_id
    WHERE pc.professional_id = v_loc.doctor_id
      AND pc.id <> v_loc.id
      AND lower(btrim(c.address)) = lower(v_addr)
      AND NOT EXISTS (SELECT 1 FROM public.doctor_locations d WHERE d.id = pc.id)
    ORDER BY pc.is_primary DESC, pc.created_at, pc.id
    LIMIT 1;

    IF v_adopt_id IS NOT NULL THEN
      IF v_has_row THEN
        DELETE FROM public.professional_clinics WHERE id = v_adopt_id;
        UPDATE public.professional_clinics SET clinic_id = v_adopt_clinic WHERE id = v_loc.id;
      ELSE
        -- Nothing references professional_clinics.id, so re-keying it is safe.
        UPDATE public.professional_clinics SET id = v_loc.id WHERE id = v_adopt_id;
      END IF;
    ELSIF v_owned THEN
      UPDATE public.clinics c
      SET address = v_addr,
          district = coalesce(v_district, c.district),
          town = v_loc.town,
          latitude = v_loc.latitude,
          longitude = v_loc.longitude,
          clinic_place_id = v_loc.clinic_place_id,
          updated_at = now()
      WHERE c.id = v_clinic.id;
    ELSE
      v_district := coalesce(v_district, v_clinic.district);
      IF v_district IS NULL THEN
        RETURN;
      END IF;
      v_new_clinic := public.create_clinic_for_professional_location(v_loc.id, v_district);
      IF v_has_row THEN
        UPDATE public.professional_clinics SET clinic_id = v_new_clinic WHERE id = v_loc.id;
      ELSE
        INSERT INTO public.professional_clinics (id, professional_id, clinic_id, created_at)
        VALUES (v_loc.id, v_loc.doctor_id, v_new_clinic, v_loc.created_at);
      END IF;
    END IF;
  END IF;

  UPDATE public.professional_clinics pc
  SET is_primary = v_loc.is_primary,
      sort_order = v_loc.sort_order,
      label = v_loc.label,
      pause_online_bookings = v_loc.pause_online_bookings,
      monday = v_loc.monday,
      tuesday = v_loc.tuesday,
      wednesday = v_loc.wednesday,
      thursday = v_loc.thursday,
      friday = v_loc.friday,
      saturday = v_loc.saturday,
      sunday = v_loc.sunday,
      start_time = v_loc.start_time,
      end_time = v_loc.end_time,
      weekly_schedule = v_loc.weekly_schedule,
      break_start = v_loc.break_start,
      break_end = v_loc.break_end,
      slot_duration_minutes = v_loc.slot_duration_minutes,
      updated_at = now()
  WHERE pc.id = v_loc.id
    AND (pc.is_primary, pc.sort_order, pc.label, pc.pause_online_bookings,
         pc.monday, pc.tuesday, pc.wednesday, pc.thursday, pc.friday, pc.saturday,
         pc.sunday, pc.start_time, pc.end_time, pc.weekly_schedule, pc.break_start,
         pc.break_end, pc.slot_duration_minutes)
        IS DISTINCT FROM
        (v_loc.is_primary, v_loc.sort_order, v_loc.label, v_loc.pause_online_bookings,
         v_loc.monday, v_loc.tuesday, v_loc.wednesday, v_loc.thursday, v_loc.friday,
         v_loc.saturday, v_loc.sunday, v_loc.start_time, v_loc.end_time,
         v_loc.weekly_schedule, v_loc.break_start, v_loc.break_end,
         v_loc.slot_duration_minutes);
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) The trigger.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.doctor_locations_mirror_to_professional_clinics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.professional_clinics WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  PERFORM public.mirror_location_to_professional_clinic(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS doctor_locations_mirror_professional_clinics ON public.doctor_locations;
CREATE TRIGGER doctor_locations_mirror_professional_clinics
  AFTER INSERT OR UPDATE OR DELETE ON public.doctor_locations
  FOR EACH ROW EXECUTE FUNCTION public.doctor_locations_mirror_to_professional_clinics();

-- Triggers fire without the caller holding EXECUTE (proven in #200), so none of
-- these needs to be callable through /rest/v1.
REVOKE EXECUTE ON FUNCTION public.create_clinic_for_professional_location(uuid, public.cyprus_district)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mirror_location_to_professional_clinic(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.doctor_locations_mirror_to_professional_clinics()
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) Backfill: bring every existing location in line. Rule-driven and idempotent.
-- ---------------------------------------------------------------------------
-- Primary first, so a professional's main address claims its clinic before a
-- secondary location looks for one to adopt.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM public.doctor_locations
    ORDER BY doctor_id, is_primary DESC, sort_order, created_at, id
  LOOP
    PERFORM public.mirror_location_to_professional_clinic(r.id);
  END LOOP;
END;
$$;

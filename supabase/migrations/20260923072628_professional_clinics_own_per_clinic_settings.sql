-- Point D3a: professional_clinics owns each professional's settings at each clinic.
--
-- Hours, breaks, slot length, label and the bookings pause describe one professional
-- at one clinic: two doctors sharing a clinic keep their own. The app now writes them
-- to the join row. Which clinic it is, and its address, stay on doctor_locations until
-- the registration redesign moves them behind admin review, so both tables are
-- written for a while. This migration keeps them from overwriting each other:
--
-- 1) The D1 mirror still copies linkage (address, clinic, primary, order) from the
--    location on every write, but copies a SETTING only when that setting changed on
--    the location itself. Old code that writes settings to the location keeps working;
--    new code that writes them to the join row can't be undone by a later address edit.
--    A new join row is still seeded with all of the location's settings.
-- 2) professional_settings still carries a copy of the primary clinic's settings, and
--    several routes read it. That copy now comes from the primary JOIN ROW, not the
--    location. The location trigger keeps copying only for a clinic still being set up
--    (no join row yet), exactly as before.
--
-- Backward-compatible: code writing only the old way sees the same results.

-- ---------------------------------------------------------------------------
-- 1) The mirror function takes a flag: copy settings, or only linkage.
-- ---------------------------------------------------------------------------
-- A defaulted second argument would create an ambiguous overload next to the
-- one-argument version, so the old signature goes first.
DROP FUNCTION IF EXISTS public.mirror_location_to_professional_clinic(uuid);

CREATE OR REPLACE FUNCTION public.mirror_location_to_professional_clinic(
  p_location_id uuid,
  p_copy_settings boolean DEFAULT true
)
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
  v_created boolean := false;
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
        v_created := true;
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
        v_created := true;
      END IF;
    END IF;
  END IF;

  -- Linkage stays owned by the location for now.
  UPDATE public.professional_clinics pc
  SET is_primary = v_loc.is_primary,
      sort_order = v_loc.sort_order,
      updated_at = now()
  WHERE pc.id = v_loc.id
    AND (pc.is_primary, pc.sort_order) IS DISTINCT FROM (v_loc.is_primary, v_loc.sort_order);

  -- Settings: a new join row starts from the location's; an existing one only when
  -- the caller asks (a backfill, or a location whose settings actually changed).
  IF p_copy_settings OR v_created THEN
    UPDATE public.professional_clinics pc
    SET label = v_loc.label,
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
      AND (pc.label, pc.pause_online_bookings,
           pc.monday, pc.tuesday, pc.wednesday, pc.thursday, pc.friday, pc.saturday,
           pc.sunday, pc.start_time, pc.end_time, pc.weekly_schedule, pc.break_start,
           pc.break_end, pc.slot_duration_minutes)
          IS DISTINCT FROM
          (v_loc.label, v_loc.pause_online_bookings,
           v_loc.monday, v_loc.tuesday, v_loc.wednesday, v_loc.thursday, v_loc.friday,
           v_loc.saturday, v_loc.sunday, v_loc.start_time, v_loc.end_time,
           v_loc.weekly_schedule, v_loc.break_start, v_loc.break_end,
           v_loc.slot_duration_minutes);
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) The location trigger: linkage always, settings only where they changed.
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

  IF TG_OP = 'INSERT' THEN
    PERFORM public.mirror_location_to_professional_clinic(NEW.id, true);
    RETURN NEW;
  END IF;

  PERFORM public.mirror_location_to_professional_clinic(NEW.id, false);

  -- Copy only the settings this update changed on the location. A join row created
  -- just now was already seeded from NEW, so this leaves it as it is.
  UPDATE public.professional_clinics pc
  SET label = CASE WHEN NEW.label IS DISTINCT FROM OLD.label THEN NEW.label ELSE pc.label END,
      pause_online_bookings = CASE WHEN NEW.pause_online_bookings IS DISTINCT FROM OLD.pause_online_bookings
        THEN NEW.pause_online_bookings ELSE pc.pause_online_bookings END,
      monday = CASE WHEN NEW.monday IS DISTINCT FROM OLD.monday THEN NEW.monday ELSE pc.monday END,
      tuesday = CASE WHEN NEW.tuesday IS DISTINCT FROM OLD.tuesday THEN NEW.tuesday ELSE pc.tuesday END,
      wednesday = CASE WHEN NEW.wednesday IS DISTINCT FROM OLD.wednesday THEN NEW.wednesday ELSE pc.wednesday END,
      thursday = CASE WHEN NEW.thursday IS DISTINCT FROM OLD.thursday THEN NEW.thursday ELSE pc.thursday END,
      friday = CASE WHEN NEW.friday IS DISTINCT FROM OLD.friday THEN NEW.friday ELSE pc.friday END,
      saturday = CASE WHEN NEW.saturday IS DISTINCT FROM OLD.saturday THEN NEW.saturday ELSE pc.saturday END,
      sunday = CASE WHEN NEW.sunday IS DISTINCT FROM OLD.sunday THEN NEW.sunday ELSE pc.sunday END,
      start_time = CASE WHEN NEW.start_time IS DISTINCT FROM OLD.start_time THEN NEW.start_time ELSE pc.start_time END,
      end_time = CASE WHEN NEW.end_time IS DISTINCT FROM OLD.end_time THEN NEW.end_time ELSE pc.end_time END,
      weekly_schedule = CASE WHEN NEW.weekly_schedule IS DISTINCT FROM OLD.weekly_schedule
        THEN NEW.weekly_schedule ELSE pc.weekly_schedule END,
      break_start = CASE WHEN NEW.break_start IS DISTINCT FROM OLD.break_start THEN NEW.break_start ELSE pc.break_start END,
      break_end = CASE WHEN NEW.break_end IS DISTINCT FROM OLD.break_end THEN NEW.break_end ELSE pc.break_end END,
      slot_duration_minutes = CASE WHEN NEW.slot_duration_minutes IS DISTINCT FROM OLD.slot_duration_minutes
        THEN NEW.slot_duration_minutes ELSE pc.slot_duration_minutes END,
      updated_at = now()
  WHERE pc.id = NEW.id
    AND (NEW.label, NEW.pause_online_bookings, NEW.monday, NEW.tuesday, NEW.wednesday,
         NEW.thursday, NEW.friday, NEW.saturday, NEW.sunday, NEW.start_time, NEW.end_time,
         NEW.weekly_schedule, NEW.break_start, NEW.break_end, NEW.slot_duration_minutes)
        IS DISTINCT FROM
        (OLD.label, OLD.pause_online_bookings, OLD.monday, OLD.tuesday, OLD.wednesday,
         OLD.thursday, OLD.friday, OLD.saturday, OLD.sunday, OLD.start_time, OLD.end_time,
         OLD.weekly_schedule, OLD.break_start, OLD.break_end, OLD.slot_duration_minutes);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS doctor_locations_mirror_professional_clinics ON public.doctor_locations;
CREATE TRIGGER doctor_locations_mirror_professional_clinics
  AFTER INSERT OR UPDATE OR DELETE ON public.doctor_locations
  FOR EACH ROW EXECUTE FUNCTION public.doctor_locations_mirror_to_professional_clinics();

-- ---------------------------------------------------------------------------
-- 3) Account settings copy the primary clinic's JOIN ROW.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.professional_clinics_sync_primary_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only a configured practice location: a scraped listing's join rows have no hours.
  IF NOT coalesce(NEW.is_primary, false) OR NEW.start_time IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.is_primary IS NOT DISTINCT FROM NEW.is_primary
     AND (OLD.pause_online_bookings, OLD.monday, OLD.tuesday, OLD.wednesday, OLD.thursday,
          OLD.friday, OLD.saturday, OLD.sunday, OLD.start_time, OLD.end_time,
          OLD.weekly_schedule, OLD.break_start, OLD.break_end, OLD.slot_duration_minutes)
         IS NOT DISTINCT FROM
         (NEW.pause_online_bookings, NEW.monday, NEW.tuesday, NEW.wednesday, NEW.thursday,
          NEW.friday, NEW.saturday, NEW.sunday, NEW.start_time, NEW.end_time,
          NEW.weekly_schedule, NEW.break_start, NEW.break_end, NEW.slot_duration_minutes) THEN
    RETURN NEW;
  END IF;

  UPDATE public.professional_settings ps
  SET pause_online_bookings = NEW.pause_online_bookings,
      monday = NEW.monday,
      tuesday = NEW.tuesday,
      wednesday = NEW.wednesday,
      thursday = NEW.thursday,
      friday = NEW.friday,
      saturday = NEW.saturday,
      sunday = NEW.sunday,
      start_time = NEW.start_time,
      end_time = NEW.end_time,
      weekly_schedule = NEW.weekly_schedule,
      break_start = NEW.break_start,
      break_end = NEW.break_end,
      slot_duration_minutes = NEW.slot_duration_minutes,
      updated_at = now()
  WHERE ps.professional_id = NEW.professional_id
    AND EXISTS (
      SELECT 1 FROM public.professionals p
      WHERE p.id = NEW.professional_id AND p.is_registered
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS professional_clinics_sync_primary_settings ON public.professional_clinics;
CREATE TRIGGER professional_clinics_sync_primary_settings
  AFTER INSERT OR UPDATE ON public.professional_clinics
  FOR EACH ROW EXECUTE FUNCTION public.professional_clinics_sync_primary_settings();

-- ---------------------------------------------------------------------------
-- 4) The location's primary sync keeps the address, and copies settings only for a
--    clinic that has no join row yet (still being set up).
-- ---------------------------------------------------------------------------
-- Same-timing triggers fire in name order, so doctor_locations_mirror_professional_clinics
-- runs before doctor_locations_sync_primary: a join row created by this very write
-- already exists here, and its own trigger has copied its settings.
CREATE OR REPLACE FUNCTION public.sync_primary_doctor_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_primary THEN
    UPDATE public.professionals
    SET
      district = CASE
        WHEN NEW.district IN (
          'Nicosia',
          'Limassol',
          'Paphos',
          'Larnaca',
          'Famagusta'
        ) THEN NEW.district::public.cyprus_district
        ELSE district
      END,
      clinic_address = NEW.clinic_address,
      town = NEW.town,
      latitude = NEW.latitude,
      longitude = NEW.longitude,
      clinic_place_id = NEW.clinic_place_id
    WHERE id = NEW.doctor_id;

    IF NOT EXISTS (SELECT 1 FROM public.professional_clinics pc WHERE pc.id = NEW.id) THEN
      UPDATE public.professional_settings
      SET
        pause_online_bookings = NEW.pause_online_bookings,
        monday = NEW.monday,
        tuesday = NEW.tuesday,
        wednesday = NEW.wednesday,
        thursday = NEW.thursday,
        friday = NEW.friday,
        saturday = NEW.saturday,
        sunday = NEW.sunday,
        start_time = NEW.start_time,
        end_time = NEW.end_time,
        weekly_schedule = NEW.weekly_schedule,
        break_start = NEW.break_start,
        break_end = NEW.break_end,
        slot_duration_minutes = NEW.slot_duration_minutes,
        updated_at = now()
      WHERE professional_id = NEW.doctor_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Triggers fire without the caller holding EXECUTE (proven in #200).
REVOKE EXECUTE ON FUNCTION public.mirror_location_to_professional_clinic(uuid, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.doctor_locations_mirror_to_professional_clinics()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.professional_clinics_sync_primary_settings()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_primary_doctor_location()
  FROM PUBLIC, anon, authenticated;

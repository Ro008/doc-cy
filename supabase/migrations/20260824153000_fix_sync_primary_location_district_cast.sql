-- doctor_locations.district is text; doctors.district is cyprus_district.
-- The sync trigger must cast, or every primary-location UPDATE fails.

CREATE OR REPLACE FUNCTION public.sync_primary_doctor_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_primary THEN
    UPDATE public.doctors
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

    UPDATE public.doctor_settings
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
    WHERE doctor_id = NEW.doctor_id;
  END IF;
  RETURN NEW;
END;
$$;

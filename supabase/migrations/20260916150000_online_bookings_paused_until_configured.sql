-- Online bookings must stay off until a professional deliberately turns them on.
--
-- Before this migration a freshly registered professional got a doctor_locations row
-- with pause_online_bookings = false (accepting) but NO doctor_settings row. The
-- settings page read the location row and showed "Accepting appointments", while the
-- public profile and finder require a doctor_settings row and therefore showed nothing.
-- Karina Miño (prod, registered 2026-09-08) sat in that state: panel said accepting,
-- patients saw no calendar.
--
-- Fix has three parts: pause new clinics by default, guarantee the settings row that
-- the booking API already hard-requires, and pause the clinics of professionals who
-- demonstrably never configured anything.

-- 1) New clinics start paused. Only affects rows created from here on.
ALTER TABLE public.doctor_locations
  ALTER COLUMN pause_online_bookings SET DEFAULT true;

ALTER TABLE public.doctor_settings
  ALTER COLUMN pause_online_bookings SET DEFAULT true;

-- 2) Pause clinics whose owner never configured anything: no settings row was ever
--    saved, the schedule is still the untouched registration default, and the row has
--    never been written to since creation (the pause toggle stamps updated_at, so a
--    professional who deliberately switched bookings on is excluded here).
UPDATE public.doctor_locations dl
SET pause_online_bookings = true,
    updated_at = now()
WHERE dl.pause_online_bookings = false
  AND dl.weekly_schedule IS NULL
  AND dl.created_at = dl.updated_at
  AND NOT EXISTS (
    SELECT 1 FROM public.doctor_settings ds WHERE ds.doctor_id = dl.doctor_id
  );

-- 3) Every registered professional gets a doctor_settings row, mirrored from their
--    primary clinic. Without it the booking API rejects with "Professional has not set
--    availability yet" even when the clinic row is perfectly valid.
INSERT INTO public.doctor_settings (
  doctor_id,
  monday, tuesday, wednesday, thursday, friday, saturday, sunday,
  start_time, end_time, weekly_schedule,
  break_start, break_end,
  slot_duration_minutes,
  pause_online_bookings
)
SELECT
  p.id,
  coalesce(dl.monday, true),
  coalesce(dl.tuesday, true),
  coalesce(dl.wednesday, true),
  coalesce(dl.thursday, true),
  coalesce(dl.friday, true),
  coalesce(dl.saturday, false),
  coalesce(dl.sunday, false),
  coalesce(dl.start_time, '09:00:00'::time),
  coalesce(dl.end_time, '17:00:00'::time),
  dl.weekly_schedule,
  dl.break_start,
  dl.break_end,
  coalesce(nullif(dl.slot_duration_minutes, 0), 30),
  coalesce(dl.pause_online_bookings, true)
FROM public.professionals p
LEFT JOIN LATERAL (
  SELECT *
  FROM public.doctor_locations d
  WHERE d.doctor_id = p.id
  ORDER BY d.is_primary DESC, d.sort_order ASC, d.created_at ASC
  LIMIT 1
) dl ON true
WHERE p.is_registered = true
  AND NOT EXISTS (
    SELECT 1 FROM public.doctor_settings ds WHERE ds.doctor_id = p.id
  )
ON CONFLICT (doctor_id) DO NOTHING;

-- 4) Keep the invariant going forward. Same function already backs both the
--    registration INSERT trigger and the directory-claim UPDATE trigger.
CREATE OR REPLACE FUNCTION public.create_primary_doctor_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT coalesce(NEW.is_registered, false) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.doctor_settings (doctor_id, pause_online_bookings)
  VALUES (NEW.id, true)
  ON CONFLICT (doctor_id) DO NOTHING;

  IF EXISTS (
    SELECT 1 FROM public.doctor_locations WHERE doctor_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.doctor_locations (
    doctor_id,
    is_primary,
    sort_order,
    district,
    clinic_address,
    town,
    latitude,
    longitude,
    clinic_place_id
  )
  VALUES (
    NEW.id,
    true,
    0,
    NEW.district,
    NEW.clinic_address,
    NEW.town,
    NEW.latitude,
    NEW.longitude,
    NEW.clinic_place_id
  );
  RETURN NEW;
END;
$$;

-- Registered-doctor workplaces: per-location address, schedule, and online-booking pause.
-- Appointments are tied to a location so finder calendars are independent.

CREATE TABLE IF NOT EXISTS public.doctor_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  label text,
  district text,
  clinic_address text,
  town text,
  latitude double precision,
  longitude double precision,
  clinic_place_id text,
  pause_online_bookings boolean NOT NULL DEFAULT false,
  monday boolean NOT NULL DEFAULT true,
  tuesday boolean NOT NULL DEFAULT true,
  wednesday boolean NOT NULL DEFAULT true,
  thursday boolean NOT NULL DEFAULT true,
  friday boolean NOT NULL DEFAULT true,
  saturday boolean NOT NULL DEFAULT false,
  sunday boolean NOT NULL DEFAULT false,
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '17:00',
  weekly_schedule jsonb,
  break_start time,
  break_end time,
  slot_duration_minutes integer NOT NULL DEFAULT 30
    CHECK (slot_duration_minutes > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.doctor_locations IS
  'Practice locations for a registered professional. Schedule and online-booking pause are per location.';

CREATE INDEX IF NOT EXISTS doctor_locations_doctor_id_idx
  ON public.doctor_locations (doctor_id);

CREATE UNIQUE INDEX IF NOT EXISTS doctor_locations_one_primary_idx
  ON public.doctor_locations (doctor_id)
  WHERE is_primary;

CREATE INDEX IF NOT EXISTS doctor_locations_district_idx
  ON public.doctor_locations (district)
  WHERE district IS NOT NULL;

-- One primary row per existing doctor, copied from doctors + doctor_settings.
INSERT INTO public.doctor_locations (
  doctor_id,
  is_primary,
  sort_order,
  district,
  clinic_address,
  town,
  latitude,
  longitude,
  clinic_place_id,
  pause_online_bookings,
  monday,
  tuesday,
  wednesday,
  thursday,
  friday,
  saturday,
  sunday,
  start_time,
  end_time,
  weekly_schedule,
  break_start,
  break_end,
  slot_duration_minutes
)
SELECT
  d.id,
  true,
  0,
  d.district,
  d.clinic_address,
  d.town,
  d.latitude,
  d.longitude,
  d.clinic_place_id,
  COALESCE(ds.pause_online_bookings, false),
  COALESCE(ds.monday, true),
  COALESCE(ds.tuesday, true),
  COALESCE(ds.wednesday, true),
  COALESCE(ds.thursday, true),
  COALESCE(ds.friday, true),
  COALESCE(ds.saturday, false),
  COALESCE(ds.sunday, false),
  COALESCE(ds.start_time, '09:00'::time),
  COALESCE(ds.end_time, '17:00'::time),
  ds.weekly_schedule,
  ds.break_start,
  ds.break_end,
  COALESCE(ds.slot_duration_minutes, 30)
FROM public.doctors d
LEFT JOIN public.doctor_settings ds ON ds.doctor_id = d.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.doctor_locations dl WHERE dl.doctor_id = d.id
);

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.doctor_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS appointments_location_id_idx
  ON public.appointments (location_id)
  WHERE location_id IS NOT NULL;

COMMENT ON COLUMN public.appointments.location_id IS
  'Workplace this visit belongs to. Independent from other locations of the same professional.';

UPDATE public.appointments a
SET location_id = dl.id
FROM public.doctor_locations dl
WHERE a.location_id IS NULL
  AND dl.doctor_id = a.doctor_id
  AND dl.is_primary;

-- Independent calendars: the same instant may be booked at two different workplaces.
DROP INDEX IF EXISTS public.appointments_doctor_datetime_active_booking_key;

CREATE UNIQUE INDEX IF NOT EXISTS appointments_location_datetime_active_booking_key
  ON public.appointments (location_id, appointment_datetime)
  WHERE status IN (
    'REQUESTED',
    'CONFIRMED'
  )
  AND location_id IS NOT NULL;

-- Legacy rows without a workplace still cannot double-book the professional.
CREATE UNIQUE INDEX IF NOT EXISTS appointments_doctor_datetime_active_booking_null_location_key
  ON public.appointments (doctor_id, appointment_datetime)
  WHERE status IN (
    'REQUESTED',
    'CONFIRMED'
  )
  AND location_id IS NULL;

COMMENT ON INDEX public.appointments_location_datetime_active_booking_key IS
  'Prevents two active bookings at the same instant for one workplace. Other workplaces of the same professional are independent.';

-- Keep doctors.* and doctor_settings schedule in sync with the primary workplace
-- so single-location code paths stay correct.
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

DROP TRIGGER IF EXISTS doctor_locations_sync_primary ON public.doctor_locations;
CREATE TRIGGER doctor_locations_sync_primary
  AFTER INSERT OR UPDATE ON public.doctor_locations
  FOR EACH ROW
  EXECUTE PROCEDURE public.sync_primary_doctor_location();

CREATE OR REPLACE FUNCTION public.create_primary_doctor_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

DROP TRIGGER IF EXISTS doctors_create_primary_location ON public.doctors;
CREATE TRIGGER doctors_create_primary_location
  AFTER INSERT ON public.doctors
  FOR EACH ROW
  EXECUTE PROCEDURE public.create_primary_doctor_location();

ALTER TABLE public.doctor_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS doctor_locations_select_public ON public.doctor_locations;
CREATE POLICY doctor_locations_select_public
  ON public.doctor_locations
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS doctor_locations_insert_owner ON public.doctor_locations;
CREATE POLICY doctor_locations_insert_owner
  ON public.doctor_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_doctor_owner(doctor_id));

DROP POLICY IF EXISTS doctor_locations_update_owner ON public.doctor_locations;
CREATE POLICY doctor_locations_update_owner
  ON public.doctor_locations
  FOR UPDATE
  TO authenticated
  USING (public.is_doctor_owner(doctor_id))
  WITH CHECK (public.is_doctor_owner(doctor_id));

DROP POLICY IF EXISTS doctor_locations_delete_owner ON public.doctor_locations;
CREATE POLICY doctor_locations_delete_owner
  ON public.doctor_locations
  FOR DELETE
  TO authenticated
  USING (public.is_doctor_owner(doctor_id) AND is_primary = false);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctor_locations TO authenticated;
GRANT SELECT ON public.doctor_locations TO anon;

-- Occupied slots can be scoped to one workplace (independent calendars).
DROP FUNCTION IF EXISTS public.public_doctor_occupied_datetimes(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.public_doctor_occupied_datetimes(uuid, timestamptz, timestamptz, uuid);

CREATE OR REPLACE FUNCTION public.public_doctor_occupied_datetimes(
  p_doctor_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_location_id uuid DEFAULT NULL
)
RETURNS TABLE (appointment_datetime timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT sub.appointment_datetime
  FROM (
    SELECT (a.appointment_datetime + (gs.n::text || ' minutes')::interval) AS appointment_datetime
    FROM public.appointments a
    INNER JOIN public.doctors d ON d.id = a.doctor_id
    LEFT JOIN public.doctor_settings ds ON ds.doctor_id = a.doctor_id
    LEFT JOIN public.doctor_locations dl ON dl.id = a.location_id
    CROSS JOIN LATERAL (
      SELECT
        GREATEST(COALESCE(dl.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS step_m,
        GREATEST(COALESCE(a.duration_minutes, dl.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS dur_m,
        GREATEST(COALESCE(dl.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS book_m
    ) AS meta
    CROSS JOIN LATERAL generate_series(
      0,
      ((meta.dur_m - 1) / meta.step_m) * meta.step_m,
      meta.step_m
    ) AS gs(n)
    WHERE a.doctor_id = p_doctor_id
      AND (p_location_id IS NULL OR a.location_id = p_location_id)
      AND d.status = 'verified'
      AND a.status IN (
        'REQUESTED',
        'CONFIRMED'
      )
      AND (a.appointment_datetime + (gs.n::text || ' minutes')::interval) >= p_from
      AND (a.appointment_datetime + (gs.n::text || ' minutes')::interval) <= p_to

    UNION ALL

    SELECT (ps.elem::timestamptz + (gs.n::text || ' minutes')::interval) AS appointment_datetime
    FROM public.appointments a
    INNER JOIN public.doctors d ON d.id = a.doctor_id
    LEFT JOIN public.doctor_settings ds ON ds.doctor_id = a.doctor_id
    LEFT JOIN public.doctor_locations dl ON dl.id = a.location_id
    CROSS JOIN LATERAL jsonb_array_elements_text(
      COALESCE(a.proposed_slots, '[]'::jsonb)
    ) AS ps(elem)
    CROSS JOIN LATERAL (
      SELECT
        GREATEST(COALESCE(dl.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS step_m,
        GREATEST(COALESCE(a.duration_minutes, dl.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS dur_m,
        GREATEST(COALESCE(dl.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS book_m
    ) AS meta
    CROSS JOIN LATERAL generate_series(
      0,
      ((meta.dur_m - 1) / meta.step_m) * meta.step_m,
      meta.step_m
    ) AS gs(n)
    WHERE a.doctor_id = p_doctor_id
      AND (p_location_id IS NULL OR a.location_id = p_location_id)
      AND d.status = 'verified'
      AND a.status = 'NEEDS_RESCHEDULE'
      AND a.proposal_expires_at IS NOT NULL
      AND a.proposal_expires_at > now()
      AND jsonb_array_length(COALESCE(a.proposed_slots, '[]'::jsonb)) > 0
      AND (ps.elem::timestamptz + (gs.n::text || ' minutes')::interval) >= p_from
      AND (ps.elem::timestamptz + (gs.n::text || ' minutes')::interval) <= p_to

    UNION ALL

    SELECT (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) AS appointment_datetime
    FROM public.appointments a
    INNER JOIN public.doctors d ON d.id = a.doctor_id
    LEFT JOIN public.doctor_settings ds ON ds.doctor_id = a.doctor_id
    LEFT JOIN public.doctor_locations dl ON dl.id = a.location_id
    CROSS JOIN LATERAL (
      SELECT
        GREATEST(COALESCE(dl.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS step_m,
        GREATEST(COALESCE(a.duration_minutes, dl.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS dur_m,
        GREATEST(COALESCE(dl.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS book_m
    ) AS meta
    CROSS JOIN LATERAL (
      SELECT
        a.appointment_datetime AS bs,
        a.appointment_datetime + (meta.dur_m::text || ' minutes')::interval AS be
    ) AS iv
    CROSS JOIN LATERAL generate_series(
      1,
      LEAST(
        2000,
        CEIL(
          (EXTRACT(EPOCH FROM (iv.be - iv.bs)) / 60.0) / NULLIF(meta.step_m, 0)
          + meta.book_m / NULLIF(meta.step_m, 0)
          + 5
        )::int
      )
    ) AS bk(k)
    WHERE a.doctor_id = p_doctor_id
      AND (p_location_id IS NULL OR a.location_id = p_location_id)
      AND d.status = 'verified'
      AND a.status IN (
        'REQUESTED',
        'CONFIRMED'
      )
      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval)
          + (meta.book_m::text || ' minutes')::interval > iv.bs
      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) < iv.be
      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) >= p_from
      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) <= p_to

    UNION ALL

    SELECT (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) AS appointment_datetime
    FROM public.appointments a
    INNER JOIN public.doctors d ON d.id = a.doctor_id
    LEFT JOIN public.doctor_settings ds ON ds.doctor_id = a.doctor_id
    LEFT JOIN public.doctor_locations dl ON dl.id = a.location_id
    CROSS JOIN LATERAL jsonb_array_elements_text(
      COALESCE(a.proposed_slots, '[]'::jsonb)
    ) AS ps(elem)
    CROSS JOIN LATERAL (
      SELECT
        GREATEST(COALESCE(dl.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS step_m,
        GREATEST(COALESCE(a.duration_minutes, dl.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS dur_m,
        GREATEST(COALESCE(dl.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS book_m
    ) AS meta
    CROSS JOIN LATERAL (
      SELECT
        ps.elem::timestamptz AS bs,
        ps.elem::timestamptz + (meta.dur_m::text || ' minutes')::interval AS be
    ) AS iv
    CROSS JOIN LATERAL generate_series(
      1,
      LEAST(
        2000,
        CEIL(
          (EXTRACT(EPOCH FROM (iv.be - iv.bs)) / 60.0) / NULLIF(meta.step_m, 0)
          + meta.book_m / NULLIF(meta.step_m, 0)
          + 5
        )::int
      )
    ) AS bk(k)
    WHERE a.doctor_id = p_doctor_id
      AND (p_location_id IS NULL OR a.location_id = p_location_id)
      AND d.status = 'verified'
      AND a.status = 'NEEDS_RESCHEDULE'
      AND a.proposal_expires_at IS NOT NULL
      AND a.proposal_expires_at > now()
      AND jsonb_array_length(COALESCE(a.proposed_slots, '[]'::jsonb)) > 0
      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval)
          + (meta.book_m::text || ' minutes')::interval > iv.bs
      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) < iv.be
      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) >= p_from
      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) <= p_to
  ) AS sub
$$;

REVOKE ALL ON FUNCTION public.public_doctor_occupied_datetimes(uuid, timestamptz, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_doctor_occupied_datetimes(uuid, timestamptz, timestamptz, uuid) TO anon, authenticated, service_role;

-- DocCy — Integration DB seed (Supabase "DocCy - Testing"; paste in SQL Editor)
-- Local CLI: also loaded from supabase/seed.sql after `supabase db reset`.
-- Safe to re-run: idempotent upserts.
--
-- Does:
--   1) appointments.duration_minutes (INTEGER, default 30) if missing
--   2) Auth user + doctor "Andreas Nikos Test" / slug andreas-nikos (verified, bookable test profile)
--   3) professional_settings Mon–Fri 09:00–17:00 linked by professional_id
--
-- Prerequisite: at least one row in auth.users (any signup) so instance_id exists;
--               if the project has zero users, register once in the Dashboard, then run this.

-- ─── 1) Appointments: duration_minutes ─────────────────────────────────────
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS duration_minutes integer;

UPDATE public.appointments
SET duration_minutes = 30
WHERE duration_minutes IS NULL;

ALTER TABLE public.appointments
  ALTER COLUMN duration_minutes SET DEFAULT 30;

-- Match app expectations when every row has a value (safe on fresh / seeded DBs)
DO $$
BEGIN
  ALTER TABLE public.appointments
    ALTER COLUMN duration_minutes SET NOT NULL;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'duration_minutes left nullable (resolve NULL rows and re-run this block if needed).';
END $$;

-- Optional: align with app constraint (ignore if it already exists or conflicts)
DO $$
BEGIN
  ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_duration_minutes_check
    CHECK (duration_minutes > 0 AND duration_minutes <= 480);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2–3) Seed auth (if needed), doctor, settings ───────────────────────────
DO $seed$
DECLARE
  v_slug text := 'andreas-nikos';
  v_email text := 'andreas-nikos.integration@doccy.testing';
  v_instance_id uuid;
  v_user_id uuid;
  v_doctor_id uuid;
  v_common jsonb := jsonb_build_object(
    'enabled', true,
    'start_time', '09:00:00',
    'end_time', '17:00:00'
  );
  v_weekly jsonb;
BEGIN
  SELECT instance_id
  INTO v_instance_id
  FROM auth.users
  LIMIT 1;

  IF v_instance_id IS NULL THEN
    RAISE EXCEPTION
      'auth.users is empty: create any user once in Authentication (Dashboard), then re-run this script.';
  END IF;

  v_weekly := jsonb_build_object(
    'monday', v_common,
    'tuesday', v_common,
    'wednesday', v_common,
    'thursday', v_common,
    'friday', v_common,
    'saturday', jsonb_build_object(
      'enabled', false,
      'start_time', '09:00:00',
      'end_time', '17:00:00'
    ),
    'sunday', jsonb_build_object(
      'enabled', false,
      'start_time', '09:00:00',
      'end_time', '17:00:00'
    )
  );

  SELECT id INTO v_doctor_id FROM public.professionals WHERE slug = v_slug LIMIT 1;

  IF v_doctor_id IS NULL THEN
    SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(v_email) LIMIT 1;

    IF v_user_id IS NULL THEN
      v_user_id := gen_random_uuid();

      -- The four token columns are written explicitly as '' rather than left to
      -- default NULL. GoTrue scans them into Go strings, so a NULL makes it return
      -- 500 for that user -- which also breaks auth.admin.listUsers for the whole
      -- project, and with it the integration cleanup, leaving orphaned users behind.
      -- Three seeded rows did exactly that and had to be repaired by hand.
      INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        confirmation_token,
        recovery_token,
        email_change,
        email_change_token_new,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at
      )
      VALUES (
        v_user_id,
        v_instance_id,
        'authenticated',
        'authenticated',
        v_email,
        extensions.crypt('doccy-integration-seed-not-for-login', extensions.gen_salt('bf')),
        now(),
        '',
        '',
        '',
        '',
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
        jsonb_build_object('role', 'doctor'),
        now(),
        now()
      );

      INSERT INTO auth.identities (
        id,
        user_id,
        provider_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
      )
      VALUES (
        gen_random_uuid(),
        v_user_id,
        v_user_id::text,
        jsonb_build_object(
          'sub', v_user_id::text,
          'email', v_email,
          'email_verified', true,
          'phone_verified', false
        ),
        'email',
        now(),
        now(),
        now()
      );
    END IF;

    INSERT INTO public.professionals (
      auth_user_id,
      name,
      email,
      phone,
      languages,
      license_file_url,
      status,
      slug,
      is_test_profile,
      subscription_tier,
      is_registered,
      has_online_booking,
      trial_notice_seen_at
    )
    VALUES (
      v_user_id,
      'Andreas Nikos Test',
      v_email,
      '+35799123456',
      ARRAY['English', 'Greek']::text[],
      'licenses/integration/andreas-nikos-seed.pdf',
      'verified',
      v_slug,
      true,
      'standard',
      -- professionals defaults is_registered and has_online_booking to false; the
      -- legacy doctors table this seed was written against had no such split.
      -- Without them the row reads as a scraped GeSY listing:
      -- create_primary_doctor_location() never fires, so there is no settings or
      -- location row, and the profile is not bookable -- the opposite of the
      -- "verified, bookable test profile" this file promises. trial_notice_seen_at
      -- skips the one-time welcome modal, which otherwise redirects /agenda.
      true,
      true,
      now()
    )
    RETURNING id INTO v_doctor_id;
  ELSE
    UPDATE public.professionals
    SET
      name = 'Andreas Nikos Test',
      status = 'verified',
      is_test_profile = true,
      is_registered = true,
      has_online_booking = true,
      trial_notice_seen_at = coalesce(trial_notice_seen_at, now()),
      email = coalesce(nullif(trim(email), ''), v_email),
      phone = coalesce(nullif(trim(phone), ''), '+35799123456'),
      languages = coalesce(languages, ARRAY['English', 'Greek']::text[])
    WHERE id = v_doctor_id;
  END IF;

  -- Specialties live only in professional_specialties (Point C3 dropped the
  -- professionals columns). Keep an existing approved row; add one otherwise.
  UPDATE public.professional_specialties
  SET is_approved = true
  WHERE professional_id = v_doctor_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.professional_specialties WHERE professional_id = v_doctor_id
  ) THEN
    INSERT INTO public.professional_specialties (professional_id, specialty, license_number, is_approved)
    VALUES (v_doctor_id, 'General Practice', 'INTEGRATION-SEED-LIC', true);
  END IF;

  INSERT INTO public.professional_settings (
    professional_id,
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
    pause_online_bookings,
    holiday_mode_enabled,
    holiday_start_date,
    holiday_end_date,
    booking_horizon_days,
    minimum_notice_hours,
    slot_duration_minutes,
    updated_at
  )
  VALUES (
    v_doctor_id,
    true,
    true,
    true,
    true,
    true,
    false,
    false,
    time '09:00',
    time '17:00',
    v_weekly,
    null,
    null,
    false,
    false,
    null,
    null,
    90,
    1,
    30,
    now()
  )
  ON CONFLICT (professional_id) DO UPDATE SET
    monday = excluded.monday,
    tuesday = excluded.tuesday,
    wednesday = excluded.wednesday,
    thursday = excluded.thursday,
    friday = excluded.friday,
    saturday = excluded.saturday,
    sunday = excluded.sunday,
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    weekly_schedule = excluded.weekly_schedule,
    break_start = excluded.break_start,
    break_end = excluded.break_end,
    pause_online_bookings = excluded.pause_online_bookings,
    holiday_mode_enabled = excluded.holiday_mode_enabled,
    holiday_start_date = excluded.holiday_start_date,
    holiday_end_date = excluded.holiday_end_date,
    booking_horizon_days = excluded.booking_horizon_days,
    minimum_notice_hours = excluded.minimum_notice_hours,
    slot_duration_minutes = excluded.slot_duration_minutes,
    updated_at = excluded.updated_at;

  RAISE NOTICE 'Integration seed OK: doctor_id=%, slug=%', v_doctor_id, v_slug;
END
$seed$;

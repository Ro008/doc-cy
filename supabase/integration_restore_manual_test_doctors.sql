-- DocCy - Integration: restore manual test doctors (idempotent)
-- Run in Supabase SQL Editor against the INTEGRATION project.
--
-- Creates/updates these profiles by slug using values copied from production:
--   - andreas-nikos
--   - ross-geller
--   - tasos-smith
--
-- Notes:
-- - Safe to re-run (upsert-like behavior by slug).
-- - Keeps existing professional_settings row when present; otherwise creates one.
-- - Auth seed password for restored doctors: demo1234

DO $seed$
DECLARE
  v_instance_id uuid;
  v_seed_password text := 'demo1234';
  rec record;
  v_user_id uuid;
  v_doctor_id uuid;
BEGIN
  SELECT instance_id
  INTO v_instance_id
  FROM auth.users
  LIMIT 1;

  IF v_instance_id IS NULL THEN
    RAISE EXCEPTION
      'auth.users is empty: create any user once in Authentication, then re-run this script.';
  END IF;

  FOR rec IN
    SELECT *
    FROM (
      VALUES
        (
          'andreas-nikos',
          'Andreas Nikos test',
          'rociosirvent+doccydemo@gmail.com',
          'Dentistry',
          '+34667082906',
          'founder',
          ARRAY['Greek', 'English', 'Spanish']::text[]
        ),
        (
          'ross-geller',
          'Ross Geller test',
          'liviolanzo@gmail.com',
          'Pediatrics',
          '+34 667 082 906',
          'founder',
          ARRAY['Greek', 'English', 'Turkish']::text[]
        ),
        (
          'tasos-smith',
          'Tasos Smith test',
          'rociosirvent+544@gmail.com',
          'Dentistry',
          null,
          'founder',
          ARRAY['English', 'Greek']::text[]
        )
    ) AS t(slug, full_name, email, specialty, phone, tier, langs)
  LOOP
    v_user_id := NULL;
    v_doctor_id := NULL;

    SELECT id INTO v_doctor_id
    FROM public.professionals
    WHERE slug = rec.slug
    LIMIT 1;

    IF v_doctor_id IS NULL THEN
      SELECT id INTO v_user_id
      FROM auth.users
      WHERE lower(email) = lower(rec.email)
      LIMIT 1;

      IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();

        -- The four token columns are written explicitly as '' rather than left to
        -- default NULL. GoTrue scans them into Go strings, so a NULL makes it return
        -- 500 for that user -- which also breaks auth.admin.listUsers for the whole
        -- project, and with it the integration cleanup, leaving orphaned users behind.
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
          rec.email,
          extensions.crypt(v_seed_password, extensions.gen_salt('bf')),
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
            'email', rec.email,
            'email_verified', true,
            'phone_verified', false
          ),
          'email',
          now(),
          now(),
          now()
        );
      END IF;

      -- Keep password deterministic across re-runs for integration manual test accounts.
      UPDATE auth.users
      SET
        encrypted_password = extensions.crypt(v_seed_password, extensions.gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
      WHERE id = v_user_id;

      INSERT INTO public.professionals (
        auth_user_id,
        name,
        email,
        languages,
        slug,
        is_test_profile,
        subscription_tier,
        is_registered,
        pro_access_until,
        trial_notice_seen_at
      )
      VALUES (
        v_user_id,
        rec.full_name,
        rec.email,
        coalesce(rec.langs, ARRAY[]::text[]),
        rec.slug,
        false,
        rec.tier,
        -- professionals defaults is_registered to false and pro_access_until to null; the
        -- legacy doctors table this seed was written against had no such split.
        -- Without them the row reads as a scraped GeSY listing:
        -- create_professional_settings_on_registration() never fires, so there is no
        -- settings row, and the profile is not bookable -- the opposite of the
        -- "verified, bookable test profile" this file promises. trial_notice_seen_at
        -- skips the one-time welcome modal, which otherwise redirects /agenda.
        true,
        now() + interval '6 months',
        now()
      )
      RETURNING id INTO v_doctor_id;
    ELSE
      UPDATE public.professionals
      SET
        is_registered = true,
        pro_access_until = coalesce(pro_access_until, now() + interval '6 months'),
        trial_notice_seen_at = coalesce(trial_notice_seen_at, now()),
        name = rec.full_name,
        subscription_tier = rec.tier,
        email = rec.email,
        languages = coalesce(rec.langs, ARRAY[]::text[]),
        is_test_profile = false
      WHERE id = v_doctor_id;
    END IF;

    -- Specialties live only in professional_specialties (Point C3 dropped the
    -- professionals columns). Restore resets the doctor to exactly one seed row.
    DELETE FROM public.professional_specialties
    WHERE professional_id = v_doctor_id;

    INSERT INTO public.professional_specialties (professional_id, specialty, license_number)
    VALUES (v_doctor_id, rec.specialty, upper(rec.slug) || '-SEED-LIC');

    -- Account settings only: the schedule and the pause live on the clinic link (Point E6).
    INSERT INTO public.professional_settings (
      professional_id,
      holiday_mode_enabled,
      holiday_start_date,
      holiday_end_date,
      booking_horizon_days,
      minimum_notice_hours,
      updated_at
    )
    VALUES (v_doctor_id, false, null, null, 90, 1, now())
    ON CONFLICT (professional_id) DO UPDATE SET
      holiday_mode_enabled = excluded.holiday_mode_enabled,
      holiday_start_date = excluded.holiday_start_date,
      holiday_end_date = excluded.holiday_end_date,
      booking_horizon_days = excluded.booking_horizon_days,
      minimum_notice_hours = excluded.minimum_notice_hours,
      updated_at = excluded.updated_at;

    RAISE NOTICE 'Restored manual test doctor: % (%), tier=%', rec.full_name, rec.slug, rec.tier;
  END LOOP;
END
$seed$;

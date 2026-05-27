-- Repair a broken Supabase Auth user by email (run in SQL Editor).
-- Use on the project that matches where you log in (testing vs production).
--
-- Example (Kasia):
--   v_email := lower('rociosirvent+kasiadoctor@gmail.com');
--   v_doctor_slug := 'kasia-petrova';
--
-- After this script succeeds, recreate the user with Admin API (recommended):
--   node scripts/repair-doctor-auth.mjs --slug kasia-petrova --password "YourNewPass123"
-- Or set password in Supabase Dashboard → Authentication → Users.

DO $$
DECLARE
  v_email text := lower('rociosirvent+kasiadoctor@gmail.com');
  v_doctor_slug text := 'kasia-petrova';
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid
  FROM auth.users
  WHERE lower(email) = v_email
  LIMIT 1;

  IF v_doctor_slug IS NOT NULL AND length(trim(v_doctor_slug)) > 0 THEN
    UPDATE public.doctors
    SET auth_user_id = NULL
    WHERE slug = v_doctor_slug OR lower(email) = v_email;
  END IF;

  IF v_uid IS NOT NULL THEN
    IF to_regclass('auth.sessions') IS NOT NULL THEN
      DELETE FROM auth.sessions WHERE user_id::text = v_uid::text;
    END IF;

    IF to_regclass('auth.refresh_tokens') IS NOT NULL THEN
      DELETE FROM auth.refresh_tokens WHERE user_id::text = v_uid::text;
    END IF;

    IF to_regclass('auth.mfa_factors') IS NOT NULL THEN
      DELETE FROM auth.mfa_factors WHERE user_id::text = v_uid::text;
    END IF;

    DELETE FROM auth.identities WHERE user_id::text = v_uid::text;
    DELETE FROM auth.users WHERE id = v_uid;
  END IF;

  DELETE FROM auth.identities
  WHERE lower(coalesce(identity_data->>'email', '')) = v_email;
END $$;

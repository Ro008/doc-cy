-- Database test for Point E6 (migration *_drop_professional_settings_schedule_copies).
--
-- A professional's schedule (days, hours, break, slot length, pause) lives on each clinic
-- link (professional_clinics); professional_settings keeps the account-level settings.
--
-- Run against TESTING only (Supabase SQL editor or the MCP execute_sql tool).
-- Everything runs in one transaction that ALWAYS rolls back: the final error message is
-- the result. "ALL professional_settings_schedule_copies TESTS PASSED (…)" means success;
-- any "FAIL: …" names the broken rule. Nothing is left behind.

do $test$
declare
  v_checks int := 0;
  v_names text;
  v_login uuid := gen_random_uuid();
  v_pro uuid;
  v_clinic uuid;
  v_start timestamptz := date_trunc('hour', now()) + interval '400 days';
  v_slots timestamptz[];
begin
  -- 1. The schedule copies are gone; the account settings stay.
  select string_agg(column_name, ', ' order by column_name) into v_names
  from information_schema.columns
  where table_schema = 'public' and table_name = 'professional_settings'
    and column_name in ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
                        'sunday', 'start_time', 'end_time', 'break_start', 'break_end',
                        'slot_duration_minutes', 'weekly_schedule', 'pause_online_bookings');
  if v_names is not null then
    raise exception 'FAIL: professional_settings still has %', v_names;
  end if;
  select string_agg(c, ', ') into v_names
  from unnest(array['professional_id', 'holiday_mode_enabled', 'holiday_start_date',
                    'holiday_end_date', 'booking_horizon_days', 'minimum_notice_hours']) c
  where not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'professional_settings'
                      and column_name = c);
  if v_names is not null then
    raise exception 'FAIL: professional_settings lost %', v_names;
  end if;
  v_checks := v_checks + 1;

  -- 2. The schedule stays on the clinic link.
  select string_agg(c, ', ') into v_names
  from unnest(array['monday', 'sunday', 'start_time', 'end_time', 'break_start', 'break_end',
                    'slot_duration_minutes', 'weekly_schedule', 'pause_online_bookings']) c
  where not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'professional_clinics'
                      and column_name = c);
  if v_names is not null then
    raise exception 'FAIL: professional_clinics lost %', v_names;
  end if;
  v_checks := v_checks + 1;

  -- 3. The copy trigger, its function and the slot-length check are gone.
  if exists (select 1 from pg_trigger where tgname = 'professional_clinics_sync_primary_settings')
     or to_regprocedure('public.professional_clinics_sync_primary_settings()') is not null
     or exists (select 1 from pg_constraint
                where conname = 'professional_settings_slot_duration_minutes_check') then
    raise exception 'FAIL: the primary-settings sync trigger, function or slot check still exists';
  end if;
  v_checks := v_checks + 1;

  -- 4. No public function reads professional_settings' slot length (alias ds).
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public'
               and p.prosrc ~ 'professional_settings\s+ds\M') then
    raise exception 'FAIL: a public function still joins professional_settings as ds';
  end if;
  v_checks := v_checks + 1;

  -- 5. Registering still creates the account settings row.
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (v_login, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'e6-' || v_login || '@integration.test', now(), now(), now());
  insert into public.professionals (name, slug, is_registered, is_test_profile, auth_user_id, status)
  values ('E6 Test', 'e6-test-' || substr(v_login::text, 1, 8), true, true, v_login, 'verified')
  returning id into v_pro;
  if not exists (select 1 from public.professional_settings where professional_id = v_pro) then
    raise exception 'FAIL: registering did not create professional_settings';
  end if;
  v_checks := v_checks + 1;

  -- 6. An appointment with no clinic uses the primary clinic's slot length (45 min):
  --    a 90-minute visit occupies start and start+45, never start+30.
  insert into public.clinics (name, slug, district, address)
  values ('E6 Clinic', 'e6-clinic-' || substr(v_login::text, 1, 8), 'Nicosia', '1 Test St')
  returning id into v_clinic;
  insert into public.professional_clinics (professional_id, clinic_id, is_primary, slot_duration_minutes)
  values (v_pro, v_clinic, true, 45);
  insert into public.appointments (professional_id, patient_name, patient_phone, appointment_datetime,
                                   status, duration_minutes, location_id)
  values (v_pro, 'E6 Patient', '+35799000000', v_start, 'REQUESTED', 90, null);

  select array_agg(o.appointment_datetime order by o.appointment_datetime) into v_slots
  from public.public_professionals_occupied_datetimes(array[v_pro], v_start - interval '1 day', v_start + interval '1 day') o;
  if v_slots is distinct from array[v_start, v_start + interval '45 minutes'] then
    raise exception 'FAIL: occupied slots for a clinic-less 90-minute visit were %', v_slots;
  end if;
  v_checks := v_checks + 1;

  raise exception 'ALL professional_settings_schedule_copies TESTS PASSED (% checks)', v_checks;
end
$test$;

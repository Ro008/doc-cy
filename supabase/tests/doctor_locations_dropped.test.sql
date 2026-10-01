-- Database tests for D4 step 2 (migration *_drop_doctor_locations).
--
-- Run against TESTING only (Supabase SQL editor or the MCP execute_sql tool).
-- Everything runs in one transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL doctor_locations_dropped TESTS PASSED (…)" means success;
-- any "FAIL: …" names the broken rule. Nothing is left behind.

do $test$
declare
  v_checks int := 0;
  v_name text;
  v_u uuid;
  v_pro uuid;
  v_paused boolean;
begin
  -- 1. The table is gone (and with it the anon-readable doctor_locations_select_public).
  if to_regclass('public.doctor_locations') is not null then
    raise exception 'FAIL: public.doctor_locations still exists';
  end if;
  v_checks := v_checks + 1;

  -- 2. Its functions are gone.
  foreach v_name in array array[
    'create_primary_doctor_location', 'sync_primary_doctor_location',
    'doctor_locations_mirror_to_professional_clinics', 'mirror_location_to_professional_clinic',
    'create_clinic_for_professional_location'
  ] loop
    if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = v_name) then
      raise exception 'FAIL: function % still exists', v_name;
    end if;
  end loop;
  v_checks := v_checks + 1;

  -- 3. The old registration triggers on professionals are gone.
  if exists (select 1 from pg_trigger
             where tgname in ('professionals_create_primary_location', 'professionals_create_primary_location_on_claim')) then
    raise exception 'FAIL: the professionals_create_primary_location triggers still exist';
  end if;
  v_checks := v_checks + 1;

  -- 4. Nothing in public still names the table or the approval GUC.
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public'
               and (p.prosrc ilike '%doctor_locations%' or p.prosrc ilike '%doccy.registration_approval%')) then
    raise exception 'FAIL: a public function still mentions doctor_locations or doccy.registration_approval';
  end if;
  v_checks := v_checks + 1;

  -- 5. The settings part survives as its own trigger function: definer, fixed search_path,
  --    not callable by anon or authenticated.
  if to_regprocedure('public.create_professional_settings_on_registration()') is null then
    raise exception 'FAIL: create_professional_settings_on_registration() is missing';
  end if;
  if not (select p.prosecdef and p.proconfig is not null
          from pg_proc p where p.oid = 'public.create_professional_settings_on_registration()'::regprocedure) then
    raise exception 'FAIL: create_professional_settings_on_registration() should be SECURITY DEFINER with a search_path';
  end if;
  if has_function_privilege('anon', 'public.create_professional_settings_on_registration()', 'execute')
     or has_function_privilege('authenticated', 'public.create_professional_settings_on_registration()', 'execute') then
    raise exception 'FAIL: anon/authenticated must not execute create_professional_settings_on_registration()';
  end if;
  if (select count(*) from pg_trigger
      where tgrelid = 'public.professionals'::regclass
        and tgname in ('professionals_create_settings', 'professionals_create_settings_on_claim')
        and tgfoid = 'public.create_professional_settings_on_registration()'::regprocedure) <> 2 then
    raise exception 'FAIL: professionals_create_settings(+_on_claim) should call create_professional_settings_on_registration()';
  end if;
  v_checks := v_checks + 1;

  -- 6. A registered professional inserted directly gets paused settings.
  v_u := gen_random_uuid();
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'd4-drop-' || v_u || '@integration.test', now(), now());
  insert into public.professionals (auth_user_id, name, slug, is_registered, status, is_test_profile)
  values (v_u, 'D4 Drop Registered', 'd4-drop-reg-' || v_u, true, 'verified', true)
  returning id into v_pro;
  select pause_online_bookings into v_paused from public.professional_settings where professional_id = v_pro;
  if v_paused is distinct from true then
    raise exception 'FAIL: a new registered professional should get paused settings, got %', v_paused;
  end if;
  v_checks := v_checks + 1;

  -- 7. A listing (not registered) gets none; claiming it (is_registered -> true) does.
  insert into public.professionals (name, slug, is_registered, is_test_profile)
  values ('D4 Drop Listing', 'd4-drop-listing-' || v_u, false, true)
  returning id into v_pro;
  if exists (select 1 from public.professional_settings where professional_id = v_pro) then
    raise exception 'FAIL: a listing should not get settings';
  end if;
  v_u := gen_random_uuid();
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'd4-drop-claim-' || v_u || '@integration.test', now(), now());
  update public.professionals set is_registered = true, auth_user_id = v_u, status = 'verified' where id = v_pro;
  select pause_online_bookings into v_paused from public.professional_settings where professional_id = v_pro;
  if v_paused is distinct from true then
    raise exception 'FAIL: claiming a listing should create paused settings, got %', v_paused;
  end if;
  v_checks := v_checks + 1;

  -- 8. Existing settings are never overwritten (a listing that already has open settings
  --    keeps them when it is claimed).
  insert into public.professionals (name, slug, is_registered, is_test_profile)
  values ('D4 Drop Listing Two', 'd4-drop-listing2-' || v_u, false, true)
  returning id into v_pro;
  insert into public.professional_settings (professional_id, pause_online_bookings) values (v_pro, false);
  v_u := gen_random_uuid();
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'd4-drop-claim2-' || v_u || '@integration.test', now(), now());
  update public.professionals set is_registered = true, auth_user_id = v_u, status = 'verified' where id = v_pro;
  select pause_online_bookings into v_paused from public.professional_settings where professional_id = v_pro;
  if v_paused is distinct from false then
    raise exception 'FAIL: existing settings must be kept, got pause=%', v_paused;
  end if;
  v_checks := v_checks + 1;

  raise exception 'ALL doctor_locations_dropped TESTS PASSED (% checks)', v_checks;
end
$test$;

-- Database tests for pro_access_until and app_settings
-- (migration *_pro_access_until_and_app_settings).
--
-- Run against TESTING only (Supabase SQL editor or the MCP execute_sql tool).
-- Everything runs in one transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL pro_access TESTS PASSED (…)" means success; any
-- "FAIL: …" names the broken rule. Nothing is left behind.

create or replace function pg_temp.expect_error(p_sql text, p_state text, p_label text)
returns void
language plpgsql
as $f$
begin
  execute p_sql;
  raise exception 'FAIL: % (expected SQLSTATE %, but it succeeded)', p_label, p_state;
exception
  when others then
    if sqlerrm like 'FAIL:%' then
      raise;
    end if;
    if sqlstate <> p_state then
      raise exception 'FAIL: % (expected SQLSTATE %, got %: %)', p_label, p_state, sqlstate, sqlerrm;
    end if;
end
$f$;

create or replace function pg_temp.new_login()
returns uuid
language plpgsql
as $f$
declare
  v_u uuid := gen_random_uuid();
begin
  -- Registered professionals need a login (professionals_registered_requires_auth).
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'pro-access-' || v_u || '@integration.test', now(), now());
  return v_u;
end
$f$;

do $test$
declare
  v_checks int := 0;
  v_months int;
  v_pro uuid;
  v_until timestamptz;
  v_expected timestamptz;
  v_tag text := 'pro-access-' || substr(md5(random()::text), 1, 8);
begin
  -- 1. The setting exists and defaults to six months.
  select (value #>> '{}')::int into v_months from public.app_settings where key = 'trial_months';
  if v_months is distinct from 6 then
    raise exception 'FAIL: trial_months should default to 6, got %', v_months;
  end if;
  v_checks := v_checks + 1;

  -- 2. Only whole months from 0 to 24 are accepted.
  perform pg_temp.expect_error(
    $$update public.app_settings set value = '25' where key = 'trial_months'$$, '23514', 'trial_months 25');
  perform pg_temp.expect_error(
    $$update public.app_settings set value = '-1' where key = 'trial_months'$$, '23514', 'trial_months -1');
  perform pg_temp.expect_error(
    $$update public.app_settings set value = '1.5' where key = 'trial_months'$$, '23514', 'trial_months 1.5');
  perform pg_temp.expect_error(
    $$update public.app_settings set value = '"six"' where key = 'trial_months'$$, '23514', 'trial_months text');
  v_checks := v_checks + 4;

  -- 3. Service role only: anon and authenticated can neither read nor write it.
  if has_table_privilege('anon', 'public.app_settings', 'SELECT')
     or has_table_privilege('authenticated', 'public.app_settings', 'SELECT')
     or has_table_privilege('anon', 'public.app_settings', 'UPDATE')
     or has_table_privilege('authenticated', 'public.app_settings', 'UPDATE') then
    raise exception 'FAIL: anon/authenticated must have no privileges on app_settings';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.app_settings'::regclass) then
    raise exception 'FAIL: app_settings must have RLS enabled';
  end if;
  if has_function_privilege('anon', 'public.professionals_default_pro_access_until()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.professionals_default_pro_access_until()', 'EXECUTE') then
    raise exception 'FAIL: the trigger function must not be callable by anon/authenticated';
  end if;
  v_checks := v_checks + 3;

  -- 4. A new registered professional with online booking gets now + trial months
  --    on the Cyprus calendar.
  insert into public.professionals (auth_user_id, name, slug, is_registered, has_online_booking, status, is_test_profile)
  values (pg_temp.new_login(), 'Pro Access ' || v_tag, v_tag || '-a', true, true, 'verified', true)
  returning id, pro_access_until into v_pro, v_until;
  v_expected := ((now() at time zone 'Asia/Nicosia') + make_interval(months => 6)) at time zone 'Asia/Nicosia';
  if v_until is distinct from v_expected then
    raise exception 'FAIL: expected pro_access_until %, got %', v_expected, v_until;
  end if;
  v_checks := v_checks + 1;

  -- 5. An explicit date is kept (the registration approval will set its own).
  insert into public.professionals (auth_user_id, name, slug, is_registered, has_online_booking, status, is_test_profile, pro_access_until)
  values (pg_temp.new_login(), 'Pro Access ' || v_tag, v_tag || '-b', true, true, 'verified', true, '2030-01-01T00:00:00Z')
  returning pro_access_until into v_until;
  if v_until is distinct from '2030-01-01T00:00:00Z'::timestamptz then
    raise exception 'FAIL: an explicit pro_access_until must be kept, got %', v_until;
  end if;
  v_checks := v_checks + 1;

  -- 6. Listings and professionals without online booking get nothing.
  insert into public.professionals (name, slug, is_registered, has_online_booking, is_test_profile)
  values ('Pro Access ' || v_tag, v_tag || '-c', false, false, true)
  returning pro_access_until into v_until;
  if v_until is not null then
    raise exception 'FAIL: a listing must not get pro access, got %', v_until;
  end if;
  insert into public.professionals (auth_user_id, name, slug, is_registered, has_online_booking, status, is_test_profile)
  values (pg_temp.new_login(), 'Pro Access ' || v_tag, v_tag || '-d', true, false, 'verified', true)
  returning pro_access_until into v_until;
  if v_until is not null then
    raise exception 'FAIL: no online booking must mean no pro access, got %', v_until;
  end if;
  v_checks := v_checks + 2;

  -- 7. No trial (0 months) means no access.
  update public.app_settings set value = '0' where key = 'trial_months';
  insert into public.professionals (auth_user_id, name, slug, is_registered, has_online_booking, status, is_test_profile)
  values (pg_temp.new_login(), 'Pro Access ' || v_tag, v_tag || '-e', true, true, 'verified', true)
  returning pro_access_until into v_until;
  if v_until is not null then
    raise exception 'FAIL: 0 trial months must give no access, got %', v_until;
  end if;
  v_checks := v_checks + 1;

  -- 8. Only inserts are touched: an update leaves the date alone.
  update public.professionals set pro_access_until = null where id = v_pro;
  update public.professionals set name = name || ' (edited)' where id = v_pro;
  select pro_access_until into v_until from public.professionals where id = v_pro;
  if v_until is not null then
    raise exception 'FAIL: an update must not set pro_access_until, got %', v_until;
  end if;
  v_checks := v_checks + 1;

  raise exception 'ALL pro_access TESTS PASSED (% checks)', v_checks;
end
$test$;

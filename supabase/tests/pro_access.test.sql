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

do $test$
declare
  v_checks int := 0;
  v_months int;
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
  v_checks := v_checks + 2;

  -- (The transitional default trigger that set pro_access_until on insert was dropped
  --  in *_remove_old_registration_path: approvals set it themselves, see
  --  request_approval.test.sql. old_registration_path_removed.test.sql checks it's gone.)

  raise exception 'ALL pro_access TESTS PASSED (% checks)', v_checks;
end
$test$;

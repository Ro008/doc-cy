-- Database tests for app_settings.public_default_scheme
-- (migration *_app_settings_public_default_scheme).
--
-- The public site opens in this mode for a visitor who has not picked Light or Dark
-- (user, 2026-10-15). Founders change it in the internal dashboard; only "light" or
-- "dark" (a JSON string) is accepted.
--
-- Run against TESTING only. One transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL app_settings_public_default_scheme TESTS PASSED" means
-- success; any "FAIL: …" names the broken rule.

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
  v_value jsonb;
begin
  select value into v_value from public.app_settings where key = 'public_default_scheme';
  if v_value is distinct from '"light"'::jsonb then
    raise exception 'FAIL: the row exists and starts as "light" (got %)', v_value;
  end if;

  update public.app_settings set value = '"dark"' where key = 'public_default_scheme';
  update public.app_settings set value = '"light"' where key = 'public_default_scheme';

  perform pg_temp.expect_error(
    $$update public.app_settings set value = '"auto"' where key = 'public_default_scheme'$$,
    '23514', 'refuses a mode other than light or dark');
  perform pg_temp.expect_error(
    $$update public.app_settings set value = '"Dark"' where key = 'public_default_scheme'$$,
    '23514', 'refuses a different spelling');
  perform pg_temp.expect_error(
    $$update public.app_settings set value = '1' where key = 'public_default_scheme'$$,
    '23514', 'refuses a number');
  perform pg_temp.expect_error(
    $$update public.app_settings set value = '{"scheme":"dark"}' where key = 'public_default_scheme'$$,
    '23514', 'refuses an object');

  -- The trial length keeps its own rule.
  perform pg_temp.expect_error(
    $$update public.app_settings set value = '"dark"' where key = 'trial_months'$$,
    '23514', 'trial_months still takes months only');

  -- Service role only, like the rest of app_settings.
  if has_table_privilege('anon', 'public.app_settings', 'select')
     or has_table_privilege('authenticated', 'public.app_settings', 'select') then
    raise exception 'FAIL: app_settings stays private to the service role';
  end if;

  raise exception 'ALL app_settings_public_default_scheme TESTS PASSED';
end
$test$;

-- Database tests for the professional's personal mobile and its visibility switch
-- (migration *_professional_mobile_change_requests).
--
-- Settings → Account (user, 2026-10-09): the professional changes her own mobile
-- and decides whether it shows on her public profile. Neither needs a founder:
-- each change is a request_log row born "recorded", with the old value in
-- before_snapshot. The change and its record happen together or not at all.
--
-- Run against TESTING only (Supabase SQL editor or the MCP execute_sql tool).
-- Everything runs in one transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL professional_mobile TESTS PASSED (…)" means success;
-- any "FAIL: …" names the broken rule. Nothing is left behind (request_log rows
-- can never be deleted, so tests must not commit any).

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

-- A signed-up professional (registered needs a login).
create or replace function pg_temp.new_registered(p_tag text, p_mobile text)
returns uuid
language plpgsql
as $f$
declare
  v_u uuid := gen_random_uuid();
  v_id uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'mob-' || p_tag || '@integration.test', now(), now(), now());
  insert into public.professionals (
    name, slug, is_registered, auth_user_id, email, registration_email, mobile_number
  )
  values (
    'Mobile ' || p_tag, 'mobile-test-' || p_tag, true, v_u,
    'scraped-' || p_tag || '@integration.test', 'mob-' || p_tag || '@integration.test', p_mobile
  )
  returning id into v_id;
  return v_id;
end
$f$;

do $test$
declare
  v_pro uuid;
  v_pro2 uuid;
  v_listing uuid;
  v_req uuid;
  v_row public.request_log%rowtype;
  v_count int;
  v_checks int := 0;
begin
  ---------------------------------------------------------------- fixtures
  v_pro := pg_temp.new_registered('a', '+35799000101');
  v_pro2 := pg_temp.new_registered('b', '+35799000102');
  insert into public.professionals (name, slug, is_registered)
  values ('Mobile listing', 'mobile-test-listing', false)
  returning id into v_listing;

  ---------------------------------------------------------------- request types
  select count(*) into v_count from public.request_types
  where name in ('professional_mobile_change', 'professional_mobile_visibility_change')
    and requires_approval = false and is_edit = true;
  assert v_count = 2, 'FAIL: both request types exist, recorded at once, as edits';
  v_checks := v_checks + 1;

  ---------------------------------------------------------------- the switch column
  assert (select show_mobile_on_profile from public.professional_settings where professional_id = v_pro) = false,
    'FAIL: the mobile is hidden by default';
  perform pg_temp.expect_error(
    format('update public.professional_settings set show_mobile_on_profile = null where professional_id = %L', v_pro),
    '23502', 'the switch is never null');
  v_checks := v_checks + 2;

  ---------------------------------------------------------------- mobile change
  v_req := public.professional_mobile_set(v_pro, '+35799000111');
  select * into v_row from public.request_log where id = v_req;
  assert v_row.request_type = 'professional_mobile_change' and v_row.status = 'recorded'
    and v_row.decided_at = v_row.created_at and v_row.decided_by is null,
    'FAIL: a mobile change is recorded at once, with no founder';
  assert v_row.before_snapshot = '{"mobile_number": "+35799000101"}'::jsonb,
    'FAIL: the record keeps the old mobile';
  assert v_row.details = '{"mobile_number": "+35799000111"}'::jsonb,
    'FAIL: the record keeps the new mobile';
  assert v_row.professional_id = v_pro and v_row.requester_email = 'mob-a@integration.test',
    'FAIL: the requester email is her sign-up email, not the scraped one';
  assert (select mobile_number from public.professionals where id = v_pro) = '+35799000111',
    'FAIL: the new mobile is saved';
  v_checks := v_checks + 5;

  -- The same number again changes nothing and records nothing.
  select count(*) into v_count from public.request_log where professional_id = v_pro;
  assert public.professional_mobile_set(v_pro, '+35799000111') is null,
    'FAIL: the same mobile returns no request';
  assert (select count(*) from public.request_log where professional_id = v_pro) = v_count,
    'FAIL: the same mobile is not recorded';
  v_checks := v_checks + 2;

  -- Format: + and 8 to 15 digits, no leading zero; never empty.
  perform pg_temp.expect_error(format('select public.professional_mobile_set(%L, %L)', v_pro, '99000111'),
    '22023', 'a mobile without + is refused');
  perform pg_temp.expect_error(format('select public.professional_mobile_set(%L, %L)', v_pro, '+357 99 000111'),
    '22023', 'a mobile with spaces is refused (the app normalizes first)');
  perform pg_temp.expect_error(format('select public.professional_mobile_set(%L, %L)', v_pro, '+0123456789'),
    '22023', 'a mobile with a leading zero is refused');
  perform pg_temp.expect_error(format('select public.professional_mobile_set(%L, %L)', v_pro, '+1234567'),
    '22023', 'a mobile that is too short is refused');
  perform pg_temp.expect_error(format('select public.professional_mobile_set(%L, null)', v_pro),
    '22023', 'an empty mobile is refused');
  v_checks := v_checks + 5;

  -- Another professional's mobile: refused, and nothing is recorded.
  select count(*) into v_count from public.request_log where professional_id = v_pro2;
  perform pg_temp.expect_error(format('select public.professional_mobile_set(%L, %L)', v_pro2, '+35799000111'),
    '23505', 'a mobile in use by someone else is refused');
  assert (select count(*) from public.request_log where professional_id = v_pro2) = v_count
    and (select mobile_number from public.professionals where id = v_pro2) = '+35799000102',
    'FAIL: a refused change leaves no record and no change';
  v_checks := v_checks + 2;

  -- Only signed-up professionals.
  perform pg_temp.expect_error(format('select public.professional_mobile_set(%L, %L)', v_listing, '+35799000121'),
    '22023', 'a listing is not a signed-up professional');
  perform pg_temp.expect_error(format('select public.professional_mobile_set(%L, %L)', gen_random_uuid(), '+35799000122'),
    'P0002', 'an unknown professional is refused');
  v_checks := v_checks + 2;

  ---------------------------------------------------------------- visibility switch
  v_req := public.professional_mobile_visibility_set(v_pro, true);
  select * into v_row from public.request_log where id = v_req;
  assert v_row.request_type = 'professional_mobile_visibility_change' and v_row.status = 'recorded',
    'FAIL: turning the switch on is recorded at once';
  assert v_row.before_snapshot = '{"show_mobile_on_profile": false}'::jsonb
    and v_row.details = '{"show_mobile_on_profile": true}'::jsonb,
    'FAIL: the record keeps the old and new switch';
  assert (select show_mobile_on_profile from public.professional_settings where professional_id = v_pro),
    'FAIL: the switch is saved';
  v_checks := v_checks + 3;

  assert public.professional_mobile_visibility_set(v_pro, true) is null,
    'FAIL: the same switch value returns no request';
  v_req := public.professional_mobile_visibility_set(v_pro, false);
  assert (select before_snapshot from public.request_log where id = v_req) = '{"show_mobile_on_profile": true}'::jsonb
    and not (select show_mobile_on_profile from public.professional_settings where professional_id = v_pro),
    'FAIL: turning it off is saved and recorded';
  perform pg_temp.expect_error(format('select public.professional_mobile_visibility_set(%L, null)', v_pro),
    '22023', 'the switch needs a value');
  v_checks := v_checks + 3;

  -- Nothing to show without a mobile.
  update public.professionals set mobile_number = null where id = v_pro2;
  perform pg_temp.expect_error(format('select public.professional_mobile_visibility_set(%L, true)', v_pro2),
    '22023', 'showing a mobile she has not saved is refused');
  v_checks := v_checks + 1;

  ---------------------------------------------------------------- access
  assert not has_function_privilege('anon', 'public.professional_mobile_set(uuid, text)', 'execute')
    and not has_function_privilege('authenticated', 'public.professional_mobile_set(uuid, text)', 'execute')
    and not has_function_privilege('anon', 'public.professional_mobile_visibility_set(uuid, boolean)', 'execute')
    and not has_function_privilege('authenticated', 'public.professional_mobile_visibility_set(uuid, boolean)', 'execute'),
    'FAIL: anon and signed-in users cannot call the functions';
  assert has_function_privilege('service_role', 'public.professional_mobile_set(uuid, text)', 'execute')
    and has_function_privilege('service_role', 'public.professional_mobile_visibility_set(uuid, boolean)', 'execute'),
    'FAIL: the service role can call the functions';
  v_checks := v_checks + 2;

  raise exception 'ALL professional_mobile TESTS PASSED (% checks); rolled back', v_checks;
end
$test$;

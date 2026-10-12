-- Database tests for holiday mode saved and recorded together
-- (migration *_professional_holiday_change).
--
-- Settings → holiday mode (user, 2026-10-11):
-- - no founders' approval; every change is recorded (professional_holiday_change);
--   saving the same dates records nothing;
-- - a holiday cannot start in the past and cannot end before it starts; one that is
--   running may keep its start and move its end;
-- - a holiday whose end date has passed counts as off: switching it off only clears it;
-- - the dates stay on professional_settings (no new columns).
--
-- Run against TESTING only. One transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL professional_holiday_change TESTS PASSED (…)" means
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

create or replace function pg_temp.new_login(p_email text)
returns uuid
language plpgsql
as $f$
declare
  v_u uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          p_email, now(), now(), now());
  return v_u;
end
$f$;

do $test$
declare
  v_tag text := substr(md5(random()::text), 1, 8);
  v_checks int := 0;
  v_today date := (now() at time zone 'Asia/Nicosia')::date;
  v_pro uuid;
  v_other uuid;
  v_bare uuid;
  v_listing uuid;
  v_clinic uuid;
  v_req uuid;
  v_row public.request_log%rowtype;
  v_ps public.professional_settings%rowtype;
  v_n int;
  v_fn text := 'public.professional_holiday_set(uuid, boolean, date, date)';
begin
  ---------------------------------------------------------------- fixtures
  insert into public.professionals (name, slug, is_registered, auth_user_id, registration_email)
  values ('Ho Pro', 'ho-pro-' || v_tag, true, pg_temp.new_login('ho-pro-' || v_tag || '@integration.test'),
          'ho-pro-' || v_tag || '@integration.test')
  returning id into v_pro;
  insert into public.professionals (name, slug, is_registered, auth_user_id, registration_email)
  values ('Ho Other', 'ho-other-' || v_tag, true, pg_temp.new_login('ho-other-' || v_tag || '@integration.test'),
          'ho-other-' || v_tag || '@integration.test')
  returning id into v_other;
  insert into public.professionals (name, slug, is_registered, auth_user_id, registration_email)
  values ('Ho Bare', 'ho-bare-' || v_tag, true, pg_temp.new_login('ho-bare-' || v_tag || '@integration.test'),
          'ho-bare-' || v_tag || '@integration.test')
  returning id into v_bare;
  insert into public.professionals (name, slug, is_registered)
  values ('Ho Listing', 'ho-listing-' || v_tag, false)
  returning id into v_listing;
  insert into public.clinics (name, slug, district, address, phone)
  values ('Ho Clinic', 'ho-clinic-' || v_tag, 'Paphos', '1 Ho St, Paphos', '26123456')
  returning id into v_clinic;
  insert into public.professional_clinics (professional_id, clinic_id)
  values (v_pro, v_clinic), (v_other, v_clinic), (v_bare, v_clinic), (v_listing, v_clinic);
  insert into public.professional_settings (professional_id) values (v_pro), (v_other)
  on conflict (professional_id) do nothing;
  delete from public.professional_settings where professional_id = v_bare;

  ---------------------------------------------------------------- the type and the function
  assert exists (select 1 from public.request_types
      where name = 'professional_holiday_change' and requires_approval = false and is_edit = true),
    'FAIL: professional_holiday_change is a recorded type';
  assert to_regprocedure(v_fn) is not null, 'FAIL: professional_holiday_set exists';
  assert not has_function_privilege('anon', v_fn, 'execute'), 'FAIL: anon cannot call professional_holiday_set';
  assert not has_function_privilege('authenticated', v_fn, 'execute'),
    'FAIL: a session cannot call professional_holiday_set';
  assert has_function_privilege('service_role', v_fn, 'execute'), 'FAIL: the server can call professional_holiday_set';
  v_checks := v_checks + 5;

  ---------------------------------------------------------------- turning it on
  v_req := public.professional_holiday_set(v_pro, true, v_today + 5, v_today + 9);
  assert v_req is not null, 'FAIL: a new holiday returns its record';
  select * into v_ps from public.professional_settings where professional_id = v_pro;
  assert v_ps.holiday_mode_enabled and v_ps.holiday_start_date = v_today + 5 and v_ps.holiday_end_date = v_today + 9,
    'FAIL: the holiday is saved on professional_settings';
  select * into v_row from public.request_log where id = v_req;
  assert v_row.request_type = 'professional_holiday_change' and v_row.status = 'recorded'
    and v_row.professional_id = v_pro, 'FAIL: the holiday is recorded for her';
  assert (v_row.details ->> 'enabled')::boolean and (v_row.details ->> 'start_date')::date = v_today + 5
    and (v_row.details ->> 'end_date')::date = v_today + 9, 'FAIL: the record keeps the new dates';
  assert (v_row.before_snapshot ->> 'enabled')::boolean = false
    and v_row.before_snapshot ->> 'start_date' is null, 'FAIL: the record keeps that it was off before';
  v_checks := v_checks + 5;

  -- The same dates again: nothing saved, nothing recorded.
  assert public.professional_holiday_set(v_pro, true, v_today + 5, v_today + 9) is null,
    'FAIL: the same holiday again returns nothing';
  select count(*) into v_n from public.request_log
  where professional_id = v_pro and request_type = 'professional_holiday_change';
  assert v_n = 1, 'FAIL: the same holiday again records nothing';
  v_checks := v_checks + 2;

  -- New dates: a second record, with the dates before.
  v_req := public.professional_holiday_set(v_pro, true, v_today + 6, v_today + 12);
  select * into v_row from public.request_log where id = v_req;
  assert (v_row.before_snapshot ->> 'enabled')::boolean
    and (v_row.before_snapshot ->> 'start_date')::date = v_today + 5
    and (v_row.before_snapshot ->> 'end_date')::date = v_today + 9, 'FAIL: a change keeps the dates before';
  assert (select holiday_end_date from public.professional_settings where professional_id = v_pro) = v_today + 12,
    'FAIL: the new dates are saved';
  -- One day only, and starting today, are both fine.
  assert public.professional_holiday_set(v_pro, true, v_today, v_today) is not null,
    'FAIL: a holiday may start today and last one day';
  v_checks := v_checks + 3;

  ---------------------------------------------------------------- refused dates
  perform pg_temp.expect_error(
    format('select public.professional_holiday_set(%L, true, %L, %L)', v_pro, v_today + 9, v_today + 8),
    '22023', 'a holiday cannot end before it starts');
  perform pg_temp.expect_error(
    format('select public.professional_holiday_set(%L, true, %L, null)', v_pro, v_today + 9),
    '22023', 'a holiday needs its end date');
  perform pg_temp.expect_error(
    format('select public.professional_holiday_set(%L, true, null, %L)', v_pro, v_today + 9),
    '22023', 'a holiday needs its start date');
  perform pg_temp.expect_error(
    format('select public.professional_holiday_set(%L, true, %L, %L)', v_other, v_today - 1, v_today + 3),
    '22023', 'a new holiday cannot start in the past');
  perform pg_temp.expect_error(
    format('select public.professional_holiday_set(%L, true, %L, %L)', v_other, v_today - 9, v_today - 3),
    '22023', 'a holiday cannot lie wholly in the past');
  perform pg_temp.expect_error(
    format('select public.professional_holiday_set(%L, null, null, null)', v_pro),
    '22023', 'holiday mode is on or off');
  select * into v_ps from public.professional_settings where professional_id = v_pro;
  assert v_ps.holiday_start_date = v_today and v_ps.holiday_end_date = v_today,
    'FAIL: a refused save leaves the holiday as it was';
  assert not (select holiday_mode_enabled from public.professional_settings where professional_id = v_other),
    'FAIL: a refused save turns nothing on';
  v_checks := v_checks + 8;

  ---------------------------------------------------------------- a running holiday
  -- Started three days ago (written directly: the function would refuse a past start).
  update public.professional_settings
  set holiday_mode_enabled = true, holiday_start_date = v_today - 3, holiday_end_date = v_today + 2
  where professional_id = v_pro;
  v_req := public.professional_holiday_set(v_pro, true, v_today - 3, v_today + 6);
  assert v_req is not null, 'FAIL: a running holiday keeps its start and moves its end';
  assert (select holiday_end_date from public.professional_settings where professional_id = v_pro) = v_today + 6,
    'FAIL: the running holiday has its new end';
  perform pg_temp.expect_error(
    format('select public.professional_holiday_set(%L, true, %L, %L)', v_pro, v_today - 1, v_today + 6),
    '22023', 'a running holiday cannot move its start to another past day');
  perform pg_temp.expect_error(
    format('select public.professional_holiday_set(%L, true, %L, %L)', v_pro, v_today - 3, v_today - 1),
    '22023', 'a running holiday cannot be given an end in the past');
  assert public.professional_holiday_set(v_pro, true, v_today - 3, v_today) is not null,
    'FAIL: a running holiday may end today';
  assert public.professional_holiday_set(v_pro, true, v_today + 1, v_today + 4) is not null,
    'FAIL: a running holiday may be moved to start later';
  v_checks := v_checks + 6;

  ---------------------------------------------------------------- a finished holiday counts as off
  update public.professional_settings
  set holiday_mode_enabled = true, holiday_start_date = v_today - 10, holiday_end_date = v_today - 5
  where professional_id = v_pro;
  select count(*) into v_n from public.request_log
  where professional_id = v_pro and request_type = 'professional_holiday_change';
  -- A page opened before it ended sends it again with another save: accepted, untouched.
  assert public.professional_holiday_set(v_pro, true, v_today - 10, v_today - 5) is null,
    'FAIL: a finished holiday sent again unchanged is accepted';
  perform pg_temp.expect_error(
    format('select public.professional_holiday_set(%L, true, %L, %L)', v_pro, v_today - 10, v_today + 3),
    '22023', 'a finished holiday cannot be brought back with its old start');
  -- Switching it off clears the old dates and records nothing: it was already over.
  assert public.professional_holiday_set(v_pro, false, null, null) is null,
    'FAIL: switching a finished holiday off returns nothing';
  select * into v_ps from public.professional_settings where professional_id = v_pro;
  assert not v_ps.holiday_mode_enabled and v_ps.holiday_start_date is null and v_ps.holiday_end_date is null,
    'FAIL: switching a finished holiday off clears it';
  assert (select count(*) from public.request_log
      where professional_id = v_pro and request_type = 'professional_holiday_change') = v_n,
    'FAIL: clearing a finished holiday records nothing';
  -- A new holiday over a finished one is recorded as starting from the old one.
  update public.professional_settings
  set holiday_mode_enabled = true, holiday_start_date = v_today - 10, holiday_end_date = v_today - 5
  where professional_id = v_pro;
  v_req := public.professional_holiday_set(v_pro, true, v_today + 2, v_today + 3);
  assert v_req is not null, 'FAIL: a new holiday can follow a finished one';
  v_checks := v_checks + 6;

  ---------------------------------------------------------------- turning it off
  v_req := public.professional_holiday_set(v_pro, false, null, null);
  assert v_req is not null, 'FAIL: switching a coming holiday off returns its record';
  select * into v_row from public.request_log where id = v_req;
  assert (v_row.details ->> 'enabled')::boolean = false and v_row.details ->> 'start_date' is null
    and v_row.status = 'recorded', 'FAIL: the record says holiday mode is off';
  assert (v_row.before_snapshot ->> 'start_date')::date = v_today + 2
    and (v_row.before_snapshot ->> 'end_date')::date = v_today + 3, 'FAIL: the record keeps the dates it had';
  select * into v_ps from public.professional_settings where professional_id = v_pro;
  assert not v_ps.holiday_mode_enabled and v_ps.holiday_start_date is null and v_ps.holiday_end_date is null,
    'FAIL: off clears the dates';
  assert public.professional_holiday_set(v_pro, false, null, null) is null, 'FAIL: off when off returns nothing';
  -- Dates sent with "off" are ignored.
  assert public.professional_holiday_set(v_pro, false, v_today + 2, v_today + 3) is null,
    'FAIL: off ignores any dates sent with it';
  v_checks := v_checks + 6;

  ---------------------------------------------------------------- no settings row yet
  assert public.professional_holiday_set(v_bare, false, null, null) is null,
    'FAIL: off without a settings row returns nothing';
  assert not exists (select 1 from public.professional_settings where professional_id = v_bare),
    'FAIL: off without a settings row creates none';
  v_req := public.professional_holiday_set(v_bare, true, v_today + 1, v_today + 2);
  assert v_req is not null, 'FAIL: a first holiday without a settings row is recorded';
  select * into v_ps from public.professional_settings where professional_id = v_bare;
  assert v_ps.holiday_mode_enabled and v_ps.holiday_start_date = v_today + 1,
    'FAIL: a first holiday creates her settings row';
  select * into v_row from public.request_log where id = v_req;
  assert (v_row.before_snapshot ->> 'enabled')::boolean = false, 'FAIL: without a row the record says it was off';
  v_checks := v_checks + 5;

  ---------------------------------------------------------------- who
  perform pg_temp.expect_error(
    format('select public.professional_holiday_set(%L, true, %L, %L)', v_listing, v_today + 1, v_today + 2),
    '22023', 'a listing that has not signed up has no holiday');
  perform pg_temp.expect_error(
    format('select public.professional_holiday_set(%L, false, null, null)', v_listing),
    '22023', 'a listing that has not signed up cannot switch it off either');
  perform pg_temp.expect_error(
    format('select public.professional_holiday_set(%L, true, %L, %L)', gen_random_uuid(), v_today + 1, v_today + 2),
    'P0002', 'an unknown professional');
  assert not (select holiday_mode_enabled from public.professional_settings where professional_id = v_other),
    'FAIL: nobody else''s holiday moves';
  assert not exists (select 1 from public.request_log
      where professional_id in (v_other, v_listing) and request_type = 'professional_holiday_change'),
    'FAIL: nothing is recorded for anyone else';
  v_checks := v_checks + 5;

  raise exception 'ALL professional_holiday_change TESTS PASSED (% checks); rolled back', v_checks;
end
$test$;

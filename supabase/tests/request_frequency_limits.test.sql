-- Database tests for how often a professional can change a setting
-- (migration *_request_frequency_limits).
--
-- Settings (user, 2026-10-12):
-- - the limits live on request_types (limit_count in limit_window, counted per
--   limit_scope_key when set, and wait_after_approval);
-- - requests that need the founders: 3 in 30 days per type, withdrawn and denied ones
--   count; an approved name change is followed by 90 days before the next one;
-- - joining and leaving a clinic: 5 in 30 days each;
-- - everyday settings: 20 a day per type, the three per-clinic ones counted per clinic;
-- - registration and the email change carry no limit;
-- - a refused change is rolled back as a whole and records nothing; the error says when
--   she can change it again (SQLSTATE DC429, the time in DETAIL, the kind in HINT).
--
-- Run against TESTING only. One transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL request_frequency_limits TESTS PASSED (…)" means success;
-- any "FAIL: …" names the broken rule.

-- Runs the statement; answers 'ok', or 'SQLSTATE|DETAIL|HINT' when it is refused.
create or replace function pg_temp.outcome(p_sql text)
returns text
language plpgsql
as $f$
declare
  v_detail text;
  v_hint text;
begin
  execute p_sql;
  return 'ok';
exception
  when others then
    get stacked diagnostics v_detail = pg_exception_detail, v_hint = pg_exception_hint;
    return sqlstate || '|' || coalesce(v_detail, '') || '|' || coalesce(v_hint, '');
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

-- The time as the error states it (UTC, to the second).
create or replace function pg_temp.stamp(p_at timestamptz)
returns text
language sql
as $f$
  select to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
$f$;

do $test$
declare
  v_tag text := substr(md5(random()::text), 1, 8);
  v_checks int := 0;
  v_admin uuid;
  v_pro uuid;
  v_other uuid;
  v_clinic_a uuid;
  v_clinic_b uuid;
  v_link_a uuid;
  v_link_b uuid;
  v_req uuid;
  v_out text;
  v_n int;
  v_i int;
  v_type public.request_types%rowtype;
begin
  ---------------------------------------------------------------- fixtures
  insert into public.admin_users (auth_user_id, name, email, role)
  values (pg_temp.new_login('rf-founder-' || v_tag || '@integration.test'), 'Rf Founder',
          'rf-founder-' || v_tag || '@integration.test', 'founder')
  returning id into v_admin;
  insert into public.professionals (name, slug, is_registered, auth_user_id, registration_email, is_gesy)
  values ('Rf Pro', 'rf-pro-' || v_tag, true, pg_temp.new_login('rf-pro-' || v_tag || '@integration.test'),
          'rf-pro-' || v_tag || '@integration.test', false)
  returning id into v_pro;
  insert into public.professionals (name, slug, is_registered, auth_user_id, registration_email, is_gesy)
  values ('Rf Other', 'rf-other-' || v_tag, true, pg_temp.new_login('rf-other-' || v_tag || '@integration.test'),
          'rf-other-' || v_tag || '@integration.test', false)
  returning id into v_other;
  insert into public.clinics (name, slug, district, address, phone)
  values ('Rf Clinic A', 'rf-clinic-a-' || v_tag, 'Paphos', '1 Rf St, Paphos', '26123456')
  returning id into v_clinic_a;
  insert into public.clinics (name, slug, district, address, phone)
  values ('Rf Clinic B', 'rf-clinic-b-' || v_tag, 'Paphos', '2 Rf St, Paphos', '26123457')
  returning id into v_clinic_b;
  insert into public.professional_clinics (professional_id, clinic_id, sort_order, pause_online_bookings)
  values (v_pro, v_clinic_a, 0, false) returning id into v_link_a;
  insert into public.professional_clinics (professional_id, clinic_id, sort_order, pause_online_bookings)
  values (v_pro, v_clinic_b, 1, false) returning id into v_link_b;

  ---------------------------------------------------------------- the limits on request_types
  select * into v_type from public.request_types where name = 'professional_name_change';
  assert v_type.limit_count = 3 and v_type.limit_window = interval '30 days'
    and v_type.wait_after_approval = interval '90 days' and v_type.limit_scope_key is null,
    'FAIL: a name change: 3 in 30 days, 90 days after an approval';
  assert not exists (select 1 from public.request_types
      where requires_approval and is_edit
        and (limit_count is distinct from 3 or limit_window is distinct from interval '30 days')),
    'FAIL: every request for the founders: 3 in 30 days';
  assert not exists (select 1 from public.request_types
      where name <> 'professional_name_change' and wait_after_approval is not null),
    'FAIL: only the name change waits after an approval';
  assert (select count(*) from public.request_types
      where name in ('professional_clinic_join', 'professional_clinic_leave')
        and limit_count = 5 and limit_window = interval '30 days') = 2,
    'FAIL: joining and leaving a clinic: 5 in 30 days each';
  assert not exists (select 1 from public.request_types
      where not requires_approval and is_edit and name like 'professional\_%'
        and name not in ('professional_clinic_join', 'professional_clinic_leave', 'professional_email_change')
        and (limit_count is distinct from 20 or limit_window is distinct from interval '1 day')),
    'FAIL: every everyday setting: 20 a day';
  assert (select count(*) from public.request_types
      where name in ('professional_clinic_hours_change', 'professional_clinic_limits_change',
                     'professional_clinic_online_booking_change')
        and limit_scope_key = 'link_id') = 3,
    'FAIL: hours, limits and the booking switch are counted per clinic';
  assert (select limit_scope_key from public.request_types where name = 'professional_clinic_details_change')
      = 'clinic_id',
    'FAIL: clinic details requests are counted per clinic';
  assert not exists (select 1 from public.request_types
      where name in ('professional_registration', 'professional_email_change')
        and (limit_count is not null or limit_window is not null or wait_after_approval is not null)),
    'FAIL: registration and the email change carry no limit';
  v_checks := v_checks + 8;

  -- A limit is a count with its window, or neither.
  v_out := pg_temp.outcome(
    $q$update public.request_types set limit_window = null where name = 'professional_gesy_change'$q$);
  assert v_out like '23514|%', format('FAIL: a count without a window is refused (%s)', v_out);
  v_out := pg_temp.outcome(
    $q$update public.request_types set limit_count = 0 where name = 'professional_gesy_change'$q$);
  assert v_out like '23514|%', format('FAIL: a limit of zero is refused (%s)', v_out);
  v_checks := v_checks + 2;

  ---------------------------------------------------------------- an everyday setting: 20 a day
  for v_i in 1..20 loop
    v_req := public.professional_gesy_set(v_pro, v_i % 2 = 1);
    assert v_req is not null, format('FAIL: GeSY change %s of 20 is recorded', v_i);
  end loop;
  assert (select is_gesy from public.professionals where id = v_pro) = false, 'FAIL: 20 changes end where they began';
  -- An unchanged save records nothing and is never refused.
  assert public.professional_gesy_set(v_pro, false) is null, 'FAIL: an unchanged save still records nothing';
  v_out := pg_temp.outcome(format('select public.professional_gesy_set(%L, true)', v_pro));
  assert v_out = 'DC429|' || pg_temp.stamp(now() + interval '1 day') || '|window',
    format('FAIL: the 21st GeSY change of the day is refused, with the time it opens again (%s)', v_out);
  assert (select is_gesy from public.professionals where id = v_pro) = false,
    'FAIL: a refused change is rolled back: GeSY stays as it was';
  assert (select count(*) from public.request_log
      where professional_id = v_pro and request_type = 'professional_gesy_change') = 20,
    'FAIL: a refused change records nothing';
  -- Somebody else is not affected, and neither is another of her settings.
  assert public.professional_gesy_set(v_other, true) is not null, 'FAIL: the limit is per professional';
  assert public.professional_holiday_set(v_pro, true,
      (now() at time zone 'Asia/Nicosia')::date + 3, (now() at time zone 'Asia/Nicosia')::date + 5) is not null,
    'FAIL: the limit is per kind of change';
  v_checks := v_checks + 27;

  ---------------------------------------------------------------- only the window counts
  -- Older changes do not count: 25 from two days ago leave today free.
  insert into public.request_log (request_type, status, details, details_version, before_snapshot, professional_id,
    requester_name, requester_email, created_at, decided_at)
  select 'professional_gesy_change', 'recorded', '{"is_gesy": true}', 1, '{"is_gesy": false}', v_other,
    'Rf Other', 'x@integration.test', now() - interval '2 days', now() - interval '2 days'
  from generate_series(1, 25);
  assert public.professional_gesy_set(v_other, false) is not null, 'FAIL: changes older than the window do not count';
  -- The time she is told is when the oldest counted change leaves the window.
  insert into public.request_log (request_type, status, details, details_version, before_snapshot, professional_id,
    requester_name, requester_email, created_at, decided_at)
  select 'professional_gesy_change', 'recorded', '{"is_gesy": true}', 1, '{"is_gesy": false}', v_other,
    'Rf Other', 'x@integration.test', now() - interval '10 hours', now() - interval '10 hours'
  from generate_series(1, 18);
  -- v_other now has 2 from now and 18 from ten hours ago in the window: 20.
  v_out := pg_temp.outcome(format('select public.professional_gesy_set(%L, true)', v_other));
  assert v_out = 'DC429|' || pg_temp.stamp(now() + interval '14 hours') || '|window',
    format('FAIL: it opens again when the oldest counted change is a day old (%s)', v_out);
  v_checks := v_checks + 2;

  ---------------------------------------------------------------- per clinic
  for v_i in 1..20 loop
    v_req := public.professional_clinic_online_booking_set(v_pro, v_link_a, v_i % 2 = 0);
    assert v_req is not null, format('FAIL: switch change %s of 20 at clinic A is recorded', v_i);
  end loop;
  v_out := pg_temp.outcome(
    format('select public.professional_clinic_online_booking_set(%L, %L, false)', v_pro, v_link_a));
  assert v_out like 'DC429|%|window', format('FAIL: the 21st switch change at clinic A is refused (%s)', v_out);
  assert (select pause_online_bookings from public.professional_clinics where id = v_link_a) = false,
    'FAIL: the refused switch stays as it was';
  assert public.professional_clinic_online_booking_set(v_pro, v_link_b, false) is not null,
    'FAIL: clinic B has its own count';
  v_checks := v_checks + 23;

  ---------------------------------------------------------------- requests for the founders: 3 in 30 days
  v_req := public.request_submit('professional_name_change', v_pro, '{"name": "Rf One"}');
  perform public.request_withdraw(v_req, v_pro);
  v_req := public.request_submit('professional_name_change', v_pro, '{"name": "Rf Two"}');
  perform public.request_reject(v_req, v_admin, 'No.');
  v_req := public.request_submit('professional_name_change', v_pro, '{"name": "Rf Three"}');
  perform public.request_withdraw(v_req, v_pro);
  v_out := pg_temp.outcome(
    format($q$select public.request_submit('professional_name_change', %L, '{"name": "Rf Four"}')$q$, v_pro));
  assert v_out = 'DC429|' || pg_temp.stamp(now() + interval '30 days') || '|window',
    format('FAIL: a 4th name request in 30 days is refused: withdrawn and denied ones count (%s)', v_out);
  -- Another kind of request is still open to her.
  assert public.request_submit('professional_photo_change', v_pro, '{"photo_path": "rf/new.jpg"}') is not null,
    'FAIL: each kind of request has its own count';
  v_checks := v_checks + 2;

  ---------------------------------------------------------------- 90 days after an approved name change
  v_req := public.request_submit('professional_name_change', v_other, '{"name": "Rf Other New"}');
  perform public.request_approve(v_req, v_admin, null, null, jsonb_build_object('slug', 'rf-other-new-' || v_tag));
  v_out := pg_temp.outcome(
    format($q$select public.request_submit('professional_name_change', %L, '{"name": "Rf Other Again"}')$q$, v_other));
  assert v_out = 'DC429|' || pg_temp.stamp(now() + interval '90 days') || '|after_approval',
    format('FAIL: no new name request for 90 days after an approved one (%s)', v_out);
  -- A denied one starts no such wait (v_pro's were withdrawn and denied): with the count
  -- lifted she may ask again.
  update public.request_types set limit_count = null, limit_window = null where name = 'professional_name_change';
  assert public.request_submit('professional_name_change', v_pro, '{"name": "Rf Five"}') is not null,
    'FAIL: a denied or withdrawn request starts no wait';
  v_out := pg_temp.outcome(
    format($q$select public.request_submit('professional_name_change', %L, '{"name": "Rf Other Again"}')$q$, v_other));
  assert v_out like 'DC429|%|after_approval', 'FAIL: the wait holds on its own, without a count';
  -- The founders may still correct her name while she waits: approvals are not limited.
  update public.request_types set wait_after_approval = null where name = 'professional_name_change';
  assert public.request_submit('professional_name_change', v_other, '{"name": "Rf Other Again"}') is not null,
    'FAIL: without limits a request goes through (the row drives the rule)';
  v_checks := v_checks + 4;

  ---------------------------------------------------------------- who can run and read
  assert not has_function_privilege('anon', 'public.request_frequency_check(text, uuid, jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public.request_frequency_check(text, uuid, jsonb)', 'execute'),
    'FAIL: only the server runs the check';
  assert not has_table_privilege('anon', 'public.request_types', 'select')
    and not has_table_privilege('authenticated', 'public.request_types', 'update'),
    'FAIL: sessions cannot read or change the limits';
  v_checks := v_checks + 2;

  raise exception 'ALL request_frequency_limits TESTS PASSED (% checks); rolled back', v_checks;
end
$test$;

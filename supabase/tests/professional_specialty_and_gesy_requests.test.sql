-- Database tests for specialties and GeSY changed from Settings
-- (migration *_professional_specialty_and_gesy_requests).
--
-- Settings → Profile (user, 2026-10-10):
-- - removing a specialty needs nobody: recorded at once, but never the last one;
-- - adding one (from the catalogue or new) needs a founder, as at registration, with
--   its licence number kept in the request; one open request, at most 5 specialties
--   counting the open request;
-- - GeSY goes on and off as she pleases, each change recorded.
--
-- Run against TESTING only. One transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL professional_specialty_and_gesy TESTS PASSED (…)" means
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
  v_admin uuid;
  v_pro uuid;
  v_listing uuid;
  v_req uuid;
  v_row public.request_log%rowtype;
  v_new text := 'Zzspecialty ' || v_tag;
  v_i int;
begin
  ---------------------------------------------------------------- fixtures
  insert into public.admin_users (auth_user_id, name, email, role)
  values (pg_temp.new_login('sg-founder-' || v_tag || '@integration.test'), 'Sg Founder',
          'sg-founder-' || v_tag || '@integration.test', 'founder')
  returning id into v_admin;
  insert into public.professionals (name, slug, is_registered, auth_user_id, registration_email, is_gesy)
  values ('Sg Pro', 'sg-pro-' || v_tag, true, pg_temp.new_login('sg-pro-' || v_tag || '@integration.test'),
          'sg-pro-' || v_tag || '@integration.test', false)
  returning id into v_pro;
  insert into public.professional_specialties (professional_id, specialty, license_number)
  values (v_pro, 'Cardiology', 'LIC-1');
  insert into public.professionals (name, slug, is_registered)
  values ('Sg Listing', 'sg-listing-' || v_tag, false)
  returning id into v_listing;

  ---------------------------------------------------------------- request types
  assert (select count(*) from public.request_types
          where (name = 'professional_specialty_add' and requires_approval and is_edit)
             or (name in ('professional_specialty_removal', 'professional_gesy_change')
                 and not requires_approval and is_edit)) = 3,
    'FAIL: adding needs approval; removing and GeSY are recorded at once';
  v_checks := v_checks + 1;

  ---------------------------------------------------------------- remove: never the last
  perform pg_temp.expect_error(format('select public.professional_specialty_remove(%L, %L)', v_pro, 'Cardiology'),
    '23514', 'her last specialty cannot be removed');
  perform pg_temp.expect_error(format('select public.professional_specialty_remove(%L, %L)', v_pro, 'Dermatology'),
    'P0002', 'a specialty she does not have cannot be removed');
  assert (select count(*) from public.request_log where professional_id = v_pro) = 0,
    'FAIL: a refused removal records nothing';
  v_checks := v_checks + 3;

  ---------------------------------------------------------------- add: submit
  perform pg_temp.expect_error(
    format('select public.request_submit(%L, %L, %L)', 'professional_specialty_add', v_pro,
           '{"name": "Dermatology", "from_catalogue": true}'),
    '22023', 'a specialty request needs a licence number');
  perform pg_temp.expect_error(
    format('select public.request_submit(%L, %L, %L)', 'professional_specialty_add', v_pro,
           '{"name": " ", "license_number": "L2"}'),
    '22023', 'a specialty request needs a specialty');
  perform pg_temp.expect_error(
    format('select public.request_submit(%L, %L, %L)', 'professional_specialty_add', v_pro,
           '{"name": "cardiology", "license_number": "L2"}'),
    '22023', 'a specialty she already has is refused');
  perform pg_temp.expect_error(
    format('select public.request_submit(%L, %L, %L)', 'professional_specialty_add', v_listing,
           '{"name": "Dermatology", "license_number": "L2"}'),
    '22023', 'a listing that never signed up cannot ask');
  v_checks := v_checks + 4;

  v_req := public.request_submit('professional_specialty_add', v_pro,
    jsonb_build_object('name', v_new, 'from_catalogue', false, 'license_number', 'LIC-NEW'));
  select * into v_row from public.request_log where id = v_req;
  assert v_row.status = 'pending' and v_row.details ->> 'license_number' = 'LIC-NEW',
    'FAIL: an added specialty waits for a founder, with its licence number in the request';
  assert v_row.before_snapshot = '{"specialties": [{"name": "Cardiology", "license_number": "LIC-1"}]}'::jsonb,
    'FAIL: the request keeps the specialties she had';
  assert (select count(*) from public.professional_specialties where professional_id = v_pro) = 1
    and not exists (select 1 from public.specialties where name = v_new),
    'FAIL: nothing changes before approval, and the catalogue does not grow';
  perform pg_temp.expect_error(
    format('select public.request_submit(%L, %L, %L)', 'professional_specialty_add', v_pro,
           '{"name": "Dermatology", "license_number": "L2"}'),
    '23505', 'one open specialty request at a time');
  v_checks := v_checks + 4;

  ---------------------------------------------------------------- add: withdraw, deny
  perform public.request_withdraw(v_req, v_pro);
  v_req := public.request_submit('professional_specialty_add', v_pro,
    '{"name": "Dermatology", "from_catalogue": true, "license_number": "L2"}');
  perform public.request_reject(v_req, v_admin, 'We could not verify this licence.');
  assert (select count(*) from public.professional_specialties where professional_id = v_pro) = 1,
    'FAIL: withdrawn and denied requests add nothing';
  v_checks := v_checks + 1;

  ---------------------------------------------------------------- add: approve
  v_req := public.request_submit('professional_specialty_add', v_pro,
    jsonb_build_object('name', lower(v_new), 'from_catalogue', false, 'license_number', 'lic new'));
  -- The founder corrects the spelling and the licence number.
  perform public.request_approve(v_req, v_admin,
    jsonb_build_object('name', v_new, 'from_catalogue', false, 'license_number', 'LIC-NEW'));
  select * into v_row from public.request_log where id = v_req;
  assert v_row.status = 'approved' and v_row.approved_details ->> 'license_number' = 'LIC-NEW'
    and v_row.outcome ->> 'specialty' = v_new and (v_row.outcome ->> 'catalogue_added')::boolean,
    'FAIL: the approval records the specialty, its licence and that the catalogue grew';
  assert exists (select 1 from public.professional_specialties ps
                 join public.specialties s on s.id = ps.specialty_id
                 where ps.professional_id = v_pro and s.name = v_new and ps.license_number = 'LIC-NEW'),
    'FAIL: the approved specialty is on her profile, in the catalogue, with its licence';
  v_checks := v_checks + 2;

  -- A catalogue specialty takes the catalogue's spelling.
  v_req := public.request_submit('professional_specialty_add', v_pro,
    '{"name": "dermatology", "from_catalogue": true, "license_number": "L3"}');
  perform public.request_approve(v_req, v_admin);
  assert exists (select 1 from public.professional_specialties
                 where professional_id = v_pro and specialty = 'Dermatology' and license_number = 'L3'),
    'FAIL: a catalogue specialty is stored with the catalogue''s name';
  assert not (select (outcome ->> 'catalogue_added')::boolean from public.request_log where id = v_req),
    'FAIL: a catalogue specialty does not grow the catalogue';
  v_checks := v_checks + 2;

  -- She got it another way meanwhile: the approval stops.
  v_req := public.request_submit('professional_specialty_add', v_pro,
    '{"name": "Neurology", "from_catalogue": true, "license_number": "L4"}');
  insert into public.professional_specialties (professional_id, specialty, license_number)
  values (v_pro, 'Neurology', 'L4');
  perform pg_temp.expect_error(format('select public.request_approve(%L, %L)', v_req, v_admin),
    '55000', 'a specialty she already has stops the approval');
  perform public.request_withdraw(v_req, v_pro);
  v_checks := v_checks + 1;

  ---------------------------------------------------------------- the limit of 5
  insert into public.professional_specialties (professional_id, specialty, license_number)
  values (v_pro, 'Urology', 'L5');
  assert (select count(*) from public.professional_specialties where professional_id = v_pro) = 5,
    'FAIL: fixture: she has five specialties';
  perform pg_temp.expect_error(
    format('select public.request_submit(%L, %L, %L)', 'professional_specialty_add', v_pro,
           '{"name": "Psychiatry", "license_number": "L6"}'),
    '22023', 'a sixth specialty cannot be requested');
  v_checks := v_checks + 2;

  ---------------------------------------------------------------- remove: recorded
  v_req := public.professional_specialty_remove(v_pro, 'urology');
  select * into v_row from public.request_log where id = v_req;
  assert v_row.request_type = 'professional_specialty_removal' and v_row.status = 'recorded'
    and v_row.before_snapshot = '{"name": "Urology", "license_number": "L5"}'::jsonb,
    'FAIL: a removal is recorded at once with the specialty and its licence number';
  assert not exists (select 1 from public.professional_specialties
                     where professional_id = v_pro and specialty = 'Urology'),
    'FAIL: the removed specialty is gone';
  assert exists (select 1 from public.specialties where name = 'Urology'),
    'FAIL: the catalogue keeps the specialty';
  v_checks := v_checks + 3;

  ---------------------------------------------------------------- GeSY
  v_req := public.professional_gesy_set(v_pro, true);
  select * into v_row from public.request_log where id = v_req;
  assert v_row.request_type = 'professional_gesy_change' and v_row.status = 'recorded'
    and v_row.before_snapshot = '{"is_gesy": false}'::jsonb and v_row.details = '{"is_gesy": true}'::jsonb,
    'FAIL: turning GeSY on is recorded at once with the old and new value';
  assert (select is_gesy from public.professionals where id = v_pro),
    'FAIL: GeSY is saved';
  assert public.professional_gesy_set(v_pro, true) is null,
    'FAIL: the same value records nothing';
  v_req := public.professional_gesy_set(v_pro, false);
  assert not (select is_gesy from public.professionals where id = v_pro)
    and (select before_snapshot from public.request_log where id = v_req) = '{"is_gesy": true}'::jsonb,
    'FAIL: turning GeSY off is saved and recorded';
  perform pg_temp.expect_error(format('select public.professional_gesy_set(%L, null)', v_pro),
    '22023', 'GeSY needs a value');
  perform pg_temp.expect_error(format('select public.professional_gesy_set(%L, true)', v_listing),
    '22023', 'a listing that never signed up cannot change GeSY');
  v_checks := v_checks + 6;

  ---------------------------------------------------------------- access
  for v_i in 1..2 loop
    assert not has_function_privilege(case v_i when 1 then 'anon' else 'authenticated' end,
        'public.professional_specialty_remove(uuid, text)', 'execute')
      and not has_function_privilege(case v_i when 1 then 'anon' else 'authenticated' end,
        'public.professional_gesy_set(uuid, boolean)', 'execute'),
      'FAIL: anon and signed-in users cannot call the functions';
  end loop;
  assert has_function_privilege('service_role', 'public.professional_specialty_remove(uuid, text)', 'execute')
    and has_function_privilege('service_role', 'public.professional_gesy_set(uuid, boolean)', 'execute')
    and not has_function_privilege('service_role',
      'public.request_apply_professional_specialty_add(public.request_log, jsonb, jsonb)', 'execute'),
    'FAIL: the service role calls the two functions; the apply step runs only inside request_approve';
  v_checks := v_checks + 2;

  raise exception 'ALL professional_specialty_and_gesy TESTS PASSED (% checks); rolled back', v_checks;
end
$test$;

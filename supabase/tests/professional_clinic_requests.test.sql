-- Database tests for clinic requests from Settings
-- (migration *_professional_clinic_requests).
--
-- Settings → Clinics (user, 2026-10-11):
-- - a clinic DocCy does not have yet is asked for (professional_clinic_add): founders
--   approve it (the clinic is created and she joins it), correct it first, attach her
--   to a clinic DocCy already has instead, or deny it; one waiting at a time;
-- - a change to a clinic's name, address or phone is asked for
--   (professional_clinic_details_change): founders approve it as asked or corrected, or
--   deny it; one open request per clinic; she can withdraw it;
-- - leaving a clinic withdraws her open details request for it.
--
-- Run against TESTING only. One transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL professional_clinic_requests TESTS PASSED (…)" means
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

create or replace function pg_temp.new_clinic(p_name text, p_tag text, p_archived boolean default false)
returns uuid
language plpgsql
as $f$
declare
  v_id uuid;
begin
  insert into public.clinics (name, slug, district, address, phone, is_archived, latitude, longitude)
  values (p_name, lower(replace(p_name, ' ', '-')) || '-' || p_tag, 'Paphos', '1 ' || p_name || ' St, Paphos',
          '26123456', p_archived, 34.77, 32.42)
  returning id into v_id;
  return v_id;
end
$f$;


do $test$
declare
  v_tag text := substr(md5(random()::text), 1, 8);
  v_checks int := 0;
  v_admin uuid;
  v_partner uuid;
  v_pro uuid;
  v_other uuid;
  v_listing uuid;
  v_home uuid;
  v_second uuid;
  v_archived uuid;
  v_home_link uuid;
  v_second_link uuid;
  v_new jsonb;
  v_req uuid;
  v_req2 uuid;
  v_row public.request_log%rowtype;
  v_clinic public.clinics%rowtype;
  v_pc public.professional_clinics%rowtype;
  v_i int;
  v_fn text;
begin
  ---------------------------------------------------------------- fixtures
  insert into public.admin_users (auth_user_id, name, email, role)
  values (pg_temp.new_login('cr-founder-' || v_tag || '@integration.test'), 'Cr Founder',
          'cr-founder-' || v_tag || '@integration.test', 'founder')
  returning id into v_admin;
  insert into public.admin_users (auth_user_id, name, email, role)
  values (pg_temp.new_login('cr-partner-' || v_tag || '@integration.test'), 'Cr Partner',
          'cr-partner-' || v_tag || '@integration.test', 'partner')
  returning id into v_partner;
  insert into public.professionals (name, slug, is_registered, auth_user_id, registration_email)
  values ('Cr Pro', 'cr-pro-' || v_tag, true, pg_temp.new_login('cr-pro-' || v_tag || '@integration.test'),
          'cr-pro-' || v_tag || '@integration.test')
  returning id into v_pro;
  insert into public.professionals (name, slug, is_registered, auth_user_id, registration_email)
  values ('Cr Other', 'cr-other-' || v_tag, true, pg_temp.new_login('cr-other-' || v_tag || '@integration.test'),
          'cr-other-' || v_tag || '@integration.test')
  returning id into v_other;
  insert into public.professionals (name, slug, is_registered)
  values ('Cr Listing', 'cr-listing-' || v_tag, false)
  returning id into v_listing;

  v_home := pg_temp.new_clinic('Cr Home', v_tag);
  v_second := pg_temp.new_clinic('Cr Second', v_tag);
  v_archived := pg_temp.new_clinic('Cr Archived', v_tag, true);
  insert into public.professional_clinics (professional_id, clinic_id, sort_order) values (v_pro, v_home, 0)
  returning id into v_home_link;
  insert into public.professional_clinics (professional_id, clinic_id, sort_order) values (v_other, v_home, 0);
  insert into public.professional_clinics (professional_id, clinic_id, sort_order) values (v_listing, v_home, 0);

  v_new := jsonb_build_object(
    'name', 'Cr New Clinic ' || v_tag, 'address', '5 New Road, Limassol', 'district', 'Limassol',
    'town', 'Germasogeia', 'latitude', 34.7, 'longitude', 33.08, 'place_id', 'place-' || v_tag,
    'phone', '25123456');

  ---------------------------------------------------------------- types
  assert (select count(*) from public.request_types
          where name in ('professional_clinic_add', 'professional_clinic_details_change')
            and requires_approval and is_edit) = 2,
    'FAIL: a new clinic and a change of clinic details need a founder';
  v_checks := v_checks + 1;

  ---------------------------------------------------------------- a new clinic: what can be asked
  perform pg_temp.expect_error(format('select public.request_submit(%L, %L, %L::jsonb)',
    'professional_clinic_add', v_pro, v_new - 'name'), '22023', 'a new clinic without a name');
  perform pg_temp.expect_error(format('select public.request_submit(%L, %L, %L::jsonb)',
    'professional_clinic_add', v_pro, v_new || jsonb_build_object('name', repeat('x', 121))), '22023',
    'a new clinic with a name over 120 characters');
  perform pg_temp.expect_error(format('select public.request_submit(%L, %L, %L::jsonb)',
    'professional_clinic_add', v_pro, v_new - 'address'), '22023', 'a new clinic without an address');
  perform pg_temp.expect_error(format('select public.request_submit(%L, %L, %L::jsonb)',
    'professional_clinic_add', v_pro, v_new || '{"district":"Athens"}'), '22023', 'a new clinic outside Cyprus');
  perform pg_temp.expect_error(format('select public.request_submit(%L, %L, %L::jsonb)',
    'professional_clinic_add', v_pro, v_new || '{"phone":"+35725123456"}'), '22023',
    'a new clinic whose phone is not 8 digits');
  perform pg_temp.expect_error(format('select public.request_submit(%L, %L, %L::jsonb)',
    'professional_clinic_add', v_pro, v_new || '{"phone":"12345678"}'), '22023',
    'a new clinic whose phone is not a Cyprus landline or mobile');
  perform pg_temp.expect_error(format('select public.request_submit(%L, %L, %L::jsonb)',
    'professional_clinic_add', v_pro, v_new - 'latitude'), '22023', 'a new clinic without a pin');
  perform pg_temp.expect_error(format('select public.request_submit(%L, %L, %L::jsonb)',
    'professional_clinic_add', v_listing, v_new), '22023', 'a listing that has not signed up asking');
  v_checks := v_checks + 8;

  v_req := public.request_submit('professional_clinic_add', v_pro, v_new);
  select * into v_row from public.request_log where id = v_req;
  assert v_row.status = 'pending' and v_row.details = v_new
    and v_row.before_snapshot = jsonb_build_object('clinics', jsonb_build_array(
      jsonb_build_object('clinic_id', v_home, 'clinic_name', 'Cr Home'))),
    'FAIL: a new-clinic request waits for a founder, with the clinics she had';
  perform pg_temp.expect_error(format('select public.request_submit(%L, %L, %L::jsonb)',
    'professional_clinic_add', v_pro, v_new || '{"name":"Another one"}'), '23505',
    'a second new-clinic request while one waits');
  assert not exists (select 1 from public.clinics where name = 'Cr New Clinic ' || v_tag),
    'FAIL: nothing is created until a founder approves';
  v_checks := v_checks + 3;

  ---------------------------------------------------------------- a new clinic: withdrawn, denied
  perform public.request_withdraw(v_req, v_pro);
  v_req := public.request_submit('professional_clinic_add', v_pro, v_new);
  perform public.request_reject(v_req, v_admin, 'We could not find this clinic.');
  assert (select status from public.request_log where id = v_req) = 'rejected'
    and not exists (select 1 from public.clinics where name = 'Cr New Clinic ' || v_tag),
    'FAIL: a denied new clinic creates nothing';
  v_checks := v_checks + 1;

  ---------------------------------------------------------------- a new clinic: approved
  v_req := public.request_submit('professional_clinic_add', v_pro, v_new);
  perform pg_temp.expect_error(format('select public.request_approve(%L, %L)', v_req, v_partner), '42501',
    'a partner approving a new clinic');
  perform public.request_approve(v_req, v_admin);
  select * into v_clinic from public.clinics where name = 'Cr New Clinic ' || v_tag;
  assert v_clinic.id is not null and v_clinic.address = '5 New Road, Limassol'
    and v_clinic.district::text = 'Limassol' and v_clinic.town = 'Germasogeia' and v_clinic.phone = '25123456'
    and v_clinic.latitude = 34.7 and v_clinic.longitude = 33.08 and v_clinic.clinic_place_id = 'place-' || v_tag
    and v_clinic.ghs_code is null and not v_clinic.is_archived and v_clinic.slug like 'cr-new-clinic-%',
    'FAIL: approving creates the clinic as asked';
  select * into v_pc from public.professional_clinics where professional_id = v_pro and clinic_id = v_clinic.id;
  assert v_pc.id is not null and v_pc.pause_online_bookings and v_pc.sort_order = 1
    and v_pc.monday and not v_pc.saturday and v_pc.slot_duration_minutes = 30,
    'FAIL: she joins the new clinic, booking off, with the starting week';
  select * into v_row from public.request_log where id = v_req;
  assert v_row.status = 'approved' and v_row.decided_by = v_admin
    and v_row.outcome = jsonb_build_object('professional_id', v_pro, 'clinic_id', v_clinic.id,
      'link_id', v_pc.id, 'created', true),
    'FAIL: the approval records the clinic created and her link';
  v_checks := v_checks + 4;

  -- Corrected by the founders before approving.
  v_req := public.request_submit('professional_clinic_add', v_pro,
    v_new || jsonb_build_object('name', 'cr typo clinic ' || v_tag));
  perform public.request_approve(v_req, v_admin,
    v_new || jsonb_build_object('name', 'Cr Typo Clinic ' || v_tag, 'phone', '25654321'));
  assert exists (select 1 from public.clinics where name = 'Cr Typo Clinic ' || v_tag and phone = '25654321')
    and not exists (select 1 from public.clinics where name = 'cr typo clinic ' || v_tag),
    'FAIL: founders may correct a new clinic before approving';
  v_req := public.request_submit('professional_clinic_add', v_pro, v_new || '{"name":"Bad correction"}');
  perform pg_temp.expect_error(format('select public.request_approve(%L, %L, %L::jsonb)', v_req, v_admin,
    v_new || '{"phone":"123"}'), '22023', 'a correction with an unusable phone');
  assert (select status from public.request_log where id = v_req) = 'pending',
    'FAIL: a refused approval leaves the request open';
  perform public.request_reject(v_req, v_admin, 'Not a clinic.');
  v_checks := v_checks + 3;

  -- It turns out DocCy already has the clinic: she is attached to it, nothing is created.
  v_req := public.request_submit('professional_clinic_add', v_pro,
    v_new || jsonb_build_object('name', 'Cr Second again ' || v_tag));
  perform pg_temp.expect_error(format('select public.request_approve(%L, %L, null, null, %L::jsonb)',
    v_req, v_admin, jsonb_build_object('existing_clinic_id', v_archived)), 'P0002',
    'attaching her to an archived clinic');
  perform pg_temp.expect_error(format('select public.request_approve(%L, %L, null, null, %L::jsonb)',
    v_req, v_admin, jsonb_build_object('existing_clinic_id', v_home)), '55000',
    'attaching her to a clinic she already works at');
  perform public.request_approve(v_req, v_admin, null, null, jsonb_build_object('existing_clinic_id', v_second));
  select id into v_second_link from public.professional_clinics
  where professional_id = v_pro and clinic_id = v_second;
  assert v_second_link is not null
    and not exists (select 1 from public.clinics where name = 'Cr Second again ' || v_tag),
    'FAIL: a request can be approved onto a clinic DocCy already has';
  assert (select outcome from public.request_log where id = v_req)
    = jsonb_build_object('professional_id', v_pro, 'clinic_id', v_second, 'link_id', v_second_link,
        'created', false),
    'FAIL: the approval records the existing clinic';
  v_checks := v_checks + 4;

  -- At most 5 clinics: she has 4 now.
  perform public.professional_clinic_join(v_pro, pg_temp.new_clinic('Cr Fifth', v_tag));
  perform pg_temp.expect_error(format('select public.request_submit(%L, %L, %L::jsonb)',
    'professional_clinic_add', v_pro, v_new || '{"name":"A sixth"}'), '23514', 'asking for a 6th clinic');
  v_checks := v_checks + 1;

  ---------------------------------------------------------------- clinic details: what can be asked
  perform pg_temp.expect_error(format('select public.request_submit(%L, %L, %L::jsonb)',
    'professional_clinic_details_change', v_pro,
    jsonb_build_object('clinic_id', v_archived, 'changes', '{"name":"X"}'::jsonb)), 'P0002',
    'changing a clinic she does not work at');
  perform pg_temp.expect_error(format('select public.request_submit(%L, %L, %L::jsonb)',
    'professional_clinic_details_change', v_pro,
    jsonb_build_object('clinic_id', v_home, 'changes', '{}'::jsonb)), '22023', 'a change with nothing in it');
  perform pg_temp.expect_error(format('select public.request_submit(%L, %L, %L::jsonb)',
    'professional_clinic_details_change', v_pro,
    jsonb_build_object('clinic_id', v_home, 'changes', '{"hours":"all day"}'::jsonb)), '22023',
    'a change to something that is not the name, address or phone');
  perform pg_temp.expect_error(format('select public.request_submit(%L, %L, %L::jsonb)',
    'professional_clinic_details_change', v_pro,
    jsonb_build_object('clinic_id', v_home, 'changes', '{"phone":"123"}'::jsonb)), '22023',
    'a change to an unusable phone');
  perform pg_temp.expect_error(format('select public.request_submit(%L, %L, %L::jsonb)',
    'professional_clinic_details_change', v_pro,
    jsonb_build_object('clinic_id', v_home, 'changes', '{"address":"9 Other St"}'::jsonb)), '22023',
    'a new address without its pin');
  perform pg_temp.expect_error(format('select public.request_submit(%L, %L, %L::jsonb)',
    'professional_clinic_details_change', v_pro,
    jsonb_build_object('clinic_id', v_home, 'changes', '{"name":"Cr Home"}'::jsonb)), '22023',
    'a change that changes nothing');
  v_checks := v_checks + 6;

  v_req := public.request_submit('professional_clinic_details_change', v_pro,
    jsonb_build_object('clinic_id', v_home, 'changes', jsonb_build_object('name', 'Cr Home Renamed', 'phone', '26654321')));
  select * into v_row from public.request_log where id = v_req;
  assert v_row.status = 'pending'
    and v_row.before_snapshot ->> 'name' = 'Cr Home' and v_row.before_snapshot ->> 'phone' = '26123456'
    and v_row.before_snapshot ->> 'address' = '1 Cr Home St, Paphos'
    and v_row.before_snapshot ->> 'district' = 'Paphos',
    'FAIL: a details request waits for a founder, with the clinic as it was';
  perform pg_temp.expect_error(format('select public.request_submit(%L, %L, %L::jsonb)',
    'professional_clinic_details_change', v_pro,
    jsonb_build_object('clinic_id', v_home, 'changes', '{"name":"Again"}'::jsonb)), '23505',
    'a second details request for the same clinic');
  v_req2 := public.request_submit('professional_clinic_details_change', v_pro,
    jsonb_build_object('clinic_id', v_second, 'changes', '{"name":"Cr Second Renamed"}'::jsonb));
  assert (select name from public.clinics where id = v_home) = 'Cr Home',
    'FAIL: nothing changes until a founder approves';
  v_checks := v_checks + 3;

  ---------------------------------------------------------------- clinic details: approved, corrected
  perform pg_temp.expect_error(format('select public.request_approve(%L, %L)', v_req, v_partner), '42501',
    'a partner approving clinic details');
  perform pg_temp.expect_error(format('select public.request_approve(%L, %L, %L::jsonb)', v_req, v_admin,
    jsonb_build_object('clinic_id', v_second, 'changes', '{"name":"Moved"}'::jsonb)), '22023',
    'a correction that points at another clinic');
  perform public.request_approve(v_req, v_admin,
    jsonb_build_object('clinic_id', v_home, 'changes', jsonb_build_object('name', 'Cr Home Medical', 'phone', '26654321')));
  select * into v_clinic from public.clinics where id = v_home;
  assert v_clinic.name = 'Cr Home Medical' and v_clinic.phone = '26654321'
    and v_clinic.address = '1 Cr Home St, Paphos' and v_clinic.slug = 'cr-home-' || v_tag,
    'FAIL: approving changes what was asked (as corrected), and nothing else';
  assert (select outcome from public.request_log where id = v_req)
    = jsonb_build_object('clinic_id', v_home, 'changed', jsonb_build_array('name', 'phone')),
    'FAIL: the approval records what changed';
  v_checks := v_checks + 4;

  -- A new address moves the pin with it.
  v_req := public.request_submit('professional_clinic_details_change', v_pro,
    jsonb_build_object('clinic_id', v_home, 'changes', jsonb_build_object(
      'address', '9 Other St, Nicosia',
      'location', jsonb_build_object('district', 'Nicosia', 'town', 'Strovolos', 'latitude', 35.1,
        'longitude', 33.3, 'place_id', 'moved-' || v_tag))));
  perform public.request_approve(v_req, v_admin);
  select * into v_clinic from public.clinics where id = v_home;
  assert v_clinic.address = '9 Other St, Nicosia' and v_clinic.district::text = 'Nicosia'
    and v_clinic.town = 'Strovolos' and v_clinic.latitude = 35.1 and v_clinic.longitude = 33.3
    and v_clinic.clinic_place_id = 'moved-' || v_tag and v_clinic.name = 'Cr Home Medical',
    'FAIL: a new address moves the district, town and pin with it';
  v_checks := v_checks + 1;

  -- The clinic changed meanwhile: the founder is told, nothing is overwritten.
  update public.clinics set name = 'Cr Second Fixed' where id = v_second;
  perform pg_temp.expect_error(format('select public.request_approve(%L, %L)', v_req2, v_admin), '55000',
    'approving a rename after the clinic was renamed');
  perform public.request_reject(v_req2, v_admin, 'Already corrected.');
  v_checks := v_checks + 1;

  ---------------------------------------------------------------- leaving withdraws her request
  v_req := public.request_submit('professional_clinic_details_change', v_pro,
    jsonb_build_object('clinic_id', v_second, 'changes', '{"phone":"26111222"}'::jsonb));
  v_req2 := public.request_submit('professional_clinic_details_change', v_pro,
    jsonb_build_object('clinic_id', v_home, 'changes', '{"phone":"22111222"}'::jsonb));
  perform public.professional_clinic_leave(v_pro, v_second_link);
  assert (select status from public.request_log where id = v_req) = 'withdrawn',
    'FAIL: leaving a clinic withdraws her open details request for it';
  assert (select status from public.request_log where id = v_req2) = 'pending',
    'FAIL: her request for another clinic stays';
  -- Someone who no longer works there cannot have a change approved.
  delete from public.professional_clinics where id = v_home_link;
  perform pg_temp.expect_error(format('select public.request_approve(%L, %L)', v_req2, v_admin), '55000',
    'approving a change for a clinic she has left');
  v_checks := v_checks + 3;

  ---------------------------------------------------------------- access
  foreach v_fn in array array[
    'public.request_apply_professional_clinic_add(public.request_log, jsonb, jsonb)',
    'public.request_apply_professional_clinic_details_change(public.request_log, jsonb, jsonb)',
    'public.professional_clinic_phone_ok(text)'
  ] loop
    assert not has_function_privilege('anon', v_fn, 'execute')
      and not has_function_privilege('authenticated', v_fn, 'execute'),
      format('FAIL: a session cannot call %s', v_fn);
    v_checks := v_checks + 1;
  end loop;

  raise exception 'ALL professional_clinic_requests TESTS PASSED (% checks); rolled back', v_checks;
end
$test$;

-- Database tests for joining and leaving a clinic from Settings
-- (migration *_professional_clinic_join_leave).
--
-- Settings → Clinics (user, 2026-10-11):
-- - she joins a clinic DocCy already has at once, with no founder, and it is recorded;
--   online booking stays off there until she switches it on; at most 5 clinics;
-- - she leaves a clinic at once, recorded with the settings she had there, but never
--   her last clinic: the functions refuse it and so does the table itself;
-- - nothing uses professional_clinics.is_primary any more (no "primary clinic").
--
-- Run against TESTING only. One transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL professional_clinic_join_leave TESTS PASSED (…)" means
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
  insert into public.clinics (name, slug, district, address, phone, is_archived)
  values (p_name, lower(replace(p_name, ' ', '-')) || '-' || p_tag, 'Paphos', '1 ' || p_name || ' St, Paphos',
          '26123456', p_archived)
  returning id into v_id;
  return v_id;
end
$f$;


do $test$
declare
  v_tag text := substr(md5(random()::text), 1, 8);
  v_checks int := 0;
  v_pro uuid;
  v_other uuid;
  v_listing uuid;
  v_home uuid;
  v_second uuid;
  v_archived uuid;
  v_extra uuid;
  v_home_link uuid;
  v_link uuid;
  v_out jsonb;
  v_req uuid;
  v_row public.request_log%rowtype;
  v_pc public.professional_clinics%rowtype;
  v_i int;
  v_fn text;
begin
  ---------------------------------------------------------------- fixtures
  insert into public.professionals (name, slug, is_registered, auth_user_id, registration_email)
  values ('Cj Pro', 'cj-pro-' || v_tag, true, pg_temp.new_login('cj-pro-' || v_tag || '@integration.test'),
          'cj-pro-' || v_tag || '@integration.test')
  returning id into v_pro;
  insert into public.professionals (name, slug, is_registered, auth_user_id, registration_email)
  values ('Cj Other', 'cj-other-' || v_tag, true, pg_temp.new_login('cj-other-' || v_tag || '@integration.test'),
          'cj-other-' || v_tag || '@integration.test')
  returning id into v_other;
  insert into public.professionals (name, slug, is_registered)
  values ('Cj Listing', 'cj-listing-' || v_tag, false)
  returning id into v_listing;

  v_home := pg_temp.new_clinic('Cj Home', v_tag);
  v_second := pg_temp.new_clinic('Cj Second', v_tag);
  v_archived := pg_temp.new_clinic('Cj Archived', v_tag, true);
  insert into public.professional_clinics (professional_id, clinic_id, sort_order, pause_online_bookings,
                                           slot_duration_minutes)
  values (v_pro, v_home, 3, false, 20)
  returning id into v_home_link;
  insert into public.professional_clinics (professional_id, clinic_id) values (v_other, v_home);
  insert into public.professional_clinics (professional_id, clinic_id) values (v_listing, v_home);

  ---------------------------------------------------------------- types
  assert (select count(*) from public.request_types
          where name in ('professional_clinic_join', 'professional_clinic_leave')
            and not requires_approval and is_edit) = 2,
    'FAIL: joining and leaving a clinic need no founder and are recorded at once';
  v_checks := v_checks + 1;

  ---------------------------------------------------------------- join
  v_out := public.professional_clinic_join(v_pro, v_second);
  v_link := (v_out ->> 'link_id')::uuid;
  select * into v_pc from public.professional_clinics where id = v_link;
  assert v_pc.professional_id = v_pro and v_pc.clinic_id = v_second,
    'FAIL: joining links her to the clinic';
  assert v_pc.pause_online_bookings,
    'FAIL: a clinic she just joined takes no online bookings until she switches them on';
  assert v_pc.monday and v_pc.friday and not v_pc.saturday and not v_pc.sunday
    and v_pc.start_time = '09:00' and v_pc.end_time = '17:00' and v_pc.slot_duration_minutes = 30,
    'FAIL: a joined clinic starts with the same week as at registration';
  assert v_pc.sort_order = 4, 'FAIL: a joined clinic comes after the ones she has';
  assert (v_out ->> 'clinic_id')::uuid = v_second, 'FAIL: joining answers with the clinic';
  v_checks := v_checks + 5;

  select * into v_row from public.request_log where id = (v_out ->> 'request_id')::uuid;
  assert v_row.request_type = 'professional_clinic_join' and v_row.status = 'recorded'
    and v_row.professional_id = v_pro and v_row.decided_at is not null,
    'FAIL: joining is recorded at once';
  assert v_row.details = jsonb_build_object('link_id', v_link, 'clinic_id', v_second,
      'clinic_name', 'Cj Second', 'clinic_address', '1 Cj Second St, Paphos'),
    'FAIL: the record names the clinic she joined';
  assert v_row.before_snapshot = jsonb_build_object('clinics', jsonb_build_array(
      jsonb_build_object('clinic_id', v_home, 'clinic_name', 'Cj Home'))),
    'FAIL: the record keeps the clinics she had before';
  v_checks := v_checks + 3;

  perform pg_temp.expect_error(
    format('select public.professional_clinic_join(%L, %L)', v_pro, v_second), '23505', 'joining a clinic twice');
  perform pg_temp.expect_error(
    format('select public.professional_clinic_join(%L, %L)', v_pro, v_archived), 'P0002', 'joining an archived clinic');
  perform pg_temp.expect_error(
    format('select public.professional_clinic_join(%L, %L)', v_pro, gen_random_uuid()), 'P0002', 'joining an unknown clinic');
  perform pg_temp.expect_error(
    format('select public.professional_clinic_join(%L, %L)', gen_random_uuid(), v_second), 'P0002',
    'an unknown professional joining');
  perform pg_temp.expect_error(
    format('select public.professional_clinic_join(%L, %L)', v_listing, v_second), '22023',
    'a listing that has not signed up joining');
  v_checks := v_checks + 5;

  -- At most 5 clinics.
  for v_i in 1..3 loop
    v_extra := pg_temp.new_clinic('Cj Extra ' || v_i, v_tag);
    perform public.professional_clinic_join(v_pro, v_extra);
  end loop;
  assert (select count(*) from public.professional_clinics where professional_id = v_pro) = 5,
    'FAIL: she can have 5 clinics';
  v_extra := pg_temp.new_clinic('Cj Sixth', v_tag);
  perform pg_temp.expect_error(
    format('select public.professional_clinic_join(%L, %L)', v_pro, v_extra), '23514', 'joining a 6th clinic');
  v_checks := v_checks + 2;

  ---------------------------------------------------------------- leave
  perform pg_temp.expect_error(
    format('select public.professional_clinic_leave(%L, %L)', v_other, v_home_link), 'P0002',
    'leaving through a link that is not hers');
  perform pg_temp.expect_error(
    format('select public.professional_clinic_leave(%L, %L)', v_pro, gen_random_uuid()), 'P0002',
    'leaving a clinic she is not at');
  v_checks := v_checks + 2;

  v_req := public.professional_clinic_leave(v_pro, v_home_link);
  assert not exists (select 1 from public.professional_clinics where id = v_home_link),
    'FAIL: leaving removes her link to the clinic';
  assert exists (select 1 from public.clinics where id = v_home)
    and exists (select 1 from public.professional_clinics where professional_id = v_other and clinic_id = v_home),
    'FAIL: the clinic and its other professionals stay';
  select * into v_row from public.request_log where id = v_req;
  assert v_row.request_type = 'professional_clinic_leave' and v_row.status = 'recorded'
    and v_row.professional_id = v_pro,
    'FAIL: leaving is recorded at once';
  assert v_row.details = jsonb_build_object('link_id', v_home_link, 'clinic_id', v_home,
      'clinic_name', 'Cj Home', 'clinic_address', '1 Cj Home St, Paphos'),
    'FAIL: the record names the clinic she left';
  assert (v_row.before_snapshot -> 'settings' ->> 'slot_duration_minutes')::int = 20
    and (v_row.before_snapshot -> 'settings' ->> 'pause_online_bookings')::boolean = false
    and (v_row.before_snapshot -> 'settings' ->> 'id')::uuid = v_home_link,
    'FAIL: the record keeps the settings she had at the clinic';
  v_checks := v_checks + 5;

  -- Never the last clinic: the other professional has one, and an archived clinic
  -- does not count as one to fall back on.
  select id into v_link from public.professional_clinics where professional_id = v_other and clinic_id = v_home;
  perform pg_temp.expect_error(
    format('select public.professional_clinic_leave(%L, %L)', v_other, v_link), '23514', 'leaving her only clinic');
  insert into public.professional_clinics (professional_id, clinic_id) values (v_other, v_archived);
  perform pg_temp.expect_error(
    format('select public.professional_clinic_leave(%L, %L)', v_other, v_link), '23514',
    'leaving her only clinic that is not archived');
  assert exists (select 1 from public.professional_clinics where id = v_link),
    'FAIL: a refused leave changes nothing';
  v_checks := v_checks + 3;

  ---------------------------------------------------------------- the table keeps one clinic
  perform pg_temp.expect_error(
    format('delete from public.professional_clinics where professional_id = %L; set constraints all immediate',
           v_other),
    '23514', 'deleting every clinic of a signed-up professional');
  set constraints all deferred;
  assert (select count(*) from public.professional_clinics where professional_id = v_other) = 2,
    'FAIL: a refused delete changes nothing';
  v_checks := v_checks + 2;

  -- Replacing her clinics in one transaction is fine (the registration approval does it).
  delete from public.professional_clinics where professional_id = v_other;
  insert into public.professional_clinics (professional_id, clinic_id) values (v_other, v_second);
  set constraints all immediate;
  set constraints all deferred;
  -- A listing that has not signed up may have no clinic.
  delete from public.professional_clinics where professional_id = v_listing;
  set constraints all immediate;
  set constraints all deferred;
  -- Deleting the professional takes her clinics with her.
  delete from public.professionals where id = v_other;
  set constraints all immediate;
  set constraints all deferred;
  v_checks := v_checks + 3;

  ---------------------------------------------------------------- no "primary clinic"
  assert (select is_primary from public.professional_clinics where professional_id = v_pro and clinic_id = v_second)
    = false, 'FAIL: joining does not mark a primary clinic';
  assert not exists (
    select 1 from pg_proc
    where pronamespace = 'public'::regnamespace and prosrc ilike '%is_primary%'
  ), 'FAIL: no database function uses is_primary any more';
  -- The order shown today is kept in sort_order: where a clinic is still marked
  -- primary, it is the first one, and no two clinics of a professional share a place.
  assert not exists (
    select 1 from (
      select is_primary, row_number() over (
        partition by professional_id order by sort_order, created_at, id) as rn
      from public.professional_clinics
      where professional_id not in (v_pro)
    ) r where r.is_primary and r.rn > 1
  ), 'FAIL: a clinic marked primary comes first by sort_order';
  assert not exists (
    select 1 from public.professional_clinics
    where professional_id <> v_pro
    group by professional_id, sort_order having count(*) > 1
  ), 'FAIL: each clinic of a professional has its own place in the order';
  v_checks := v_checks + 4;

  ---------------------------------------------------------------- access
  foreach v_fn in array array[
    'public.professional_clinic_join(uuid, uuid)',
    'public.professional_clinic_leave(uuid, uuid)',
    'public.professional_clinics_keep_one()'
  ] loop
    assert not has_function_privilege('anon', v_fn, 'execute')
      and not has_function_privilege('authenticated', v_fn, 'execute'),
      format('FAIL: a session cannot call %s', v_fn);
    v_checks := v_checks + 1;
  end loop;
  assert has_function_privilege('service_role', 'public.professional_clinic_join(uuid, uuid)', 'execute')
    and has_function_privilege('service_role', 'public.professional_clinic_leave(uuid, uuid)', 'execute'),
    'FAIL: the service role joins and leaves for her';
  assert has_function_privilege('service_role',
      'public.public_professionals_occupied_datetimes(uuid[], timestamptz, timestamptz)', 'execute')
    and not has_function_privilege('anon',
      'public.public_professionals_occupied_datetimes(uuid[], timestamptz, timestamptz)', 'execute'),
    'FAIL: the occupancy function keeps its grants';
  v_checks := v_checks + 2;

  raise exception 'ALL professional_clinic_join_leave TESTS PASSED (% checks); rolled back', v_checks;
end
$test$;

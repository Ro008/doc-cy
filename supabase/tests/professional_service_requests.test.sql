-- Database tests for services changed from Settings
-- (migrations *_professional_service_requests and *_professional_services_not_writable).
--
-- Settings → Services & prices (user, 2026-10-10): she adds, changes and removes the
-- services on her price list as she pleases, with no founder, and every change is
-- recorded in request_log:
-- - a service has a name (1 to 80 characters) and an optional price in euros, kept as
--   text: an amount ("120", "49.50") or a lowest price ("From 80");
-- - at most 20 services, and no name twice (capitals and spaces aside);
-- - the table is no longer written through a session, only through the functions.
--
-- Run against TESTING only. One transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL professional_service_requests TESTS PASSED (…)" means
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
  v_pro uuid;
  v_other uuid;
  v_listing uuid;
  v_out jsonb;
  v_sid uuid;
  v_sid2 uuid;
  v_req uuid;
  v_row public.request_log%rowtype;
  v_i int;
  v_fn text;
  v_priv text;
begin
  ---------------------------------------------------------------- fixtures
  insert into public.professionals (name, slug, is_registered, auth_user_id, registration_email)
  values ('Sv Pro', 'sv-pro-' || v_tag, true, pg_temp.new_login('sv-pro-' || v_tag || '@integration.test'),
          'sv-pro-' || v_tag || '@integration.test')
  returning id into v_pro;
  insert into public.professionals (name, slug, is_registered, auth_user_id, registration_email)
  values ('Sv Other', 'sv-other-' || v_tag, true, pg_temp.new_login('sv-other-' || v_tag || '@integration.test'),
          'sv-other-' || v_tag || '@integration.test')
  returning id into v_other;
  insert into public.professionals (name, slug, is_registered)
  values ('Sv Listing', 'sv-listing-' || v_tag, false)
  returning id into v_listing;

  ---------------------------------------------------------------- types
  assert (select count(*) from public.request_types
          where name in ('professional_service_add', 'professional_service_change', 'professional_service_removal')
            and not requires_approval and is_edit) = 3,
    'FAIL: the three service changes need no founder and are recorded at once';
  v_checks := v_checks + 1;

  ---------------------------------------------------------------- add
  v_out := public.professional_service_add(v_pro, '  Facial   laser ', ' From 80 ');
  v_sid := (v_out -> 'service' ->> 'id')::uuid;
  assert v_out -> 'service' = jsonb_build_object('id', v_sid, 'name', 'Facial laser', 'price', 'From 80'),
    'FAIL: adding answers with the service, its name trimmed and single-spaced';
  assert (select name = 'Facial laser' and price = 'From 80' from public.professional_services
          where id = v_sid and professional_id = v_pro),
    'FAIL: the service is on her list';
  select * into v_row from public.request_log where id = (v_out ->> 'request_id')::uuid;
  assert v_row.request_type = 'professional_service_add' and v_row.status = 'recorded'
    and v_row.professional_id = v_pro
    and v_row.details = jsonb_build_object('id', v_sid, 'name', 'Facial laser', 'price', 'From 80')
    and v_row.before_snapshot = jsonb_build_object('services', '[]'::jsonb),
    'FAIL: adding is recorded at once with the service and the list before';
  v_checks := v_checks + 3;

  v_out := public.professional_service_add(v_pro, 'Consultation', null);
  v_sid2 := (v_out -> 'service' ->> 'id')::uuid;
  assert (select price is null from public.professional_services where id = v_sid2),
    'FAIL: a service may have no price';
  assert (select before_snapshot from public.request_log where id = (v_out ->> 'request_id')::uuid)
    = jsonb_build_object('services', jsonb_build_array(
        jsonb_build_object('id', v_sid, 'name', 'Facial laser', 'price', 'From 80'))),
    'FAIL: the list before holds what she had';
  assert (public.professional_service_add(v_pro, 'Empty price', '  ') -> 'service' -> 'price') = 'null'::jsonb,
    'FAIL: an empty price means none';
  assert (public.professional_service_add(v_pro, 'Cents', '49.50') -> 'service' ->> 'price') = '49.50',
    'FAIL: a price may have cents';
  v_checks := v_checks + 4;

  perform pg_temp.expect_error(format('select public.professional_service_add(%L, %L, null)', v_pro, '   '),
    '22023', 'a service needs a name');
  perform pg_temp.expect_error(format('select public.professional_service_add(%L, %L, null)', v_pro, repeat('x', 81)),
    '22023', 'a name over 80 characters is refused');
  foreach v_priv in array array['abc', '€60', '60 EUR', '-5', '100000', '12.345', 'from 80', 'From  80', '49,50'] loop
    perform pg_temp.expect_error(
      format('select public.professional_service_add(%L, %L, %L)', v_pro, 'Bad price ' || v_priv, v_priv),
      '22023', 'the price ' || v_priv || ' is refused');
    v_checks := v_checks + 1;
  end loop;
  perform pg_temp.expect_error(format('select public.professional_service_add(%L, %L, null)', v_pro, ' facial  LASER '),
    '23505', 'the same name twice is refused, capitals and spaces aside');
  perform pg_temp.expect_error(format('select public.professional_service_add(%L, %L, null)', v_listing, 'Laser'),
    '22023', 'a listing that never signed up cannot add one');
  perform pg_temp.expect_error(format('select public.professional_service_add(%L, %L, null)', gen_random_uuid(), 'Laser'),
    'P0002', 'an unknown professional is refused');
  v_checks := v_checks + 5;

  -- Another professional may use the same name.
  perform public.professional_service_add(v_other, 'Facial laser', '100');
  v_checks := v_checks + 1;

  ---------------------------------------------------------------- change
  v_out := public.professional_service_update(v_pro, v_sid, 'Facial laser', 'From 80');
  assert v_out -> 'request_id' = 'null'::jsonb
    and v_out -> 'service' = jsonb_build_object('id', v_sid, 'name', 'Facial laser', 'price', 'From 80'),
    'FAIL: the same name and price change nothing and record nothing';
  v_out := public.professional_service_update(v_pro, v_sid, ' Facial  laser (CO2) ', '120');
  select * into v_row from public.request_log where id = (v_out ->> 'request_id')::uuid;
  assert v_row.request_type = 'professional_service_change' and v_row.status = 'recorded'
    and v_row.details = jsonb_build_object('id', v_sid, 'name', 'Facial laser (CO2)', 'price', '120')
    and v_row.before_snapshot -> 'services' @> jsonb_build_array(
          jsonb_build_object('id', v_sid, 'name', 'Facial laser', 'price', 'From 80'))
    and jsonb_array_length(v_row.before_snapshot -> 'services') = 4,
    'FAIL: a change is recorded at once with the new values and the list before';
  assert (select name = 'Facial laser (CO2)' and price = '120' from public.professional_services where id = v_sid),
    'FAIL: the service has its new name and price';
  -- Only the capitals of her own name: allowed, and recorded.
  v_out := public.professional_service_update(v_pro, v_sid, 'FACIAL laser (CO2)', '120');
  assert v_out ->> 'request_id' is not null, 'FAIL: she may change the capitals of a name';
  v_out := public.professional_service_update(v_pro, v_sid, 'FACIAL laser (CO2)', null);
  assert (select price is null from public.professional_services where id = v_sid),
    'FAIL: a price can be taken off';
  v_checks := v_checks + 5;

  perform pg_temp.expect_error(
    format('select public.professional_service_update(%L, %L, %L, null)', v_pro, v_sid, 'consultation'),
    '23505', 'a change cannot take the name of another of her services');
  perform pg_temp.expect_error(
    format('select public.professional_service_update(%L, %L, %L, null)', v_pro, v_sid, ''),
    '22023', 'a change needs a name');
  perform pg_temp.expect_error(
    format('select public.professional_service_update(%L, %L, %L, %L)', v_pro, v_sid, 'Laser', 'cheap'),
    '22023', 'a change needs a price in euros');
  perform pg_temp.expect_error(
    format('select public.professional_service_update(%L, %L, %L, null)', v_other, v_sid, 'Mine now'),
    'P0002', 'she cannot change a service of another professional');
  perform pg_temp.expect_error(
    format('select public.professional_service_update(%L, %L, %L, null)', v_pro, gen_random_uuid(), 'Ghost'),
    'P0002', 'an unknown service cannot be changed');
  v_checks := v_checks + 5;

  ---------------------------------------------------------------- remove
  perform pg_temp.expect_error(
    format('select public.professional_service_remove(%L, %L)', v_other, v_sid),
    'P0002', 'she cannot remove a service of another professional');
  v_req := public.professional_service_remove(v_pro, v_sid2);
  select * into v_row from public.request_log where id = v_req;
  assert v_row.request_type = 'professional_service_removal' and v_row.status = 'recorded'
    and v_row.details = jsonb_build_object('id', v_sid2, 'name', 'Consultation', 'price', null)
    and jsonb_array_length(v_row.before_snapshot -> 'services') = 4,
    'FAIL: removing is recorded at once with the service and the list before';
  assert not exists (select 1 from public.professional_services where id = v_sid2)
    and (select count(*) from public.professional_services where professional_id = v_pro) = 3,
    'FAIL: the removed service is gone and the others stay';
  perform pg_temp.expect_error(
    format('select public.professional_service_remove(%L, %L)', v_pro, v_sid2),
    'P0002', 'a service already removed cannot be removed again');
  v_checks := v_checks + 4;

  ---------------------------------------------------------------- at most 20
  for v_i in 1..17 loop
    perform public.professional_service_add(v_pro, 'Service ' || v_i, v_i::text);
  end loop;
  assert (select count(*) from public.professional_services where professional_id = v_pro) = 20,
    'FAIL: she can list 20 services';
  perform pg_temp.expect_error(format('select public.professional_service_add(%L, %L, null)', v_pro, 'One too many'),
    '23514', 'the 21st service is refused');
  -- At 20 she can still change and remove.
  perform public.professional_service_update(v_pro, v_sid, 'Laser', '90');
  perform public.professional_service_remove(v_pro, v_sid);
  perform public.professional_service_add(v_pro, 'Fits again', null);
  v_checks := v_checks + 3;

  ---------------------------------------------------------------- access
  foreach v_fn in array array[
    'public.professional_service_add(uuid, text, text)',
    'public.professional_service_update(uuid, uuid, text, text)',
    'public.professional_service_remove(uuid, uuid)'
  ] loop
    assert not has_function_privilege('anon', v_fn, 'execute')
      and not has_function_privilege('authenticated', v_fn, 'execute')
      and has_function_privilege('service_role', v_fn, 'execute'),
      format('FAIL: only the service role calls %s', v_fn);
    v_checks := v_checks + 1;
  end loop;
  foreach v_priv in array array['insert', 'update', 'delete', 'truncate'] loop
    assert not has_table_privilege('anon', 'public.professional_services', v_priv)
      and not has_table_privilege('authenticated', 'public.professional_services', v_priv),
      format('FAIL: a session cannot %s services directly', v_priv);
    v_checks := v_checks + 1;
  end loop;
  assert has_table_privilege('authenticated', 'public.professional_services', 'select'),
    'FAIL: she can still read her services';
  v_checks := v_checks + 1;

  raise exception 'ALL professional_service_requests TESTS PASSED (% checks); rolled back', v_checks;
end
$test$;

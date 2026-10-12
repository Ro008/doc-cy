-- Database tests for clinic web addresses that follow the name
-- (migration *_clinic_slug_redirects).
--
-- User, 2026-10-12: when founders approve a new clinic name, the clinic's web address
-- (slug) changes with it, and the old address keeps working: it is kept in
-- clinic_slug_redirects and the clinic page forwards it. Nobody else is ever given an
-- address that still forwards to another clinic.
--
-- Run against TESTING only. One transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL clinic_slug_redirects TESTS PASSED (…)" means success;
-- any "FAIL: …" names the broken rule.

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

create or replace function pg_temp.new_clinic(p_name text, p_slug text)
returns uuid
language plpgsql
as $f$
declare
  v_id uuid;
begin
  insert into public.clinics (name, slug, district, address, phone, latitude, longitude)
  values (p_name, p_slug, 'Paphos', '1 ' || p_name || ' St, Paphos', '26123456', 34.77, 32.42)
  returning id into v_id;
  return v_id;
end
$f$;

create or replace function pg_temp.rename(p_pro uuid, p_admin uuid, p_clinic uuid, p_name text)
returns uuid
language plpgsql
as $f$
declare
  v_req uuid;
begin
  v_req := public.request_submit('professional_clinic_details_change', p_pro,
    jsonb_build_object('clinic_id', p_clinic, 'changes', jsonb_build_object('name', p_name)));
  perform public.request_approve(v_req, p_admin);
  return v_req;
end
$f$;


do $test$
declare
  v_tag text := substr(md5(random()::text), 1, 8);
  v_checks int := 0;
  v_admin uuid;
  v_pro uuid;
  v_home uuid;
  v_other uuid;
  v_req uuid;
  v_slug text;
  v_fn text;
begin
  ---------------------------------------------------------------- fixtures
  update public.request_types
  set limit_count = null, limit_window = null, limit_scope_key = null, wait_after_approval = null;
  insert into public.admin_users (auth_user_id, name, email, role)
  values (pg_temp.new_login('sr-founder-' || v_tag || '@integration.test'), 'Sr Founder',
          'sr-founder-' || v_tag || '@integration.test', 'founder')
  returning id into v_admin;
  insert into public.professionals (name, slug, is_registered, auth_user_id, registration_email)
  values ('Sr Pro', 'sr-pro-' || v_tag, true, pg_temp.new_login('sr-pro-' || v_tag || '@integration.test'),
          'sr-pro-' || v_tag || '@integration.test')
  returning id into v_pro;
  v_home := pg_temp.new_clinic('Sr Home ' || v_tag, 'sr-home-' || v_tag);
  v_other := pg_temp.new_clinic('Sr Other ' || v_tag, 'sr-other-' || v_tag);
  insert into public.professional_clinics (professional_id, clinic_id, sort_order) values (v_pro, v_home, 0);
  insert into public.professional_clinics (professional_id, clinic_id, sort_order) values (v_pro, v_other, 1);

  ---------------------------------------------------------------- the table is closed to sessions
  assert (select relrowsecurity from pg_class where oid = 'public.clinic_slug_redirects'::regclass),
    'FAIL: clinic_slug_redirects has row level security';
  assert not has_table_privilege('anon', 'public.clinic_slug_redirects', 'select')
    and not has_table_privilege('authenticated', 'public.clinic_slug_redirects', 'select')
    and not has_table_privilege('anon', 'public.clinic_slug_redirects', 'insert')
    and not has_table_privilege('authenticated', 'public.clinic_slug_redirects', 'insert,update,delete'),
    'FAIL: a session cannot read or write clinic_slug_redirects';
  assert has_table_privilege('service_role', 'public.clinic_slug_redirects', 'select'),
    'FAIL: the server reads clinic_slug_redirects';
  v_checks := v_checks + 3;

  ---------------------------------------------------------------- a new name moves the address
  v_req := pg_temp.rename(v_pro, v_admin, v_home, 'Sr Médical Centre ' || v_tag);
  assert (select slug from public.clinics where id = v_home) = 'sr-medical-centre-' || v_tag,
    'FAIL: the address follows the approved name';
  assert (select clinic_id from public.clinic_slug_redirects where slug = 'sr-home-' || v_tag) = v_home,
    'FAIL: the old address forwards to the clinic';
  assert (select outcome from public.request_log where id = v_req) = jsonb_build_object(
      'clinic_id', v_home, 'changed', jsonb_build_array('name'),
      'slug', 'sr-medical-centre-' || v_tag, 'previous_slug', 'sr-home-' || v_tag),
    'FAIL: the approval records the old and the new address';
  v_checks := v_checks + 3;

  ---------------------------------------------------------------- phone or address alone: the address stays
  v_req := public.request_submit('professional_clinic_details_change', v_pro,
    jsonb_build_object('clinic_id', v_home, 'changes', '{"phone":"26654321"}'::jsonb));
  perform public.request_approve(v_req, v_admin);
  assert (select slug from public.clinics where id = v_home) = 'sr-medical-centre-' || v_tag
    and (select count(*) from public.clinic_slug_redirects where clinic_id = v_home) = 1,
    'FAIL: a phone change leaves the address alone';
  assert (select outcome from public.request_log where id = v_req)
    = jsonb_build_object('clinic_id', v_home, 'changed', jsonb_build_array('phone')),
    'FAIL: with no new address the approval records none';
  v_checks := v_checks + 2;

  ---------------------------------------------------------------- a name that gives the same address
  perform pg_temp.rename(v_pro, v_admin, v_home, 'SR MEDICAL CENTRE ' || v_tag);
  assert (select slug from public.clinics where id = v_home) = 'sr-medical-centre-' || v_tag
    and (select count(*) from public.clinic_slug_redirects where clinic_id = v_home) = 1,
    'FAIL: a new spelling with the same address moves nothing';
  -- A name with no Latin letters or digits gives no address of its own: keep the one she has.
  perform pg_temp.rename(v_pro, v_admin, v_home, 'Ιατρείο');
  assert (select slug from public.clinics where id = v_home) = 'sr-medical-centre-' || v_tag,
    'FAIL: a name that gives no address keeps the current one';
  v_checks := v_checks + 2;

  ---------------------------------------------------------------- nobody takes an address that forwards
  perform pg_temp.rename(v_pro, v_admin, v_other, 'Sr Home ' || v_tag);
  assert (select slug from public.clinics where id = v_other) = 'sr-home-' || v_tag || '-2',
    'FAIL: another clinic is not given an address that forwards elsewhere';
  assert (select clinic_id from public.clinic_slug_redirects where slug = 'sr-home-' || v_tag) = v_home,
    'FAIL: the old address still forwards to its own clinic';
  assert public.request_clinic_slug('Sr Home ' || v_tag) = 'sr-home-' || v_tag || '-3',
    'FAIL: a new clinic skips addresses in use and addresses that forward';
  -- An address in use by another clinic is skipped too.
  perform pg_temp.rename(v_pro, v_admin, v_other, 'Sr Medical Centre ' || v_tag);
  assert (select slug from public.clinics where id = v_other) = 'sr-medical-centre-' || v_tag || '-2',
    'FAIL: a clinic is not given another clinic''s address';
  v_checks := v_checks + 4;

  ---------------------------------------------------------------- back to the old name
  perform pg_temp.rename(v_pro, v_admin, v_home, 'Sr Home ' || v_tag);
  assert (select slug from public.clinics where id = v_home) = 'sr-home-' || v_tag,
    'FAIL: a clinic may take back its own old address';
  assert not exists (select 1 from public.clinic_slug_redirects where slug = 'sr-home-' || v_tag),
    'FAIL: an address in use does not forward';
  assert (select clinic_id from public.clinic_slug_redirects where slug = 'sr-medical-centre-' || v_tag) = v_home,
    'FAIL: the address it had meanwhile forwards';
  assert not exists (
      select 1 from public.clinic_slug_redirects r join public.clinics c on c.slug = r.slug),
    'FAIL: no address both belongs to a clinic and forwards';
  v_checks := v_checks + 4;

  ---------------------------------------------------------------- a deleted clinic takes its forwards along
  delete from public.professional_clinics where clinic_id = v_home;
  begin
    delete from public.clinics where id = v_home;
    assert not exists (select 1 from public.clinic_slug_redirects where clinic_id = v_home),
      'FAIL: a deleted clinic leaves no forward behind';
  exception when foreign_key_violation then
    -- Something else still points at the clinic (request_log keeps its id as text, so not that):
    -- the rule is then proven by the constraint itself.
    assert (select confdeltype from pg_constraint
            where conrelid = 'public.clinic_slug_redirects'::regclass and contype = 'f') = 'c',
      'FAIL: forwards go when their clinic goes';
  end;
  v_checks := v_checks + 1;

  ---------------------------------------------------------------- access
  foreach v_fn in array array[
    'public.clinic_slug_pick(text, uuid)',
    'public.request_clinic_slug(text)'
  ] loop
    assert not has_function_privilege('anon', v_fn, 'execute')
      and not has_function_privilege('authenticated', v_fn, 'execute'),
      format('FAIL: a session cannot call %s', v_fn);
    v_checks := v_checks + 1;
  end loop;

  raise exception 'ALL clinic_slug_redirects TESTS PASSED (% checks); rolled back', v_checks;
end
$test$;

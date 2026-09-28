-- Database tests for unique professional contact details
-- (migration *_professional_contact_unique).
--
-- registration_email and mobile_number (the professional's personal mobile) belong
-- to one real professional each. Test profiles never block anyone.
--
-- Run against TESTING only (Supabase SQL editor or the MCP execute_sql tool).
-- Everything runs in one transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL professional_contact TESTS PASSED (…)" means success;
-- any "FAIL: …" names the broken rule. Nothing is left behind.

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

-- A listing-shaped row carrying contact details (no login needed).
create or replace function pg_temp.new_pro(p_tag text, p_email text, p_mobile text, p_test boolean)
returns uuid
language plpgsql
as $f$
declare
  v_id uuid;
begin
  insert into public.professionals (name, slug, is_registered, is_test_profile, registration_email, mobile_number)
  values ('Contact ' || p_tag, 'contact-' || p_tag, false, p_test, p_email, p_mobile)
  returning id into v_id;
  return v_id;
end
$f$;

create or replace function pg_temp.details(p_email text, p_mobile text, p_last text)
returns jsonb
language sql
as $f$
  select jsonb_build_object(
    'first_name', 'Contact',
    'last_name', p_last,
    'gender', 'female',
    'gesy', true,
    'email', p_email,
    'mobile', p_mobile,
    'languages', jsonb_build_array('English'),
    'photo', null,
    'specialties', jsonb_build_array(
      jsonb_build_object('name', 'Cardiology', 'from_catalogue', true, 'license_number', 'LIC-1')),
    'clinics', jsonb_build_array(),
    'claimed_professional_id', null,
    'disclaimer_accepted', true
  );
$f$;

-- A confirmed applicant with a pending request; returns the applicant's login.
create or replace function pg_temp.new_applicant(p_email text, p_mobile text, p_last text)
returns uuid
language plpgsql
as $f$
declare
  v_login uuid := pg_temp.new_login(p_email);
begin
  perform public.request_draft_submit('professional_registration', v_login,
    pg_temp.details(p_email, p_mobile, p_last), 1::smallint, 'Contact ' || p_last, p_email);
  perform public.request_draft_confirm(v_login);
  return v_login;
end
$f$;

do $test$
declare
  v_checks int := 0;
  v_tag text := substr(md5(random()::text), 1, 8);
  -- Random Cyprus-style mobile digits, so leftovers in Testing can't collide.
  v_mob text := '+35799' || lpad((floor(random() * 1000000))::int::text, 6, '0');
  v_mob2 text := '+35796' || lpad((floor(random() * 1000000))::int::text, 6, '0');
  v_mob3 text := '+35797' || lpad((floor(random() * 1000000))::int::text, 6, '0');
  v_email text := 'contact-' || v_tag || '@example.org';
  v_pro uuid;
  v_login uuid;
  v_applicant uuid;
  v_r record;
begin
  -- 1. Access: the check is service role only.
  if to_regprocedure('public.professional_contact_in_use(text, text, uuid)') is null then
    raise exception 'FAIL: professional_contact_in_use(text, text, uuid) is missing';
  end if;
  if has_function_privilege('anon', 'public.professional_contact_in_use(text, text, uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.professional_contact_in_use(text, text, uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.professional_contact_in_use(text, text, uuid)', 'EXECUTE') then
    raise exception 'FAIL: professional_contact_in_use must be callable by the service role only';
  end if;
  v_checks := v_checks + 2;

  -- 2. Two real professionals can't share an email (case and spaces ignored) or a
  --    mobile (formatting ignored).
  v_pro := pg_temp.new_pro(v_tag || '-a', v_email, v_mob, false);
  perform pg_temp.expect_error(
    format($$select pg_temp.new_pro(%L, %L, null, false)$$, v_tag || '-b', '  ' || upper(v_email) || ' '),
    '23505', 'a second real professional with the same email');
  perform pg_temp.expect_error(
    format($$select pg_temp.new_pro(%L, null, %L, false)$$, v_tag || '-c',
      '+357 ' || substr(v_mob, 5, 2) || ' ' || substr(v_mob, 7)),
    '23505', 'a second real professional with the same mobile, formatted differently');
  v_checks := v_checks + 2;

  -- 3. Test profiles never block and are never blocked by each other; empty values repeat.
  perform pg_temp.new_pro(v_tag || '-t1', v_email, v_mob, true);
  perform pg_temp.new_pro(v_tag || '-t2', v_email, v_mob, true);
  perform pg_temp.new_pro(v_tag || '-e1', null, '', false);
  perform pg_temp.new_pro(v_tag || '-e2', '', null, false);
  v_checks := v_checks + 2;

  -- 4. Changing a real professional's mobile to another real professional's is refused.
  perform pg_temp.new_pro(v_tag || '-d', null, v_mob2, false);
  perform pg_temp.expect_error(
    format($$update public.professionals set mobile_number = %L where id = %L$$, v_mob2, v_pro),
    '23505', 'updating a mobile to one already used by another real professional');
  v_checks := v_checks + 1;

  -- 5. The check reports a real professional's email and mobile, normalised.
  select * into v_r from public.professional_contact_in_use(upper(v_email), '+357 ' || substr(v_mob, 5), null);
  if v_r.email_in_use is distinct from 'professional' or v_r.mobile_in_use is not true then
    raise exception 'FAIL: expected (professional, true) for a real professional''s contact, got (%, %)',
      v_r.email_in_use, v_r.mobile_in_use;
  end if;
  v_checks := v_checks + 1;

  -- 6. Free values, and values used only by test profiles, are not in use.
  select * into v_r from public.professional_contact_in_use('free-' || v_tag || '@example.org', v_mob3, null);
  if v_r.email_in_use is not null or v_r.mobile_in_use then
    raise exception 'FAIL: free contact details reported in use (%, %)', v_r.email_in_use, v_r.mobile_in_use;
  end if;
  perform pg_temp.new_pro(v_tag || '-t3', 'testonly-' || v_tag || '@example.org', v_mob3, true);
  select * into v_r from public.professional_contact_in_use('testonly-' || v_tag || '@example.org', v_mob3, null);
  if v_r.email_in_use is not null or v_r.mobile_in_use then
    raise exception 'FAIL: a test profile''s contact details must not block (%, %)', v_r.email_in_use, v_r.mobile_in_use;
  end if;
  v_checks := v_checks + 2;

  -- 7. A login without a professional: the email is an existing account.
  v_login := pg_temp.new_login('login-' || v_tag || '@example.org');
  select * into v_r from public.professional_contact_in_use('LOGIN-' || v_tag || '@example.org', null, null);
  if v_r.email_in_use is distinct from 'account' then
    raise exception 'FAIL: a login''s email should be reported as an account, got %', v_r.email_in_use;
  end if;
  -- …but not when that login is the applicant (applying again, signed in).
  select * into v_r from public.professional_contact_in_use('login-' || v_tag || '@example.org', null, v_login);
  if v_r.email_in_use is not null then
    raise exception 'FAIL: the applicant''s own login must not block them, got %', v_r.email_in_use;
  end if;
  v_checks := v_checks + 2;

  -- 8. A real applicant's pending request holds its mobile; their own check ignores it.
  v_applicant := pg_temp.new_applicant('pending-' || v_tag || '@example.org', '+35795' || substr(v_mob, 7), 'Pending ' || v_tag);
  select * into v_r from public.professional_contact_in_use(null, '+35795' || substr(v_mob, 7), null);
  if v_r.mobile_in_use is not true then
    raise exception 'FAIL: a real pending request''s mobile should be in use';
  end if;
  select * into v_r from public.professional_contact_in_use('pending-' || v_tag || '@example.org', '+35795' || substr(v_mob, 7), v_applicant);
  if v_r.mobile_in_use or v_r.email_in_use is not null then
    raise exception 'FAIL: the applicant''s own pending request must not block them (%, %)', v_r.email_in_use, v_r.mobile_in_use;
  end if;
  v_checks := v_checks + 2;

  -- 9. A test applicant's pending request never blocks.
  perform pg_temp.new_applicant('pending-' || v_tag || '@integration.test', '+35794' || substr(v_mob, 7), 'Testpending ' || v_tag);
  select * into v_r from public.professional_contact_in_use(null, '+35794' || substr(v_mob, 7), null);
  if v_r.mobile_in_use then
    raise exception 'FAIL: a test pending request must not block';
  end if;
  v_checks := v_checks + 1;

  raise exception 'ALL professional_contact TESTS PASSED (% checks)', v_checks;
end
$test$;

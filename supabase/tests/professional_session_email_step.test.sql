-- Database tests for the emailed sign-in step
-- (migration *_professional_session_email_step).
--
-- A professional signs in with her password, then with the link or code emailed to
-- her. Supabase marks a session made from the link or code with an `amr` entry
-- `{"method":"otp","timestamp":…}` (a password reset gives the same mark). The rules
-- that guard her appointments, settings, clinics, services and profile edits accept
-- a session only when that mark is at most 30 days old, so a stolen password alone
-- (a session marked only "password") reaches nothing. Reading her own profile row
-- stays open (the site tells professionals from applicants with it).
--
-- Run against TESTING only (Supabase SQL editor or the MCP execute_sql tool).
-- Everything runs in one transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL professional_session_email_step TESTS PASSED (…)"
-- means success; any "FAIL: …" names the broken rule. Nothing is left behind.

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

-- Acts as the signed-in user with the given `amr` (as PostgREST does). The test goes
-- back with `reset role` inline: temp functions can't be called as `authenticated`.
create or replace function pg_temp.as_user(p_login uuid, p_amr jsonb)
returns void
language plpgsql
as $f$
begin
  perform set_config(
    'request.jwt.claims',
    (jsonb_build_object('sub', p_login, 'role', 'authenticated', 'aal', 'aal1')
      || case when p_amr is null then '{}'::jsonb else jsonb_build_object('amr', p_amr) end)::text,
    true);
  execute 'set local role authenticated';
end
$f$;

create or replace function pg_temp.amr(p_method text, p_age interval)
returns jsonb
language sql
as $f$
  select jsonb_build_array(jsonb_build_object(
    'method', p_method,
    'timestamp', floor(extract(epoch from now() - p_age))::bigint));
$f$;

do $test$
declare
  v_login uuid;
  v_pro uuid;
  v_appt uuid;
  v_n integer;
  v_ok boolean;
  v_checks integer := 0;
  v_case record;
begin
  if to_regprocedure('public.professional_session_email_step_verified()') is null then
    raise exception 'FAIL: public.professional_session_email_step_verified() does not exist';
  end if;

  v_login := pg_temp.new_login('email-step-' || gen_random_uuid() || '@integration.test');
  insert into public.professionals (name, slug, is_registered, is_test_profile, auth_user_id, status)
  values ('Email Step', 'email-step-' || substr(gen_random_uuid()::text, 1, 8), true, true, v_login, 'verified')
  returning id into v_pro;
  insert into public.professional_settings (professional_id)
  values (v_pro)
  on conflict do nothing;
  insert into public.appointments (professional_id, patient_name, patient_phone, appointment_datetime, status)
  values (v_pro, 'Patient Step', '+35799000000', now() + interval '400 days', 'REQUESTED')
  returning id into v_appt;

  -- Sessions that must reach NOTHING of hers but her own profile row.
  for v_case in
    select * from (values
      ('password only',              pg_temp.amr('password', interval '1 minute')),
      ('emailed step 31 days old',   pg_temp.amr('otp', interval '31 days')),
      ('old emailed step + password',
        pg_temp.amr('otp', interval '40 days') || pg_temp.amr('password', interval '1 minute')),
      ('no amr at all',              null::jsonb)
    ) as t(label, amr)
  loop
    perform pg_temp.as_user(v_login, v_case.amr);

    select public.professional_session_email_step_verified() into v_ok;
    if v_ok then raise exception 'FAIL: % counts as the emailed step', v_case.label; end if;
    v_checks := v_checks + 1;

    select count(*) into v_n from public.professionals where id = v_pro;
    if v_n <> 1 then raise exception 'FAIL: % cannot read her own profile row', v_case.label; end if;
    v_checks := v_checks + 1;

    select count(*) into v_n from public.appointments where id = v_appt;
    if v_n <> 0 then raise exception 'FAIL: % reads her appointments', v_case.label; end if;
    v_checks := v_checks + 1;

    update public.appointments set patient_name = 'Changed' where id = v_appt;
    get diagnostics v_n = row_count;
    if v_n <> 0 then raise exception 'FAIL: % changes her appointments', v_case.label; end if;
    v_checks := v_checks + 1;

    update public.professionals set name = 'Changed' where id = v_pro;
    get diagnostics v_n = row_count;
    if v_n <> 0 then raise exception 'FAIL: % edits her profile', v_case.label; end if;
    v_checks := v_checks + 1;

    update public.professional_settings set updated_at = now() where professional_id = v_pro;
    get diagnostics v_n = row_count;
    if v_n <> 0 then raise exception 'FAIL: % edits her settings', v_case.label; end if;
    v_checks := v_checks + 1;

    begin
      insert into public.professional_services (professional_id, name) values (v_pro, 'Step service');
      raise exception 'FAIL: % adds a service', v_case.label;
    exception when insufficient_privilege then
      v_checks := v_checks + 1;
    end;

    execute 'reset role'; perform set_config('request.jwt.claims', '', true);
  end loop;

  -- Sessions from the emailed link or code (or a password reset) within 30 days.
  for v_case in
    select * from (values
      ('emailed step today',          pg_temp.amr('otp', interval '1 minute')),
      ('emailed step 29 days old',    pg_temp.amr('otp', interval '29 days')),
      ('password + recent emailed step',
        pg_temp.amr('password', interval '2 minutes') || pg_temp.amr('otp', interval '1 minute'))
    ) as t(label, amr)
  loop
    perform pg_temp.as_user(v_login, v_case.amr);

    select public.professional_session_email_step_verified() into v_ok;
    if not v_ok then raise exception 'FAIL: % does not count as the emailed step', v_case.label; end if;
    v_checks := v_checks + 1;

    select count(*) into v_n from public.appointments where id = v_appt;
    if v_n <> 1 then raise exception 'FAIL: % cannot read her appointments', v_case.label; end if;
    v_checks := v_checks + 1;

    update public.appointments set patient_name = 'Patient Step' where id = v_appt;
    get diagnostics v_n = row_count;
    if v_n <> 1 then raise exception 'FAIL: % cannot change her appointments', v_case.label; end if;
    v_checks := v_checks + 1;

    update public.professionals set name = 'Email Step' where id = v_pro;
    get diagnostics v_n = row_count;
    if v_n <> 1 then raise exception 'FAIL: % cannot edit her profile', v_case.label; end if;
    v_checks := v_checks + 1;

    update public.professional_settings set updated_at = now() where professional_id = v_pro;
    get diagnostics v_n = row_count;
    if v_n <> 1 then raise exception 'FAIL: % cannot edit her settings', v_case.label; end if;
    v_checks := v_checks + 1;

    insert into public.professional_services (professional_id, name) values (v_pro, 'Step service ' || v_checks);
    v_checks := v_checks + 1;

    execute 'reset role'; perform set_config('request.jwt.claims', '', true);
  end loop;

  -- Someone else's verified session still reaches nothing of hers.
  perform pg_temp.as_user(pg_temp.new_login('other-' || gen_random_uuid() || '@integration.test'),
                          pg_temp.amr('otp', interval '1 minute'));
  select count(*) into v_n from public.appointments where id = v_appt;
  if v_n <> 0 then raise exception 'FAIL: another professional reads her appointments'; end if;
  v_checks := v_checks + 1;
  execute 'reset role'; perform set_config('request.jwt.claims', '', true);

  -- The check is callable where the rules run, and reads only the caller's own token.
  if not has_function_privilege('authenticated', 'public.professional_session_email_step_verified()', 'execute') then
    raise exception 'FAIL: authenticated cannot run the check its rules call';
  end if;
  v_checks := v_checks + 1;

  raise exception 'ALL professional_session_email_step TESTS PASSED (% checks)', v_checks;
end
$test$;

-- Database test for Point E7 (migrations *_rename_doctor_services_to_professional_services
-- and *_drop_doctor_services_compat_view).
--
-- doctor_services is now professional_services, its doctor_id is professional_id, and its
-- policies, index and constraints carry the new names. Between the two migrations a
-- deploy-window view doctor_services (doctor_id aliased) keeps the previous deployment
-- working; while it exists it must run with the caller's rights (security_invoker), so the
-- table's rules still decide who reads and writes.
--
-- Run against TESTING only (Supabase SQL editor or the MCP execute_sql tool).
-- Everything runs in one transaction that ALWAYS rolls back: the final error message is
-- the result. "ALL professional_services TESTS PASSED (…)" means success; any "FAIL: …"
-- names the broken rule. Nothing is left behind.

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

-- Acts as the signed-in user (as PostgREST does), with a session from the emailed link
-- (`otp`) or a password only. Go back with `reset role` inline.
create or replace function pg_temp.as_user(p_login uuid, p_method text)
returns void
language plpgsql
as $f$
begin
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_login, 'role', 'authenticated', 'aal', 'aal1',
      'amr', jsonb_build_array(jsonb_build_object(
        'method', p_method, 'timestamp', floor(extract(epoch from now()))::bigint)))::text,
    true);
  execute 'set local role authenticated';
end
$f$;

do $test$
declare
  v_checks int := 0;
  v_names text;
  v_login uuid;
  v_other uuid;
  v_pro uuid;
  v_n int;
  v_view boolean;
begin
  -- 1. The table and its columns carry the new names.
  if coalesce((select relkind from pg_class
               where oid = to_regclass('public.professional_services')), '-') <> 'r' then
    raise exception 'FAIL: public.professional_services is not a table';
  end if;
  select string_agg(column_name, ', ' order by ordinal_position) into v_names
  from information_schema.columns
  where table_schema = 'public' and table_name = 'professional_services';
  if v_names is distinct from 'id, professional_id, name, price, created_at' then
    raise exception 'FAIL: professional_services columns are %', v_names;
  end if;
  v_checks := v_checks + 1;

  -- 2. Policies, index and constraints follow the rename.
  select string_agg(policyname, ', ' order by policyname) into v_names
  from pg_policies where schemaname = 'public' and tablename = 'professional_services';
  if v_names is distinct from 'professional_services_owner_delete, professional_services_owner_insert, '
                              'professional_services_owner_update, professional_services_public_read' then
    raise exception 'FAIL: professional_services policies are %', v_names;
  end if;
  if not exists (select 1 from pg_class where oid = 'public.professional_services'::regclass and relrowsecurity) then
    raise exception 'FAIL: professional_services has RLS off';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'professional_services'
                   and indexname = 'professional_services_professional_id_idx'
                   and indexdef like '%(professional_id, created_at)') then
    raise exception 'FAIL: index professional_services_professional_id_idx (professional_id, created_at) missing';
  end if;
  select string_agg(conname || ' ' || pg_get_constraintdef(oid), '; ' order by conname) into v_names
  from pg_constraint where conrelid = 'public.professional_services'::regclass;
  if v_names is distinct from
       'professional_services_pkey PRIMARY KEY (id); '
       'professional_services_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE CASCADE' then
    raise exception 'FAIL: professional_services constraints are %', v_names;
  end if;
  v_checks := v_checks + 1;

  -- 3. Nothing else still says doctor_services (the deploy-window view aside).
  select string_agg(n, ', ') into v_names from (
    select indexname n from pg_indexes where schemaname = 'public' and indexname like 'doctor_services%'
    union all select conname from pg_constraint where conname like 'doctor_services%'
    union all select policyname from pg_policies where schemaname = 'public' and policyname like 'doctor_services%'
    union all select p.proname from pg_proc p join pg_namespace s on s.oid = p.pronamespace
              where s.nspname = 'public' and p.prosrc ilike '%doctor_services%'
  ) x;
  if v_names is not null then
    raise exception 'FAIL: still named doctor_services: %', v_names;
  end if;
  v_checks := v_checks + 1;

  -- 4. The deploy-window view, while it exists, runs with the caller's rights and gives
  --    anon read access only.
  v_view := to_regclass('public.doctor_services') is not null;
  if v_view then
    if (select relkind from pg_class where oid = to_regclass('public.doctor_services')) <> 'v' then
      raise exception 'FAIL: public.doctor_services exists and is not a view';
    end if;
    if not exists (select 1 from pg_class where oid = 'public.doctor_services'::regclass
                     and 'security_invoker=true' = any(coalesce(reloptions, '{}'))) then
      raise exception 'FAIL: view doctor_services is not security_invoker';
    end if;
    if has_table_privilege('anon', 'public.doctor_services', 'insert')
       or has_table_privilege('anon', 'public.doctor_services', 'update')
       or has_table_privilege('anon', 'public.doctor_services', 'delete') then
      raise exception 'FAIL: anon can write through view doctor_services';
    end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public'
                     and table_name = 'doctor_services' and column_name = 'doctor_id') then
      raise exception 'FAIL: view doctor_services does not expose doctor_id';
    end if;
  end if;
  v_checks := v_checks + 1;

  -- Fixture: a registered professional with one service.
  v_login := pg_temp.new_login('services-' || gen_random_uuid() || '@integration.test');
  v_other := pg_temp.new_login('services-other-' || gen_random_uuid() || '@integration.test');
  insert into public.professionals (name, slug, is_registered, is_test_profile, auth_user_id)
  values ('Services Test', 'services-test-' || substr(gen_random_uuid()::text, 1, 8), true, true, v_login)
  returning id into v_pro;
  insert into public.professional_services (professional_id, name, price) values (v_pro, 'Consultation', '60€');

  -- 5. Anyone reads services; anon can't add one.
  execute 'set local role anon';
  select count(*) into v_n from public.professional_services where professional_id = v_pro;
  if v_n <> 1 then raise exception 'FAIL: anon reads % services, expected 1', v_n; end if;
  begin
    insert into public.professional_services (professional_id, name) values (v_pro, 'Anon service');
    raise exception 'FAIL: anon adds a service';
  exception when insufficient_privilege then null;
  end;
  if v_view then
    execute 'select count(*) from public.doctor_services where doctor_id = $1' into v_n using v_pro;
    if v_n <> 1 then raise exception 'FAIL: anon reads % services through the view, expected 1', v_n; end if;
  end if;
  execute 'reset role';
  v_checks := v_checks + 1;

  -- 6. Nobody writes services through a session any more, not even the owner (since
  --    *_professional_services_not_writable, 2026-10-10: professional_service_add /
  --    _update / _remove record each change; see professional_service_requests.test.sql).
  perform pg_temp.as_user(v_login, 'otp');
  begin
    insert into public.professional_services (professional_id, name) values (v_pro, 'Owner service');
    raise exception 'FAIL: the owner adds a service directly';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.professional_services where professional_id = v_pro;
    raise exception 'FAIL: the owner removes a service directly';
  exception when insufficient_privilege then null;
  end;
  if v_view then
    -- The previous deployment's write path: insert with doctor_id through the view.
    execute 'insert into public.doctor_services (doctor_id, name) values ($1, $2)' using v_pro, 'Old path service';
  end if;
  execute 'reset role'; perform set_config('request.jwt.claims', '', true);
  if v_view and not exists (select 1 from public.professional_services
                            where professional_id = v_pro and name = 'Old path service') then
    raise exception 'FAIL: an insert through the view did not land in professional_services';
  end if;

  perform pg_temp.as_user(v_login, 'password');
  begin
    insert into public.professional_services (professional_id, name) values (v_pro, 'Password service');
    raise exception 'FAIL: a password-only session adds a service';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role'; perform set_config('request.jwt.claims', '', true);

  perform pg_temp.as_user(v_other, 'otp');
  begin
    insert into public.professional_services (professional_id, name) values (v_pro, 'Other service');
    raise exception 'FAIL: another professional adds a service';
  exception when insufficient_privilege then null;
  end;
  if v_view then
    begin
      execute 'insert into public.doctor_services (doctor_id, name) values ($1, $2)' using v_pro, 'Other via view';
      raise exception 'FAIL: another professional adds a service through the view';
    exception when insufficient_privilege then null;
    end;
  end if;
  begin
    delete from public.professional_services where professional_id = v_pro;
    raise exception 'FAIL: another professional removes a service';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role'; perform set_config('request.jwt.claims', '', true);
  v_checks := v_checks + 1;

  -- 7. Deleting the professional removes their services.
  delete from public.professionals where id = v_pro;
  select count(*) into v_n from public.professional_services where professional_id = v_pro;
  if v_n <> 0 then raise exception 'FAIL: % services outlive their professional', v_n; end if;
  v_checks := v_checks + 1;

  raise exception 'ALL professional_services TESTS PASSED (% checks, compat view %)',
    v_checks, case when v_view then 'present' else 'absent' end;
end
$test$;

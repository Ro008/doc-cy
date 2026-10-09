-- Checks for 20261004130000_appointments_rls_lockdown (Testing only; always rolls back).
-- The final error message is the result: 'PASS: …' or the first failure.
do $t$
declare
  v_policies text;
  v_pro uuid;
  v_auth uuid;
  v_appt uuid;
  v_n int;
begin
  select string_agg(policyname, ',' order by policyname) into v_policies
  from pg_policies where schemaname = 'public' and tablename = 'appointments';
  if v_policies is distinct from 'appointments_select_professional' then
    raise exception 'FAIL 1: policies are %', v_policies;
  end if;

  if has_table_privilege('anon', 'public.appointments', 'select')
     or has_table_privilege('anon', 'public.appointments', 'insert')
     or has_table_privilege('anon', 'public.appointments', 'update')
     or has_table_privilege('anon', 'public.appointments', 'delete') then
    raise exception 'FAIL 2: anon still has a privilege on appointments';
  end if;

  if not has_table_privilege('authenticated', 'public.appointments', 'select') then
    raise exception 'FAIL 3: authenticated lost SELECT';
  end if;
  if has_table_privilege('authenticated', 'public.appointments', 'insert')
     or has_table_privilege('authenticated', 'public.appointments', 'update')
     or has_table_privilege('authenticated', 'public.appointments', 'delete')
     or has_table_privilege('authenticated', 'public.appointments', 'truncate') then
    raise exception 'FAIL 4: authenticated can still write appointments';
  end if;

  -- A professional's session can read her row but not change or delete it.
  select p.id, p.auth_user_id into v_pro, v_auth
  from public.professionals p
  where p.is_registered and p.auth_user_id is not null
    and exists (select 1 from public.appointments a where a.professional_id = p.id)
  limit 1;
  if v_pro is null then
    raise exception 'FAIL 5: no registered professional with appointments to test with';
  end if;
  select id into v_appt from public.appointments where professional_id = v_pro limit 1;

  perform set_config('request.jwt.claims', json_build_object('sub', v_auth, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- Reading needs a verified email-step session (professional_session_email_step_verified),
  -- which a fake JWT can't give; check the read policy is unchanged instead.
  select count(*) into v_n from pg_policies
  where schemaname = 'public' and tablename = 'appointments' and policyname = 'appointments_select_professional'
    and cmd = 'SELECT' and qual = 'is_professional_owner(professional_id)';
  if v_n <> 1 then
    raise exception 'FAIL 6: the owner read policy changed';
  end if;

  begin
    update public.appointments set reason = reason where id = v_appt;
    raise exception 'FAIL 7: owner could update';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.appointments where id = v_appt;
    raise exception 'FAIL 8: owner could delete';
  exception when insufficient_privilege then null;
  end;

  reset role;
  set local role anon;
  begin
    perform 1 from public.appointments limit 1;
    raise exception 'FAIL 9: anon could read';
  exception when insufficient_privilege then null;
  end;

  reset role;
  raise exception 'PASS: appointments locked down (9 checks)';
end
$t$;

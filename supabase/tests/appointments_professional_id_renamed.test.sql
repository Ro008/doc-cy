-- Database test for Point E7b (migrations *_rename_appointments_doctor_id_to_professional_id
-- and *_drop_doctor_named_appointment_functions).
--
-- appointments.doctor_id is now professional_id; its FK, indexes and policies carry the
-- professional name; the owner rules on appointments and professional_settings call
-- is_professional_owner (SECURITY INVOKER) instead of is_doctor_owner (SECURITY DEFINER);
-- occupancy and the founders' count read professional_id. Between the two migrations the
-- old functions (is_doctor_owner, public_doctor_occupied_datetimes,
-- founder_active_doctor_count) may still exist for the previous deployment; while they do,
-- anon must not be able to call them.
--
-- Run against TESTING only (Supabase SQL editor or the MCP execute_sql tool).
-- Everything runs in one transaction that ALWAYS rolls back: the final error message is
-- the result. "ALL appointments_professional_id TESTS PASSED (…)" means success; any
-- "FAIL: …" names the broken rule. Nothing is left behind.

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
  v_appt uuid;
  v_at timestamptz := date_trunc('hour', now()) + interval '400 days';
  v_n int;
  v_fn text;
begin
  -- 1. The column carries the new name.
  if not exists (select 1 from information_schema.columns where table_schema = 'public'
                   and table_name = 'appointments' and column_name = 'professional_id') then
    raise exception 'FAIL: appointments.professional_id does not exist';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public'
               and table_name = 'appointments' and column_name = 'doctor_id') then
    raise exception 'FAIL: appointments.doctor_id still exists';
  end if;
  v_checks := v_checks + 1;

  -- 2. FK and indexes follow the rename.
  if not exists (select 1 from pg_constraint where conrelid = 'public.appointments'::regclass
                   and conname = 'appointments_professional_id_fkey'
                   and pg_get_constraintdef(oid) = 'FOREIGN KEY (professional_id) REFERENCES professionals(id) ON DELETE CASCADE') then
    raise exception 'FAIL: appointments_professional_id_fkey missing or changed';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'appointments'
                   and indexname = 'appointments_professional_datetime_idx'
                   and indexdef like '%(professional_id, appointment_datetime)') then
    raise exception 'FAIL: index appointments_professional_datetime_idx missing';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'appointments'
                   and indexname = 'appointments_professional_datetime_null_location_key'
                   and indexdef like 'CREATE UNIQUE INDEX%(professional_id, appointment_datetime)%location_id IS NULL%') then
    raise exception 'FAIL: index appointments_professional_datetime_null_location_key missing';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'appointments'
                   and indexname = 'appointments_active_slot_unique'
                   and indexdef like '%(professional_id, appointment_datetime)%') then
    raise exception 'FAIL: index appointments_active_slot_unique is not on professional_id';
  end if;
  select string_agg(n, ', ') into v_names from (
    select indexname n from pg_indexes where schemaname = 'public' and tablename = 'appointments'
      and indexname ~ 'doctor'
    union all select conname from pg_constraint where conrelid = 'public.appointments'::regclass
      and conname ~ 'doctor'
  ) x;
  if v_names is not null then
    raise exception 'FAIL: appointments still has doctor names: %', v_names;
  end if;
  v_checks := v_checks + 1;

  -- 3. Policies: professional names, the invoker owner check, no is_doctor_owner anywhere.
  select string_agg(policyname || '=' || coalesce(qual, '') || '|' || coalesce(with_check, ''), '; ' order by policyname)
    into v_names
  from pg_policies where schemaname = 'public' and tablename = 'appointments';
  if v_names is distinct from
       'appointments_delete_professional=is_professional_owner(professional_id)|; '
       'appointments_insert_public_booking=|(EXISTS ( SELECT 1
   FROM professionals p
  WHERE ((p.id = appointments.professional_id) AND (p.is_registered = true)))); '
       'appointments_select_professional=is_professional_owner(professional_id)|; '
       'appointments_update_professional=is_professional_owner(professional_id)|is_professional_owner(professional_id)' then
    raise exception 'FAIL: appointments policies are %', v_names;
  end if;
  select string_agg(policyname, ', ' order by policyname) into v_names
  from pg_policies where schemaname = 'public' and tablename = 'professional_settings'
    and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'is_professional_owner\(professional_id\)';
  if v_names is distinct from
       'professional_settings_delete_owner, professional_settings_insert_owner, professional_settings_update_owner' then
    raise exception 'FAIL: professional_settings owner policies on is_professional_owner: %', v_names;
  end if;
  select string_agg(tablename || '.' || policyname, ', ') into v_names
  from pg_policies where schemaname = 'public'
    and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'is_doctor_owner';
  if v_names is not null then
    raise exception 'FAIL: policies still call is_doctor_owner: %', v_names;
  end if;
  v_checks := v_checks + 1;

  -- 4. is_professional_owner runs with the caller's rights, for signed-in users only.
  if to_regprocedure('public.is_professional_owner(uuid)') is null then
    raise exception 'FAIL: public.is_professional_owner(uuid) does not exist';
  end if;
  if (select prosecdef from pg_proc where oid = to_regprocedure('public.is_professional_owner(uuid)')) then
    raise exception 'FAIL: is_professional_owner is SECURITY DEFINER';
  end if;
  if not has_function_privilege('authenticated', 'public.is_professional_owner(uuid)', 'execute') then
    raise exception 'FAIL: authenticated cannot run is_professional_owner';
  end if;
  if has_function_privilege('anon', 'public.is_professional_owner(uuid)', 'execute') then
    raise exception 'FAIL: anon can run is_professional_owner';
  end if;
  v_checks := v_checks + 1;

  -- 5. Functions read professional_id; the founders' count has its professional name; the
  --    old functions, while they exist, are closed to anon.
  for v_fn in select unnest(array['public.public_professionals_occupied_datetimes(uuid[],timestamptz,timestamptz)',
                                  'public.founder_active_professional_count(timestamptz)'])
  loop
    if to_regprocedure(v_fn) is null then
      raise exception 'FAIL: % does not exist', v_fn;
    end if;
    if (select prosrc from pg_proc where oid = to_regprocedure(v_fn)) ~ 'doctor_id' then
      raise exception 'FAIL: % still reads doctor_id', v_fn;
    end if;
    if has_function_privilege('anon', v_fn, 'execute') or has_function_privilege('authenticated', v_fn, 'execute') then
      raise exception 'FAIL: anon or authenticated can run %', v_fn;
    end if;
  end loop;
  for v_fn in select unnest(array['public.is_doctor_owner(uuid)',
                                  'public.public_doctor_occupied_datetimes(uuid,timestamptz,timestamptz,uuid)',
                                  'public.founder_active_doctor_count(timestamptz)'])
  loop
    if to_regprocedure(v_fn) is not null and has_function_privilege('anon', v_fn, 'execute') then
      raise exception 'FAIL: anon can run %', v_fn;
    end if;
  end loop;
  v_checks := v_checks + 1;

  -- Fixture: a registered professional.
  v_login := pg_temp.new_login('appts-' || gen_random_uuid() || '@integration.test');
  v_other := pg_temp.new_login('appts-other-' || gen_random_uuid() || '@integration.test');
  insert into public.professionals (name, slug, is_registered, is_test_profile, auth_user_id)
  values ('Appts Test', 'appts-test-' || substr(gen_random_uuid()::text, 1, 8), true, true, v_login)
  returning id into v_pro;

  -- 6. A booking (the booking route writes with the service role); the same slot can't be
  --    booked twice.
  insert into public.appointments (professional_id, patient_name, patient_phone, appointment_datetime, status)
  values (v_pro, 'Patient Appts', '+35799000001', v_at, 'REQUESTED')
  returning id into v_appt;
  begin
    insert into public.appointments (professional_id, patient_name, patient_phone, appointment_datetime, status)
    values (v_pro, 'Patient Twice', '+35799000002', v_at, 'REQUESTED');
    raise exception 'FAIL: the same slot was booked twice';
  exception when unique_violation then null;
  end;
  v_checks := v_checks + 1;

  -- 7. The owner (emailed-step session) reads and changes the appointment; a password-only
  --    session and another professional reach nothing.
  perform pg_temp.as_user(v_login, 'otp');
  select count(*) into v_n from public.appointments where id = v_appt;
  if v_n <> 1 then raise exception 'FAIL: owner reads % appointments, expected 1', v_n; end if;
  update public.appointments set patient_name = 'Patient Changed' where id = v_appt;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FAIL: owner changes % appointments, expected 1', v_n; end if;
  update public.professional_settings set updated_at = now() where professional_id = v_pro;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FAIL: owner edits % settings rows, expected 1', v_n; end if;
  execute 'reset role'; perform set_config('request.jwt.claims', '', true);

  perform pg_temp.as_user(v_login, 'password');
  select count(*) into v_n from public.appointments where id = v_appt;
  if v_n <> 0 then raise exception 'FAIL: a password-only session reads the appointment'; end if;
  update public.professional_settings set updated_at = now() where professional_id = v_pro;
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'FAIL: a password-only session edits the settings'; end if;
  execute 'reset role'; perform set_config('request.jwt.claims', '', true);

  perform pg_temp.as_user(v_other, 'otp');
  select count(*) into v_n from public.appointments where id = v_appt;
  if v_n <> 0 then raise exception 'FAIL: another professional reads the appointment'; end if;
  delete from public.appointments where id = v_appt;
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'FAIL: another professional deletes the appointment'; end if;
  execute 'reset role'; perform set_config('request.jwt.claims', '', true);
  v_checks := v_checks + 1;

  -- 8. Occupancy and the founders' count see the appointment by professional_id.
  select count(*) into v_n
  from public.public_professionals_occupied_datetimes(array[v_pro], v_at - interval '1 day', v_at + interval '1 day') o
  where o.professional_id = v_pro and o.appointment_datetime = v_at;
  if v_n <> 1 then raise exception 'FAIL: occupancy shows the booked slot % times, expected 1', v_n; end if;
  if public.founder_active_professional_count(now() - interval '1 minute') < 1 then
    raise exception 'FAIL: founder_active_professional_count misses the new appointment';
  end if;
  v_checks := v_checks + 1;

  -- 9. Deleting the professional removes their appointments.
  delete from public.professionals where id = v_pro;
  select count(*) into v_n from public.appointments where professional_id = v_pro;
  if v_n <> 0 then raise exception 'FAIL: % appointments outlive their professional', v_n; end if;
  v_checks := v_checks + 1;

  raise exception 'ALL appointments_professional_id TESTS PASSED (% checks, old functions %)',
    v_checks,
    case when to_regprocedure('public.is_doctor_owner(uuid)') is null then 'dropped' else 'present' end;
end
$test$;

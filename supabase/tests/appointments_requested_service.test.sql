-- Checks for 20261004140000_appointments_requested_service (Testing only; always rolls back).
-- The final error message is the result: 'PASS: …' or the first failure.
do $t$
declare
  v_appt uuid;
  v_pro uuid;
  v_draft uuid;
  v_other uuid;
  v_service uuid;
  v_foreign uuid;
  v_id uuid;
  v_name text;
  v_failed boolean;
begin
  -- Columns, nullable, on both tables.
  if (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name in ('appointments', 'appointment_drafts')
        and column_name in ('professional_service_id', 'service_name') and is_nullable = 'YES') <> 4 then
    raise exception 'FAIL 1: expected 4 nullable service columns';
  end if;

  -- FKs to professional_services with ON DELETE SET NULL.
  if (select count(*) from pg_constraint
      where conname in ('appointments_professional_service_id_fkey', 'appointment_drafts_professional_service_id_fkey')
        and contype = 'f' and confdeltype = 'n'
        and confrelid = 'public.professional_services'::regclass) <> 2 then
    raise exception 'FAIL 2: FKs missing or not ON DELETE SET NULL';
  end if;

  select a.id, a.professional_id into v_appt, v_pro
  from public.appointments a order by a.created_at desc limit 1;
  select p.id into v_other from public.professionals p
  where p.id <> v_pro and p.is_registered limit 1;
  if v_appt is null or v_other is null then
    raise exception 'FAIL 0: Testing has no appointment or second professional to test with';
  end if;

  insert into public.professional_services (professional_id, name) values (v_pro, 'Check-up (test)')
  returning id into v_service;
  insert into public.professional_services (professional_id, name) values (v_other, 'Foreign (test)')
  returning id into v_foreign;

  -- Choosing a service snapshots its name, whatever the caller sent.
  update public.appointments set professional_service_id = v_service, service_name = 'ignored' where id = v_appt;
  select service_name into v_name from public.appointments where id = v_appt;
  if v_name is distinct from 'Check-up (test)' then
    raise exception 'FAIL 3: service_name snapshot is %', v_name;
  end if;

  -- Another professional's service is refused.
  v_failed := false;
  begin
    update public.appointments set professional_service_id = v_foreign where id = v_appt;
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL 4: accepted another professional''s service'; end if;

  -- Renaming the service doesn't touch the visit; deleting it keeps the name.
  update public.professional_services set name = 'Renamed (test)' where id = v_service;
  delete from public.professional_services where id = v_service;
  select professional_service_id, service_name into v_id, v_name from public.appointments where id = v_appt;
  if v_id is not null or v_name is distinct from 'Check-up (test)' then
    raise exception 'FAIL 5: after delete id=% name=%', v_id, v_name;
  end if;

  -- A name without a service id is allowed (deleted service); a service id needs a name
  -- (the trigger always fills it).
  v_failed := false;
  begin
    alter table public.appointments disable trigger appointments_requested_service_check;
    insert into public.professional_services (id, professional_id, name) values (v_service, v_pro, 'Again (test)');
    update public.appointments set professional_service_id = v_service, service_name = null where id = v_appt;
  exception when check_violation then v_failed := true;
  end;
  alter table public.appointments enable trigger appointments_requested_service_check;
  if not v_failed then raise exception 'FAIL 6: a service id without a name was accepted'; end if;

  -- Drafts behave the same.
  insert into public.professional_services (professional_id, name) values (v_pro, 'Draft service (test)')
  returning id into v_service;
  insert into public.appointment_drafts (
    professional_id, clinic_id, appointment_datetime, duration_minutes, patient_name, patient_email,
    patient_phone, patient_gender, patient_birthdate, is_new_patient, reason, token_hash, expires_at,
    professional_service_id)
  select a.professional_id, a.clinic_id, now() + interval '400 days', 30, 'Draft test', 'draft-svc@integration.test',
    '+35799000000', 'female', date '1990-01-01', true, 'Integration: service', md5(random()::text), now() + interval '30 minutes',
    v_service
  from public.appointments a where a.id = v_appt
  returning id into v_draft;
  select service_name into v_name from public.appointment_drafts where id = v_draft;
  if v_name is distinct from 'Draft service (test)' then
    raise exception 'FAIL 7: draft snapshot is %', v_name;
  end if;
  v_failed := false;
  begin
    update public.appointment_drafts set professional_service_id = v_foreign where id = v_draft;
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL 8: draft accepted another professional''s service'; end if;

  -- Nothing new is callable through the API.
  if has_function_privilege('anon', 'public.appointments_requested_service_check()', 'execute')
     or has_function_privilege('authenticated', 'public.appointments_requested_service_check()', 'execute') then
    raise exception 'FAIL 9: trigger function is executable by anon/authenticated';
  end if;

  raise exception 'PASS: requested service (9 checks)';
end
$t$;

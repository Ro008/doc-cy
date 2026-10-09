-- Database tests for the appointments-flow M2 migration (*_appointments_flow_m2_drop_legacy):
-- the legacy appointment columns are gone, status is text with only the six live values
-- and no default (on every database, including Production where it was an enum), one
-- active booking per professional and time, and the occupancy RPC takes the slot length
-- from the visit's clinic (clinic_id) instead of the dropped location_id.
--
-- Run against TESTING only (Supabase SQL editor or the MCP execute_sql tool).
-- Everything runs in one transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL appointments_flow_m2 TESTS PASSED (…)" means success;
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

do $test$
declare
  v_checks int := 0;
  v_pro uuid;
  v_primary uuid;
  v_other_clinic uuid;
  v_when timestamptz := date_trunc('hour', now()) + interval '720 days'
                        + (floor(random() * 500)::int || ' hours')::interval;
  v_appt uuid;
  v_left text;
  v_n int;
  v_cols text;
begin
  -- 1. Legacy columns gone.
  select string_agg(column_name, ', ') into v_left
  from information_schema.columns
  where table_schema = 'public' and table_name = 'appointments'
    and column_name in ('location_id', 'visit_type', 'visit_notes', 'synced_to_calendar',
                        'reschedule_access_token');
  if v_left is not null then
    raise exception 'FAIL: legacy columns still there: %', v_left;
  end if;
  v_checks := v_checks + 1;

  -- 2. Status: text, no default, no enum type left.
  select data_type || '|' || coalesce(column_default, '<none>') into v_left
  from information_schema.columns
  where table_schema = 'public' and table_name = 'appointments' and column_name = 'status';
  if v_left <> 'text|<none>' then
    raise exception 'FAIL: status should be text without a default, got %', v_left;
  end if;
  if to_regtype('public.appointment_status') is not null then
    raise exception 'FAIL: the appointment_status enum still exists';
  end if;
  v_checks := v_checks + 1;

  -- 3. Indexes that named location_id are gone; one active booking per professional and time.
  select string_agg(indexname, ', ') into v_left
  from pg_indexes
  where schemaname = 'public' and tablename = 'appointments' and indexdef like '%location_id%';
  if v_left is not null then
    raise exception 'FAIL: indexes on location_id remain: %', v_left;
  end if;
  v_checks := v_checks + 1;

  -- 4. Occupancy RPC: no clinic column in its result, service role only.
  select string_agg(a.attname, ',' order by a.attnum) into v_cols
  from pg_proc p
  cross join lateral unnest(p.proallargtypes, p.proargmodes, p.proargnames)
    with ordinality as a(atttype, mode, attname, attnum)
  where p.oid = to_regprocedure('public.public_professionals_occupied_datetimes(uuid[],timestamptz,timestamptz)')
    and a.mode = 't';
  if v_cols is distinct from 'professional_id,appointment_datetime' then
    raise exception 'FAIL: occupancy RPC returns %, expected professional_id,appointment_datetime', v_cols;
  end if;
  if has_function_privilege('anon', 'public.public_professionals_occupied_datetimes(uuid[],timestamptz,timestamptz)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.public_professionals_occupied_datetimes(uuid[],timestamptz,timestamptz)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.public_professionals_occupied_datetimes(uuid[],timestamptz,timestamptz)', 'EXECUTE') then
    raise exception 'FAIL: occupancy RPC grants changed (service role only)';
  end if;
  v_checks := v_checks + 1;

  -- Fixture: a registered professional with a primary clinic, plus a second clinic link
  -- with a longer slot (all rolled back).
  select pc.professional_id, pc.id into v_pro, v_primary
  from public.professional_clinics pc
  join public.professionals p on p.id = pc.professional_id
  where p.is_registered and pc.is_primary
  order by pc.created_at
  limit 1;
  if v_pro is null then
    raise exception 'FAIL: fixture: no registered professional with a primary clinic on this database';
  end if;
  select c.id into v_other_clinic
  from public.clinics c
  where not coalesce(c.is_archived, false)
    and not exists (select 1 from public.professional_clinics x where x.professional_id = v_pro and x.clinic_id = c.id)
  order by c.id
  limit 1;
  update public.professional_clinics set slot_duration_minutes = 15 where id = v_primary;
  insert into public.professional_clinics (professional_id, clinic_id, is_primary, slot_duration_minutes)
  values (v_pro, v_other_clinic, false, 60);

  -- 5. Status values: the six live ones only, and a row must name its status.
  insert into public.appointments (professional_id, clinic_id, patient_name, patient_phone,
    appointment_datetime, duration_minutes, status)
  values (v_pro, v_other_clinic, 'M2 Patient', '+35799000001', v_when, 60, 'CONFIRMED')
  returning id into v_appt;
  update public.appointments set status = 'REQUESTED' where id = v_appt;
  update public.appointments set status = 'NEEDS_RESCHEDULE' where id = v_appt;
  update public.appointments set status = 'DECLINED' where id = v_appt;
  update public.appointments set status = 'EXPIRED' where id = v_appt;
  update public.appointments set status = 'CANCELLED' where id = v_appt;
  perform pg_temp.expect_error(format($s$update public.appointments set status = 'PENDING' where id = %L$s$, v_appt),
    '23514', 'PENDING is no longer a status');
  perform pg_temp.expect_error(format($s$update public.appointments set status = 'COMPLETED' where id = %L$s$, v_appt),
    '23514', 'COMPLETED is no longer a status');
  perform pg_temp.expect_error(format($s$update public.appointments set status = 'REJECTED' where id = %L$s$, v_appt),
    '23514', 'REJECTED is no longer a status (DECLINED)');
  perform pg_temp.expect_error(format($s$update public.appointments set status = 'confirmed' where id = %L$s$, v_appt),
    '23514', 'lowercase statuses are not statuses');
  perform pg_temp.expect_error(format(
    $s$insert into public.appointments (professional_id, patient_name, patient_phone, appointment_datetime)
       values (%L, 'M2 No Status', '+35799000002', %L)$s$, v_pro, v_when + interval '3 hours'),
    '23502', 'a row without a status');
  update public.appointments set status = 'CONFIRMED' where id = v_appt;
  v_checks := v_checks + 1;

  -- 6. One active booking per professional and time, whichever clinic; a closed row doesn't count.
  perform pg_temp.expect_error(format(
    $s$insert into public.appointments (professional_id, clinic_id, patient_name, patient_phone, appointment_datetime, status)
       values (%L, (select clinic_id from public.professional_clinics where id = %L), 'M2 Twice', '+35799000003', %L, 'REQUESTED')$s$,
    v_pro, v_primary, v_when), '23505', 'a second active booking at the same time, other clinic');
  update public.appointments set status = 'DECLINED' where id = v_appt;
  insert into public.appointments (professional_id, patient_name, patient_phone, appointment_datetime, status)
  values (v_pro, 'M2 After Decline', '+35799000004', v_when, 'REQUESTED');
  delete from public.appointments where patient_name = 'M2 After Decline' and professional_id = v_pro;
  update public.appointments set status = 'CONFIRMED' where id = v_appt;
  v_checks := v_checks + 1;

  -- 7. Occupancy uses the visit's own clinic slot (60 min): one blocked start in the hour,
  --    not four 15-minute ones from the primary clinic.
  select count(*) into v_n
  from public.public_professionals_occupied_datetimes(array[v_pro], v_when, v_when + interval '59 minutes');
  if v_n <> 1 then
    raise exception 'FAIL: occupancy gives % blocked starts in the visit hour, expected 1 (60-minute slot of its clinic)', v_n;
  end if;
  v_checks := v_checks + 1;

  raise exception 'ALL appointments_flow_m2 TESTS PASSED (% checks)', v_checks;
end
$test$;

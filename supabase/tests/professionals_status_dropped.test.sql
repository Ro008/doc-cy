-- Database test for Point E8 (migrations *_professionals_status_off_booking_path and
-- *_drop_professionals_status).
--
-- professionals.status is gone: a professional row exists only once the founders approved
-- the registration, so `is_registered` is the whole rule. Occupancy and the public booking
-- insert rule check is_registered; a registered professional needs no status; after the
-- second migration the approval writes none and the column and its checks are dropped.
--
-- Run against TESTING only (Supabase SQL editor or the MCP execute_sql tool).
-- Everything runs in one transaction that ALWAYS rolls back: the final error message is
-- the result. "ALL professionals_status TESTS PASSED (…)" means success; any "FAIL: …"
-- names the broken rule. Nothing is left behind.

do $test$
declare
  v_checks int := 0;
  v_names text;
  v_login uuid;
  v_pro uuid;
  v_listing uuid;
  v_at timestamptz := date_trunc('hour', now()) + interval '400 days';
  v_n int;
  v_fn text := 'public.public_professionals_occupied_datetimes(uuid[],timestamptz,timestamptz)';
  v_dropped boolean := not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'professionals' and column_name = 'status'
  );
begin
  -- 1. A registered professional needs no status.
  if exists (select 1 from pg_constraint where conrelid = 'public.professionals'::regclass
               and conname = 'professionals_registered_requires_status') then
    raise exception 'FAIL: professionals_registered_requires_status still exists';
  end if;
  v_checks := v_checks + 1;

  -- 2. Occupancy filters on is_registered, never on status; still closed to anon and
  --    signed-in users.
  if (select prosrc from pg_proc where oid = to_regprocedure(v_fn)) ~ 'd\.status' then
    raise exception 'FAIL: occupancy still reads professionals.status';
  end if;
  if (select count(*) from regexp_matches((select prosrc from pg_proc where oid = to_regprocedure(v_fn)),
                                          'AND d\.is_registered', 'g')) <> 4 then
    raise exception 'FAIL: occupancy does not filter on d.is_registered in all 4 branches';
  end if;
  if has_function_privilege('anon', v_fn, 'execute') or has_function_privilege('authenticated', v_fn, 'execute') then
    raise exception 'FAIL: anon or authenticated can run occupancy';
  end if;
  v_checks := v_checks + 1;

  -- 3. The public booking insert rule checks is_registered only; no policy reads status
  --    on professionals.
  select with_check into v_names from pg_policies
  where schemaname = 'public' and tablename = 'appointments' and policyname = 'appointments_insert_public_booking';
  if v_names is distinct from '(EXISTS ( SELECT 1
   FROM professionals p
  WHERE ((p.id = appointments.professional_id) AND (p.is_registered = true))))' then
    raise exception 'FAIL: appointments_insert_public_booking is %', v_names;
  end if;
  select string_agg(tablename || '.' || policyname, ', ') into v_names
  from pg_policies where schemaname = 'public'
    and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'p\.status';
  if v_names is not null then
    raise exception 'FAIL: policies still read professionals.status: %', v_names;
  end if;
  v_checks := v_checks + 1;

  -- Fixture: a registered professional (no status) and an unregistered listing, each with a
  -- booking (the booking route writes with the service role).
  v_login := gen_random_uuid();
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (v_login, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'status-' || v_login || '@integration.test', now(), now(), now());
  insert into public.professionals (name, slug, is_registered, is_test_profile, auth_user_id)
  values ('Status Test', 'status-test-' || substr(gen_random_uuid()::text, 1, 8), true, true, v_login)
  returning id into v_pro;
  insert into public.professionals (name, slug, is_registered, is_test_profile)
  values ('Status Listing', 'status-listing-' || substr(gen_random_uuid()::text, 1, 8), false, true)
  returning id into v_listing;
  insert into public.appointments (professional_id, patient_name, patient_phone, appointment_datetime, status)
  values (v_pro, 'Patient Status', '+35799000011', v_at, 'REQUESTED'),
         (v_listing, 'Patient Listing', '+35799000012', v_at, 'REQUESTED');

  -- 4. Occupancy shows the registered professional's booking, not the listing's.
  select count(*) into v_n
  from public.public_professionals_occupied_datetimes(array[v_pro, v_listing], v_at - interval '1 day', v_at + interval '1 day') o
  where o.appointment_datetime = v_at and o.professional_id = v_pro;
  if v_n <> 1 then raise exception 'FAIL: occupancy shows the registered booking % times, expected 1', v_n; end if;
  select count(*) into v_n
  from public.public_professionals_occupied_datetimes(array[v_listing], v_at - interval '1 day', v_at + interval '1 day');
  if v_n <> 0 then raise exception 'FAIL: occupancy shows % slots for an unregistered listing', v_n; end if;
  v_checks := v_checks + 1;

  -- 5. After the second migration: the column, its checks and every write are gone.
  if v_dropped then
    select string_agg(conname, ', ') into v_names from pg_constraint
    where conrelid = 'public.professionals'::regclass
      and conname in ('professionals_unregistered_no_status', 'professionals_status_check');
    if v_names is not null then
      raise exception 'FAIL: status checks still exist: %', v_names;
    end if;
    if (select prosrc from pg_proc
        where oid = to_regprocedure('public.request_apply_professional_registration(public.request_log,jsonb,jsonb)'))
       ~ '\ystatus\y' then
      raise exception 'FAIL: request_apply_professional_registration still mentions status';
    end if;
    v_checks := v_checks + 1;
  end if;

  raise exception 'ALL professionals_status TESTS PASSED (% checks, status column %)',
    v_checks, case when v_dropped then 'dropped' else 'present' end;
end
$test$;

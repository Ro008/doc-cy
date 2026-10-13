-- Database tests for the booking limits per clinic, the cancellation deadline each
-- visit keeps, and the recording of a clinic's hours, limits and online-booking switch
-- (migration *_professional_clinic_limits).
--
-- Settings → Clinics (user, 2026-10-11):
-- - how far ahead, the minimum notice and the online cancellation deadline belong to
--   each clinic (professional_clinics), no longer to the professional;
-- - a visit keeps the cancellation deadline it was confirmed with;
-- - a change of hours, of limits or of the online-booking switch is saved at once and
--   recorded; saving the same values records nothing.
--
-- Run against TESTING only. One transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL professional_clinic_limits TESTS PASSED (…)" means
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

create or replace function pg_temp.new_clinic(p_name text, p_tag text)
returns uuid
language plpgsql
as $f$
declare
  v_id uuid;
begin
  insert into public.clinics (name, slug, district, address, phone)
  values (p_name, lower(replace(p_name, ' ', '-')) || '-' || p_tag, 'Paphos', '1 ' || p_name || ' St, Paphos',
          '26123456')
  returning id into v_id;
  return v_id;
end
$f$;

-- A week as Settings sends it: Mon–Fri open, the given hours, optional break on each open day.
create or replace function pg_temp.week(p_start text, p_end text, p_slot int, p_break_start text default null,
  p_break_end text default null)
returns jsonb
language sql
as $f$
  select jsonb_build_object(
    'monday', true, 'tuesday', true, 'wednesday', true, 'thursday', true, 'friday', true,
    'saturday', false, 'sunday', false,
    'start_time', p_start, 'end_time', p_end,
    'break_start', null, 'break_end', null,
    'slot_duration_minutes', p_slot,
    'weekly_schedule', (
      select jsonb_object_agg(d, jsonb_build_object(
        'enabled', d not in ('saturday', 'sunday'),
        'start_time', p_start, 'end_time', p_end,
        'break_start', case when d not in ('saturday', 'sunday') then p_break_start end,
        'break_end', case when d not in ('saturday', 'sunday') then p_break_end end))
      from unnest(array['monday','tuesday','wednesday','thursday','friday','saturday','sunday']) d
    )
  );
$f$;


do $test$
declare
  v_tag text := substr(md5(random()::text), 1, 8);
  v_checks int := 0;
  v_pro uuid;
  v_other uuid;
  v_listing uuid;
  v_a uuid;
  v_b uuid;
  v_link_a uuid;
  v_link_b uuid;
  v_other_link uuid;
  v_listing_link uuid;
  v_req uuid;
  v_row public.request_log%rowtype;
  v_pc public.professional_clinics%rowtype;
  v_appt uuid;
  v_n int;
  v_fn text;
  v_col text;
  v_when timestamptz := date_trunc('day', now()) + interval '9 days 10 hours';
begin
  ---------------------------------------------------------------- fixtures
  insert into public.professionals (name, slug, is_registered, auth_user_id, registration_email)
  values ('Cl Pro', 'cl-pro-' || v_tag, true, pg_temp.new_login('cl-pro-' || v_tag || '@integration.test'),
          'cl-pro-' || v_tag || '@integration.test')
  returning id into v_pro;
  insert into public.professionals (name, slug, is_registered, auth_user_id, registration_email)
  values ('Cl Other', 'cl-other-' || v_tag, true, pg_temp.new_login('cl-other-' || v_tag || '@integration.test'),
          'cl-other-' || v_tag || '@integration.test')
  returning id into v_other;
  insert into public.professionals (name, slug, is_registered)
  values ('Cl Listing', 'cl-listing-' || v_tag, false)
  returning id into v_listing;

  v_a := pg_temp.new_clinic('Cl Clinic A', v_tag);
  v_b := pg_temp.new_clinic('Cl Clinic B', v_tag);
  insert into public.professional_clinics (professional_id, clinic_id, sort_order, pause_online_bookings,
    monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_time, end_time, slot_duration_minutes,
    weekly_schedule)
  values (v_pro, v_a, 0, false, true, true, true, true, true, false, false, '09:00', '17:00', 30,
          pg_temp.week('09:00:00', '17:00:00', 30) -> 'weekly_schedule')
  returning id into v_link_a;
  insert into public.professional_clinics (professional_id, clinic_id, sort_order, pause_online_bookings,
    monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_time, end_time, slot_duration_minutes,
    weekly_schedule)
  values (v_pro, v_b, 1, true, true, true, true, true, true, false, false, '09:00', '17:00', 30,
          pg_temp.week('09:00:00', '17:00:00', 30) -> 'weekly_schedule')
  returning id into v_link_b;
  insert into public.professional_clinics (professional_id, clinic_id) values (v_other, v_a)
  returning id into v_other_link;
  insert into public.professional_clinics (professional_id, clinic_id) values (v_listing, v_a)
  returning id into v_listing_link;

  ---------------------------------------------------------------- the columns
  foreach v_col in array array['booking_horizon_days', 'minimum_notice_hours', 'patient_cancel_notice_hours'] loop
    assert exists (select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'professional_clinics' and column_name = v_col
          and is_nullable = 'NO'),
      format('FAIL: professional_clinics.%s exists and is never empty', v_col);
    v_checks := v_checks + 1;
  end loop;
  select * into v_pc from public.professional_clinics where id = v_link_a;
  assert v_pc.booking_horizon_days = 90 and v_pc.minimum_notice_hours = 2 and v_pc.patient_cancel_notice_hours = 12,
    'FAIL: a new clinic link starts with 90 days, 2 hours notice, cancel until 12 hours before';
  v_checks := v_checks + 1;

  perform pg_temp.expect_error(
    format('update public.professional_clinics set booking_horizon_days = 45 where id = %L', v_link_a),
    '23514', 'the table refuses a horizon that is not 14 / 30 / 90 / 180');
  perform pg_temp.expect_error(
    format('update public.professional_clinics set minimum_notice_hours = 3 where id = %L', v_link_a),
    '23514', 'the table refuses a notice that is not on the list');
  perform pg_temp.expect_error(
    format('update public.professional_clinics set patient_cancel_notice_hours = 6 where id = %L', v_link_a),
    '23514', 'the table refuses a cancel deadline that is not 12 / 24 / 48');
  v_checks := v_checks + 3;

  ---------------------------------------------------------------- access
  foreach v_fn in array array[
    'public.professional_clinic_hours_set(uuid, uuid, jsonb)',
    'public.professional_clinic_limits_set(uuid, uuid, integer, integer, integer)',
    'public.professional_clinic_online_booking_set(uuid, uuid, boolean)'
  ] loop
    assert not has_function_privilege('anon', v_fn, 'execute')
      and not has_function_privilege('authenticated', v_fn, 'execute')
      and has_function_privilege('service_role', v_fn, 'execute'),
      format('FAIL: only the service role calls %s', v_fn);
    v_checks := v_checks + 1;
  end loop;
  foreach v_fn in array array[
    'professional_clinic_hours_change', 'professional_clinic_limits_change',
    'professional_clinic_online_booking_change'
  ] loop
    assert exists (select 1 from public.request_types where name = v_fn and is_edit and not requires_approval),
      format('FAIL: %s is a recorded type', v_fn);
    v_checks := v_checks + 1;
  end loop;

  ---------------------------------------------------------------- limits
  v_req := public.professional_clinic_limits_set(v_pro, v_link_a, 30, 24, 48);
  assert v_req is not null, 'FAIL: a change of limits returns its record';
  select * into v_row from public.request_log where id = v_req;
  assert v_row.request_type = 'professional_clinic_limits_change' and v_row.status = 'recorded'
    and v_row.professional_id = v_pro and v_row.decided_at is not null,
    'FAIL: the limits change is recorded at once';
  assert v_row.before_snapshot = jsonb_build_object(
      'booking_horizon_days', 90, 'minimum_notice_hours', 2, 'patient_cancel_notice_hours', 12),
    format('FAIL: the record keeps the limits before (%s)', v_row.before_snapshot);
  assert v_row.details @> jsonb_build_object('link_id', v_link_a, 'clinic_id', v_a, 'clinic_name', 'Cl Clinic A',
      'booking_horizon_days', 30, 'minimum_notice_hours', 24, 'patient_cancel_notice_hours', 48),
    format('FAIL: the record keeps the clinic and the new limits (%s)', v_row.details);
  select * into v_pc from public.professional_clinics where id = v_link_a;
  assert v_pc.booking_horizon_days = 30 and v_pc.minimum_notice_hours = 24 and v_pc.patient_cancel_notice_hours = 48,
    'FAIL: the limits are saved on that clinic';
  select * into v_pc from public.professional_clinics where id = v_link_b;
  assert v_pc.booking_horizon_days = 90 and v_pc.minimum_notice_hours = 2 and v_pc.patient_cancel_notice_hours = 12,
    'FAIL: her other clinic keeps its own limits';
  v_checks := v_checks + 6;

  assert public.professional_clinic_limits_set(v_pro, v_link_a, 30, 24, 48) is null,
    'FAIL: the same limits again record nothing';
  select count(*) into v_n from public.request_log
  where professional_id = v_pro and request_type = 'professional_clinic_limits_change';
  assert v_n = 1, 'FAIL: one limits record so far';
  -- A value left out keeps what is there.
  v_req := public.professional_clinic_limits_set(v_pro, v_link_a, null, null, 24);
  select * into v_pc from public.professional_clinics where id = v_link_a;
  assert v_req is not null and v_pc.booking_horizon_days = 30 and v_pc.minimum_notice_hours = 24
    and v_pc.patient_cancel_notice_hours = 24,
    'FAIL: a limit left out keeps its value';
  v_checks := v_checks + 3;

  perform pg_temp.expect_error(
    format('select public.professional_clinic_limits_set(%L, %L, 45, 2, 12)', v_pro, v_link_a),
    '22023', 'a horizon off the list is refused');
  perform pg_temp.expect_error(
    format('select public.professional_clinic_limits_set(%L, %L, 90, 3, 12)', v_pro, v_link_a),
    '22023', 'a notice off the list is refused');
  perform pg_temp.expect_error(
    format('select public.professional_clinic_limits_set(%L, %L, 90, 2, 6)', v_pro, v_link_a),
    '22023', 'a cancel deadline off the list is refused');
  perform pg_temp.expect_error(
    format('select public.professional_clinic_limits_set(%L, %L, 90, 2, 12)', v_pro, v_other_link),
    'P0002', 'she cannot set the limits of somebody else''s clinic link');
  perform pg_temp.expect_error(
    format('select public.professional_clinic_limits_set(%L, %L, 30, 2, 12)', v_listing, v_listing_link),
    '22023', 'a listing that has not signed up sets nothing');
  v_checks := v_checks + 5;

  ---------------------------------------------------------------- hours
  v_req := public.professional_clinic_hours_set(v_pro, v_link_a,
    pg_temp.week('08:30:00', '16:00:00', 45, '12:00:00', '13:00:00'));
  assert v_req is not null, 'FAIL: a change of hours returns its record';
  select * into v_row from public.request_log where id = v_req;
  assert v_row.request_type = 'professional_clinic_hours_change' and v_row.status = 'recorded',
    'FAIL: the hours change is recorded at once';
  assert (v_row.before_snapshot ->> 'slot_duration_minutes')::int = 30
    and v_row.before_snapshot -> 'weekly_schedule' -> 'monday' ->> 'start_time' = '09:00:00'
    and v_row.before_snapshot ->> 'start_time' = '09:00:00',
    format('FAIL: the record keeps the week and slot before (%s)', v_row.before_snapshot);
  assert v_row.details @> jsonb_build_object('link_id', v_link_a, 'clinic_id', v_a, 'clinic_name', 'Cl Clinic A',
      'slot_duration_minutes', 45)
    and v_row.details -> 'weekly_schedule' -> 'monday' ->> 'break_start' = '12:00:00'
    and v_row.details -> 'weekly_schedule' -> 'monday' ->> 'end_time' = '16:00:00',
    format('FAIL: the record keeps the new week, breaks and slot (%s)', v_row.details);
  select * into v_pc from public.professional_clinics where id = v_link_a;
  assert v_pc.slot_duration_minutes = 45 and v_pc.start_time = '08:30' and v_pc.end_time = '16:00'
    and v_pc.monday and not v_pc.saturday
    and v_pc.weekly_schedule -> 'friday' ->> 'break_end' = '13:00:00'
    and v_pc.break_start is null,
    'FAIL: the hours are saved on that clinic';
  select * into v_pc from public.professional_clinics where id = v_link_b;
  assert v_pc.slot_duration_minutes = 30 and v_pc.start_time = '09:00',
    'FAIL: her other clinic keeps its own hours';
  v_checks := v_checks + 6;

  assert public.professional_clinic_hours_set(v_pro, v_link_a,
      pg_temp.week('08:30:00', '16:00:00', 45, '12:00:00', '13:00:00')) is null,
    'FAIL: the same hours again record nothing';
  -- The same times written without seconds are the same hours.
  assert public.professional_clinic_hours_set(v_pro, v_link_a,
      pg_temp.week('08:30:00', '16:00:00', 45, '12:00:00', '13:00:00')
        || jsonb_build_object('start_time', '08:30', 'end_time', '16:00')) is null,
    'FAIL: 08:30 and 08:30:00 are the same time';
  -- Only the slot length changes: still one record.
  v_req := public.professional_clinic_hours_set(v_pro, v_link_a,
    pg_temp.week('08:30:00', '16:00:00', 30, '12:00:00', '13:00:00'));
  select * into v_row from public.request_log where id = v_req;
  assert (v_row.before_snapshot ->> 'slot_duration_minutes')::int = 45
    and (v_row.details ->> 'slot_duration_minutes')::int = 30,
    'FAIL: a new slot length alone is recorded';
  select count(*) into v_n from public.request_log
  where professional_id = v_pro and request_type = 'professional_clinic_hours_change';
  assert v_n = 2, format('FAIL: two hours records so far (%s)', v_n);
  v_checks := v_checks + 4;

  perform pg_temp.expect_error(
    format('select public.professional_clinic_hours_set(%L, %L, %L::jsonb)', v_pro, v_link_a,
      (pg_temp.week('09:00:00', '17:00:00', 30) - 'weekly_schedule')::text),
    '22023', 'hours without the week are refused');
  perform pg_temp.expect_error(
    format('select public.professional_clinic_hours_set(%L, %L, %L::jsonb)', v_pro, v_link_a,
      pg_temp.week('09:00:00', '17:00:00', 0)::text),
    '22023', 'a slot of 0 minutes is refused');
  perform pg_temp.expect_error(
    format('select public.professional_clinic_hours_set(%L, %L, %L::jsonb)', v_pro, v_other_link,
      pg_temp.week('09:00:00', '17:00:00', 30)::text),
    'P0002', 'she cannot set the hours of somebody else''s clinic link');
  v_checks := v_checks + 3;

  ---------------------------------------------------------------- online-booking switch
  v_req := public.professional_clinic_online_booking_set(v_pro, v_link_b, true);
  select * into v_row from public.request_log where id = v_req;
  assert v_row.request_type = 'professional_clinic_online_booking_change' and v_row.status = 'recorded'
    and v_row.before_snapshot = jsonb_build_object('online_booking', false)
    and v_row.details @> jsonb_build_object('link_id', v_link_b, 'clinic_id', v_b, 'clinic_name', 'Cl Clinic B',
      'online_booking', true),
    format('FAIL: switching online booking on is recorded with the clinic (%s / %s)', v_row.before_snapshot, v_row.details);
  assert not (select pause_online_bookings from public.professional_clinics where id = v_link_b),
    'FAIL: the clinic takes online bookings now';
  assert public.professional_clinic_online_booking_set(v_pro, v_link_b, true) is null,
    'FAIL: switching on what is on records nothing';
  v_req := public.professional_clinic_online_booking_set(v_pro, v_link_b, false);
  assert v_req is not null and (select pause_online_bookings from public.professional_clinics where id = v_link_b),
    'FAIL: switching off is saved and recorded';
  assert not (select pause_online_bookings from public.professional_clinics where id = v_link_a),
    'FAIL: her other clinic keeps its switch';
  perform pg_temp.expect_error(
    format('select public.professional_clinic_online_booking_set(%L, %L, true)', v_pro, v_other_link),
    'P0002', 'she cannot switch somebody else''s clinic link');
  perform pg_temp.expect_error(
    format('select public.professional_clinic_online_booking_set(%L, %L, null)', v_pro, v_link_b),
    '22023', 'the switch needs on or off');
  v_checks := v_checks + 7;

  ---------------------------------------------------------------- a visit keeps its deadline
  assert exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'appointments'
        and column_name = 'patient_cancel_notice_hours' and is_nullable = 'YES'),
    'FAIL: appointments.patient_cancel_notice_hours exists (empty for older visits)';
  -- Clinic A is at 24 hours now.
  insert into public.appointments (professional_id, clinic_id, patient_name, patient_phone, appointment_datetime, status)
  values (v_pro, v_a, 'Cl Patient', '+35799000001', v_when, 'REQUESTED')
  returning id into v_appt;
  assert (select patient_cancel_notice_hours from public.appointments where id = v_appt) is null,
    'FAIL: a request has no deadline yet';
  update public.appointments set status = 'CONFIRMED' where id = v_appt;
  assert (select patient_cancel_notice_hours from public.appointments where id = v_appt) = 24,
    'FAIL: confirming keeps the clinic''s deadline on the visit';
  perform public.professional_clinic_limits_set(v_pro, v_link_a, null, null, 48);
  assert (select patient_cancel_notice_hours from public.appointments where id = v_appt) = 24,
    'FAIL: a later change of the clinic''s deadline leaves confirmed visits alone';
  update public.appointments set status = 'CANCELLED' where id = v_appt;
  assert (select patient_cancel_notice_hours from public.appointments where id = v_appt) = 24,
    'FAIL: cancelling keeps what the visit had';
  v_checks := v_checks + 5;

  -- Confirmed from the start (a manual booking), at the other clinic (12 hours).
  insert into public.appointments (professional_id, clinic_id, patient_name, patient_phone, appointment_datetime, status)
  values (v_pro, v_b, 'Cl Patient Two', '+35799000002', v_when + interval '1 day', 'CONFIRMED')
  returning id into v_appt;
  assert (select patient_cancel_notice_hours from public.appointments where id = v_appt) = 12,
    'FAIL: a visit confirmed from the start takes its own clinic''s deadline';
  -- A value given by the caller is kept.
  insert into public.appointments (professional_id, clinic_id, patient_name, patient_phone, appointment_datetime,
    status, patient_cancel_notice_hours)
  values (v_pro, v_a, 'Cl Patient Three', '+35799000003', v_when + interval '2 days', 'CONFIRMED', 12)
  returning id into v_appt;
  assert (select patient_cancel_notice_hours from public.appointments where id = v_appt) = 12,
    'FAIL: a deadline given with the visit is kept';
  -- A clinic she no longer works at: nothing to copy, the visit stays without.
  insert into public.appointments (professional_id, clinic_id, patient_name, patient_phone, appointment_datetime, status)
  values (v_other, v_b, 'Cl Patient Four', '+35799000004', v_when + interval '3 days', 'CONFIRMED')
  returning id into v_appt;
  assert (select patient_cancel_notice_hours from public.appointments where id = v_appt) is null,
    'FAIL: without a clinic link the visit has no stored deadline';
  perform pg_temp.expect_error(
    format('update public.appointments set patient_cancel_notice_hours = 6 where id = %L', v_appt),
    '23514', 'the visit refuses a deadline that is not 12 / 24 / 48');
  v_checks := v_checks + 4;

  ---------------------------------------------------------------- the old per-professional limits
  -- Until the old columns go, code that still writes them reaches every clinic of hers.
  if exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'professional_settings'
        and column_name = 'booking_horizon_days') then
    insert into public.professional_settings (professional_id) values (v_pro)
    on conflict (professional_id) do nothing;
    select * into v_pc from public.professional_clinics where id = v_link_a;
    assert v_pc.booking_horizon_days = 30 and v_pc.patient_cancel_notice_hours = 48,
      'FAIL: a settings row appearing does not touch her clinics';
    update public.professional_settings set holiday_mode_enabled = true where professional_id = v_pro;
    select * into v_pc from public.professional_clinics where id = v_link_a;
    assert v_pc.booking_horizon_days = 30 and v_pc.patient_cancel_notice_hours = 48,
      'FAIL: a holiday save does not touch her clinics';
    update public.professional_settings
    set booking_horizon_days = 180, minimum_notice_hours = 4, patient_cancel_notice_hours = 24
    where professional_id = v_pro;
    select count(*) into v_n from public.professional_clinics
    where professional_id = v_pro and booking_horizon_days = 180 and minimum_notice_hours = 4
      and patient_cancel_notice_hours = 24;
    assert v_n = 2, 'FAIL: old code changing the professional''s limits reaches both her clinics';
    assert (select booking_horizon_days from public.professional_clinics where id = v_other_link) = 90,
      'FAIL: nobody else''s clinic link moves';
    v_checks := v_checks + 4;
  end if;

  ---------------------------------------------------------------- leaving keeps the limits in the record
  v_req := public.professional_clinic_leave(v_pro, v_link_b);
  select * into v_row from public.request_log where id = v_req;
  assert v_row.before_snapshot -> 'settings' ? 'booking_horizon_days'
    and v_row.before_snapshot -> 'settings' ? 'patient_cancel_notice_hours',
    'FAIL: the leave record keeps the limits she had there';
  v_checks := v_checks + 1;

  raise exception 'ALL professional_clinic_limits TESTS PASSED (% checks); rolled back', v_checks;
end
$test$;

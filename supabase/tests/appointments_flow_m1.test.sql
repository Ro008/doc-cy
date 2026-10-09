-- Database tests for the appointments-flow M1 migration
-- (*_appointments_flow_add_columns_and_tables): new appointment columns and rules,
-- appointment_drafts, appointment_links, professional_reviews, the patient cancel
-- notice setting and the paused-banner dismissal.
--
-- Historical: describes the schema right after M1. Checks 3 and 8 (location_id, REJECTED)
-- stopped holding with M2 (20261009100000) and check 14 (24 h default) with
-- 20261008120000; appointments_flow_m2.test.sql covers the current rules.
--
-- Run against TESTING only (Supabase SQL editor or the MCP execute_sql tool).
-- Everything runs in one transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL appointments_flow_m1 TESTS PASSED (…)" means success;
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
  v_link uuid;
  v_clinic uuid;
  v_when timestamptz := date_trunc('minute', now()) + interval '700 days'
                        + (floor(random() * 5000)::int || ' minutes')::interval;
  v_appt uuid;
  v_appt2 uuid;
  v_missing text;
  v_n int;
  v_ts timestamptz;
begin
  -- 1. Columns and tables exist.
  select string_agg(c, ', ') into v_missing
  from unnest(array[
    'appointments.booking_source', 'appointments.clinic_id', 'appointments.patient_gender',
    'appointments.patient_birthdate', 'appointments.decline_reason', 'appointments.cancelled_by',
    'appointments.cancel_reason', 'appointments.professional_notes',
    'appointments.visit_reminder_sent_at', 'appointments.proposal_reminder_sent_at',
    'appointments.review_requested_at',
    'professional_settings.patient_cancel_notice_hours',
    'professional_clinics.pause_notice_dismissed_at'
  ]) as c
  where not exists (
    select 1 from information_schema.columns ic
    where ic.table_schema = 'public'
      and ic.table_name = split_part(c, '.', 1)
      and ic.column_name = split_part(c, '.', 2)
  );
  if v_missing is not null then
    raise exception 'FAIL: missing columns: %', v_missing;
  end if;
  v_checks := v_checks + 1;

  select string_agg(t, ', ') into v_missing
  from unnest(array['appointment_drafts', 'appointment_links', 'professional_reviews']) as t
  where to_regclass('public.' || t) is null;
  if v_missing is not null then
    raise exception 'FAIL: missing tables: %', v_missing;
  end if;
  v_checks := v_checks + 1;

  -- 2. New tables: RLS on, nothing for anon / authenticated.
  select string_agg(t, ', ') into v_missing
  from unnest(array['appointment_drafts', 'appointment_links', 'professional_reviews']) as t
  where not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass)
     or has_table_privilege('anon', 'public.' || t, 'SELECT')
     or has_table_privilege('anon', 'public.' || t, 'INSERT')
     or has_table_privilege('authenticated', 'public.' || t, 'SELECT')
     or has_table_privilege('authenticated', 'public.' || t, 'INSERT')
     or has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
     or has_table_privilege('authenticated', 'public.' || t, 'DELETE');
  if v_missing is not null then
    raise exception 'FAIL: RLS off or anon/authenticated privileges on: %', v_missing;
  end if;
  v_checks := v_checks + 1;

  -- Fixture: a registered professional with a clinic link (any; all rolled back).
  select pc.professional_id, pc.id, pc.clinic_id into v_pro, v_link, v_clinic
  from public.professional_clinics pc
  join public.professionals p on p.id = pc.professional_id
  where p.is_registered
  order by pc.created_at
  limit 1;
  if v_pro is null then
    raise exception 'FAIL: fixture: no registered professional with a clinic on this database';
  end if;

  -- 3. clinic_id backfill: every row with a clinic link carries that link's clinic.
  select count(*) into v_n
  from public.appointments a
  join public.professional_clinics pc on pc.id = a.location_id
  where a.clinic_id is distinct from pc.clinic_id;
  if v_n > 0 then
    raise exception 'FAIL: % appointments with location_id but wrong/missing clinic_id', v_n;
  end if;
  v_checks := v_checks + 1;

  -- 4. Legacy-style row (no booking_source) needs none of the new fields.
  insert into public.appointments (professional_id, patient_name, patient_phone, appointment_datetime, status)
  values (v_pro, 'M1 Legacy', '+35799000001', v_when, 'REQUESTED')
  returning id into v_appt;
  v_checks := v_checks + 1;

  -- 5. Online booking: every field required, email included.
  perform pg_temp.expect_error(format(
    $s$insert into public.appointments (professional_id, clinic_id, booking_source, patient_name,
         patient_email, patient_phone, appointment_datetime, status, is_new_patient, reason, patient_birthdate)
       values (%L, %L, 'online', 'M1 Online', 'm1@integration.test', '+35799000002', %L, 'REQUESTED',
         true, 'Check-up', '1990-01-01')$s$,
    v_pro, v_clinic, v_when + interval '1 hour'), '23514', 'online booking without gender');
  perform pg_temp.expect_error(format(
    $s$insert into public.appointments (professional_id, clinic_id, booking_source, patient_name,
         patient_phone, appointment_datetime, status, is_new_patient, reason, patient_gender, patient_birthdate)
       values (%L, %L, 'online', 'M1 Online', '+35799000002', %L, 'REQUESTED',
         true, 'Check-up', 'female', '1990-01-01')$s$,
    v_pro, v_clinic, v_when + interval '1 hour'), '23514', 'online booking without email');
  perform pg_temp.expect_error(format(
    $s$insert into public.appointments (professional_id, clinic_id, booking_source, patient_name,
         patient_email, patient_phone, appointment_datetime, status, reason, patient_gender, patient_birthdate)
       values (%L, %L, 'online', 'M1 Online', 'm1@integration.test', '+35799000002', %L, 'REQUESTED',
         'Check-up', 'female', '1990-01-01')$s$,
    v_pro, v_clinic, v_when + interval '1 hour'), '23514', 'online booking without is_new_patient');
  perform pg_temp.expect_error(format(
    $s$insert into public.appointments (professional_id, clinic_id, booking_source, patient_name,
         patient_email, patient_phone, appointment_datetime, status, is_new_patient, reason, patient_gender, patient_birthdate)
       values (%L, %L, 'online', 'M1 Online', 'm1@integration.test', '+35799000002', %L, 'REQUESTED',
         true, '   ', 'female', '1990-01-01')$s$,
    v_pro, v_clinic, v_when + interval '1 hour'), '23514', 'online booking with a blank reason');
  insert into public.appointments (professional_id, clinic_id, booking_source, patient_name,
    patient_email, patient_phone, appointment_datetime, status, is_new_patient, reason, patient_gender, patient_birthdate)
  values (v_pro, v_clinic, 'online', 'M1 Online', 'm1@integration.test', '+35799000002',
    v_when + interval '1 hour', 'REQUESTED', true, 'Check-up', 'female', '1990-01-01')
  returning id into v_appt2;
  v_checks := v_checks + 1;

  -- 6. Manual booking: email optional, everything else required.
  insert into public.appointments (professional_id, clinic_id, booking_source, patient_name,
    patient_phone, appointment_datetime, status, is_new_patient, reason, patient_gender, patient_birthdate)
  values (v_pro, v_clinic, 'manual', 'M1 Manual', '+35799000003',
    v_when + interval '5 hours', 'CONFIRMED', false, 'Follow-up', 'prefer_not_to_say', '1985-06-15');
  perform pg_temp.expect_error(format(
    $s$insert into public.appointments (professional_id, clinic_id, booking_source, patient_name,
         patient_phone, appointment_datetime, status, is_new_patient, reason, patient_gender)
       values (%L, %L, 'manual', 'M1 Manual', '+35799000003', %L, 'CONFIRMED', false, 'Follow-up', 'male')$s$,
    v_pro, v_clinic, v_when + interval '6 hours'), '23514', 'manual booking without birthdate');
  v_checks := v_checks + 1;

  -- 7. Value checks.
  perform pg_temp.expect_error(format(
    $s$update public.appointments set booking_source = 'phone' where id = %L$s$, v_appt),
    '23514', 'booking_source outside online/manual');
  perform pg_temp.expect_error(format(
    $s$update public.appointments set patient_gender = 'other' where id = %L$s$, v_appt),
    '23514', 'patient_gender outside the three values');
  perform pg_temp.expect_error(format(
    $s$update public.appointments set cancelled_by = 'founder' where id = %L$s$, v_appt),
    '23514', 'cancelled_by outside patient/professional');
  perform pg_temp.expect_error(format(
    $s$update public.appointments set professional_notes = repeat('x', 2001) where id = %L$s$, v_appt),
    '23514', 'professional_notes over 2000 characters');
  perform pg_temp.expect_error(format(
    $s$update public.appointments set patient_birthdate = '1800-01-01' where id = %L$s$, v_appt),
    '23514', 'patient_birthdate before 1900');
  perform pg_temp.expect_error(format(
    $s$update public.appointments set status = 'BOGUS' where id = %L$s$, v_appt),
    '23514', 'unknown status');
  v_checks := v_checks + 1;

  -- 8. New statuses and attendance value accepted; old statuses still accepted (M2 removes them).
  update public.appointments set status = 'DECLINED', decline_reason = 'Away that week' where id = v_appt;
  update public.appointments set status = 'EXPIRED' where id = v_appt;
  update public.appointments set status = 'REJECTED' where id = v_appt;
  update public.appointments set status = 'CANCELLED', cancelled_by = 'patient', attendance = 'attended' where id = v_appt;
  update public.appointments set attendance = 'no_show' where id = v_appt;
  perform pg_temp.expect_error(format(
    $s$update public.appointments set attendance = 'late' where id = %L$s$, v_appt),
    '23514', 'attendance outside attended/no_show');
  v_checks := v_checks + 1;

  -- 9. A declined request frees its time (occupancy RPC).
  update public.appointments set status = 'DECLINED', decline_reason = 'Away that week' where id = v_appt2;
  select count(*) into v_n
  from public.public_professionals_occupied_datetimes(array[v_pro], v_when + interval '1 hour', v_when + interval '1 hour');
  if v_n > 0 then
    raise exception 'FAIL: a DECLINED request still blocks its time';
  end if;
  v_checks := v_checks + 1;

  -- 10. clinic_id refuses an unknown clinic.
  perform pg_temp.expect_error(format(
    $s$update public.appointments set clinic_id = gen_random_uuid() where id = %L$s$, v_appt),
    '23503', 'clinic_id must reference clinics');
  v_checks := v_checks + 1;

  -- 11. appointment_drafts: token unique, email required.
  insert into public.appointment_drafts (professional_id, clinic_id, appointment_datetime, duration_minutes,
    patient_name, patient_email, patient_phone, patient_gender, patient_birthdate, is_new_patient, reason,
    token_hash, expires_at)
  values (v_pro, v_clinic, v_when, 30, 'M1 Draft', 'draft@integration.test', '+35799000004', 'male',
    '1970-02-02', true, 'Back pain', 'm1-draft-hash', now() + interval '30 minutes');
  perform pg_temp.expect_error(format(
    $s$insert into public.appointment_drafts (professional_id, clinic_id, appointment_datetime, duration_minutes,
         patient_name, patient_email, patient_phone, patient_gender, patient_birthdate, is_new_patient, reason,
         token_hash, expires_at)
       values (%L, %L, %L, 30, 'M1 Draft', 'draft2@integration.test', '+35799000005', 'male',
         '1970-02-02', true, 'Back pain', 'm1-draft-hash', now() + interval '30 minutes')$s$,
    v_pro, v_clinic, v_when), '23505', 'draft token_hash unique');
  perform pg_temp.expect_error(format(
    $s$insert into public.appointment_drafts (professional_id, clinic_id, appointment_datetime, duration_minutes,
         patient_name, patient_phone, patient_gender, patient_birthdate, is_new_patient, reason,
         token_hash, expires_at)
       values (%L, %L, %L, 30, 'M1 Draft', '+35799000005', 'male',
         '1970-02-02', true, 'Back pain', 'm1-draft-hash-2', now() + interval '30 minutes')$s$,
    v_pro, v_clinic, v_when), '23502', 'draft without email');
  v_checks := v_checks + 1;

  -- 12. appointment_links: purpose checked, token unique.
  insert into public.appointment_links (appointment_id, purpose, token_hash, expires_at)
  values (v_appt2, 'cancel', 'm1-link-hash', now() + interval '1 day');
  perform pg_temp.expect_error(format(
    $s$insert into public.appointment_links (appointment_id, purpose, token_hash, expires_at)
       values (%L, 'reschedule', 'm1-link-hash-2', now() + interval '1 day')$s$, v_appt2),
    '23514', 'link purpose outside proposal/cancel/review');
  perform pg_temp.expect_error(format(
    $s$insert into public.appointment_links (appointment_id, purpose, token_hash, expires_at)
       values (%L, 'review', 'm1-link-hash', now() + interval '1 day')$s$, v_appt2),
    '23505', 'link token_hash unique');
  v_checks := v_checks + 1;

  -- 13. professional_reviews: one per visit, rating 1-5, comment required, status checked.
  insert into public.professional_reviews (professional_id, appointment_id, rating, comment, reviewer_name, reviewer_email)
  values (v_pro, v_appt, 5, 'Very kind and thorough.', 'Maria Kyriakou', 'maria@integration.test');
  select count(*) into v_n from public.professional_reviews where appointment_id = v_appt and status = 'published';
  if v_n <> 1 then
    raise exception 'FAIL: a new review is not published by default';
  end if;
  perform pg_temp.expect_error(format(
    $s$insert into public.professional_reviews (professional_id, appointment_id, rating, comment, reviewer_name, reviewer_email)
       values (%L, %L, 4, 'Second review.', 'Maria Kyriakou', 'maria@integration.test')$s$, v_pro, v_appt),
    '23505', 'second review for the same visit');
  perform pg_temp.expect_error(format(
    $s$insert into public.professional_reviews (professional_id, appointment_id, rating, comment, reviewer_name, reviewer_email)
       values (%L, %L, 6, 'Too many stars.', 'A B', 'ab@integration.test')$s$, v_pro, v_appt2),
    '23514', 'rating above 5');
  perform pg_temp.expect_error(format(
    $s$insert into public.professional_reviews (professional_id, appointment_id, rating, comment, reviewer_name, reviewer_email)
       values (%L, %L, 3, '  ', 'A B', 'ab@integration.test')$s$, v_pro, v_appt2),
    '23514', 'blank review comment');
  perform pg_temp.expect_error(format(
    $s$update public.professional_reviews set status = 'deleted' where appointment_id = %L$s$, v_appt),
    '23514', 'review status outside published/hidden');
  v_checks := v_checks + 1;

  -- 14. Patient cancel notice: default 24, only 12/24/48.
  select count(*) into v_n from public.professional_settings where patient_cancel_notice_hours is distinct from 24;
  if v_n > 0 then
    raise exception 'FAIL: % professional_settings rows without the default 24 h cancel notice', v_n;
  end if;
  perform pg_temp.expect_error(format(
    $s$update public.professional_settings set patient_cancel_notice_hours = 36 where professional_id = %L$s$, v_pro),
    '23514', 'cancel notice outside 12/24/48');
  v_checks := v_checks + 1;

  -- 15. Paused banner: dismissal cleared when the pause changes, kept otherwise.
  update public.professional_clinics set pause_notice_dismissed_at = now() where id = v_link;
  update public.professional_clinics set label = coalesce(label, '') where id = v_link;
  select pause_notice_dismissed_at into v_ts from public.professional_clinics where id = v_link;
  if v_ts is null then
    raise exception 'FAIL: dismissal cleared by an unrelated update';
  end if;
  update public.professional_clinics set pause_online_bookings = not pause_online_bookings where id = v_link;
  select pause_notice_dismissed_at into v_ts from public.professional_clinics where id = v_link;
  if v_ts is not null then
    raise exception 'FAIL: dismissal not cleared when the pause changed';
  end if;
  v_checks := v_checks + 1;

  raise exception 'ALL appointments_flow_m1 TESTS PASSED (% checks)', v_checks;
end
$test$;

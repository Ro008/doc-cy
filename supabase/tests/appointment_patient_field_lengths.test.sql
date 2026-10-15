-- Database tests for the patient fields' length limits
-- (migration *_appointment_patient_field_lengths).
--
-- The booking routes refuse longer values (lib/booking-patient-fields.ts, 2026-10-15); the
-- database refuses them too, on drafts and on appointments:
-- - patient_name at most 200 characters;
-- - patient_email at most 254 (the longest valid address; null stays allowed on appointments);
-- - patient_phone at most 32.
--
-- Run against TESTING only. One transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL appointment_patient_field_lengths TESTS PASSED (…)" means
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

do $test$
declare
  v_pro uuid;
  v_clinic uuid;
  v_checks int := 0;
  v_draft text;
  v_appt text;
begin
  -- Any professional with a clinic: the rows never outlive this transaction.
  select pc.professional_id, pc.clinic_id into v_pro, v_clinic
  from public.professional_clinics pc
  limit 1;
  if v_pro is null then
    raise exception 'FAIL: setup (no professional_clinics row on this database)';
  end if;

  -- A draft with the given name, email and phone; everything else valid.
  v_draft := format(
    $s$insert into public.appointment_drafts (professional_id, clinic_id, appointment_datetime,
         duration_minutes, patient_name, patient_email, patient_phone, patient_gender,
         patient_birthdate, is_new_patient, reason, token_hash, expires_at)
       values (%L, %L, now() + interval '400 days', 30, %%L, %%L, %%L, 'female', date '1990-05-17',
         true, 'Check-up', %%L, now() + interval '30 minutes')$s$,
    v_pro, v_clinic);
  -- A declined appointment, far in the past, so no slot rule gets in the way.
  v_appt := format(
    $s$insert into public.appointments (professional_id, appointment_datetime, status,
         patient_name, patient_email, patient_phone)
       values (%L, timestamptz '2001-01-01 10:00+00', 'DECLINED', %%L, %%L, %%L)$s$,
    v_pro);

  -- At the limits: accepted.
  execute format(v_draft, 'Maria ' || repeat('K', 194), repeat('m', 242) || '@example.com',
    '+357' || repeat('-', 20) || '99123456', 'test-' || gen_random_uuid());
  execute format(v_appt, 'Maria ' || repeat('K', 194), repeat('m', 242) || '@example.com',
    '+357' || repeat('-', 20) || '99123456');
  v_checks := v_checks + 2;
  -- No email on a manual appointment is still fine.
  execute format(v_appt, 'Maria', null, '+35799123456');
  v_checks := v_checks + 1;

  -- One character over: refused, on both tables.
  perform pg_temp.expect_error(format(v_draft, 'Maria ' || repeat('K', 195), 'maria@example.com',
    '+35799123456', 'test-' || gen_random_uuid()), '23514', 'draft name of 201');
  perform pg_temp.expect_error(format(v_draft, 'Maria K', repeat('m', 243) || '@example.com',
    '+35799123456', 'test-' || gen_random_uuid()), '23514', 'draft email of 255');
  perform pg_temp.expect_error(format(v_draft, 'Maria K', 'maria@example.com',
    '+357' || repeat('-', 21) || '99123456', 'test-' || gen_random_uuid()), '23514', 'draft phone of 33');
  perform pg_temp.expect_error(format(v_appt, 'Maria ' || repeat('K', 195), 'maria@example.com',
    '+35799123456'), '23514', 'appointment name of 201');
  perform pg_temp.expect_error(format(v_appt, 'Maria K', repeat('m', 243) || '@example.com',
    '+35799123456'), '23514', 'appointment email of 255');
  perform pg_temp.expect_error(format(v_appt, 'Maria K', 'maria@example.com',
    '+357' || repeat('-', 21) || '99123456'), '23514', 'appointment phone of 33');
  v_checks := v_checks + 6;

  -- Changing a stored row is held to the same limits.
  perform pg_temp.expect_error(
    format($s$update public.appointments set patient_name = %L
             where professional_id = %L and appointment_datetime = timestamptz '2001-01-01 10:00+00'$s$,
           repeat('K', 201), v_pro),
    '23514', 'appointment name updated to 201');
  v_checks := v_checks + 1;

  raise exception 'ALL appointment_patient_field_lengths TESTS PASSED (% checks)', v_checks;
end
$test$;

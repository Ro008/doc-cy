-- Patient fields' length limits on drafts and appointments (user, 2026-10-15).
--
-- The booking routes refuse longer values (lib/booking-patient-fields.ts); the database
-- refuses them too, so a request sent without the form can't store a huge name in the
-- professional's Agenda or in the emails:
--   patient_name  at most 200 characters,
--   patient_email at most 254 (the longest valid address; null stays allowed on appointments),
--   patient_phone at most 32.
--
-- Backward-compatible: the running code never writes longer values (longest on Testing:
-- name 38, email 44, phone 14; Production has no rows). Idempotent: each check is
-- dropped and added again.
-- Test: supabase/tests/appointment_patient_field_lengths.test.sql.

alter table public.appointment_drafts
  drop constraint if exists appointment_drafts_patient_lengths_check;
alter table public.appointment_drafts
  add constraint appointment_drafts_patient_lengths_check check (
    char_length(patient_name) <= 200
    and char_length(patient_email) <= 254
    and char_length(patient_phone) <= 32
  );

alter table public.appointments
  drop constraint if exists appointments_patient_lengths_check;
alter table public.appointments
  add constraint appointments_patient_lengths_check check (
    char_length(patient_name) <= 200
    and (patient_email is null or char_length(patient_email) <= 254)
    and char_length(patient_phone) <= 32
  );

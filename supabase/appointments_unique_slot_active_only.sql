-- NEEDS_RESCHEDULE rows keep the original appointment_datetime for history/email.
-- A full UNIQUE(doctor_id, appointment_datetime) makes a new public booking at that
-- instant fail with 23505 (BOOKING_DUPLICATE) even though overlap logic frees the slot.
--
-- Run in Supabase SQL Editor after inspecting existing indexes (step 1).

-- 1) List unique indexes on appointments (find the one on doctor_id + appointment_datetime):
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public' AND tablename = 'appointments';

-- 2) Drop that index or table constraint. Examples (use ONLY what matches step 1):
-- DROP INDEX IF EXISTS public.appointments_doctor_id_appointment_datetime_key;
-- ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_doctor_id_appointment_datetime_key;

-- 3) Replace with a partial unique: only REQUESTED/CONFIRMED "own" the slot at DB level.
CREATE UNIQUE INDEX IF NOT EXISTS appointments_doctor_datetime_active_booking_key
  ON public.appointments (doctor_id, appointment_datetime)
  WHERE status IN (
    'REQUESTED'::public.appointment_status,
    'CONFIRMED'::public.appointment_status
  );

COMMENT ON INDEX public.appointments_doctor_datetime_active_booking_key IS
  'Prevents two active bookings at the same instant; NEEDS_RESCHEDULE does not reserve the original datetime.';

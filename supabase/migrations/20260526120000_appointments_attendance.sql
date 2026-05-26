-- Doctor-marked attendance on confirmed visits (MVP: no-show flag).
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS attendance text;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_attendance_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_attendance_check
  CHECK (attendance IS NULL OR attendance = 'no_show');

COMMENT ON COLUMN public.appointments.attendance IS
  'Doctor attendance marking; MVP supports no_show on past confirmed visits only.';

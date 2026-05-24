-- Manual bookings may omit patient email (doctor-entered appointments).
ALTER TABLE public.appointments
  ALTER COLUMN patient_email DROP NOT NULL;

COMMENT ON COLUMN public.appointments.patient_email IS
  'Patient email when provided; null for manual bookings without email.';

-- Per-appointment duration (minutes). Used after professional confirms; also set on new requests from slot settings.
-- Run in Supabase SQL Editor (separate from enum migration if needed).

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS duration_minutes integer;

UPDATE public.appointments
SET duration_minutes = 30
WHERE duration_minutes IS NULL;

ALTER TABLE public.appointments
  ALTER COLUMN duration_minutes SET DEFAULT 30;

ALTER TABLE public.appointments
  ALTER COLUMN duration_minutes SET NOT NULL;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_duration_minutes_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_duration_minutes_check
  CHECK (duration_minutes > 0 AND duration_minutes <= 480);

COMMENT ON COLUMN public.appointments.duration_minutes IS
  'Length of the visit in minutes (professional may adjust before confirm).';

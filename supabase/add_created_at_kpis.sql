-- Timestamps for Founder Dashboard KPIs (Active doctors 7d, Recent activity, New doctors week).
-- Run in Supabase: SQL Editor → New query → paste → Run.
--
-- What it does:
--   • appointments.created_at  → when the booking was created (for "last 5" + active doctors 7d)
--   • doctors.created_at     → when the profile was created (for "new doctors this week")
--
-- Safe to run multiple times (uses IF NOT EXISTS / only fills NULLs where noted).

-- ─── appointments.created_at ─────────────────────────────────────────────
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

-- Existing rows: approximate "created" as the slot time (better than all = migration time).
-- If you prefer every old row to share one date instead, change the UPDATE below.
UPDATE public.appointments
SET created_at = appointment_datetime
WHERE created_at IS NULL
  AND appointment_datetime IS NOT NULL;

UPDATE public.appointments
SET created_at = now()
WHERE created_at IS NULL;

ALTER TABLE public.appointments
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.appointments
  ALTER COLUMN created_at SET NOT NULL;

COMMENT ON COLUMN public.appointments.created_at IS 'When the booking was created (dashboard KPIs).';


-- ─── doctors.created_at ────────────────────────────────────────────────────
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

-- Existing profiles: use a fixed old date so they do NOT all count as "new this week"
-- after you run this migration. New signups still get real timestamps from DEFAULT now().
UPDATE public.doctors
SET created_at = '2000-01-01 00:00:00+00'::timestamptz
WHERE created_at IS NULL;

ALTER TABLE public.doctors
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.doctors
  ALTER COLUMN created_at SET NOT NULL;

COMMENT ON COLUMN public.doctors.created_at IS 'When the doctor profile was created (dashboard KPIs).';


-- Optional: verify
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name IN ('appointments', 'doctors')
--   AND column_name = 'created_at';

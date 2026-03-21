-- Doctor verification workflow: public booking only when status = 'verified'.
-- Run in Supabase SQL Editor (or migrate) after reviewing existing rows.
--
-- Values: pending (default for new signups), verified, rejected
-- Legacy: maps status = 'active' → 'verified'

-- Optional: credential columns (safe if already present)
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS license_number text,
  ADD COLUMN IF NOT EXISTS license_file_url text;

-- Migrate legacy "active" profiles to verified
UPDATE public.doctors
SET status = 'verified'
WHERE lower(trim(coalesce(status, ''))) = 'active';

-- Normalize anything else invalid to pending (adjust if you use other values)
UPDATE public.doctors
SET status = 'pending'
WHERE status IS NULL
   OR trim(status) = ''
   OR lower(trim(status)) NOT IN ('pending', 'verified', 'rejected');

ALTER TABLE public.doctors
  ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE public.doctors
  DROP CONSTRAINT IF EXISTS doctors_status_check;

ALTER TABLE public.doctors
  ADD CONSTRAINT doctors_status_check
  CHECK (status IN ('pending', 'verified', 'rejected'));

COMMENT ON COLUMN public.doctors.status IS 'Verification: pending | verified | rejected (public profile + booking only when verified).';
COMMENT ON COLUMN public.doctors.license_number IS 'Professional license number supplied at registration.';
COMMENT ON COLUMN public.doctors.license_file_url IS 'Storage path in bucket doctor-verifications for proof of ID.';

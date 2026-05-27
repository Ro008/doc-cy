-- Founder asked the professional to pick a standard specialty (custom label not added to directory).
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS specialty_requires_standard_at timestamptz;

COMMENT ON COLUMN public.doctors.specialty_requires_standard_at IS
  'Set when founder rejects a custom specialty; cleared when they pick a master category or founder maps/approves.';

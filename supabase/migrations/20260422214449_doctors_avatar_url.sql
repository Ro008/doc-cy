-- Add avatar_url to doctors so onboarding can persist cropped profile photo path.
-- Run in Supabase SQL Editor (safe to re-run).

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS avatar_url text;

COMMENT ON COLUMN public.doctors.avatar_url IS
  'Storage path in avatars bucket for the professional profile image.';


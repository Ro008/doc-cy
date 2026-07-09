ALTER TABLE public.doctor_settings
  ADD COLUMN IF NOT EXISTS show_phone_public boolean NOT NULL DEFAULT false;


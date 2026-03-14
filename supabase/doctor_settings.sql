-- Run this in the Supabase SQL editor to create the doctor_settings table.

CREATE TABLE IF NOT EXISTS public.doctor_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL UNIQUE REFERENCES public.doctors(id) ON DELETE CASCADE,
  monday boolean NOT NULL DEFAULT true,
  tuesday boolean NOT NULL DEFAULT true,
  wednesday boolean NOT NULL DEFAULT true,
  thursday boolean NOT NULL DEFAULT true,
  friday boolean NOT NULL DEFAULT true,
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '17:00',
  slot_duration_minutes integer NOT NULL DEFAULT 30 CHECK (slot_duration_minutes > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS doctor_settings_doctor_id_idx ON public.doctor_settings (doctor_id);

-- Optional: RLS (enable if you use Row Level Security)
-- ALTER TABLE public.doctor_settings ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Doctors can manage own settings" ON public.doctor_settings
--   FOR ALL USING (auth.uid() = (SELECT auth_user_id FROM public.doctors WHERE id = doctor_id));

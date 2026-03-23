-- Run this in the Supabase SQL editor to create the doctor_settings table.

CREATE TABLE IF NOT EXISTS public.doctor_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL UNIQUE REFERENCES public.doctors(id) ON DELETE CASCADE,
  monday boolean NOT NULL DEFAULT true,
  tuesday boolean NOT NULL DEFAULT true,
  wednesday boolean NOT NULL DEFAULT true,
  thursday boolean NOT NULL DEFAULT true,
  friday boolean NOT NULL DEFAULT true,
  saturday boolean NOT NULL DEFAULT false,
  sunday boolean NOT NULL DEFAULT false,
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '17:00',
  weekly_schedule jsonb NULL,
  break_start time NULL,
  break_end time NULL,
  pause_online_bookings boolean NOT NULL DEFAULT false,
  holiday_mode_enabled boolean NOT NULL DEFAULT false,
  holiday_start_date date NULL,
  holiday_end_date date NULL,
  booking_horizon_days integer NOT NULL DEFAULT 90 CHECK (booking_horizon_days IN (14, 30, 90, 180)),
  minimum_notice_hours integer NOT NULL DEFAULT 2 CHECK (minimum_notice_hours IN (1, 2, 12, 24)),
  slot_duration_minutes integer NOT NULL DEFAULT 30 CHECK (slot_duration_minutes > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- If migrating an existing database, run:
--   ALTER TABLE public.doctor_settings ADD COLUMN IF NOT EXISTS break_start time NULL;
--   ALTER TABLE public.doctor_settings ADD COLUMN IF NOT EXISTS break_end time NULL;
--   ALTER TABLE public.doctor_settings ADD COLUMN IF NOT EXISTS saturday boolean NOT NULL DEFAULT false;
--   ALTER TABLE public.doctor_settings ADD COLUMN IF NOT EXISTS sunday boolean NOT NULL DEFAULT false;
--   ALTER TABLE public.doctor_settings ADD COLUMN IF NOT EXISTS pause_online_bookings boolean NOT NULL DEFAULT false;
--   ALTER TABLE public.doctor_settings ADD COLUMN IF NOT EXISTS holiday_mode_enabled boolean NOT NULL DEFAULT false;
--   ALTER TABLE public.doctor_settings ADD COLUMN IF NOT EXISTS holiday_start_date date NULL;
--   ALTER TABLE public.doctor_settings ADD COLUMN IF NOT EXISTS holiday_end_date date NULL;
--   ALTER TABLE public.doctor_settings ADD COLUMN IF NOT EXISTS weekly_schedule jsonb NULL;
--   ALTER TABLE public.doctor_settings ADD COLUMN IF NOT EXISTS booking_horizon_days integer NOT NULL DEFAULT 90;
--   ALTER TABLE public.doctor_settings ADD COLUMN IF NOT EXISTS minimum_notice_hours integer NOT NULL DEFAULT 2;

CREATE INDEX IF NOT EXISTS doctor_settings_doctor_id_idx ON public.doctor_settings (doctor_id);

-- Optional: RLS (enable if you use Row Level Security)
-- ALTER TABLE public.doctor_settings ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Doctors can manage own settings" ON public.doctor_settings
--   FOR ALL USING (auth.uid() = (SELECT auth_user_id FROM public.doctors WHERE id = doctor_id));

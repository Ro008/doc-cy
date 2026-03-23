-- Upgrade doctor_settings for day-specific schedules + holiday blocking.
-- Run this in Supabase SQL Editor.

ALTER TABLE public.doctor_settings
  ADD COLUMN IF NOT EXISTS saturday boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sunday boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weekly_schedule jsonb NULL,
  ADD COLUMN IF NOT EXISTS pause_online_bookings boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS holiday_mode_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS holiday_start_date date NULL,
  ADD COLUMN IF NOT EXISTS holiday_end_date date NULL,
  ADD COLUMN IF NOT EXISTS booking_horizon_days integer NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS minimum_notice_hours integer NOT NULL DEFAULT 2;

ALTER TABLE public.doctor_settings
  DROP CONSTRAINT IF EXISTS doctor_settings_booking_horizon_days_check,
  ADD CONSTRAINT doctor_settings_booking_horizon_days_check
    CHECK (booking_horizon_days IN (14, 30, 90, 180));

ALTER TABLE public.doctor_settings
  DROP CONSTRAINT IF EXISTS doctor_settings_minimum_notice_hours_check,
  ADD CONSTRAINT doctor_settings_minimum_notice_hours_check
    CHECK (minimum_notice_hours IN (1, 2, 12, 24));


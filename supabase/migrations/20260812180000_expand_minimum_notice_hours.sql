-- Expand minimum notice period options for doctor_settings.
-- Adds 4h, 48h (2 days), 72h (3 days), and 168h (1 week).

ALTER TABLE public.doctor_settings
  DROP CONSTRAINT IF EXISTS doctor_settings_minimum_notice_hours_check;

ALTER TABLE public.doctor_settings
  ADD CONSTRAINT doctor_settings_minimum_notice_hours_check
  CHECK (minimum_notice_hours IN (1, 2, 4, 12, 24, 48, 72, 168));

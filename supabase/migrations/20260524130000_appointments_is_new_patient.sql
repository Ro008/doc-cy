-- Patient self-reports first visit vs returning (public booking KPI).
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS is_new_patient boolean;

COMMENT ON COLUMN public.appointments.is_new_patient IS
  'True when the patient selected first visit with this professional; false when returning; null for legacy/manual bookings.';

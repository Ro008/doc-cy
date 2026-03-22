-- Reason for visit (booking flow). Run in Supabase SQL Editor once.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS visit_type text,
  ADD COLUMN IF NOT EXISTS visit_notes text;

COMMENT ON COLUMN public.appointments.visit_type IS
  'Category: First Consultation | Follow-up | Routine Check-up | Urgency';
COMMENT ON COLUMN public.appointments.visit_notes IS
  'Optional patient note (app max 200 chars).';

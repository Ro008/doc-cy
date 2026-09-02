-- Store clinic on every Request online booking tap (repeat taps keep inserting rows).
ALTER TABLE IF EXISTS public.professional_patient_booking_requests
  ADD COLUMN IF NOT EXISTS clinic_id uuid REFERENCES public.clinics (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS professional_patient_booking_requests_clinic_created_idx
  ON public.professional_patient_booking_requests (clinic_id, created_at desc)
  WHERE clinic_id IS NOT NULL;

COMMENT ON COLUMN public.professional_patient_booking_requests.clinic_id IS
  'Practice location on the card when the patient tapped Request online booking, if known.';

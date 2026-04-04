-- STEP 2 of 2 — Run ONLY after step 1 has completed in a separate execution:
--   1) Run: appointments_appointment_request_step1_enum.sql
--   2) Then run this entire file (new query tab is fine).
--
-- Appointment request flow: status REQUESTED by default, required reason text.
-- Expects enum public.appointment_status to already include REQUESTED, CONFIRMED, CANCELLED.

-- ─── reason column ─────────────────────────────────────────────────────────
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reason text;

UPDATE public.appointments
SET reason = COALESCE(
  NULLIF(trim(reason), ''),
  NULLIF(trim(visit_notes), ''),
  '(No reason provided)'
)
WHERE reason IS NULL OR trim(reason) = '';

ALTER TABLE public.appointments
  ALTER COLUMN reason SET DEFAULT '';

ALTER TABLE public.appointments
  ALTER COLUMN reason SET NOT NULL;

COMMENT ON COLUMN public.appointments.reason IS
  'Patient explanation of why they need the visit (appointment request flow).';

-- ─── status: enum appointment_status ──────────────────────────────────────
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;

-- Map rows using ::text so we never feed '' into the enum.
UPDATE public.appointments
SET status = CASE
  WHEN status IS NULL THEN 'REQUESTED'::public.appointment_status
  WHEN trim(status::text) = '' THEN 'REQUESTED'::public.appointment_status
  WHEN lower(trim(status::text)) = 'confirmed' THEN 'CONFIRMED'::public.appointment_status
  WHEN lower(trim(status::text)) = 'cancelled' THEN 'CANCELLED'::public.appointment_status
  WHEN lower(trim(status::text)) IN ('pending', 'requested') THEN 'REQUESTED'::public.appointment_status
  WHEN trim(status::text) IN ('REQUESTED', 'CONFIRMED', 'CANCELLED') THEN status
  ELSE status
END;

ALTER TABLE public.appointments
  ALTER COLUMN status SET DEFAULT 'REQUESTED';

COMMENT ON COLUMN public.appointments.status IS
  'REQUESTED = awaiting professional confirmation; CONFIRMED = fixed in calendar; CANCELLED.';

-- Optional: only if status is plain text, not enum, uncomment:
-- ALTER TABLE public.appointments
--   ADD CONSTRAINT appointments_status_check
--   CHECK (status::text IN ('REQUESTED', 'CONFIRMED', 'CANCELLED'));

-- ─── RPC: occupied slots (superseded for production) ───────────────────────
-- Use public_doctor_occupied_datetimes_expand_appointment_slots.sql (+ NEEDS_RESCHEDULE rules).
-- This stub excludes NEEDS_RESCHEDULE from blocking the original time (no proposed_slots expansion here).
CREATE OR REPLACE FUNCTION public.public_doctor_occupied_datetimes(
  p_doctor_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE (appointment_datetime timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.appointment_datetime
  FROM public.appointments a
  INNER JOIN public.doctors d ON d.id = a.doctor_id
  WHERE a.doctor_id = p_doctor_id
    AND d.status = 'verified'
    AND lower(trim(a.status::text)) IN ('requested', 'confirmed')
    AND a.appointment_datetime >= p_from
    AND a.appointment_datetime <= p_to;
$$;

REVOKE ALL ON FUNCTION public.public_doctor_occupied_datetimes(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_doctor_occupied_datetimes(uuid, timestamptz, timestamptz) TO anon, authenticated;

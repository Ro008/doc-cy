-- STEP 2 of 2 — Run ONLY after step 1 has completed successfully:
--   appointments_needs_reschedule_step1_enum.sql
--
-- Counter-offer flow: columns + public_doctor_occupied_datetimes (proposed_slots holds).

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS proposed_slots jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS proposal_expires_at timestamptz;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reschedule_access_token uuid;

CREATE UNIQUE INDEX IF NOT EXISTS appointments_reschedule_access_token_key
  ON public.appointments (reschedule_access_token)
  WHERE reschedule_access_token IS NOT NULL;

COMMENT ON COLUMN public.appointments.proposed_slots IS
  'JSON array of ISO-8601 UTC start times offered to the patient while status is NEEDS_RESCHEDULE.';

COMMENT ON COLUMN public.appointments.proposal_expires_at IS
  'When the temporary hold on proposed_slots ends (patient must pick before this).';

COMMENT ON COLUMN public.appointments.reschedule_access_token IS
  'Secret token for the patient reschedule page; set when proposal is sent, cleared when resolved.';

-- Public booking: block other patients from slot starts that fall inside active proposals.
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
    AND a.status IS DISTINCT FROM 'CANCELLED'::public.appointment_status
    AND a.status IS DISTINCT FROM 'NEEDS_RESCHEDULE'::public.appointment_status
    AND a.appointment_datetime >= p_from
    AND a.appointment_datetime <= p_to

  UNION ALL

  SELECT (ps.elem::timestamptz + (gs.n::text || ' minutes')::interval)
  FROM public.appointments a
  INNER JOIN public.doctors d ON d.id = a.doctor_id
  LEFT JOIN public.doctor_settings ds ON ds.doctor_id = a.doctor_id
  CROSS JOIN LATERAL jsonb_array_elements_text(
    COALESCE(a.proposed_slots, '[]'::jsonb)
  ) AS ps(elem)
  CROSS JOIN LATERAL (
    SELECT
      GREATEST(COALESCE(ds.slot_duration_minutes, 30), 1) AS step_m,
      GREATEST(COALESCE(a.duration_minutes, ds.slot_duration_minutes, 30), 1) AS dur_m
  ) AS meta
  CROSS JOIN LATERAL generate_series(
    0,
    ((meta.dur_m - 1) / meta.step_m) * meta.step_m,
    meta.step_m
  ) AS gs(n)
  WHERE a.doctor_id = p_doctor_id
    AND d.status = 'verified'
    AND a.status = 'NEEDS_RESCHEDULE'::public.appointment_status
    AND a.proposal_expires_at IS NOT NULL
    AND a.proposal_expires_at > now()
    AND jsonb_array_length(COALESCE(a.proposed_slots, '[]'::jsonb)) > 0
    AND (ps.elem::timestamptz + (gs.n::text || ' minutes')::interval) >= p_from
    AND (ps.elem::timestamptz + (gs.n::text || ' minutes')::interval) <= p_to;
$$;

REVOKE ALL ON FUNCTION public.public_doctor_occupied_datetimes(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_doctor_occupied_datetimes(uuid, timestamptz, timestamptz) TO anon, authenticated;

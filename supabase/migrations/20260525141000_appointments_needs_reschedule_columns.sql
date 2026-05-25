-- Counter-offer reschedule: proposal columns on appointments.
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

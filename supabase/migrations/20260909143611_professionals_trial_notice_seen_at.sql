-- One-time first-login trial notice on the agenda (verified professionals only).
-- Not exposed on public directory views.

ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS trial_notice_seen_at timestamptz;

COMMENT ON COLUMN public.professionals.trial_notice_seen_at IS
  'When the verified professional dismissed the one-time first-login trial notice.';

-- Existing verified accounts already use the product; do not interrupt them.
UPDATE public.professionals
SET trial_notice_seen_at = now()
WHERE trial_notice_seen_at IS NULL
  AND is_registered = true
  AND status = 'verified';

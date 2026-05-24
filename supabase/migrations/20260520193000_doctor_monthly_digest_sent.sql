-- Idempotency log for doctor month-end digest emails (service role only).

CREATE TABLE IF NOT EXISTS public.doctor_monthly_digest_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id uuid NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  month_key text NOT NULL CHECK (month_key ~ '^\d{4}-\d{2}$'),
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doctor_id, month_key)
);

CREATE INDEX IF NOT EXISTS doctor_monthly_digest_sent_month_key_idx
  ON public.doctor_monthly_digest_sent (month_key);

ALTER TABLE public.doctor_monthly_digest_sent ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.doctor_monthly_digest_sent IS
  'Tracks month-end practice digest emails sent to doctors (Cyprus yyyy-MM).';

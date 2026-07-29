-- Cooldown log for automated ops alerts (finder traffic spikes, etc.).
-- Service role only; no public access.

CREATE TABLE IF NOT EXISTS public.ops_traffic_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_key text NOT NULL,
  alerted_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ops_traffic_alerts_key_time_idx
  ON public.ops_traffic_alerts (alert_key, alerted_at DESC);

COMMENT ON TABLE public.ops_traffic_alerts IS
  'Internal ops alert send log (cooldown + audit). Not exposed to anon/authenticated clients.';

ALTER TABLE public.ops_traffic_alerts ENABLE ROW LEVEL SECURITY;

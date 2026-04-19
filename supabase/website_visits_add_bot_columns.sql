-- Bot flag + User-Agent for filtering founder analytics (run on existing DBs).

ALTER TABLE public.website_visits ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE public.website_visits ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS website_visits_human_created_idx
  ON public.website_visits (created_at DESC)
  WHERE is_bot = false;

COMMENT ON COLUMN public.website_visits.user_agent IS 'Raw User-Agent (truncated at insert).';
COMMENT ON COLUMN public.website_visits.is_bot IS 'Heuristic: crawlers, monitors, headless, HTTP libraries — excluded from founder dashboard aggregates.';

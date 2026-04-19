-- Lightweight traffic analytics storage for founder dashboard.
-- One row per page view. Inserted server-side from middleware.

CREATE TABLE IF NOT EXISTS public.website_visits (
  id bigserial PRIMARY KEY,
  session_id text NOT NULL,
  page_path text NOT NULL,
  traffic_origin text NOT NULL CHECK (traffic_origin IN ('direct', 'ref')),
  ref_code text,
  utm_source text,
  utm_medium text,
  city text,
  country text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS website_visits_created_at_idx
  ON public.website_visits (created_at DESC);

CREATE INDEX IF NOT EXISTS website_visits_session_created_idx
  ON public.website_visits (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS website_visits_location_idx
  ON public.website_visits (country, city);

CREATE INDEX IF NOT EXISTS website_visits_page_idx
  ON public.website_visits (page_path);

COMMENT ON TABLE public.website_visits IS
  'Traffic analytics for founder dashboard. One row per page view.';

COMMENT ON COLUMN public.website_visits.traffic_origin IS
  'direct = no ?ref; ref = URL contains ?ref=<code>';


-- Run once on existing databases that already have website_visits (adds UTM columns for printed QR / marketing links).

ALTER TABLE public.website_visits ADD COLUMN IF NOT EXISTS utm_source text;
ALTER TABLE public.website_visits ADD COLUMN IF NOT EXISTS utm_medium text;

COMMENT ON COLUMN public.website_visits.utm_source IS 'From ?utm_source= (e.g. offline)';
COMMENT ON COLUMN public.website_visits.utm_medium IS 'From ?utm_medium= (e.g. business_card)';

-- Remove Postgres page-view analytics (Disk IO write pressure on Free/Nano).
-- Founder dashboard now points to Vercel Analytics / Search Console instead.

DROP TABLE IF EXISTS public.website_visits CASCADE;

-- Cooldown table only used by the retired finder-traffic-alert cron.
DROP TABLE IF EXISTS public.ops_traffic_alerts CASCADE;

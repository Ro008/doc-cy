-- Destructive: delete all traffic analytics rows (e.g. after test noise or to start fresh).
-- Run manually in Supabase SQL Editor → New query → Run.

TRUNCATE public.website_visits RESTART IDENTITY;

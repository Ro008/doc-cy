-- Reconstructed migration: this table was created directly against Supabase
-- Testing (out-of-band, not via a committed migration) on 2026-09-16 ~10:30.
-- Captured here from live schema introspection so migration history and any
-- fresh environment stay in sync. Companion to
-- directory_manual_outreach_unsubscribed (see
-- 20260915153059_rls_initplan_and_fk_indexes_disk_io.sql, itself also created
-- out-of-band) for the planned manual-directory email outreach feature
-- (docs/gesy-directory-export.md).

CREATE TABLE IF NOT EXISTS public.directory_manual_outreach_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manual_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  email text NOT NULL,
  booking_count integer NOT NULL DEFAULT 0,
  phone_click_count integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS directory_manual_outreach_sent_sent_idx
  ON public.directory_manual_outreach_sent (sent_at DESC);

CREATE INDEX IF NOT EXISTS directory_manual_outreach_sent_manual_sent_idx
  ON public.directory_manual_outreach_sent (manual_id, sent_at DESC);

ALTER TABLE public.directory_manual_outreach_sent ENABLE ROW LEVEL SECURITY;
-- No RLS policies: service_role only, consistent with other outreach/internal
-- tables (no anon/authenticated access).

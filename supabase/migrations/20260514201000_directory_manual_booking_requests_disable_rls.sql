-- RLS was enabled without policies; inserts from PostgREST + service role must succeed.
-- This table is only written by server route handlers (service role), not from the browser.
alter table if exists public.directory_manual_patient_booking_requests
  disable row level security;

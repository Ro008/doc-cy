-- This table is written only by trusted server routes with the service role.
-- Keep browser/anon clients from bypassing route validation and inflating votes.
alter table if exists public.directory_manual_patient_booking_requests
  enable row level security;

revoke all on table public.directory_manual_patient_booking_requests
  from anon, authenticated;

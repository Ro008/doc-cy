-- Security hardening: this table should not be publicly accessible.
-- Writes are performed from server route handlers using service role.
alter table if exists public.directory_manual_patient_booking_requests
  enable row level security;

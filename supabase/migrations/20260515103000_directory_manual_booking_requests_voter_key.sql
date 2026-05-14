-- Approximate de-duplication for patient "vote" signals (opaque HMAC; not raw IP).
alter table public.directory_manual_patient_booking_requests
  add column if not exists voter_key text;

comment on column public.directory_manual_patient_booking_requests.voter_key is
  'Opaque fingerprint (HMAC-SHA256 of client IP + manual_id) for counting unique voters; set server-side.';

create index if not exists directory_manual_patient_booking_requests_manual_voter_created_idx
  on public.directory_manual_patient_booking_requests (manual_id, voter_key, created_at desc);

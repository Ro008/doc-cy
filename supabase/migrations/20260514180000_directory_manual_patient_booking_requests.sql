-- Patient-driven demand signal: when someone taps "Request online booking" on a manual directory card / public manual profile.
create table if not exists public.directory_manual_patient_booking_requests (
  id uuid primary key default gen_random_uuid(),
  manual_id uuid not null references public.directory_manual (id) on delete cascade,
  created_at timestamptz not null default now(),
  source text not null default 'finder_card'
);

create index if not exists directory_manual_patient_booking_requests_manual_created_idx
  on public.directory_manual_patient_booking_requests (manual_id, created_at desc);

comment on table public.directory_manual_patient_booking_requests is
  'Anonymous patient intent: requests for a manual directory professional to enable DocCy online booking. Inserted only via server API (service role).';

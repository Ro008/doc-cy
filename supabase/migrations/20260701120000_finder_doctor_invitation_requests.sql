-- Patient demand when finder filters return no results: free-text doctor/clinic name.
create table if not exists public.finder_doctor_invitation_requests (
  id uuid primary key default gen_random_uuid(),
  requested_name text not null,
  specialty text,
  district text,
  search_name text,
  created_at timestamptz not null default now(),
  source text not null default 'finder_empty_state',
  voter_key text
);

create index if not exists finder_doctor_invitation_requests_created_idx
  on public.finder_doctor_invitation_requests (created_at desc);

create index if not exists finder_doctor_invitation_requests_name_context_idx
  on public.finder_doctor_invitation_requests (requested_name, specialty, district, created_at desc);

comment on table public.finder_doctor_invitation_requests is
  'Anonymous patient intent from finder empty state: names of doctors/clinics patients want on DocCy. Inserted only via server API (service role).';

alter table if exists public.finder_doctor_invitation_requests
  enable row level security;

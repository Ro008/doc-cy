-- Queue for registered doctors requesting a specialty change from settings.
-- Inserts/reviews go through trusted server APIs (service role). No client RLS policies.

create table if not exists public.doctor_specialty_change_requests (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  from_specialty text not null,
  to_specialty text not null,
  to_specialty_from_master boolean not null default true,
  license_number text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  founder_note text
);

create index if not exists doctor_specialty_change_requests_status_created_idx
  on public.doctor_specialty_change_requests (status, created_at desc);

create index if not exists doctor_specialty_change_requests_doctor_idx
  on public.doctor_specialty_change_requests (doctor_id, created_at desc);

-- At most one open request per doctor.
create unique index if not exists doctor_specialty_change_requests_one_pending_per_doctor
  on public.doctor_specialty_change_requests (doctor_id)
  where (status = 'pending');

comment on table public.doctor_specialty_change_requests is
  'Doctor specialty change requests from agenda settings. Service-role APIs only; founder reviews in /internal/directory.';

alter table if exists public.doctor_specialty_change_requests
  enable row level security;

-- Doctors can see their own requests in settings; writes go through service-role APIs.
drop policy if exists doctor_specialty_change_requests_select_own
  on public.doctor_specialty_change_requests;
create policy doctor_specialty_change_requests_select_own
  on public.doctor_specialty_change_requests
  for select
  to authenticated
  using (
    doctor_id in (
      select d.id from public.doctors d where d.auth_user_id = auth.uid()
    )
  );

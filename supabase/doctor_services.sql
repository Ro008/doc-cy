-- Service Menu for public doctor profiles.
-- Run in Supabase SQL editor.

create table if not exists public.doctor_services (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  name text not null,
  price text,
  created_at timestamptz not null default now()
);

create index if not exists doctor_services_doctor_id_idx
  on public.doctor_services (doctor_id, created_at);

alter table public.doctor_services enable row level security;

-- Public can read all services shown on profile pages.
drop policy if exists "doctor_services_public_read" on public.doctor_services;
create policy "doctor_services_public_read"
  on public.doctor_services
  for select
  using (true);

-- Only the authenticated doctor owner can insert their own services.
drop policy if exists "doctor_services_owner_insert" on public.doctor_services;
create policy "doctor_services_owner_insert"
  on public.doctor_services
  for insert
  with check (
    exists (
      select 1
      from public.doctors d
      where d.id = doctor_services.doctor_id
        and d.auth_user_id = auth.uid()
    )
  );

-- Only the authenticated doctor owner can update their own services.
drop policy if exists "doctor_services_owner_update" on public.doctor_services;
create policy "doctor_services_owner_update"
  on public.doctor_services
  for update
  using (
    exists (
      select 1
      from public.doctors d
      where d.id = doctor_services.doctor_id
        and d.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.doctors d
      where d.id = doctor_services.doctor_id
        and d.auth_user_id = auth.uid()
    )
  );

-- Only the authenticated doctor owner can delete their own services.
drop policy if exists "doctor_services_owner_delete" on public.doctor_services;
create policy "doctor_services_owner_delete"
  on public.doctor_services
  for delete
  using (
    exists (
      select 1
      from public.doctors d
      where d.id = doctor_services.doctor_id
        and d.auth_user_id = auth.uid()
    )
  );

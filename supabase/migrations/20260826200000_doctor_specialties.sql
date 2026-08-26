-- Multi-specialty for registered doctors (flat list, license per specialty).
-- Keeps doctors.specialty / license_number / is_specialty_approved in sync for legacy reads.

create table if not exists public.doctor_specialties (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  specialty text not null,
  license_number text not null,
  is_approved boolean not null default true,
  created_at timestamptz not null default now(),
  constraint doctor_specialties_specialty_nonempty check (length(btrim(specialty)) > 0),
  constraint doctor_specialties_license_nonempty check (length(btrim(license_number)) > 0),
  unique (doctor_id, specialty)
);

create index if not exists doctor_specialties_doctor_id_idx
  on public.doctor_specialties (doctor_id);

create index if not exists doctor_specialties_specialty_idx
  on public.doctor_specialties (specialty);

comment on table public.doctor_specialties is
  'Flat specialties for a registered professional. Each row has its own license; no primary specialty.';

alter table public.doctors
  add column if not exists specialties text[] not null default '{}';

comment on column public.doctors.specialties is
  'Approved specialty labels synced from doctor_specialties (alphabetical). Used by finder overlaps.';

create index if not exists doctors_specialties_gin_idx
  on public.doctors using gin (specialties);

-- Backfill junction from legacy single columns.
insert into public.doctor_specialties (doctor_id, specialty, license_number, is_approved)
select
  d.id,
  btrim(d.specialty),
  coalesce(nullif(btrim(d.license_number), ''), 'PENDING'),
  coalesce(d.is_specialty_approved, true)
from public.doctors d
where d.specialty is not null
  and btrim(d.specialty) <> ''
  and not exists (
    select 1
    from public.doctor_specialties ds
    where ds.doctor_id = d.id
      and lower(ds.specialty) = lower(btrim(d.specialty))
  );

create or replace function public.sync_doctor_specialties_to_doctor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_doctor_id uuid;
  approved_labels text[];
  first_label text;
  first_license text;
  any_unapproved boolean;
begin
  target_doctor_id := coalesce(new.doctor_id, old.doctor_id);

  select
    coalesce(
      array_agg(btrim(ds.specialty) order by lower(btrim(ds.specialty))),
      '{}'::text[]
    )
  into approved_labels
  from public.doctor_specialties ds
  where ds.doctor_id = target_doctor_id
    and ds.is_approved = true;

  select exists (
    select 1
    from public.doctor_specialties ds
    where ds.doctor_id = target_doctor_id
      and ds.is_approved = false
  )
  into any_unapproved;

  if cardinality(approved_labels) > 0 then
    first_label := approved_labels[1];
  else
    select btrim(ds.specialty)
    into first_label
    from public.doctor_specialties ds
    where ds.doctor_id = target_doctor_id
    order by lower(btrim(ds.specialty))
    limit 1;
  end if;

  if first_label is not null then
    select ds.license_number
    into first_license
    from public.doctor_specialties ds
    where ds.doctor_id = target_doctor_id
      and btrim(ds.specialty) = first_label
    order by ds.created_at
    limit 1;
  end if;

  update public.doctors d
  set
    specialties = coalesce(approved_labels, '{}'::text[]),
    specialty = coalesce(first_label, d.specialty),
    license_number = coalesce(nullif(btrim(first_license), ''), d.license_number),
    is_specialty_approved = not coalesce(any_unapproved, false)
  where d.id = target_doctor_id;

  return null;
end;
$$;

drop trigger if exists doctor_specialties_sync_doctor on public.doctor_specialties;
create trigger doctor_specialties_sync_doctor
after insert or update or delete on public.doctor_specialties
for each row
execute function public.sync_doctor_specialties_to_doctor();

-- Sync denormalized columns for backfilled rows.
do $$
declare
  r record;
begin
  for r in select distinct doctor_id from public.doctor_specialties
  loop
    update public.doctor_specialties
    set specialty = specialty
    where doctor_id = r.doctor_id
      and id = (
        select id from public.doctor_specialties where doctor_id = r.doctor_id limit 1
      );
  end loop;
end $$;

alter table public.doctor_specialties enable row level security;

-- Owner can read their own rows in settings. Public reads use doctors.specialties via service role.
drop policy if exists doctor_specialties_select_own on public.doctor_specialties;
create policy doctor_specialties_select_own
  on public.doctor_specialties
  for select
  to authenticated
  using (
    doctor_id in (
      select d.id from public.doctors d where d.auth_user_id = auth.uid()
    )
  );

-- Writes only via service role (registration / founder APIs).

drop view if exists public.doctors_public;

create view public.doctors_public
with (security_invoker = false)
as
select
  d.id,
  d.name,
  d.specialty,
  d.specialties,
  d.bio,
  d.clinic_address,
  d.slug,
  d.status,
  d.languages,
  d.created_at,
  d.is_specialty_approved,
  d.is_gesy,
  d.district,
  d.town,
  d.avatar_url,
  d.latitude,
  d.longitude,
  case
    when coalesce(ds.show_phone_public, false) then nullif(btrim(d.phone), '')
    else null
  end as phone
from public.doctors d
left join public.doctor_settings ds on ds.doctor_id = d.id;

revoke select on public.doctors_public from anon, authenticated;
grant select on public.doctors_public to service_role;

comment on view public.doctors_public is
  'Server-only registered doctor public profile fields (service_role). Includes specialties[]. Conditional phone via show_phone_public.';

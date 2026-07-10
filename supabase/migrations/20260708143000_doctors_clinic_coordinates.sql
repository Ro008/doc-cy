alter table public.doctors
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists clinic_place_id text;

alter table public.directory_manual
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

-- Store languages spoken by the doctor (for internal directory & future filters).
-- Run in Supabase SQL editor.

alter table public.doctors
  add column if not exists languages text[] not null default '{}'::text[];

comment on column public.doctors.languages is 'Languages offered (e.g. English, Greek).';

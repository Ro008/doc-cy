-- GeSY badge for manual directory cards (same visual as doctors.is_gesy).
-- Rows linked to GeSY (non-null ghs_code) are marked is_gesy = true.

alter table public.directory_manual
  add column if not exists is_gesy boolean not null default false;

comment on column public.directory_manual.is_gesy is
  'When true, show the GeSY provider badge on finder / manual landing cards.';

-- All current GeSY-linked Dermatology imports (and any future rows with ghs_code).
update public.directory_manual
set is_gesy = true
where is_archived = false
  and ghs_code is not null
  and btrim(ghs_code) <> '';

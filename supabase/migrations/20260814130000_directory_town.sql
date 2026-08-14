-- Town/municipality for finder typeahead (GeSY locality, not district).
-- Stored on the workplace (clinics) and copied to directory_manual for primary-location filters.

alter table public.clinics
  add column if not exists town text;

alter table public.directory_manual
  add column if not exists town text;

comment on column public.clinics.town is
  'Municipality/village for this clinic location (GeSY town). Used by finder town filter.';

comment on column public.directory_manual.town is
  'Primary clinic town for this professional. Extra workplaces are filtered via clinics.town.';

create index if not exists clinics_town_idx
  on public.clinics (town)
  where is_archived = false and town is not null;

create index if not exists directory_manual_town_idx
  on public.directory_manual (town)
  where is_archived = false and town is not null;

drop view if exists public.clinics_public;
create view public.clinics_public
with (security_invoker = false)
as
select
  id,
  name,
  slug,
  district,
  town,
  address,
  phone,
  address_maps_link,
  latitude,
  longitude,
  is_archived,
  created_at,
  updated_at
from public.clinics
where is_archived = false;

revoke select on public.clinics_public from anon, authenticated;
grant select on public.clinics_public to service_role;

drop view if exists public.directory_manual_public;
create view public.directory_manual_public
with (security_invoker = false)
as
select
  id,
  name,
  specialty,
  specialties,
  district,
  town,
  address_maps_link,
  phone,
  address,
  is_gesy,
  latitude,
  longitude,
  slug,
  clinic_id,
  finder_visible,
  is_archived,
  created_at,
  updated_at
from public.directory_manual
where is_archived = false;

revoke select on public.directory_manual_public from anon, authenticated;
grant select on public.directory_manual_public to service_role;

-- Persist clinic town for registered doctors (Google locality / GeSY town list).
-- Nullable: registration still succeeds if Places does not yield a known town.

alter table public.doctors
  add column if not exists town text;

comment on column public.doctors.town is
  'Clinic town/municipality for finder filters. Filled from Google Places locality at register/settings; not a doctor-entered field.';

drop view if exists public.doctors_public;

create view public.doctors_public
with (security_invoker = false)
as
select
  d.id,
  d.name,
  d.specialty,
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
  'Server-only registered doctor public profile fields (service_role). Conditional phone via show_phone_public. Not granted to anon/authenticated.';

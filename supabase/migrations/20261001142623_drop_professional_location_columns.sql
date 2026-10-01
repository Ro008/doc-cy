-- Point E5: a professional's location lives on their clinics (professional_clinics ->
-- clinics). Drops the copies on professionals and the unused phone settings
-- (user, 2026-10-01). Listing data was reconciled into the clinics first; nothing in the
-- app reads or writes these columns any more. Backward-compatible once the code that
-- stops reading them is live: apply to Production after the PR merges.
--
-- Kept: professionals.ghs_code (the professional's own GeSY code, the importer's key),
-- professionals.email (outreach), clinics.clinic_place_id (Google Places id of
-- DocCy-created clinics).

-- Guard: no database function names a dropped phone setting. (The location column
-- names are shared with clinics; E0 checked that no function reads them on professionals.)
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosrc ~ '\m(show_phone_public|public_phone_source)\M'
  ) then
    raise exception 'a public function still names show_phone_public or public_phone_source';
  end if;
end
$$;

drop index if exists public.professionals_district_idx;
drop index if exists public.professionals_town_idx;
drop index if exists public.professionals_clinic_id_idx;

alter table public.professionals drop constraint if exists professionals_clinic_id_fkey;

alter table public.professionals
  drop column if exists district,
  drop column if exists town,
  drop column if exists phone,
  drop column if exists clinic_address,
  drop column if exists address,
  drop column if exists address_maps_link,
  drop column if exists latitude,
  drop column if exists longitude,
  drop column if exists clinic_place_id,
  drop column if exists clinic_id;

alter table public.professional_settings
  drop constraint if exists professional_settings_public_phone_source_check;

alter table public.professional_settings
  drop column if exists show_phone_public,
  drop column if exists public_phone_source;

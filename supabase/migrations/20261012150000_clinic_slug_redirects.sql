-- Clinic web addresses follow the clinic's name, and old addresses keep working.
--
-- User, 2026-10-12: when founders approve a new clinic name (request type
-- professional_clinic_details_change), the clinic's web address (slug) changes with
-- it. Until now it stayed, because clinics had nowhere to keep an old address.
--
-- - clinic_slug_redirects: old addresses, each pointing at its clinic. The clinic page
--   forwards them (server only: no session can read or write the table).
-- - clinic_slug_pick(name, clinic): the address for a name. It skips addresses in use
--   by another clinic and addresses that forward to another clinic. A clinic may keep
--   its own address or take back one it had. A name with no Latin letters or digits
--   gives no address of its own: a clinic being renamed then keeps the one it has.
-- - request_clinic_slug(name) (new clinics) goes through the same rule, so a new
--   clinic is never given an address that forwards elsewhere.
-- - the approval step moves the address and records it in the request's outcome
--   (slug, previous_slug) when it changed.
--
-- Backward-compatible: nothing running reads the new table or depends on the address
-- staying. Safe to re-run.

-- 1. Old addresses.
create table if not exists public.clinic_slug_redirects (
  slug text primary key,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint clinic_slug_redirects_slug_shape check (slug <> '' and slug = lower(btrim(slug)))
);
create index if not exists clinic_slug_redirects_clinic_id_idx
  on public.clinic_slug_redirects (clinic_id);
alter table public.clinic_slug_redirects enable row level security;
revoke all on table public.clinic_slug_redirects from public, anon, authenticated;
grant select, insert, update, delete on table public.clinic_slug_redirects to service_role;
comment on table public.clinic_slug_redirects is
  'Old public addresses (slugs) of clinics. /clinics/<old> forwards to the clinic''s current address. Written when a clinic name change is approved. Server only.';

-- 2. The address for a clinic name.
create or replace function public.clinic_slug_pick(p_name text, p_clinic_id uuid default null)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_base text;
  v_slug text;
  v_n integer := 1;
begin
  v_base := trim(both '-' from regexp_replace(
    lower(translate(
      coalesce(p_name, ''),
      'áàâäãåÁÀÂÄÃÅéèêëÉÈÊËíìîïÍÌÎÏóòôöõÓÒÔÖÕúùûüÚÙÛÜñÑçÇýÿÝ',
      'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUnNcCyyY'
    )),
    '[^a-z0-9]+', '-', 'g'
  ));
  if v_base = '' then
    -- The name gives no address of its own: a clinic being renamed keeps the one it has.
    if p_clinic_id is not null then
      select nullif(lower(btrim(coalesce(c.slug, ''))), '') into v_slug
      from public.clinics c where c.id = p_clinic_id;
      if v_slug is not null then
        return v_slug;
      end if;
    end if;
    v_base := 'clinic';
  end if;
  v_slug := v_base;
  while exists (select 1 from public.clinics c
                where c.slug = v_slug and c.id is distinct from p_clinic_id)
     or exists (select 1 from public.clinic_slug_redirects r
                where r.slug = v_slug and r.clinic_id is distinct from p_clinic_id) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n::text;
  end loop;
  return v_slug;
end
$$;

create or replace function public.request_clinic_slug(p_name text)
returns text
language sql
set search_path = ''
as $$
  select public.clinic_slug_pick(p_name, null);
$$;

-- 3. Approval step: the clinic's details. As in *_professional_clinic_requests, and a
--    new name now moves the web address.
create or replace function public.request_apply_professional_clinic_details_change(
  p_req public.request_log,
  p_details jsonb,
  p_options jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_clinic public.clinics%rowtype;
  v_changes jsonb := p_details -> 'changes';
  v_place jsonb := p_details -> 'changes' -> 'location';
  v_before jsonb := coalesce(p_req.before_snapshot, '{}'::jsonb);
  v_current jsonb;
  v_changed jsonb := '[]'::jsonb;
  v_old_slug text;
  v_new_slug text;
  v_moved jsonb := '{}'::jsonb;
begin
  if p_details ->> 'clinic_id' is distinct from p_req.details ->> 'clinic_id' then
    raise exception 'a correction stays with the clinic she asked about' using errcode = '22023';
  end if;
  select * into v_clinic from public.clinics c
  where c.id::text = p_req.details ->> 'clinic_id' and not c.is_archived
  for update;
  if not found then
    raise exception 'the clinic no longer exists' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.professional_clinics pc
                 where pc.professional_id = p_req.professional_id and pc.clinic_id = v_clinic.id) then
    raise exception 'she no longer works at this clinic: deny the request' using errcode = '55000';
  end if;

  v_current := jsonb_build_object('name', v_clinic.name, 'address', v_clinic.address, 'phone', v_clinic.phone);
  perform public.professional_clinic_changes_check(v_changes, v_current);
  if (v_changes ? 'name' and v_clinic.name is distinct from v_before ->> 'name')
     or (v_changes ? 'address' and v_clinic.address is distinct from v_before ->> 'address')
     or (v_changes ? 'phone' and v_clinic.phone is distinct from v_before ->> 'phone') then
    raise exception 'the clinic changed since this request was made' using errcode = '55000';
  end if;

  if v_changes ? 'name' then
    -- The web address follows the name; the old one is kept and forwards.
    v_old_slug := nullif(lower(btrim(coalesce(v_clinic.slug, ''))), '');
    v_new_slug := public.clinic_slug_pick(v_changes ->> 'name', v_clinic.id);
    -- Taking back an address this clinic had before: it stops forwarding.
    delete from public.clinic_slug_redirects r where r.slug = v_new_slug;
    update public.clinics
    set name = btrim(v_changes ->> 'name'), slug = v_new_slug, updated_at = now()
    where id = v_clinic.id;
    if v_old_slug is not null and v_old_slug <> v_new_slug then
      insert into public.clinic_slug_redirects (slug, clinic_id)
      values (v_old_slug, v_clinic.id)
      on conflict (slug) do update set clinic_id = excluded.clinic_id;
      v_moved := jsonb_build_object('slug', v_new_slug, 'previous_slug', v_old_slug);
    end if;
    v_changed := v_changed || '"name"'::jsonb;
  end if;
  if v_changes ? 'address' then
    update public.clinics
    set address = btrim(v_changes ->> 'address'),
        district = (v_place ->> 'district')::public.cyprus_district,
        town = nullif(btrim(coalesce(v_place ->> 'town', '')), ''),
        latitude = (v_place ->> 'latitude')::double precision,
        longitude = (v_place ->> 'longitude')::double precision,
        clinic_place_id = nullif(btrim(coalesce(v_place ->> 'place_id', '')), ''),
        -- The old Maps link pointed at the old address.
        address_maps_link = null,
        updated_at = now()
    where id = v_clinic.id;
    v_changed := v_changed || '"address"'::jsonb;
  end if;
  if v_changes ? 'phone' then
    update public.clinics set phone = v_changes ->> 'phone', updated_at = now() where id = v_clinic.id;
    v_changed := v_changed || '"phone"'::jsonb;
  end if;
  return jsonb_build_object('clinic_id', v_clinic.id, 'changed', v_changed) || v_moved;
end
$$;

comment on function public.clinic_slug_pick(text, uuid) is
  'The public address (slug) for a clinic name: skips addresses in use by, or forwarding to, another clinic. With p_clinic_id, that clinic may keep its address or take back an old one.';
comment on function public.request_clinic_slug(text) is
  'The public address (slug) for a new clinic. See clinic_slug_pick.';
comment on function public.request_apply_professional_clinic_details_change(public.request_log, jsonb, jsonb) is
  'Approval step of professional_clinic_details_change: changes the clinic''s name, address or phone. A new name moves the web address; the old one is kept in clinic_slug_redirects. Called by request_approve only.';

revoke all on function public.clinic_slug_pick(text, uuid) from public, anon, authenticated;
revoke all on function public.request_clinic_slug(text) from public, anon, authenticated;
revoke all on function public.request_apply_professional_clinic_details_change(public.request_log, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.clinic_slug_pick(text, uuid) to service_role;
grant execute on function public.request_clinic_slug(text) to service_role;

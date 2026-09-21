-- Point C, step 1 (expand only): the specialties catalogue and the
-- professional_specialties join table.
--
--   specialties               id, name (unique), slug (unique), created_at
--   professional_specialties  = doctor_specialties renamed, doctor_id -> professional_id,
--                               plus specialty_id -> specialties, licence now nullable
--
-- Backward-compatible. The previous code keeps working through:
--   * a compatibility view `doctor_specialties` (security_invoker, aliases
--     professional_id back to doctor_id). INSERT ... ON CONFLICT (doctor_id, specialty)
--     still resolves, because the (professional_id, specialty) unique index stays
--     until the code writes specialty_id itself.
--   * the sync trigger, which keeps professionals.specialty / specialties /
--     license_number / is_specialty_approved filled for registered professionals.
--
-- Rules:
--   * The catalogue holds approved labels only. A pending custom label ("Other")
--     keeps specialty_id null; the row gets its specialty_id, and the label enters
--     the catalogue, when a founder approves it (is_approved -> true).
--   * specialty_id is always derived from the label by slug, so case or spacing
--     variants of a label resolve to the same specialty.
--   * slug reproduces lib/finder-seo.ts specialtyToSlug(), because finder URLs
--     are built from it and are indexed.
--   * Scraped listings get join rows from their own specialties[] (or `specialty`
--     when the array is empty), with a null licence. The sync trigger skips
--     unregistered professionals, so their `specialty` is never rewritten
--     (for about 180 of them it is not the alphabetically first label).
--   * The backfill never touches professionals.
--
-- Later steps: C2 moves reads and writes onto these tables; C3 drops the
-- professionals.* specialty columns, the sync trigger, the text label column,
-- and the compatibility view. is_approved stays until the registration flow is
-- rebuilt.
--
-- Idempotent: every step is guarded; a re-run is a no-op.

-- ---------------------------------------------------------------------------
-- 1. Slug helper, identical to specialtyToSlug() (minus its "all" fallback).
-- ---------------------------------------------------------------------------
create or replace function public.specialty_slug(p_label text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            btrim(lower(normalize(coalesce(p_label, ''), NFKD))),
            '[^a-z0-9\s-]', '', 'g'),
          '\s+', '-', 'g'),
        '-+', '-', 'g'),
      '^-|-$', '', 'g'),
    '')
$$;

revoke all on function public.specialty_slug(text) from public, anon, authenticated;
-- The catalogue's check constraint and the resolve trigger run it as the writer.
grant execute on function public.specialty_slug(text) to service_role;

-- ---------------------------------------------------------------------------
-- 2. The catalogue. Service role only: RLS on, no policies, no anon/authenticated grants.
-- ---------------------------------------------------------------------------
create table if not exists public.specialties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  constraint specialties_name_key unique (name),
  constraint specialties_slug_key unique (slug),
  constraint specialties_name_nonempty check (length(btrim(name)) > 0),
  constraint specialties_slug_matches_name check (slug = public.specialty_slug(name))
);

alter table public.specialties enable row level security;
revoke all on table public.specialties from anon, authenticated;

comment on table public.specialties is
  'Approved specialty labels. slug = specialty_slug(name) = the finder URL segment.';

-- ---------------------------------------------------------------------------
-- 3. Rename doctor_specialties -> professional_specialties (real table only).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
       select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = 'doctor_specialties' and c.relkind = 'r'
     )
     and to_regclass('public.professional_specialties') is null
  then
    alter table public.doctor_specialties rename to professional_specialties;
  end if;

  if exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'professional_specialties' and column_name = 'doctor_id'
     )
  then
    alter table public.professional_specialties rename column doctor_id to professional_id;
  end if;
end $$;

-- Constraint, index, policy and trigger names follow the table.
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('doctor_specialties_pkey',                     'professional_specialties_pkey'),
      ('doctor_specialties_doctor_id_fkey',           'professional_specialties_professional_id_fkey'),
      ('doctor_specialties_doctor_id_specialty_key',  'professional_specialties_professional_id_specialty_key'),
      ('doctor_specialties_specialty_nonempty',       'professional_specialties_specialty_nonempty')
    ) as t(old_name, new_name)
  loop
    if exists (select 1 from pg_constraint where conrelid = 'public.professional_specialties'::regclass and conname = r.old_name)
       and not exists (select 1 from pg_constraint where conrelid = 'public.professional_specialties'::regclass and conname = r.new_name)
    then
      execute format('alter table public.professional_specialties rename constraint %I to %I', r.old_name, r.new_name);
    end if;
  end loop;

  for r in
    select * from (values
      ('doctor_specialties_doctor_id_idx', 'professional_specialties_professional_id_idx'),
      ('doctor_specialties_specialty_idx', 'professional_specialties_specialty_idx')
    ) as t(old_name, new_name)
  loop
    if to_regclass('public.' || r.old_name) is not null and to_regclass('public.' || r.new_name) is null then
      execute format('alter index public.%I rename to %I', r.old_name, r.new_name);
    end if;
  end loop;

  if exists (select 1 from pg_policy where polrelid = 'public.professional_specialties'::regclass and polname = 'doctor_specialties_select_own') then
    alter policy doctor_specialties_select_own on public.professional_specialties
      rename to professional_specialties_select_own;
  end if;
end $$;

-- Licence: optional (scraped listings have none), but never an empty string.
alter table public.professional_specialties alter column license_number drop not null;
alter table public.professional_specialties drop constraint if exists doctor_specialties_license_nonempty;
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.professional_specialties'::regclass and conname = 'professional_specialties_license_nonempty') then
    alter table public.professional_specialties
      add constraint professional_specialties_license_nonempty
      check (license_number is null or length(btrim(license_number)) > 0);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. specialty_id.
-- ---------------------------------------------------------------------------
alter table public.professional_specialties
  add column if not exists specialty_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.professional_specialties'::regclass and conname = 'professional_specialties_specialty_id_fkey') then
    alter table public.professional_specialties
      add constraint professional_specialties_specialty_id_fkey
      foreign key (specialty_id) references public.specialties (id) on delete restrict;
  end if;
end $$;

create index if not exists professional_specialties_specialty_id_idx
  on public.professional_specialties (specialty_id);

-- ---------------------------------------------------------------------------
-- 5. Triggers.
--    a) BEFORE: derive specialty_id from the label; add an approved label that
--       the catalogue lacks.
--    b) AFTER: the sync into professionals.*, rewritten for the new names. It skips
--       unregistered professionals, and skips entirely while this migration backfills.
-- ---------------------------------------------------------------------------
create or replace function public.professional_specialties_resolve_specialty()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_label text := btrim(new.specialty);
  v_slug text := public.specialty_slug(new.specialty);
begin
  if v_slug is null or v_slug = 'all' then
    raise exception 'specialty label "%" has no usable slug', new.specialty;
  end if;

  select s.id into new.specialty_id
  from public.specialties s
  where s.slug = v_slug;

  if new.specialty_id is null and new.is_approved then
    insert into public.specialties (name, slug)
    values (v_label, v_slug)
    on conflict (slug) do nothing;

    select s.id into new.specialty_id
    from public.specialties s
    where s.slug = v_slug;
  end if;

  return new;
end;
$$;

revoke all on function public.professional_specialties_resolve_specialty() from public, anon, authenticated;

create or replace function public.sync_professional_specialties_to_professional()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_professional_id uuid;
  approved_labels text[];
  first_label text;
  first_license text;
  any_unapproved boolean;
begin
  if current_setting('doccy.skip_specialty_sync', true) = 'on' then
    return null;
  end if;

  target_professional_id := coalesce(new.professional_id, old.professional_id);

  -- Scraped listings own their denormalized columns (written by the GeSY import).
  if not exists (
    select 1 from public.professionals p
    where p.id = target_professional_id and p.is_registered is true
  ) then
    return null;
  end if;

  select coalesce(array_agg(btrim(ps.specialty) order by lower(btrim(ps.specialty))), '{}'::text[])
  into approved_labels
  from public.professional_specialties ps
  where ps.professional_id = target_professional_id
    and ps.is_approved = true;

  select exists (
    select 1 from public.professional_specialties ps
    where ps.professional_id = target_professional_id
      and ps.is_approved = false
  )
  into any_unapproved;

  if cardinality(approved_labels) > 0 then
    first_label := approved_labels[1];
  else
    select btrim(ps.specialty)
    into first_label
    from public.professional_specialties ps
    where ps.professional_id = target_professional_id
    order by lower(btrim(ps.specialty))
    limit 1;
  end if;

  if first_label is not null then
    select ps.license_number
    into first_license
    from public.professional_specialties ps
    where ps.professional_id = target_professional_id
      and btrim(ps.specialty) = first_label
    order by ps.created_at
    limit 1;
  end if;

  update public.professionals d
  set
    specialties = coalesce(approved_labels, '{}'::text[]),
    specialty = coalesce(first_label, d.specialty),
    license_number = coalesce(nullif(btrim(first_license), ''), d.license_number),
    is_specialty_approved = not coalesce(any_unapproved, false)
  where d.id = target_professional_id;

  return null;
end;
$$;

revoke all on function public.sync_professional_specialties_to_professional() from public, anon, authenticated;

drop trigger if exists doctor_specialties_sync_doctor on public.professional_specialties;
drop function if exists public.sync_doctor_specialties_to_doctor();

drop trigger if exists professional_specialties_resolve_specialty on public.professional_specialties;
create trigger professional_specialties_resolve_specialty
  before insert or update of specialty, specialty_id, is_approved
  on public.professional_specialties
  for each row execute function public.professional_specialties_resolve_specialty();

-- Not fired by specialty_id-only updates, so the backfill below cannot reach professionals.
drop trigger if exists professional_specialties_sync_professional on public.professional_specialties;
create trigger professional_specialties_sync_professional
  after insert or delete or update of professional_id, specialty, license_number, is_approved
  on public.professional_specialties
  for each row execute function public.sync_professional_specialties_to_professional();

-- ---------------------------------------------------------------------------
-- 6. Backfill (sync disabled for this transaction only).
-- ---------------------------------------------------------------------------
select set_config('doccy.skip_specialty_sync', 'on', true);

-- 6a. Catalogue: every approved label in use, one row per slug; the most
--     frequent spelling wins. Professionals with join rows contribute their
--     approved rows; the others their denormalized labels, when approved.
with labels as (
  select btrim(ps.specialty) as label
  from public.professional_specialties ps
  where ps.is_approved
  union all
  select btrim(s)
  from public.professionals p
  cross join lateral unnest(
    case when cardinality(p.specialties) > 0 then p.specialties else array[p.specialty] end
  ) as s
  where coalesce(p.is_specialty_approved, true)
    and not exists (select 1 from public.professional_specialties ps where ps.professional_id = p.id)
),
ranked as (
  select
    label,
    public.specialty_slug(label) as slug,
    row_number() over (
      partition by public.specialty_slug(label)
      order by count(*) desc, label
    ) as rn
  from labels
  where public.specialty_slug(label) is not null
    and public.specialty_slug(label) <> 'all'
  group by label
)
insert into public.specialties (name, slug)
select label, slug from ranked where rn = 1
on conflict (slug) do nothing;

-- 6b. Existing join rows get their specialty_id (only the BEFORE trigger fires).
update public.professional_specialties ps
set specialty_id = s.id
from public.specialties s
where ps.specialty_id is null
  and s.slug = public.specialty_slug(ps.specialty);

-- 6c. Every professional without join rows gets them from its own labels.
--     Licence only for registered professionals; scraped listings have none.
insert into public.professional_specialties
  (professional_id, specialty, specialty_id, license_number, is_approved)
select
  p.id,
  x.label,
  s.id,
  case when p.is_registered then nullif(btrim(p.license_number), '') end,
  coalesce(p.is_specialty_approved, true)
from public.professionals p
cross join lateral (
  select distinct on (public.specialty_slug(l)) btrim(l) as label
  from unnest(
    case when cardinality(p.specialties) > 0 then p.specialties else array[p.specialty] end
  ) as l
  where public.specialty_slug(l) is not null
    and public.specialty_slug(l) <> 'all'
  order by public.specialty_slug(l), btrim(l)
) x
left join public.specialties s on s.slug = public.specialty_slug(x.label)
where not exists (select 1 from public.professional_specialties ps where ps.professional_id = p.id)
on conflict (professional_id, specialty) do nothing;

select set_config('doccy.skip_specialty_sync', 'off', true);

-- ---------------------------------------------------------------------------
-- 7. Constraints that need the backfill done first.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.professional_specialties'::regclass and conname = 'professional_specialties_professional_id_specialty_id_key') then
    alter table public.professional_specialties
      add constraint professional_specialties_professional_id_specialty_id_key
      unique (professional_id, specialty_id);
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.professional_specialties'::regclass and conname = 'professional_specialties_approved_needs_specialty') then
    alter table public.professional_specialties
      add constraint professional_specialties_approved_needs_specialty
      check (specialty_id is not null or is_approved = false);
  end if;
end $$;

-- Only SELECT for signed-in users (the select-own policy); writes are service role.
revoke insert, update, delete, truncate, references, trigger
  on table public.professional_specialties from anon, authenticated;

comment on table public.professional_specialties is
  'Which specialties each professional has. One row per (professional, specialty); '
  'license_number is null for scraped listings. specialty_id is derived from the label.';

-- ---------------------------------------------------------------------------
-- 8. Compatibility view for the previous code, for one release.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'doctor_specialties' and c.relkind = 'r'
  ) then
    raise exception 'doctor_specialties is still a table; the rename above did not run';
  end if;
end $$;

create or replace view public.doctor_specialties with (security_invoker = true) as
select id, professional_id as doctor_id, specialty, license_number, is_approved, created_at
from public.professional_specialties;

comment on view public.doctor_specialties is
  'Deploy-window compatibility shim for professional_specialties. security_invoker, so the '
  'base table RLS still applies. Drop once every deployment reads the new name.';

-- Same grants as the base table after step 7; RLS still decides what each role sees.
revoke all on table public.doctor_specialties from anon, authenticated;
grant select on table public.doctor_specialties to anon, authenticated;
grant select, insert, update, delete on table public.doctor_specialties to service_role;

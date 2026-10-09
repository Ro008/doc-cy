-- Point E7 (part 1): rename doctor_services to professional_services.
--
--   doctor_services            -> professional_services
--   doctor_services.doctor_id  -> professional_id
--   policies doctor_services_* -> professional_services_*
--   doctor_services_doctor_id_idx   -> professional_services_professional_id_idx
--   doctor_services_pkey            -> professional_services_pkey
--   doctor_services_doctor_id_fkey  -> professional_services_professional_id_fkey
--
-- Policy expressions refer to the table and column by reference, so they follow the
-- rename on their own. No function or view names doctor_services (checked on Testing and
-- Production before writing this).
--
-- Deploy order: the running deployment still reads and writes doctor_services, so this
-- goes to Production BEFORE the code merges, and leaves a deploy-window view under the
-- old name (Point B pattern): doctor_id aliased back, security_invoker so the table's
-- rules still decide who reads and writes, anon read-only. The follow-up migration
-- *_drop_doctor_services_compat_view drops it once every deployment reads the new name.
--
-- Idempotent: every step is guarded; a re-run after the rename changes nothing.

do $$
begin
  -- 1. The table.
  if to_regclass('public.professional_services') is null then
    if (select relkind from pg_class where oid = to_regclass('public.doctor_services')) = 'r' then
      alter table public.doctor_services rename to professional_services;
    else
      raise exception 'Neither table public.professional_services nor public.doctor_services exists';
    end if;
  end if;

  -- 2. The owning column.
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'professional_services'
               and column_name = 'doctor_id') then
    alter table public.professional_services rename column doctor_id to professional_id;
  end if;

  -- 3. Constraints (renaming the primary key renames its index too) and the index.
  if exists (select 1 from pg_constraint where conrelid = 'public.professional_services'::regclass
             and conname = 'doctor_services_pkey') then
    alter table public.professional_services rename constraint doctor_services_pkey to professional_services_pkey;
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.professional_services'::regclass
             and conname = 'doctor_services_doctor_id_fkey') then
    alter table public.professional_services
      rename constraint doctor_services_doctor_id_fkey to professional_services_professional_id_fkey;
  end if;
  if to_regclass('public.doctor_services_doctor_id_idx') is not null then
    alter index public.doctor_services_doctor_id_idx rename to professional_services_professional_id_idx;
  end if;
end $$;

-- 4. Policies.
do $$
declare
  r record;
begin
  for r in
    select policyname as old_name,
           'professional_services_' || substr(policyname, length('doctor_services_') + 1) as new_name
    from pg_policies
    where schemaname = 'public' and tablename = 'professional_services'
      and policyname like 'doctor\_services\_%'
  loop
    execute format('alter policy %I on public.professional_services rename to %I', r.old_name, r.new_name);
  end loop;
end $$;

-- 5. Deploy-window view under the old name, for the previous deployment only.
do $$
begin
  if to_regclass('public.doctor_services') is null
     or (select relkind from pg_class where oid = to_regclass('public.doctor_services')) = 'v' then
    create or replace view public.doctor_services with (security_invoker = true) as
      select id, professional_id as doctor_id, name, price, created_at
      from public.professional_services;

    comment on view public.doctor_services is
      'Deploy-window compatibility view for professional_services (Point E7). security_invoker, '
      'so the table''s rules still apply. Dropped by *_drop_doctor_services_compat_view.';

    -- Read for everyone (public profiles), writes only for signed-in users (the settings
    -- service menu), where the table's rules decide.
    revoke all on public.doctor_services from anon, authenticated;
    grant select on public.doctor_services to anon;
    grant select, insert, update, delete on public.doctor_services to authenticated, service_role;
  end if;
end $$;

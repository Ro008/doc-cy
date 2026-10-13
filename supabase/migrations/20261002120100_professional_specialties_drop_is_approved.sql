-- professional_specialties.is_approved, step 2 of 2 (the drop): apply only after the
-- code that stopped reading and writing the column is merged AND deployed, and after
-- the previous migration (20261002120000) is in.
--
-- * Refuses to run if a row is not approved, or has no specialty_id: that would be
--   data this migration must not destroy or silently reinterpret.
-- * professional_specialties_approved_needs_specialty ("specialty_id is set, or the row
--   is unapproved") becomes simply NOT NULL on specialty_id: the resolve trigger always
--   sets it.
-- * Drops the column. Idempotent (a re-run finds nothing to do).

do $mig$
declare
  v_n bigint;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'professional_specialties' and column_name = 'is_approved'
  ) then
    execute 'select count(*) from public.professional_specialties where is_approved is not true' into v_n;
    if v_n > 0 then
      raise exception 'professional_specialties.is_approved: % row(s) are not approved; review them before dropping the column', v_n
        using errcode = '55000';
    end if;
  end if;

  select count(*) into v_n from public.professional_specialties where specialty_id is null;
  if v_n > 0 then
    raise exception 'professional_specialties: % row(s) have no specialty_id; fix them before dropping is_approved', v_n
      using errcode = '55000';
  end if;
end
$mig$;

alter table public.professional_specialties
  drop constraint if exists professional_specialties_approved_needs_specialty;

alter table public.professional_specialties
  alter column specialty_id set not null;

alter table public.professional_specialties
  drop column if exists is_approved;

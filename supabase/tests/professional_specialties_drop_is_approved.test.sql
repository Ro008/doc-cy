-- Database tests for dropping professional_specialties.is_approved
-- (migrations *_professional_specialties_prepare_drop_is_approved and
-- *_professional_specialties_drop_is_approved).
--
-- Run against TESTING only (Supabase SQL editor or the MCP execute_sql tool).
-- Everything runs in one transaction that ALWAYS rolls back: the final error message is
-- the result. "ALL ... PASSED" means success; any "FAIL: ..." names the broken rule.
--   * After step 1 only: "STEP 1 CHECKS PASSED (the column is still there)".
--   * After step 2: "ALL is_approved DROP TESTS PASSED".
-- To verify step 2 without keeping it, run the step 2 file's SQL first in the same
-- execute_sql call, then this file.

do $test$
declare
  v_checks int := 0;
  v_tag text := substr(md5(random()::text), 1, 8);
  v_has_column boolean;
  v_def text;
  v_pro uuid;
  v_label text := 'Dropcheck Therapy ' || v_tag;
  v_slug text;
  v_row public.professional_specialties%rowtype;
  v_n bigint;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'professional_specialties' and column_name = 'is_approved'
  ) into v_has_column;

  -- 1. The resolve function and its trigger no longer name the column.
  select prosrc into v_def from pg_proc
  where oid = 'public.professional_specialties_resolve_specialty()'::regprocedure;
  if v_def ilike '%is_approved%' then
    raise exception 'FAIL: professional_specialties_resolve_specialty still names is_approved';
  end if;
  select pg_get_triggerdef(oid) into v_def from pg_trigger
  where tgrelid = 'public.professional_specialties'::regclass
    and tgname = 'professional_specialties_resolve_specialty' and not tgisinternal;
  if v_def is null then
    raise exception 'FAIL: the professional_specialties_resolve_specialty trigger is missing';
  end if;
  if v_def ilike '%is_approved%' or v_def not ilike '%BEFORE INSERT OR UPDATE OF specialty, specialty_id%' then
    raise exception 'FAIL: the trigger should fire on INSERT or UPDATE OF specialty, specialty_id only, got %', v_def;
  end if;
  v_checks := v_checks + 3;

  -- 2. The approval function no longer writes the column.
  select prosrc into v_def from pg_proc
  where oid = 'public.request_apply_professional_registration(public.request_log, jsonb, jsonb)'::regprocedure;
  if v_def ilike '%is_approved%' then
    raise exception 'FAIL: request_apply_professional_registration still names is_approved';
  end if;
  v_checks := v_checks + 1;

  -- 3. A label the catalogue does not have yet joins it (what an approved custom
  --    specialty relies on), and the row gets its specialty_id.
  insert into public.professionals (name, slug, is_registered, is_test_profile)
  values ('Dropcheck Pro ' || v_tag, 'dropcheck-pro-' || v_tag, false, true)
  returning id into v_pro;
  v_slug := public.specialty_slug(v_label);
  if exists (select 1 from public.specialties where slug = v_slug) then
    raise exception 'FAIL: setup: the test label should not be in the catalogue yet';
  end if;
  insert into public.professional_specialties (professional_id, specialty, license_number)
  values (v_pro, v_label, 'DC-1')
  returning * into v_row;
  if v_row.specialty_id is null
     or not exists (select 1 from public.specialties s where s.id = v_row.specialty_id and s.slug = v_slug) then
    raise exception 'FAIL: a new label should join the catalogue and the row should point at it, got %', row_to_json(v_row);
  end if;
  v_checks := v_checks + 1;

  -- 4. A label already in the catalogue is reused, not duplicated.
  update public.professional_specialties set specialty = v_label || ' ' where id = v_row.id;
  select count(*) into v_n from public.specialties where slug = v_slug;
  if v_n <> 1 then
    raise exception 'FAIL: the catalogue should hold one % row, found %', v_slug, v_n;
  end if;
  v_checks := v_checks + 1;

  if v_has_column then
    raise exception 'STEP 1 CHECKS PASSED (% checks; the column is still there)', v_checks;
  end if;

  -- 5. Step 2: the column and its constraint are gone, specialty_id is NOT NULL.
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.professional_specialties'::regclass
      and conname = 'professional_specialties_approved_needs_specialty'
  ) then
    raise exception 'FAIL: professional_specialties_approved_needs_specialty should be dropped';
  end if;
  if (select is_nullable from information_schema.columns
      where table_schema = 'public' and table_name = 'professional_specialties' and column_name = 'specialty_id') <> 'NO' then
    raise exception 'FAIL: specialty_id should be NOT NULL';
  end if;
  v_checks := v_checks + 2;

  -- 6. A row without a catalogue id cannot be written around the trigger.
  begin
    insert into public.professional_specialties (professional_id, specialty, license_number)
    values (v_pro, '!!!', 'DC-2');
    raise exception 'FAIL: a label with no usable slug should be refused';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then
        raise;
      end if;
  end;
  v_checks := v_checks + 1;

  -- 7. Every existing row still points at a catalogue row.
  select count(*) into v_n from public.professional_specialties ps
  where not exists (select 1 from public.specialties s where s.id = ps.specialty_id);
  if v_n <> 0 then
    raise exception 'FAIL: % row(s) point at no catalogue specialty', v_n;
  end if;
  v_checks := v_checks + 1;

  raise exception 'ALL is_approved DROP TESTS PASSED (% checks)', v_checks;
end
$test$;

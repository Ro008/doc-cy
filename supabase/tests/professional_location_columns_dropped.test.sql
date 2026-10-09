-- Database test for Point E5 (migration *_drop_professional_location_columns).
--
-- Run against TESTING only (Supabase SQL editor or the MCP execute_sql tool).
-- Read-only: the final error message is the result. "ALL professional_location_columns
-- TESTS PASSED (…)" means success; any "FAIL: …" names the broken rule.

do $test$
declare
  v_checks int := 0;
  v_names text;
begin
  -- 1. The location copies on professionals are gone.
  select string_agg(column_name, ', ' order by column_name) into v_names
  from information_schema.columns
  where table_schema = 'public' and table_name = 'professionals'
    and column_name in ('district', 'town', 'phone', 'clinic_address', 'address',
                        'address_maps_link', 'latitude', 'longitude', 'clinic_place_id', 'clinic_id');
  if v_names is not null then
    raise exception 'FAIL: professionals still has %', v_names;
  end if;
  v_checks := v_checks + 1;

  -- 2. So are their indexes and the clinic_id foreign key.
  if exists (select 1 from pg_indexes where schemaname = 'public'
             and indexname in ('professionals_district_idx', 'professionals_town_idx', 'professionals_clinic_id_idx'))
     or exists (select 1 from pg_constraint where conname = 'professionals_clinic_id_fkey') then
    raise exception 'FAIL: a location index or professionals_clinic_id_fkey still exists';
  end if;
  v_checks := v_checks + 1;

  -- 3. The unused phone settings are gone with their check.
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'professional_settings'
               and column_name in ('show_phone_public', 'public_phone_source'))
     or exists (select 1 from pg_constraint where conname = 'professional_settings_public_phone_source_check') then
    raise exception 'FAIL: show_phone_public / public_phone_source (or its check) still exists';
  end if;
  v_checks := v_checks + 1;

  -- 4. What stays: the professional's own GeSY code and email, the clinic's location.
  select string_agg(c, ', ') into v_names
  from unnest(array['ghs_code', 'email', 'mobile_number']) c
  where not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'professionals' and column_name = c);
  if v_names is not null then
    raise exception 'FAIL: professionals lost %', v_names;
  end if;
  select string_agg(c, ', ') into v_names
  from unnest(array['district', 'town', 'address', 'phone', 'address_maps_link', 'latitude', 'longitude', 'clinic_place_id']) c
  where not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'clinics' and column_name = c);
  if v_names is not null then
    raise exception 'FAIL: clinics lost %', v_names;
  end if;
  v_checks := v_checks + 1;

  -- 5. No public function names a dropped phone setting.
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.prosrc ~ '\m(show_phone_public|public_phone_source)\M') then
    raise exception 'FAIL: a public function names a dropped phone setting';
  end if;
  v_checks := v_checks + 1;

  raise exception 'ALL professional_location_columns TESTS PASSED (% checks)', v_checks;
end
$test$;

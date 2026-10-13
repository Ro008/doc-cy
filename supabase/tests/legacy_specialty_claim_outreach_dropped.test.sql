-- Database tests for Point E3 (migration *_drop_legacy_specialty_claim_outreach).
--
-- Run against TESTING only (Supabase SQL editor or the MCP execute_sql tool).
-- Read-only, and it always ends in an error: the final message is the result.
-- "ALL legacy_specialty_claim_outreach_dropped TESTS PASSED (…)" means success; any "FAIL: …" names the broken rule.

do $test$
declare
  v_checks int := 0;
begin
  -- 1. Both tables are gone.
  if to_regclass('public.professional_specialty_change_requests') is not null then
    raise exception 'FAIL: professional_specialty_change_requests still exists';
  end if;
  if to_regclass('public.directory_manual_outreach_sent') is not null then
    raise exception 'FAIL: directory_manual_outreach_sent still exists';
  end if;
  v_checks := v_checks + 1;

  -- 2. The four columns on professionals are gone.
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'professionals'
               and column_name in ('license_file_url', 'specialty_requires_standard_at',
                                   'directory_claim_source', 'claim_listing_id')) then
    raise exception 'FAIL: a legacy column is still on professionals';
  end if;
  v_checks := v_checks + 1;

  -- 3. Their index and constraints are gone with them.
  if to_regclass('public.professionals_claim_listing_id_idx') is not null then
    raise exception 'FAIL: professionals_claim_listing_id_idx still exists';
  end if;
  if exists (select 1 from pg_constraint
             where conrelid = 'public.professionals'::regclass
               and conname in ('professionals_claim_listing_id_fkey',
                               'professionals_directory_claim_source_check')) then
    raise exception 'FAIL: a claim constraint is still on professionals';
  end if;
  v_checks := v_checks + 1;

  -- 4. Nothing in public still names any of them.
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public'
               and p.prosrc ~ '(specialty_change_request|license_file_url|specialty_requires_standard_at|directory_claim_source|claim_listing_id|directory_manual_outreach)') then
    raise exception 'FAIL: a public function still names a dropped object';
  end if;
  if exists (select 1 from pg_views where schemaname = 'public'
             and definition ~ '(specialty_change_request|license_file_url|specialty_requires_standard_at|directory_claim_source|claim_listing_id|directory_manual_outreach)') then
    raise exception 'FAIL: a public view still names a dropped object';
  end if;
  v_checks := v_checks + 1;

  -- 5. What stays: specialties and registered professionals. The empty licence
  --    bucket was deleted afterwards (2026-10-02): licence numbers only, no uploads.
  if to_regclass('public.professional_specialties') is null then
    raise exception 'FAIL: professional_specialties is missing';
  end if;
  if exists (select 1 from storage.buckets where id = 'doctor-verifications') then
    raise exception 'FAIL: the doctor-verifications bucket should be deleted';
  end if;
  v_checks := v_checks + 1;

  raise exception 'ALL legacy_specialty_claim_outreach_dropped TESTS PASSED (% checks)', v_checks;
end
$test$;

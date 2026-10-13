-- Database tests for Point E2 (migration *_drop_professionals_finder_visible_segment).
--
-- Run against TESTING only (Supabase SQL editor or the MCP execute_sql tool).
-- Read-only, and it always ends in an error: the final message is the result.
-- "ALL finder_visible_segment_dropped TESTS PASSED (…)" means success; any "FAIL: …" names the broken rule.

do $test$
declare
  v_checks int := 0;
  v_def text;
begin
  -- 1. Both columns are gone.
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'professionals'
               and column_name in ('finder_visible', 'segment')) then
    raise exception 'FAIL: professionals.finder_visible or professionals.segment still exists';
  end if;
  v_checks := v_checks + 1;

  -- 2. Their indexes are gone; the finder's state index is back without the column.
  if to_regclass('public.professionals_finder_visible_idx') is not null then
    raise exception 'FAIL: professionals_finder_visible_idx still exists';
  end if;
  select indexdef into v_def from pg_indexes
  where schemaname = 'public' and indexname = 'professionals_finder_state_idx';
  if v_def is null or v_def not like '%(is_archived, is_registered)' then
    raise exception 'FAIL: professionals_finder_state_idx should be (is_archived, is_registered), got %', v_def;
  end if;
  v_checks := v_checks + 1;

  -- 3. Nothing in public still names either column.
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and (p.prosrc ~ 'finder_visible' or p.prosrc ~ '\msegment\M')) then
    raise exception 'FAIL: a public function still mentions finder_visible or segment';
  end if;
  if exists (select 1 from pg_views where schemaname = 'public' and definition ~ '(finder_visible|\msegment\M)') then
    raise exception 'FAIL: a public view still mentions finder_visible or segment';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public'
             and (coalesce(qual, '') || coalesce(with_check, '')) ~ '(finder_visible|\msegment\M)') then
    raise exception 'FAIL: a policy still mentions finder_visible or segment';
  end if;
  v_checks := v_checks + 1;

  -- 4. The approval step still creates and claims profiles (its body is checked in
  --    request_approval.test.sql); here only that it exists and stays private.
  if to_regprocedure('public.request_apply_professional_registration(public.request_log, jsonb, jsonb)') is null then
    raise exception 'FAIL: request_apply_professional_registration is missing';
  end if;
  if has_function_privilege('anon', 'public.request_apply_professional_registration(public.request_log, jsonb, jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.request_apply_professional_registration(public.request_log, jsonb, jsonb)', 'execute') then
    raise exception 'FAIL: request_apply_professional_registration is callable by anon or authenticated';
  end if;
  v_checks := v_checks + 1;

  -- 5. The two clinics only Inpatient Services listings used are gone.
  if exists (select 1 from public.clinics where ghs_code in ('C2928', 'J1056')) then
    raise exception 'FAIL: an Inpatient Services-only clinic (C2928 / J1056) still exists';
  end if;
  v_checks := v_checks + 1;

  raise exception 'ALL finder_visible_segment_dropped TESTS PASSED (% checks)', v_checks;
end
$test$;

-- Database tests for Point E1 (migration *_drop_professional_monthly_digest_sent).
--
-- Run against TESTING only (Supabase SQL editor or the MCP execute_sql tool).
-- Read-only, and it always ends in an error: the final message is the result.
-- "ALL monthly_digest_removed TESTS PASSED (…)" means success; any "FAIL: …" names the broken rule.

do $test$
declare
  v_checks int := 0;
begin
  -- 1. The send log table is gone.
  if to_regclass('public.professional_monthly_digest_sent') is not null then
    raise exception 'FAIL: public.professional_monthly_digest_sent still exists';
  end if;
  v_checks := v_checks + 1;

  -- 2. Nothing in public still names it (functions, views, policies).
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.prosrc ilike '%monthly_digest%') then
    raise exception 'FAIL: a public function still mentions monthly_digest';
  end if;
  if exists (select 1 from pg_views where schemaname = 'public' and definition ilike '%monthly_digest%') then
    raise exception 'FAIL: a public view still mentions monthly_digest';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public'
             and (coalesce(qual, '') || coalesce(with_check, '')) ilike '%monthly_digest%') then
    raise exception 'FAIL: a policy still mentions monthly_digest';
  end if;
  v_checks := v_checks + 1;

  raise exception 'ALL monthly_digest_removed TESTS PASSED (% checks)', v_checks;
end
$test$;

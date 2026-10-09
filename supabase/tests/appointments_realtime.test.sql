-- Database tests for migration *_appointments_realtime (dashboard "new requests" bar, agenda live updates).
--
-- Run against TESTING only (Supabase SQL editor or the MCP execute_sql tool).
-- It always ends in an error, so nothing is kept: the final message is the result.
-- "ALL appointments_realtime TESTS PASSED (…)" means success; any "FAIL: …" names the broken rule.

do $test$
declare
  v_checks int := 0;
begin
  -- 1. Realtime publishes appointments changes.
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'appointments') then
    raise exception 'FAIL: public.appointments is not in the supabase_realtime publication';
  end if;
  v_checks := v_checks + 1;

  -- 2. Only that table was added, not every table.
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables) then
    raise exception 'FAIL: supabase_realtime must not publish all tables';
  end if;
  v_checks := v_checks + 1;

  -- 3. Realtime filters events through RLS: the table must keep it, with no anon read.
  if not (select relrowsecurity from pg_class where oid = 'public.appointments'::regclass) then
    raise exception 'FAIL: RLS must stay enabled on appointments';
  end if;
  if has_table_privilege('anon', 'public.appointments', 'select') then
    raise exception 'FAIL: anon must not read appointments';
  end if;
  v_checks := v_checks + 1;

  -- 4. Session clients still read only their own rows.
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'appointments'
             and (cmd <> 'SELECT' or roles <> array['authenticated']::name[])) then
    raise exception 'FAIL: appointments policies must stay SELECT for authenticated only';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'appointments'
                 and qual like '%is_professional_owner(professional_id)%') then
    raise exception 'FAIL: the own-rows SELECT policy is missing';
  end if;
  v_checks := v_checks + 1;

  raise exception 'ALL appointments_realtime TESTS PASSED (% checks)', v_checks;
end
$test$;

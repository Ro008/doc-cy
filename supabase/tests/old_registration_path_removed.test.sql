-- Database tests for the contract step after the registration redesign
-- (migration *_remove_old_registration_path).
--
-- Run against TESTING only (Supabase SQL editor or the MCP execute_sql tool).
-- Everything runs in one transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL old_registration_path TESTS PASSED (…)" means success;
-- any "FAIL: …" names the broken rule. Nothing is left behind.

do $test$
declare
  v_checks int := 0;
  v_def text;
  v_u uuid := gen_random_uuid();
  v_pro uuid;
  v_until timestamptz;
begin
  -- 1. The old sign-up RPC and the absorb function are gone.
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'register_professional_with_founder_lock') then
    raise exception 'FAIL: register_professional_with_founder_lock still exists';
  end if;
  v_checks := v_checks + 1;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'absorb_unregistered_into_registered') then
    raise exception 'FAIL: absorb_unregistered_into_registered still exists';
  end if;
  v_checks := v_checks + 1;

  -- 2. The transitional pro_access_until default (build PR 2) is gone: trigger and function.
  if exists (select 1 from pg_trigger where tgname = 'professionals_default_pro_access_until') then
    raise exception 'FAIL: trigger professionals_default_pro_access_until still exists';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'professionals_default_pro_access_until') then
    raise exception 'FAIL: function professionals_default_pro_access_until still exists';
  end if;
  v_checks := v_checks + 1;

  -- 3. has_online_booking is gone; pro_access_until is the entitlement.
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'professionals' and column_name = 'has_online_booking') then
    raise exception 'FAIL: professionals.has_online_booking still exists';
  end if;
  v_checks := v_checks + 1;

  -- 4. The finder's state index is back, without the dropped column (and, since
  --    Point E2, without finder_visible too).
  select indexdef into v_def from pg_indexes
  where schemaname = 'public' and indexname = 'professionals_finder_state_idx';
  if v_def is null or v_def not like '%(is_archived, is_registered)' then
    raise exception 'FAIL: professionals_finder_state_idx should be (is_archived, is_registered), got %', v_def;
  end if;
  v_checks := v_checks + 1;

  -- 5. Nothing in public still names the column.
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.prosrc ilike '%has_online_booking%') then
    raise exception 'FAIL: a public function still mentions has_online_booking';
  end if;
  v_checks := v_checks + 1;

  -- 6. A registered professional inserted directly no longer gets a default date.
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'old-path-' || v_u || '@integration.test', now(), now());
  insert into public.professionals (auth_user_id, name, slug, is_registered, status, is_test_profile)
  values (v_u, 'Old Path Check', 'old-path-check-' || v_u, true, 'verified', true)
  returning id into v_pro;
  select pro_access_until into v_until from public.professionals where id = v_pro;
  if v_until is not null then
    raise exception 'FAIL: no default pro_access_until any more, got %', v_until;
  end if;
  v_checks := v_checks + 1;

  -- 7. Since D4 the registration location trigger is gone (with doctor_locations); the
  --    professional still gets settings (doctor_locations_dropped.test.sql).
  if exists (select 1 from pg_trigger where tgname = 'professionals_create_primary_location') then
    raise exception 'FAIL: professionals_create_primary_location should be gone since D4';
  end if;
  if not exists (select 1 from public.professional_settings where professional_id = v_pro) then
    raise exception 'FAIL: a directly inserted registered professional should get settings';
  end if;
  v_checks := v_checks + 1;

  raise exception 'ALL old_registration_path TESTS PASSED (% checks)', v_checks;
end
$test$;

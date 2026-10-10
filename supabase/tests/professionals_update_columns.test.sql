-- Database tests for what a signed-in professional may change on her own row
-- (migrations *_professionals_update_columns and *_professionals_gesy_not_writable).
--
-- Found 2026-10-09: "authenticated" had UPDATE on every column of professionals, so
-- with the update policy (own row, emailed sign-in step) she could set her own
-- pro_access_until, subscription_tier, is_registered, slug or mobile_number straight
-- through /rest/v1, skipping every check and record. Now only the columns her
-- session-client routes write are open: bio, languages and the two "sign out other
-- sessions" columns. Everything else goes through the service role (is_gesy too, since
-- 2026-10-10: professional_gesy_set records each change).
--
-- Run against TESTING only (Supabase SQL editor or the MCP execute_sql tool).
-- Everything runs in one transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL professionals_update_columns TESTS PASSED (…)" means
-- success; any "FAIL: …" names the broken rule. Nothing is left behind.

do $test$
declare
  v_u uuid := gen_random_uuid();
  v_pro uuid;
  v_col text;
  v_rows int;
  v_checks int := 0;
begin
  ---------------------------------------------------------------- privileges
  foreach v_col in array array['bio', 'languages', 'auth_session_revoked_after', 'auth_keep_session_id'] loop
    assert has_column_privilege('authenticated', 'public.professionals', v_col, 'update'),
      format('FAIL: a signed-in professional can still change %s', v_col);
    v_checks := v_checks + 1;
  end loop;

  foreach v_col in array array[
    'is_gesy', 'mobile_number', 'pro_access_until', 'subscription_tier', 'is_registered', 'is_test_profile',
    'slug', 'name', 'email', 'registration_email', 'auth_user_id', 'avatar_url', 'ghs_code',
    'is_archived', 'trial_notice_seen_at', 'id', 'created_at'
  ] loop
    assert not has_column_privilege('authenticated', 'public.professionals', v_col, 'update'),
      format('FAIL: a signed-in professional cannot change %s directly', v_col);
    v_checks := v_checks + 1;
  end loop;

  assert not has_table_privilege('authenticated', 'public.professionals', 'insert')
    and not has_table_privilege('authenticated', 'public.professionals', 'delete')
    and not has_table_privilege('authenticated', 'public.professionals', 'truncate'),
    'FAIL: signed-in users cannot insert, delete or truncate professionals';
  assert has_table_privilege('authenticated', 'public.professionals', 'select'),
    'FAIL: signed-in users still read their own row (RLS)';
  assert not has_table_privilege('anon', 'public.professionals', 'update')
    and not has_table_privilege('anon', 'public.professionals', 'insert')
    and not has_table_privilege('anon', 'public.professionals', 'delete'),
    'FAIL: anon cannot write professionals';
  assert has_table_privilege('service_role', 'public.professionals', 'select,insert,update,delete'),
    'FAIL: the service role keeps full access';
  v_checks := v_checks + 4;

  ---------------------------------------------------------------- as the owner
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'cols-owner@integration.test', now(), now(), now());
  insert into public.professionals (name, slug, is_registered, auth_user_id, registration_email, mobile_number)
  values ('Cols Owner', 'cols-owner-test', true, v_u, 'cols-owner@integration.test', '+35799000201')
  returning id into v_pro;

  -- Her session, with the emailed sign-in step (the update policy needs it).
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_u, 'role', 'authenticated',
    'amr', json_build_array(json_build_object('method', 'otp', 'timestamp', extract(epoch from now())::bigint))
  )::text, true);
  set local role authenticated;

  update public.professionals set bio = 'Updated by her' where id = v_pro;
  get diagnostics v_rows = row_count;
  assert v_rows = 1, 'FAIL: she can still save her bio';
  v_checks := v_checks + 1;

  begin
    update public.professionals set mobile_number = '+35799000202' where id = v_pro;
    raise exception 'FAIL: she cannot change her mobile directly (use professional_mobile_set)';
  exception when insufficient_privilege then
    v_checks := v_checks + 1;
  end;

  begin
    update public.professionals set pro_access_until = now() + interval '10 years' where id = v_pro;
    raise exception 'FAIL: she cannot extend her own access';
  exception when insufficient_privilege then
    v_checks := v_checks + 1;
  end;

  begin
    update public.professionals set subscription_tier = 'pro' where id = v_pro;
    raise exception 'FAIL: she cannot change her own plan';
  exception when insufficient_privilege then
    v_checks := v_checks + 1;
  end;

  reset role;
  assert (select mobile_number from public.professionals where id = v_pro) = '+35799000201',
    'FAIL: her mobile is unchanged';
  v_checks := v_checks + 1;

  raise exception 'ALL professionals_update_columns TESTS PASSED (% checks); rolled back', v_checks;
end
$test$;

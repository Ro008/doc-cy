-- Database tests for changing the sign-in email from Settings
-- (migration *_professional_email_change).
--
-- Settings → Account → "Change email" (user, 2026-10-11): she asks for a new address,
-- a link goes to it, and nothing changes until that link is opened:
-- - one change waits at a time; asking again replaces the one waiting, and she can
--   cancel it;
-- - the link is kept as a hash, works once and expires;
-- - an address another account uses is refused, when asking and again when confirming;
-- - confirming moves professionals.registration_email (where booking requests are
--   sent) and records it in request_log, with no founder; the server changes the
--   sign-in address in Supabase Auth in the same step;
-- - confirming signs her out on every device, so she signs in again with the new
--   address (which also proves it receives mail).
--
-- Run against TESTING only. One transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL professional_email_change TESTS PASSED (…)" means
-- success; any "FAIL: …" names the broken rule.

create or replace function pg_temp.expect_error(p_sql text, p_state text, p_label text)
returns void
language plpgsql
as $f$
begin
  execute p_sql;
  raise exception 'FAIL: % (expected SQLSTATE %, but it succeeded)', p_label, p_state;
exception
  when others then
    if sqlerrm like 'FAIL:%' then
      raise;
    end if;
    if sqlstate <> p_state then
      raise exception 'FAIL: % (expected SQLSTATE %, got %: %)', p_label, p_state, sqlstate, sqlerrm;
    end if;
end
$f$;

create or replace function pg_temp.new_login(p_email text)
returns uuid
language plpgsql
as $f$
declare
  v_u uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          p_email, now(), now(), now());
  return v_u;
end
$f$;


do $test$
declare
  v_tag text := substr(md5(random()::text), 1, 8);
  v_checks int := 0;
  v_pro uuid;
  v_pro_login uuid;
  v_other uuid;
  v_listing uuid;
  v_old text;
  v_new text;
  v_taken text;
  v_h1 text := md5('h1' || random()::text) || md5('h1b' || random()::text);
  v_h2 text := md5('h2' || random()::text) || md5('h2b' || random()::text);
  v_h3 text := md5('h3' || random()::text) || md5('h3b' || random()::text);
  v_h4 text := md5('h4' || random()::text) || md5('h4b' || random()::text);
  v_id uuid;
  v_id2 uuid;
  v_out jsonb;
  v_row public.request_log%rowtype;
  v_fn text;
  v_priv text;
  v_other_login uuid;
begin
  ---------------------------------------------------------------- fixtures
  v_old := 'em-pro-' || v_tag || '@integration.test';
  v_new := 'em-new-' || v_tag || '@integration.test';
  v_taken := 'em-other-' || v_tag || '@integration.test';
  v_pro_login := pg_temp.new_login(v_old);
  insert into public.professionals (name, slug, is_registered, auth_user_id, registration_email)
  values ('Em Pro', 'em-pro-' || v_tag, true, v_pro_login, v_old)
  returning id into v_pro;
  v_other_login := pg_temp.new_login(v_taken);
  insert into public.professionals (name, slug, is_registered, auth_user_id, registration_email)
  values ('Em Other', 'em-other-' || v_tag, true, v_other_login, v_taken)
  returning id into v_other;
  -- Both are signed in, she on two devices.
  insert into auth.sessions (id, user_id, created_at, updated_at)
  values (gen_random_uuid(), v_pro_login, now(), now()),
         (gen_random_uuid(), v_pro_login, now(), now()),
         (gen_random_uuid(), v_other_login, now(), now());
  update public.professionals set auth_keep_session_id = gen_random_uuid() where id = v_pro;
  insert into public.professionals (name, slug, is_registered)
  values ('Em Listing', 'em-listing-' || v_tag, false)
  returning id into v_listing;

  ---------------------------------------------------------------- type
  assert (select not requires_approval and is_edit from public.request_types
          where name = 'professional_email_change'),
    'FAIL: an email change needs no founder and is recorded at once';
  v_checks := v_checks + 1;

  ---------------------------------------------------------------- asking
  v_id := public.professional_email_change_start(v_pro, '  ' || upper(v_new) || ' ', v_h1);
  assert (select new_email = v_new and token_hash = v_h1 and confirmed_at is null and cancelled_at is null
            and expires_at > now() + interval '55 minutes' and expires_at <= now() + interval '60 minutes'
          from public.professional_email_changes where id = v_id and professional_id = v_pro),
    'FAIL: asking keeps the new address (trimmed, lower case), the hash, and an hour to confirm';
  assert (select registration_email = v_old from public.professionals where id = v_pro),
    'FAIL: nothing changes until the link is opened';
  assert not exists (select 1 from public.request_log
                     where professional_id = v_pro and request_type = 'professional_email_change'),
    'FAIL: asking alone records nothing';
  v_checks := v_checks + 3;

  -- Asking again replaces the one waiting: the first link stops working.
  v_id2 := public.professional_email_change_start(v_pro, v_new, v_h2, 30);
  assert (select cancelled_at is not null from public.professional_email_changes where id = v_id),
    'FAIL: asking again cancels the change that was waiting';
  assert (select count(*) from public.professional_email_changes
          where professional_id = v_pro and confirmed_at is null and cancelled_at is null) = 1,
    'FAIL: one change waits at a time';
  assert (select expires_at <= now() + interval '30 minutes' from public.professional_email_changes where id = v_id2),
    'FAIL: the time to confirm can be set';
  perform pg_temp.expect_error(
    format('select public.professional_email_change_confirm(%L)', v_h1), 'P0002',
    'a replaced link no longer works');
  v_checks := v_checks + 4;

  -- What is refused when asking.
  perform pg_temp.expect_error(
    format('select public.professional_email_change_start(%L, %L, %L)', v_pro, 'not-an-email', v_h3), '22023',
    'the new address must look like one');
  perform pg_temp.expect_error(
    format('select public.professional_email_change_start(%L, %L, %L)', v_pro, upper(v_old), v_h3), '22023',
    'the new address must differ from the current one');
  perform pg_temp.expect_error(
    format('select public.professional_email_change_start(%L, %L, %L)', v_pro, upper(v_taken), v_h3), '23505',
    'an address another account uses is refused');
  perform pg_temp.expect_error(
    format('select public.professional_email_change_start(%L, %L, %L)', v_pro, v_new, 'short'), '22023',
    'the link is kept as a SHA-256 hash');
  perform pg_temp.expect_error(
    format('select public.professional_email_change_start(%L, %L, %L, 2)', v_pro, v_new, v_h3), '22023',
    'the time to confirm is between 5 minutes and a day');
  perform pg_temp.expect_error(
    format('select public.professional_email_change_start(%L, %L, %L)', v_listing, v_new, v_h3), '22023',
    'a listing that never signed up has no email to change');
  perform pg_temp.expect_error(
    format('select public.professional_email_change_start(%L, %L, %L)', gen_random_uuid(), v_new, v_h3), 'P0002',
    'an unknown professional is refused');
  assert (select count(*) from public.professional_email_changes
          where professional_id = v_pro and confirmed_at is null and cancelled_at is null) = 1,
    'FAIL: a refused ask leaves the waiting change alone';
  v_checks := v_checks + 8;

  ---------------------------------------------------------------- cancelling
  assert public.professional_email_change_cancel(v_pro),
    'FAIL: cancelling answers true when a change was waiting';
  assert not public.professional_email_change_cancel(v_pro),
    'FAIL: cancelling answers false when nothing waits';
  perform pg_temp.expect_error(
    format('select public.professional_email_change_confirm(%L)', v_h2), 'P0002',
    'a cancelled link no longer works');
  v_checks := v_checks + 3;

  ---------------------------------------------------------------- expiry
  v_id := public.professional_email_change_start(v_pro, v_new, v_h3);
  update public.professional_email_changes set expires_at = now() - interval '1 second' where id = v_id;
  perform pg_temp.expect_error(
    format('select public.professional_email_change_confirm(%L)', v_h3), 'P0002',
    'an expired link no longer works');
  assert (select registration_email = v_old from public.professionals where id = v_pro),
    'FAIL: an expired link changes nothing';
  v_checks := v_checks + 2;

  ---------------------------------------------------------------- confirming
  perform pg_temp.expect_error(
    format('select public.professional_email_change_confirm(%L)', md5('x') || md5('y')), 'P0002',
    'an unknown link is refused');
  v_checks := v_checks + 1;

  -- The address was free when she asked, and taken by the time she confirms.
  v_id := public.professional_email_change_start(v_pro, v_new, v_h4);
  update public.professionals set registration_email = v_new where id = v_other;
  perform pg_temp.expect_error(
    format('select public.professional_email_change_confirm(%L)', v_h4), '23505',
    'confirming checks again that no other account uses the address');
  assert (select confirmed_at is null from public.professional_email_changes where id = v_id),
    'FAIL: a refused confirmation leaves the change waiting';
  assert (select count(*) from auth.sessions where user_id = v_pro_login) = 2,
    'FAIL: a refused confirmation signs nobody out';
  update public.professionals set registration_email = v_taken where id = v_other;
  v_checks := v_checks + 3;

  -- The server has already moved her sign-in address in Supabase Auth.
  update auth.users set email = v_new where id = v_pro_login;
  v_out := public.professional_email_change_confirm(v_h4);
  assert v_out - 'request_id' = jsonb_build_object(
      'professional_id', v_pro, 'auth_user_id', v_pro_login, 'old_email', v_old, 'new_email', v_new),
    'FAIL: confirming answers with who she is and both addresses';
  assert (select registration_email = v_new from public.professionals where id = v_pro),
    'FAIL: booking requests now go to the new address';
  assert (select confirmed_at is not null from public.professional_email_changes where id = v_id),
    'FAIL: the change is marked confirmed';
  select * into v_row from public.request_log where id = (v_out ->> 'request_id')::uuid;
  assert v_row.request_type = 'professional_email_change' and v_row.status = 'recorded'
    and v_row.professional_id = v_pro
    and v_row.details = jsonb_build_object('registration_email', v_new)
    and v_row.before_snapshot = jsonb_build_object('registration_email', v_old)
    and v_row.requester_email = v_old,
    'FAIL: the change is recorded at once with the new address and the one before';
  -- She is signed out on every device, and signs in again with the new address.
  assert not exists (select 1 from auth.sessions where user_id = v_pro_login),
    'FAIL: confirming ends every session she had';
  assert (select auth_session_revoked_after > now() - interval '1 minute' and auth_keep_session_id is null
          from public.professionals where id = v_pro),
    'FAIL: confirming revokes the tokens already issued, keeping no device';
  assert (select count(*) from auth.sessions where user_id = v_other_login) = 1
    and (select auth_session_revoked_after is null from public.professionals where id = v_other),
    'FAIL: nobody else is signed out';
  perform pg_temp.expect_error(
    format('select public.professional_email_change_confirm(%L)', v_h4), 'P0002',
    'a link works once');
  assert (select count(*) from public.request_log
          where professional_id = v_pro and request_type = 'professional_email_change') = 1,
    'FAIL: one change, one record';
  v_checks := v_checks + 9;

  ---------------------------------------------------------------- access
  foreach v_fn in array array[
    'public.professional_email_change_start(uuid, text, text, integer)',
    'public.professional_email_change_cancel(uuid)',
    'public.professional_email_change_confirm(text)',
    'public.professional_email_in_use(text, uuid)',
    'public.professional_sessions_end(uuid)'
  ] loop
    assert not has_function_privilege('anon', v_fn, 'execute')
      and not has_function_privilege('authenticated', v_fn, 'execute')
      and has_function_privilege('service_role', v_fn, 'execute'),
      format('FAIL: only the service role calls %s', v_fn);
    v_checks := v_checks + 1;
  end loop;
  foreach v_priv in array array['select', 'insert', 'update', 'delete', 'truncate'] loop
    assert not has_table_privilege('anon', 'public.professional_email_changes', v_priv)
      and not has_table_privilege('authenticated', 'public.professional_email_changes', v_priv),
      format('FAIL: a session cannot %s waiting email changes', v_priv);
    v_checks := v_checks + 1;
  end loop;
  assert (select relrowsecurity from pg_class where oid = 'public.professional_email_changes'::regclass),
    'FAIL: row security is on for waiting email changes';
  v_checks := v_checks + 1;

  raise exception 'ALL professional_email_change TESTS PASSED (% checks); rolled back', v_checks;
end
$test$;

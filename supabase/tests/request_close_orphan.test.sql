-- Database tests for closing a pending registration request whose applicant login is
-- gone (the Requests tab's "Can't be approved" group). No migration: it relies on
-- request_reject, request_approve and founders_club_places_taken as they are.
--
-- Run against TESTING only (Supabase SQL editor or the MCP execute_sql tool).
-- Everything runs in one transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL request_close_orphan TESTS PASSED (…)" means success;
-- any "FAIL: …" names the broken rule. Nothing is left behind.

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
  v_checks int := 0;
  v_tag text := substr(md5(random()::text), 1, 8);
  v_email text := 'close-orphan-' || v_tag || '@example.org';
  v_login uuid := gen_random_uuid();
  v_founder uuid;
  v_partner uuid;
  v_req uuid;
  v_row public.request_log%rowtype;
  v_taken_before int;
begin
  v_taken_before := public.founders_club_places_taken();
  if v_taken_before >= 49 then
    raise exception 'FAIL: setup needs a free Founders'' Club place on Testing, % taken', v_taken_before;
  end if;

  -- Setup: a founder, a partner, and a real applicant holding a place.
  insert into public.admin_users (auth_user_id, name, email, role)
  values (pg_temp.new_login('close-founder-' || v_tag || '@integration.test'), 'Close Founder',
          'close-founder-' || v_tag || '@integration.test', 'founder')
  returning id into v_founder;
  insert into public.admin_users (auth_user_id, name, email, role)
  values (pg_temp.new_login('close-partner-' || v_tag || '@integration.test'), 'Close Partner',
          'close-partner-' || v_tag || '@integration.test', 'partner')
  returning id into v_partner;

  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (v_login, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          v_email, now(), now(), now());
  perform public.request_draft_submit(
    'professional_registration', v_login,
    jsonb_build_object('first_name', 'Close', 'last_name', 'Orphan', 'email', v_email),
    1::smallint, 'Close Orphan', v_email
  );
  select request_id into v_req from public.request_draft_confirm(v_login);
  if public.founders_club_places_taken() <> v_taken_before + 1 then
    raise exception 'FAIL: setup: the pending request should hold a place';
  end if;

  -- 1. The login is deleted: the request stays, pending, and keeps its place.
  delete from auth.users where id = v_login;
  select * into v_row from public.request_log where id = v_req;
  if v_row.status <> 'pending' or v_row.applicant_auth_user_id is not null then
    raise exception 'FAIL: deleting the login should leave a pending request with no applicant, got %', row_to_json(v_row);
  end if;
  if public.founders_club_places_taken() <> v_taken_before + 1 then
    raise exception 'FAIL: an orphan pending request keeps holding its Founders'' Club place';
  end if;
  v_checks := v_checks + 2;

  -- 2. It can never be approved.
  perform pg_temp.expect_error(
    format($$select public.request_approve(%L::uuid, %L::uuid, null, null, '{"slug":"x"}'::jsonb)$$, v_req, v_founder),
    'P0002', 'an orphan request cannot be approved');
  select * into v_row from public.request_log where id = v_req;
  if v_row.status <> 'pending' then
    raise exception 'FAIL: a refused approval must leave the request pending';
  end if;
  v_checks := v_checks + 2;

  -- 3. Closing needs a founder and a reason.
  perform pg_temp.expect_error(
    format($$select public.request_reject(%L::uuid, %L::uuid, 'Applicant gone')$$, v_req, v_partner),
    '42501', 'a partner cannot close it');
  perform pg_temp.expect_error(
    format($$select public.request_reject(%L::uuid, %L::uuid, '  ')$$, v_req, v_founder),
    '22023', 'closing needs a reason');
  v_checks := v_checks + 2;

  -- 4. A founder closes it: rejected with the note, decided by them, place released, row kept.
  perform public.request_reject(v_req, v_founder, 'Applicant''s account was deleted');
  select * into v_row from public.request_log where id = v_req;
  if v_row.status <> 'rejected'
     or v_row.decided_by is distinct from v_founder
     or v_row.decided_at is null
     or v_row.decision_note <> 'Applicant''s account was deleted'
     or v_row.applicant_auth_user_id is not null then
    raise exception 'FAIL: closing should record a rejection by the founder with the note, got %', row_to_json(v_row);
  end if;
  if public.founders_club_places_taken() <> v_taken_before then
    raise exception 'FAIL: closing should release the Founders'' Club place (% before, % now)',
      v_taken_before, public.founders_club_places_taken();
  end if;
  v_checks := v_checks + 2;

  -- 5. Once closed it never changes.
  perform pg_temp.expect_error(
    format($$select public.request_reject(%L::uuid, %L::uuid, 'again')$$, v_req, v_founder),
    '55000', 'a closed request cannot be closed again');
  v_checks := v_checks + 1;

  raise exception 'ALL request_close_orphan TESTS PASSED (% checks)', v_checks;
end
$test$;

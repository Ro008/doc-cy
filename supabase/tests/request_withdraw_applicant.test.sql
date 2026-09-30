-- Database tests for an applicant withdrawing their own pending registration
-- (migration *_request_withdraw_as_applicant).
--
-- Run against TESTING only (Supabase SQL editor or the MCP execute_sql tool).
-- Everything runs in one transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL request_withdraw_as_applicant TESTS PASSED (…)"
-- means success; any "FAIL: …" names the broken rule. Nothing is left behind.

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

-- A confirmed login with a pending registration request; returns the request id.
create or replace function pg_temp.pending_registration(p_email text)
returns uuid
language plpgsql
as $f$
declare
  v_u uuid := gen_random_uuid();
  v_req uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          p_email, now(), now(), now());
  perform public.request_draft_submit(
    'professional_registration', v_u,
    jsonb_build_object('first_name', 'Withdraw', 'last_name', 'Test', 'email', p_email),
    1::smallint, 'Withdraw Test', p_email
  );
  select request_id into v_req from public.request_draft_confirm(v_u);
  return v_req;
end
$f$;

do $test$
declare
  v_checks int := 0;
  v_tag text := substr(md5(random()::text), 1, 8);
  v_email text := 'withdraw-real-' || v_tag || '@example.org';
  v_req uuid;
  v_other_req uuid;
  v_login uuid;
  v_other_login uuid;
  v_row public.request_log%rowtype;
  v_taken_before int;
  v_pro uuid;
  v_pro_req uuid;
  v_returned uuid;
begin
  v_taken_before := public.founders_club_places_taken();
  if v_taken_before >= 49 then
    raise exception 'FAIL: setup needs a free Founders'' Club place on Testing, % taken', v_taken_before;
  end if;

  -- 1. Service role only.
  if to_regprocedure('public.request_withdraw_as_applicant(uuid, uuid)') is null then
    raise exception 'FAIL: public.request_withdraw_as_applicant(uuid, uuid) does not exist';
  end if;
  if has_function_privilege('anon', 'public.request_withdraw_as_applicant(uuid, uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.request_withdraw_as_applicant(uuid, uuid)', 'EXECUTE') then
    raise exception 'FAIL: anon/authenticated must not call request_withdraw_as_applicant';
  end if;
  if not has_function_privilege('service_role', 'public.request_withdraw_as_applicant(uuid, uuid)', 'EXECUTE') then
    raise exception 'FAIL: service_role must be able to call request_withdraw_as_applicant';
  end if;
  v_checks := v_checks + 3;

  -- Setup: a real applicant (takes a place) and a second applicant.
  v_req := pg_temp.pending_registration(v_email);
  v_other_req := pg_temp.pending_registration('withdraw-other-' || v_tag || '@integration.test');
  select applicant_auth_user_id into v_login from public.request_log where id = v_req;
  select applicant_auth_user_id into v_other_login from public.request_log where id = v_other_req;
  if public.founders_club_places_taken() <> v_taken_before + 1 then
    raise exception 'FAIL: setup: the real applicant''s pending request should hold a place';
  end if;

  -- 2. Refusals.
  perform pg_temp.expect_error(
    format($$select public.request_withdraw_as_applicant(%L::uuid, %L::uuid)$$, v_req, v_other_login),
    '42501', 'another applicant cannot withdraw it');
  perform pg_temp.expect_error(
    format($$select public.request_withdraw_as_applicant(%L::uuid, null)$$, v_req),
    '42501', 'no login cannot withdraw it');
  perform pg_temp.expect_error(
    format($$select public.request_withdraw_as_applicant(%L::uuid, %L::uuid)$$, gen_random_uuid(), v_login),
    'P0002', 'unknown request');
  select * into v_row from public.request_log where id = v_req;
  if v_row.status <> 'pending' then
    raise exception 'FAIL: a refused withdrawal must leave the request pending';
  end if;
  v_checks := v_checks + 4;

  -- 3. The applicant withdraws: closed without an admin, place released.
  v_returned := public.request_withdraw_as_applicant(v_req, v_login);
  select * into v_row from public.request_log where id = v_req;
  if v_returned is distinct from v_req
     or v_row.status <> 'withdrawn'
     or v_row.decided_at is null
     or v_row.decided_by is not null
     or v_row.decision_note is not null then
    raise exception 'FAIL: the withdrawal should close the request as withdrawn, got %', row_to_json(v_row);
  end if;
  if public.founders_club_places_taken() <> v_taken_before then
    raise exception 'FAIL: withdrawing should release the Founders'' Club place (% before, % now)',
      v_taken_before, public.founders_club_places_taken();
  end if;
  if (select status from public.request_log where id = v_other_req) <> 'pending' then
    raise exception 'FAIL: another applicant''s request must be untouched';
  end if;
  v_checks := v_checks + 3;

  -- 4. Once withdrawn it never changes.
  perform pg_temp.expect_error(
    format($$select public.request_withdraw_as_applicant(%L::uuid, %L::uuid)$$, v_req, v_login),
    '55000', 'a withdrawn request cannot be withdrawn again');
  v_checks := v_checks + 1;

  -- 5. The same login can apply again.
  perform public.request_draft_submit(
    'professional_registration', v_login,
    jsonb_build_object('first_name', 'Again', 'last_name', 'Test', 'email', v_email),
    1::smallint, 'Again Test', v_email
  );
  if not exists (select 1 from public.request_drafts where auth_user_id = v_login) then
    raise exception 'FAIL: after withdrawing, the applicant should be able to apply again';
  end if;
  v_checks := v_checks + 1;

  -- 6. A request made by a professional (no applicant login) can't be withdrawn this way.
  insert into public.professionals (name, slug, is_registered, is_test_profile)
  values ('Withdraw Pro ' || v_tag, 'withdraw-pro-' || v_tag, false, true)
  returning id into v_pro;
  v_pro_req := public.request_submit('professional_registration', v_pro, '{"pro": true}'::jsonb, 1::smallint);
  perform pg_temp.expect_error(
    format($$select public.request_withdraw_as_applicant(%L::uuid, %L::uuid)$$, v_pro_req, v_login),
    '42501', 'a professional''s request is not the applicant''s');
  v_checks := v_checks + 1;

  raise exception 'ALL request_withdraw_as_applicant TESTS PASSED (% checks)', v_checks;
end
$test$;

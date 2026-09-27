-- Database tests for the registration submit path
-- (migration *_request_drafts_and_registration_submit).
--
-- Run against TESTING only (Supabase SQL editor or the MCP execute_sql tool).
-- Everything runs in one transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL request_drafts TESTS PASSED (…)" means success; any
-- "FAIL: …" names the broken rule. Nothing is left behind.

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

-- A login. p_email decides whether it counts as a test registration.
create or replace function pg_temp.new_login(p_email text, p_confirmed boolean default false)
returns uuid
language plpgsql
as $f$
declare
  v_u uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          p_email, case when p_confirmed then now() end, now(), now());
  return v_u;
end
$f$;

create or replace function pg_temp.draft(p_login uuid, p_name text, p_email text)
returns boolean
language sql
as $f$
  select founders_club
  from public.request_draft_submit(
    'professional_registration', p_login,
    jsonb_build_object('first_name', 'Draft', 'last_name', p_name, 'email', p_email),
    1::smallint, 'Draft ' || p_name, p_email
  );
$f$;

do $test$
declare
  v_checks int := 0;
  v_tag text := substr(md5(random()::text), 1, 8);
  v_real_email text;
  v_test_email text;
  v_real uuid;
  v_test uuid;
  v_other uuid;
  v_founders boolean;
  v_taken int;
  v_taken_before int;
  v_draft public.request_drafts%rowtype;
  v_req public.request_log%rowtype;
  v_req_id uuid;
  v_again uuid;
  v_created boolean;
  v_admin_login uuid;
  v_admin uuid;
  v_n int;
  v_i int;
  v_bucket record;
begin
  -- The cap test below fills the Founders' Club; start from a known count.
  v_taken_before := public.founders_club_places_taken();
  if v_taken_before >= 49 then
    raise exception 'FAIL: setup needs at least 2 free Founders'' Club places on Testing, % taken', v_taken_before;
  end if;

  -- 1. Service role only.
  if not (select relrowsecurity from pg_class where oid = 'public.request_drafts'::regclass) then
    raise exception 'FAIL: request_drafts must have RLS enabled';
  end if;
  if has_table_privilege('anon', 'public.request_drafts', 'SELECT')
     or has_table_privilege('authenticated', 'public.request_drafts', 'SELECT')
     or has_table_privilege('anon', 'public.request_drafts', 'INSERT')
     or has_table_privilege('authenticated', 'public.request_drafts', 'DELETE') then
    raise exception 'FAIL: anon/authenticated must have no privileges on request_drafts';
  end if;
  if has_function_privilege('anon', 'public.request_draft_submit(text, uuid, jsonb, smallint, text, text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.request_draft_submit(text, uuid, jsonb, smallint, text, text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.request_draft_confirm(uuid, text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.request_draft_confirm(uuid, text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.request_drafts_expired(interval)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.request_drafts_expired(interval)', 'EXECUTE')
     or has_function_privilege('anon', 'public.founders_club_places_taken()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.founders_club_places_taken()', 'EXECUTE') then
    raise exception 'FAIL: the draft functions must not be callable by anon/authenticated';
  end if;
  if not has_function_privilege('service_role', 'public.request_draft_submit(text, uuid, jsonb, smallint, text, text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.request_draft_confirm(uuid, text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.request_drafts_expired(interval)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.founders_club_places_taken()', 'EXECUTE') then
    raise exception 'FAIL: service_role must be able to call the draft functions';
  end if;
  v_checks := v_checks + 4;

  -- 2. Registration photos wait in a private bucket until approval.
  select id, public into v_bucket from storage.buckets where id = 'request-uploads';
  if v_bucket.id is null or v_bucket.public then
    raise exception 'FAIL: bucket request-uploads must exist and be private';
  end if;
  v_checks := v_checks + 1;

  -- 3. A real applicant's draft takes a Founders' Club place and stores the form.
  v_real_email := 'draft-real-' || v_tag || '@example.org';
  v_real := pg_temp.new_login(v_real_email);
  v_founders := pg_temp.draft(v_real, 'Real ' || v_tag, v_real_email);
  if v_founders is distinct from true then
    raise exception 'FAIL: a real applicant with places left should get a Founders'' Club place';
  end if;
  select * into v_draft from public.request_drafts where auth_user_id = v_real;
  if v_draft.id is null
     or v_draft.request_type <> 'professional_registration'
     or v_draft.details ->> 'last_name' <> 'Real ' || v_tag
     or (v_draft.details -> 'founders_club') is distinct from 'true'::jsonb
     or v_draft.requester_name <> 'Draft Real ' || v_tag
     or v_draft.requester_email <> v_real_email then
    raise exception 'FAIL: the draft should hold the form, requester and founders_club = true, got %', row_to_json(v_draft);
  end if;
  if public.founders_club_places_taken() <> v_taken_before + 1 then
    raise exception 'FAIL: a reserved draft should take a place (% before, % now)',
      v_taken_before, public.founders_club_places_taken();
  end if;
  v_checks := v_checks + 3;

  -- 4. A test registration never takes a place.
  v_test_email := 'draft-test-' || v_tag || '@integration.test';
  v_test := pg_temp.new_login(v_test_email);
  if pg_temp.draft(v_test, 'Test ' || v_tag, v_test_email) is distinct from false then
    raise exception 'FAIL: a test registration must not get a Founders'' Club place';
  end if;
  if public.founders_club_places_taken() <> v_taken_before + 1 then
    raise exception 'FAIL: a test draft must not change the places taken';
  end if;
  v_checks := v_checks + 2;

  -- 5. Bad input is refused.
  perform pg_temp.expect_error(
    format($$select pg_temp.draft(%L, 'Twice', %L)$$, v_real, v_real_email), '23505', 'second draft for one login');
  perform pg_temp.expect_error(
    format($$select * from public.request_draft_submit('no_such_type', %L, '{}'::jsonb, 1::smallint, 'N', 'n@example.org')$$,
      pg_temp.new_login('draft-x-' || v_tag || '@example.org')), '22023', 'unknown type');
  perform pg_temp.expect_error(
    format($$select * from public.request_draft_submit('professional_registration', %L, '[]'::jsonb, 1::smallint, 'N', 'n@example.org')$$,
      pg_temp.new_login('draft-y-' || v_tag || '@example.org')), '22023', 'details not an object');
  perform pg_temp.expect_error(
    format($$select * from public.request_draft_submit('professional_registration', %L, '{}'::jsonb, 1::smallint, '  ', 'n@example.org')$$,
      pg_temp.new_login('draft-z-' || v_tag || '@example.org')), '22023', 'blank requester name');
  perform pg_temp.expect_error(
    format($$select * from public.request_draft_submit('professional_registration', %L, '{}'::jsonb, 1::smallint, 'N', 'n@example.org')$$,
      gen_random_uuid()), 'P0002', 'unknown login');
  -- A login that already belongs to a professional can't register again.
  v_other := pg_temp.new_login('draft-pro-' || v_tag || '@integration.test');
  insert into public.professionals (auth_user_id, name, slug, is_registered, has_online_booking, status, is_test_profile)
  values (v_other, 'Draft Pro ' || v_tag, 'draft-pro-' || v_tag, true, false, 'verified', true);
  perform pg_temp.expect_error(
    format($$select pg_temp.draft(%L, 'Pro', 'draft-pro@integration.test')$$, v_other), '23505', 'login with a professional');
  v_checks := v_checks + 6;

  -- 6. Confirming needs a confirmed email.
  perform pg_temp.expect_error(
    format($$select * from public.request_draft_confirm(%L)$$, v_real), '55000', 'confirm before the email is confirmed');
  v_checks := v_checks + 1;

  -- 7. Confirmed: the draft becomes a pending request linked to the login, and the draft goes.
  update auth.users set email_confirmed_at = now() where id = v_real;
  select request_id, created into v_req_id, v_created from public.request_draft_confirm(v_real);
  if v_created is distinct from true then
    raise exception 'FAIL: the first confirm should report created = true';
  end if;
  select * into v_req from public.request_log where id = v_req_id;
  if v_req.id is null
     or v_req.status <> 'pending'
     or v_req.request_type <> 'professional_registration'
     or v_req.applicant_auth_user_id is distinct from v_real
     or v_req.professional_id is not null
     or v_req.details is distinct from v_draft.details
     or v_req.details_version <> 1
     or v_req.requester_name <> 'Draft Real ' || v_tag
     or v_req.requester_email <> v_real_email then
    raise exception 'FAIL: the confirmed draft should become a pending request, got %', row_to_json(v_req);
  end if;
  if exists (select 1 from public.request_drafts where auth_user_id = v_real) then
    raise exception 'FAIL: the draft should be gone after confirming';
  end if;
  v_checks := v_checks + 2;

  -- 8. Confirming again (a second click on the link) returns the same request.
  -- (created = false, so the app doesn't email the founders twice).
  select request_id, created into v_again, v_created from public.request_draft_confirm(v_real);
  if v_again is distinct from v_req_id or v_created is distinct from false then
    raise exception 'FAIL: confirming twice should return the same request, not created (%, %, %)',
      v_req_id, v_again, v_created;
  end if;
  -- A confirmed login with no draft and no request gives no row.
  if exists (select 1 from public.request_draft_confirm(pg_temp.new_login('draft-none-' || v_tag || '@example.org', true))) then
    raise exception 'FAIL: a login without a draft should confirm to no row';
  end if;
  v_checks := v_checks + 2;

  -- 9. The pending request keeps the place; a new draft for the same login is refused.
  if public.founders_club_places_taken() <> v_taken_before + 1 then
    raise exception 'FAIL: a pending request should keep its place';
  end if;
  perform pg_temp.expect_error(
    format($$select pg_temp.draft(%L, 'Again', %L)$$, v_real, v_real_email), '23505', 'draft while a request is pending');
  v_checks := v_checks + 2;

  -- 10. request_log rules for applicants.
  perform pg_temp.expect_error(
    $$insert into public.request_log (request_type, status, details, details_version)
      values ('professional_registration', 'pending', '{}'::jsonb, 1)$$,
    '23514', 'request with neither professional nor applicant');
  perform pg_temp.expect_error(
    format($$update public.request_log set applicant_auth_user_id = %L where id = %L$$,
      v_test, v_req_id), '55000', 'changing the applicant of a pending request');
  perform pg_temp.expect_error(
    format($$insert into public.request_log (request_type, status, details, details_version, applicant_auth_user_id)
      values ('professional_registration', 'pending', '{}'::jsonb, 1, %L)$$, v_real),
    '23505', 'second pending registration for one applicant');
  v_checks := v_checks + 3;

  -- 11. Rejecting releases the place.
  v_admin_login := pg_temp.new_login('draft-admin-' || v_tag || '@integration.test');
  insert into public.admin_users (auth_user_id, name, email, role)
  values (v_admin_login, 'Draft Admin', 'draft-admin-' || v_tag || '@integration.test', 'founder')
  returning id into v_admin;
  perform public.request_reject(v_req_id, v_admin, 'Test rejection');
  if public.founders_club_places_taken() <> v_taken_before then
    raise exception 'FAIL: a rejected request should release its place';
  end if;
  v_checks := v_checks + 1;

  -- 12. Deleting the login keeps the request (permanent log) with the link emptied.
  --     (The admin stays: decided_by never lets a decider be deleted.)
  delete from auth.users where id = v_real;
  select * into v_req from public.request_log where id = v_req_id;
  if v_req.id is null or v_req.applicant_auth_user_id is not null or v_req.status <> 'rejected' then
    raise exception 'FAIL: deleting the login should keep the request and empty its link, got %', row_to_json(v_req);
  end if;
  v_checks := v_checks + 1;

  -- 13. Expired drafts: older than the limit only, with the email state.
  update public.request_drafts set created_at = now() - interval '8 days' where auth_user_id = v_test;
  v_other := pg_temp.new_login('draft-fresh-' || v_tag || '@integration.test');
  perform pg_temp.draft(v_other, 'Fresh ' || v_tag, 'draft-fresh-' || v_tag || '@integration.test');
  select count(*) into v_n from public.request_drafts_expired(interval '7 days') e
  where e.auth_user_id = v_test and e.email_confirmed = false
    and e.requester_email = v_test_email and e.photo_path is null;
  if v_n <> 1 then
    raise exception 'FAIL: the 8-day-old draft should be listed as expired and unconfirmed';
  end if;
  if exists (select 1 from public.request_drafts_expired(interval '7 days') e where e.auth_user_id = v_other) then
    raise exception 'FAIL: a fresh draft must not be listed as expired';
  end if;
  v_checks := v_checks + 2;

  -- 14. Deleting a login deletes its draft (the purge deletes unconfirmed logins).
  delete from auth.users where id = v_test;
  if exists (select 1 from public.request_drafts where auth_user_id = v_test) then
    raise exception 'FAIL: deleting the login should delete its draft';
  end if;
  v_checks := v_checks + 1;

  -- 15. The 50-place cap: once full, the next real applicant gets standard pricing.
  v_i := 0;
  while public.founders_club_places_taken() < 50 loop
    v_i := v_i + 1;
    v_other := pg_temp.new_login('draft-cap-' || v_i || '-' || v_tag || '@example.org');
    perform pg_temp.draft(v_other, 'Cap ' || v_i, 'draft-cap-' || v_i || '-' || v_tag || '@example.org');
    if v_i > 60 then
      raise exception 'FAIL: filling the Founders'' Club did not converge';
    end if;
  end loop;
  v_other := pg_temp.new_login('draft-late-' || v_tag || '@example.org');
  if pg_temp.draft(v_other, 'Late ' || v_tag, 'draft-late-' || v_tag || '@example.org') is distinct from false then
    raise exception 'FAIL: with 50 places taken, a new applicant must not get a Founders'' Club place';
  end if;
  if public.founders_club_places_taken() <> 50 then
    raise exception 'FAIL: places taken should stay at 50, got %', public.founders_club_places_taken();
  end if;
  v_checks := v_checks + 2;

  raise exception 'ALL request_drafts TESTS PASSED (% checks)', v_checks;
end
$test$;

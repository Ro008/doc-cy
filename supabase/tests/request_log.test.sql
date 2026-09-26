-- Database tests for request_log / request_types and their functions
-- (migration 20260926071953_request_log_and_types).
--
-- Run against TESTING only (Supabase SQL editor or the MCP execute_sql tool).
-- Everything runs in one transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL request_log TESTS PASSED (…)" means success;
-- any "FAIL: …" names the broken rule. Nothing is left behind (request_log
-- rows can never be deleted, so tests must not commit any).

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

do $test$
declare
  v_pro uuid;
  v_pro2 uuid;
  v_founder uuid;
  v_partner uuid;
  v_inactive uuid;
  v_u uuid;
  v_req uuid;
  v_req2 uuid;
  v_rec uuid;
  v_row public.request_log%rowtype;
  v_checks int := 0;
begin
  ---------------------------------------------------------------- fixtures
  insert into public.professionals (name, email, is_registered)
  values ('RL Test Pro', 'rl-test-pro@integration.test', false)
  returning id into v_pro;
  insert into public.professionals (name, email, is_registered)
  values ('RL Other Pro', 'rl-other-pro@integration.test', false)
  returning id into v_pro2;

  v_u := gen_random_uuid();
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rl-founder@integration.test', now(), now());
  insert into public.admin_users (auth_user_id, name, email, role) values (v_u, 'RL Founder', 'rl-founder@integration.test', 'founder')
  returning id into v_founder;

  v_u := gen_random_uuid();
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rl-partner@integration.test', now(), now());
  insert into public.admin_users (auth_user_id, name, email, role) values (v_u, 'RL Partner', 'rl-partner@integration.test', 'partner')
  returning id into v_partner;

  v_u := gen_random_uuid();
  insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
  values (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rl-inactive@integration.test', now(), now());
  insert into public.admin_users (auth_user_id, name, email, role, is_active) values (v_u, 'RL Inactive', 'rl-inactive@integration.test', 'founder', false)
  returning id into v_inactive;

  -- Throwaway types for the generic rules (rolled back with everything else).
  insert into public.request_types (name, requires_approval, is_edit, description) values
    ('zz_test_recorded', false, false, 'test: recorded without approval'),
    ('zz_test_edit', true, true, 'test: edit type');

  ---------------------------------------------------------------- types
  assert exists (
    select 1 from public.request_types
    where name = 'registration' and requires_approval and not is_edit and btrim(description) <> ''
  ), 'FAIL: registration type is seeded (needs approval, not an edit)';
  v_checks := v_checks + 1;

  perform pg_temp.expect_error(
    $$insert into public.request_types (name, requires_approval, description) values ('Bad Name', true, 'x')$$,
    '23514', 'type names are lower_snake_case');
  v_checks := v_checks + 1;

  ---------------------------------------------------------------- submit
  v_req := public.request_submit('registration', v_pro, '{"specialties": []}'::jsonb, 1::smallint);
  select * into v_row from public.request_log where id = v_req;
  assert v_row.status = 'pending', 'FAIL: a type needing approval starts pending';
  assert v_row.decided_at is null and v_row.decided_by is null, 'FAIL: pending has no decision';
  assert v_row.requester_name = 'RL Test Pro' and v_row.requester_email = 'rl-test-pro@integration.test',
    'FAIL: requester name and email are copied at submission';
  assert v_row.professional_id = v_pro and v_row.details_version = 1 and v_row.details = '{"specialties": []}'::jsonb,
    'FAIL: submission stores the professional, details and version as given';
  assert v_row.before_snapshot is null and v_row.approved_details is null and v_row.outcome is null,
    'FAIL: no snapshot, corrections or outcome on a new registration';
  v_checks := v_checks + 5;

  perform pg_temp.expect_error(
    format($$select public.request_submit('registration', %L::uuid, '{}'::jsonb, 1::smallint)$$, v_pro),
    '23505', 'one pending registration per professional');
  v_req2 := public.request_submit('registration', v_pro2, '{}'::jsonb, 1::smallint);
  assert v_req2 is not null, 'FAIL: another professional can have their own pending registration';
  v_checks := v_checks + 2;

  perform pg_temp.expect_error(
    format($$select public.request_submit('no_such_type', %L::uuid, '{}'::jsonb, 1::smallint)$$, v_pro),
    '22023', 'unknown request type');
  perform pg_temp.expect_error(
    format($$select public.request_submit('registration', %L::uuid, '[1]'::jsonb, 1::smallint)$$, v_pro2),
    '22023', 'details must be a JSON object');
  perform pg_temp.expect_error(
    format($$select public.request_submit('registration', %L::uuid, '{}'::jsonb, 0::smallint)$$, v_pro2),
    '22023', 'details_version must be at least 1');
  perform pg_temp.expect_error(
    $$select public.request_submit('registration', gen_random_uuid(), '{}'::jsonb, 1::smallint)$$,
    'P0002', 'the professional must exist');
  v_checks := v_checks + 4;

  -- Types without approval are recorded, closed at birth.
  v_rec := public.request_submit('zz_test_recorded', v_pro, '{"clinic_id": "x"}'::jsonb, 1::smallint);
  select * into v_row from public.request_log where id = v_rec;
  assert v_row.status = 'recorded' and v_row.decided_at = v_row.created_at and v_row.decided_by is null,
    'FAIL: a type without approval is recorded with decided_at = created_at';
  v_checks := v_checks + 1;

  -- Edit types need a "before" snapshot, captured per type: none exists yet.
  perform pg_temp.expect_error(
    format($$select public.request_submit('zz_test_edit', %L::uuid, '{}'::jsonb, 1::smallint)$$, v_pro),
    '0A000', 'an edit type without a snapshot step is refused');
  perform pg_temp.expect_error(
    format($$insert into public.request_log (request_type, status, details, details_version, professional_id)
             values ('zz_test_edit', 'pending', '{}'::jsonb, 1, %L::uuid)$$, v_pro),
    '23514', 'an edit request needs before_snapshot');
  v_checks := v_checks + 2;

  ---------------------------------------------------------------- born pending or recorded
  perform pg_temp.expect_error(
    format($$insert into public.request_log (request_type, status, details, details_version, professional_id, decided_at, decided_by)
             values ('registration', 'approved', '{}'::jsonb, 1, %L::uuid, now(), %L::uuid)$$, v_pro2, v_founder),
    '23514', 'a request cannot be born approved');
  perform pg_temp.expect_error(
    format($$insert into public.request_log (request_type, status, details, details_version, professional_id)
             values ('zz_test_recorded', 'pending', '{}'::jsonb, 1, %L::uuid)$$, v_pro2),
    '23514', 'a type without approval cannot be born pending');
  perform pg_temp.expect_error(
    $$insert into public.request_log (request_type, status, details, details_version)
      values ('registration', 'pending', '{}'::jsonb, 1)$$,
    '23514', 'a new request names its professional');
  v_checks := v_checks + 3;

  ---------------------------------------------------------------- tamper-proof while pending
  perform pg_temp.expect_error(
    format($$update public.request_log set details = '{"x": 1}'::jsonb where id = %L$$, v_req),
    '55000', 'details never change');
  perform pg_temp.expect_error(
    format($$update public.request_log set requester_email = 'x@y.z' where id = %L$$, v_req),
    '55000', 'the requester copy never changes');
  perform pg_temp.expect_error(
    format($$update public.request_log set created_at = now() - interval '1 day' where id = %L$$, v_req),
    '55000', 'created_at never changes');
  perform pg_temp.expect_error(
    format($$delete from public.request_log where id = %L$$, v_req),
    '55000', 'requests are never deleted');
  perform pg_temp.expect_error(
    $$truncate public.request_log$$,
    '55000', 'the log is never truncated');
  perform pg_temp.expect_error(
    format($$update public.request_log set status = 'rejected', decided_at = now(), decided_by = %L::uuid, decision_note = 'x' where id = %L$$, v_founder, v_req),
    '55000', 'decisions happen only through the request functions');
  perform pg_temp.expect_error(
    format($$update public.request_log set status = 'approved', decided_at = now(), decided_by = %L::uuid where id = %L$$, v_founder, v_req),
    '55000', 'nobody approves with a plain update (skipping the approval step)');
  v_checks := v_checks + 7;

  ---------------------------------------------------------------- approve (no approval step yet)
  perform pg_temp.expect_error(
    format($$select public.request_approve(%L::uuid, %L::uuid)$$, v_req, v_founder),
    '0A000', 'approving a type without an approval step is refused');
  assert (select status from public.request_log where id = v_req) = 'pending', 'FAIL: a refused approval changes nothing';
  perform pg_temp.expect_error(
    format($$select public.request_approve(%L::uuid, %L::uuid)$$, v_req, v_partner),
    '42501', 'partners cannot approve (read-only)');
  perform pg_temp.expect_error(
    format($$select public.request_approve(%L::uuid, %L::uuid)$$, v_req, v_inactive),
    '42501', 'deactivated admins cannot approve');
  perform pg_temp.expect_error(
    format($$select public.request_approve(gen_random_uuid(), %L::uuid)$$, v_founder),
    'P0002', 'approving a missing request');
  perform pg_temp.expect_error(
    format($$select public.request_approve(%L::uuid, %L::uuid, '[1]'::jsonb)$$, v_req, v_founder),
    '22023', 'corrections must be a JSON object');
  v_checks := v_checks + 6;

  ---------------------------------------------------------------- reject
  perform pg_temp.expect_error(
    format($$select public.request_reject(%L::uuid, %L::uuid, '   ')$$, v_req, v_founder),
    '22023', 'a rejection needs a reason');
  perform pg_temp.expect_error(
    format($$select public.request_reject(%L::uuid, %L::uuid, 'no')$$, v_req, v_partner),
    '42501', 'partners cannot reject');
  perform public.request_reject(v_req, v_founder, '  Licence number not found  ');
  select * into v_row from public.request_log where id = v_req;
  assert v_row.status = 'rejected' and v_row.decided_by = v_founder and v_row.decided_at is not null
    and v_row.decision_note = 'Licence number not found',
    'FAIL: a rejection records who, when and the (trimmed) reason';
  v_checks := v_checks + 3;

  -- A decided request is closed for good.
  perform pg_temp.expect_error(
    format($$select public.request_reject(%L::uuid, %L::uuid, 'again')$$, v_req, v_founder),
    '55000', 'a decided request cannot be rejected again');
  perform pg_temp.expect_error(
    format($$select public.request_approve(%L::uuid, %L::uuid)$$, v_req, v_founder),
    '55000', 'a decided request cannot be approved');
  perform pg_temp.expect_error(
    format($$select public.request_withdraw(%L::uuid, %L::uuid)$$, v_req, v_pro),
    '55000', 'a decided request cannot be withdrawn');
  perform pg_temp.expect_error(
    format($$update public.request_log set decision_note = 'edited' where id = %L$$, v_req),
    '55000', 'a decided request cannot be edited');
  perform pg_temp.expect_error(
    format($$update public.request_log set status = 'pending', decided_at = null, decided_by = null, decision_note = null where id = %L$$, v_req),
    '55000', 'a decided request cannot be reopened');
  perform pg_temp.expect_error(
    format($$update public.request_log set details = '{"x": 1}'::jsonb where id = %L$$, v_rec),
    '55000', 'a recorded request cannot be edited');
  v_checks := v_checks + 6;

  -- After a rejection the professional may submit a new registration.
  v_req := public.request_submit('registration', v_pro, '{"second": true}'::jsonb, 1::smallint);
  v_checks := v_checks + 1;

  ---------------------------------------------------------------- withdraw
  perform pg_temp.expect_error(
    format($$select public.request_withdraw(%L::uuid, %L::uuid)$$, v_req, v_pro2),
    '42501', 'only the requester can withdraw');
  perform public.request_withdraw(v_req, v_pro);
  select * into v_row from public.request_log where id = v_req;
  assert v_row.status = 'withdrawn' and v_row.decided_at is not null and v_row.decided_by is null,
    'FAIL: a withdrawal closes the request without an admin';
  v_checks := v_checks + 2;

  ---------------------------------------------------------------- deleting a professional keeps their requests
  v_req := public.request_submit('registration', v_pro, '{"third": true}'::jsonb, 1::smallint);
  delete from public.professionals where id = v_pro;
  -- Theirs: rejected, recorded, withdrawn, pending.
  assert (select count(*) from public.request_log where requester_email = 'rl-test-pro@integration.test') = 4,
    'FAIL: all of a deleted professional''s requests stay';
  assert not exists (
    select 1 from public.request_log where requester_email = 'rl-test-pro@integration.test' and professional_id is not null
  ), 'FAIL: their professional link becomes empty';
  assert (select status from public.request_log where id = v_req) = 'pending'
    and (select requester_name from public.request_log where id = v_req) = 'RL Test Pro',
    'FAIL: nothing else changes on their requests';
  v_checks := v_checks + 3;

  ---------------------------------------------------------------- admins who decided can't be deleted
  perform pg_temp.expect_error(
    format($$delete from public.admin_users where id = %L$$, v_founder),
    '23503', 'an admin who decided a request cannot be deleted');
  v_checks := v_checks + 1;

  ---------------------------------------------------------------- access
  assert not has_table_privilege('anon', 'public.request_log', 'select')
    and not has_table_privilege('authenticated', 'public.request_log', 'select')
    and not has_table_privilege('anon', 'public.request_types', 'select')
    and not has_table_privilege('authenticated', 'public.request_types', 'select'),
    'FAIL: anon and signed-in users cannot read the tables';
  assert not has_table_privilege('service_role', 'public.request_log', 'delete')
    and not has_table_privilege('service_role', 'public.request_log', 'truncate'),
    'FAIL: even the service role has no delete or truncate on the log';
  assert has_table_privilege('service_role', 'public.request_log', 'select,insert,update'),
    'FAIL: the service role can read and write through the rules';
  assert not has_function_privilege('anon', 'public.request_submit(text, uuid, jsonb, smallint)', 'execute')
    and not has_function_privilege('authenticated', 'public.request_submit(text, uuid, jsonb, smallint)', 'execute')
    and not has_function_privilege('anon', 'public.request_approve(uuid, uuid, jsonb, text)', 'execute')
    and not has_function_privilege('authenticated', 'public.request_approve(uuid, uuid, jsonb, text)', 'execute')
    and not has_function_privilege('anon', 'public.request_reject(uuid, uuid, text)', 'execute')
    and not has_function_privilege('authenticated', 'public.request_reject(uuid, uuid, text)', 'execute')
    and not has_function_privilege('anon', 'public.request_withdraw(uuid, uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.request_withdraw(uuid, uuid)', 'execute'),
    'FAIL: anon and signed-in users cannot call the functions';
  assert has_function_privilege('service_role', 'public.request_submit(text, uuid, jsonb, smallint)', 'execute'),
    'FAIL: the service role can call the functions';
  v_checks := v_checks + 5;

  raise exception 'ALL request_log TESTS PASSED (% checks); rolled back', v_checks;
end
$test$;

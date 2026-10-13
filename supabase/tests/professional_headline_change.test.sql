-- Database tests for the headline on the public profile
-- (migration *_professional_headline_change).
--
-- Settings → Profile → "Headline" (user, 2026-10-13): one optional line under her name on
-- her public page, at most 90 characters. It changes as she pleases, with no founder, and
-- every change is recorded in request_log:
-- - profile_headline is a new column on professionals (null: no headline);
-- - professional_headline_set makes the change and its record together;
-- - at most 5 changes in a rolling 30 days (request_types), like joining a clinic,
--   not the 20 a day of the everyday settings: it is public text under her name.
--
-- Run against TESTING only. One transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL professional_headline_change TESTS PASSED (…)" means
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
  v_other uuid;
  v_listing uuid;
  v_req uuid;
  v_row public.request_log%rowtype;
  v_type public.request_types%rowtype;
  v_i int;
  v_fn text := 'public.professional_headline_set(uuid, text)';
begin
  ---------------------------------------------------------------- fixtures
  insert into public.professionals (name, slug, is_registered, auth_user_id, registration_email, languages)
  values ('Hl Pro', 'hl-pro-' || v_tag, true, pg_temp.new_login('hl-pro-' || v_tag || '@integration.test'),
          'hl-pro-' || v_tag || '@integration.test', array['English'])
  returning id into v_pro;
  insert into public.professionals (name, slug, is_registered, auth_user_id, registration_email, languages)
  values ('Hl Other', 'hl-other-' || v_tag, true, pg_temp.new_login('hl-other-' || v_tag || '@integration.test'),
          'hl-other-' || v_tag || '@integration.test', array['English'])
  returning id into v_other;
  insert into public.professionals (name, slug, is_registered)
  values ('Hl Listing', 'hl-listing-' || v_tag, false)
  returning id into v_listing;

  ---------------------------------------------------------------- column and type
  assert (select profile_headline is null from public.professionals where id = v_pro),
    'FAIL: a professional starts with no headline';
  select * into v_type from public.request_types where name = 'professional_headline_change';
  assert found and not v_type.requires_approval and v_type.is_edit,
    'FAIL: the headline change is a recorded edit that needs no founder';
  assert v_type.limit_count = 5 and v_type.limit_window = interval '30 days'
    and v_type.limit_scope_key is null and v_type.wait_after_approval is null,
    'FAIL: the headline changes at most 5 times in 30 days';
  perform pg_temp.expect_error(
    format('update public.professionals set profile_headline = %L where id = %L', repeat('a', 91), v_pro),
    '23514', 'the column refuses more than 90 characters');
  perform pg_temp.expect_error(
    format('update public.professionals set profile_headline = %L where id = %L', '', v_pro),
    '23514', 'the column refuses an empty headline (none is null)');
  perform pg_temp.expect_error(
    format('update public.professionals set profile_headline = %L where id = %L', E'two\nlines', v_pro),
    '23514', 'the column refuses a line break');
  v_checks := v_checks + 6;

  ---------------------------------------------------------------- setting it (change 1)
  v_req := public.professional_headline_set(v_pro, E'  Gentle   dentistry\tfor the whole family  ');
  select * into v_row from public.request_log where id = v_req;
  assert v_row.request_type = 'professional_headline_change' and v_row.status = 'recorded'
    and v_row.professional_id = v_pro and v_row.decided_at is not null
    and v_row.before_snapshot = '{"profile_headline": null}'::jsonb
    and v_row.details = '{"profile_headline": "Gentle dentistry for the whole family"}'::jsonb,
    'FAIL: a headline is recorded at once, on one line, with the old text';
  assert (select profile_headline from public.professionals where id = v_pro)
      = 'Gentle dentistry for the whole family',
    'FAIL: the headline is saved';
  assert public.professional_headline_set(v_pro, ' Gentle dentistry  for the whole family ') is null
    and (select count(*) from public.request_log
         where professional_id = v_pro and request_type = 'professional_headline_change') = 1,
    'FAIL: the same headline records nothing';
  assert (select profile_headline is null from public.professionals where id = v_other),
    'FAIL: nobody else''s headline changed';
  v_checks := v_checks + 4;

  ---------------------------------------------------------------- clearing it (change 2)
  v_req := public.professional_headline_set(v_pro, '   ');
  assert (select profile_headline from public.professionals where id = v_pro) is null
    and (select details from public.request_log where id = v_req) = '{"profile_headline": null}'::jsonb
    and (select before_snapshot from public.request_log where id = v_req)
        = '{"profile_headline": "Gentle dentistry for the whole family"}'::jsonb,
    'FAIL: an emptied headline is saved as none and recorded';
  assert public.professional_headline_set(v_pro, null) is null,
    'FAIL: clearing an empty headline records nothing';
  v_checks := v_checks + 2;

  ---------------------------------------------------------------- refusals
  perform pg_temp.expect_error(format('select public.professional_headline_set(%L, %L)', v_pro, repeat('a', 91)),
    '22023', 'a headline over 90 characters is refused');
  assert public.professional_headline_set(v_other, repeat('a', 90)) is not null,
    'FAIL: a headline of exactly 90 characters is accepted';
  perform pg_temp.expect_error(format('select public.professional_headline_set(%L, %L)', v_listing, 'Hello'),
    '22023', 'a listing that never signed up cannot write a headline');
  perform pg_temp.expect_error(
    format('select public.professional_headline_set(%L, %L)', gen_random_uuid(), 'Hello'),
    'P0002', 'an unknown professional is refused');
  assert (select count(*) from public.request_log
          where professional_id = v_pro and request_type = 'professional_headline_change') = 2,
    'FAIL: a refused headline records nothing';
  v_checks := v_checks + 5;

  ---------------------------------------------------------------- 5 in 30 days (changes 3 to 5, then refused)
  for v_i in 3..5 loop
    assert public.professional_headline_set(v_pro, 'Headline number ' || v_i) is not null,
      format('FAIL: change %s of 5 is accepted', v_i);
  end loop;
  perform pg_temp.expect_error(format('select public.professional_headline_set(%L, %L)', v_pro, 'One too many'),
    'DC429', 'the 6th change in 30 days is refused');
  assert (select profile_headline from public.professionals where id = v_pro) = 'Headline number 5'
    and (select count(*) from public.request_log
         where professional_id = v_pro and request_type = 'professional_headline_change') = 5,
    'FAIL: the refused change saved and recorded nothing';
  assert public.professional_headline_set(v_pro, 'Headline number 5') is null,
    'FAIL: saving the same headline is still fine at the limit';
  -- The limit is hers alone, and the window rolls: the other professional has 1 change
  -- from today; 3 from ten days ago count, 5 from 31 days ago do not. So she is at 4.
  insert into public.request_log (request_type, status, details, details_version, before_snapshot, professional_id,
    requester_name, requester_email, created_at, decided_at)
  select 'professional_headline_change', 'recorded', '{"profile_headline": "Old"}', 1, '{"profile_headline": null}',
    v_other, 'Hl Other', 'x@integration.test', now() - d, now() - d
  from (select interval '10 days' as d from generate_series(1, 3)
        union all
        select interval '31 days' from generate_series(1, 5)) past;
  assert public.professional_headline_set(v_other, 'Her fifth in 30 days') is not null,
    'FAIL: changes older than 30 days do not count, and the limit is per professional';
  perform pg_temp.expect_error(format('select public.professional_headline_set(%L, %L)', v_other, 'Her sixth'),
    'DC429', 'her 6th change in 30 days is refused too');
  v_checks := v_checks + 7;

  ---------------------------------------------------------------- access
  assert not has_function_privilege('anon', v_fn, 'execute')
    and not has_function_privilege('authenticated', v_fn, 'execute')
    and has_function_privilege('service_role', v_fn, 'execute'),
    format('FAIL: only the service role calls %s', v_fn);
  assert not has_column_privilege('authenticated', 'public.professionals', 'profile_headline', 'update')
    and not has_column_privilege('anon', 'public.professionals', 'profile_headline', 'update')
    and not has_column_privilege('anon', 'public.professionals', 'profile_headline', 'select'),
    'FAIL: the headline is not writable through a session, nor readable by anon';
  v_checks := v_checks + 2;

  raise exception 'ALL professional_headline_change TESTS PASSED (% checks); rolled back', v_checks;
end
$test$;

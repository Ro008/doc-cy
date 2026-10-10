-- Database tests for the professional's name and photo changes
-- (migration *_professional_profile_change_requests).
--
-- Settings → Profile (user, 2026-10-10): a new name and a new photo both need a
-- founder. Each is a request_log row born "pending" with the live value in
-- before_snapshot; one open request per kind; she can withdraw it while it is
-- open. Approving a name also moves the public address (slug) and leaves the old
-- one in professional_slug_redirects. Removing the photo needs nobody: it is
-- recorded at once.
--
-- Run against TESTING only (Supabase SQL editor or the MCP execute_sql tool).
-- Everything runs in one transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL professional_profile_change TESTS PASSED (…)" means
-- success; any "FAIL: …" names the broken rule. Nothing is left behind.

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

-- A signed-up professional (registered needs a login).
create or replace function pg_temp.new_registered(p_name text, p_slug text, p_avatar text default null)
returns uuid
language plpgsql
as $f$
declare
  v_id uuid;
begin
  insert into public.professionals (name, slug, is_registered, auth_user_id, registration_email, avatar_url)
  values (p_name, p_slug, true, pg_temp.new_login(p_slug || '@integration.test'),
          p_slug || '@integration.test', p_avatar)
  returning id into v_id;
  return v_id;
end
$f$;

do $test$
declare
  v_tag text := substr(md5(random()::text), 1, 8);
  v_checks int := 0;
  v_admin uuid;
  v_partner uuid;
  v_pro uuid;
  v_pro2 uuid;
  v_listing uuid;
  v_req uuid;
  v_req2 uuid;
  v_row public.request_log%rowtype;
  v_count int;
  v_slug text := 'pcr-anna-' || v_tag;
begin
  ---------------------------------------------------------------- fixtures
  insert into public.admin_users (auth_user_id, name, email, role)
  values (pg_temp.new_login('pcr-founder-' || v_tag || '@integration.test'), 'Pcr Founder',
          'pcr-founder-' || v_tag || '@integration.test', 'founder')
  returning id into v_admin;
  insert into public.admin_users (auth_user_id, name, email, role)
  values (pg_temp.new_login('pcr-partner-' || v_tag || '@integration.test'), 'Pcr Partner',
          'pcr-partner-' || v_tag || '@integration.test', 'partner')
  returning id into v_partner;
  v_pro := pg_temp.new_registered('Anna Old', v_slug, 'profiles/x/old.jpg');
  v_pro2 := pg_temp.new_registered('Other Person', 'pcr-other-' || v_tag);
  insert into public.professionals (name, slug, is_registered)
  values ('Pcr Listing', 'pcr-listing-' || v_tag, false)
  returning id into v_listing;

  ---------------------------------------------------------------- request types
  select count(*) into v_count from public.request_types
  where name in ('professional_name_change', 'professional_photo_change')
    and requires_approval = true and is_edit = true;
  assert v_count = 2, 'FAIL: name and photo changes exist, need approval, and are edits';
  assert exists (select 1 from public.request_types where name = 'professional_photo_removal'
                 and requires_approval = false and is_edit = true),
    'FAIL: removing the photo is recorded at once';
  v_checks := v_checks + 2;

  ---------------------------------------------------------------- name: submit
  v_req := public.request_submit('professional_name_change', v_pro,
    jsonb_build_object('name', 'Anna New', 'reason', 'I married'));
  select * into v_row from public.request_log where id = v_req;
  assert v_row.status = 'pending' and v_row.decided_at is null,
    'FAIL: a name change waits for a founder';
  assert v_row.before_snapshot = jsonb_build_object('name', 'Anna Old', 'slug', v_slug),
    'FAIL: the request keeps the live name and address';
  assert v_row.details = '{"name": "Anna New", "reason": "I married"}'::jsonb,
    'FAIL: the request keeps what she asked for';
  assert (select name from public.professionals where id = v_pro) = 'Anna Old',
    'FAIL: the live name does not change before approval';
  v_checks := v_checks + 4;

  perform pg_temp.expect_error(
    format('select public.request_submit(%L, %L, %L)', 'professional_name_change', v_pro, '{"name": "Anna Other"}'),
    '23505', 'one open name request at a time');
  perform pg_temp.expect_error(
    format('select public.request_submit(%L, %L, %L)', 'professional_name_change', v_pro2, '{"name": "   "}'),
    '22023', 'an empty name is refused');
  perform pg_temp.expect_error(
    format('select public.request_submit(%L, %L, %L)', 'professional_name_change', v_pro2, '{"reason": "x"}'),
    '22023', 'a request without a name is refused');
  perform pg_temp.expect_error(
    format('select public.request_submit(%L, %L, %L)', 'professional_name_change', v_pro2, '{"name": "Other Person"}'),
    '22023', 'her current name is not a change');
  perform pg_temp.expect_error(
    format('select public.request_submit(%L, %L, %L)', 'professional_name_change', v_pro2,
           jsonb_build_object('name', repeat('a', 81))),
    '22023', 'a name over 80 characters is refused');
  perform pg_temp.expect_error(
    format('select public.request_submit(%L, %L, %L)', 'professional_name_change', v_listing, '{"name": "Listing New"}'),
    '22023', 'a listing that never signed up cannot ask');
  v_checks := v_checks + 6;

  ---------------------------------------------------------------- name: withdraw
  perform pg_temp.expect_error(format('select public.request_withdraw(%L, %L)', v_req, v_pro2),
    '42501', 'only she can withdraw her request');
  perform public.request_withdraw(v_req, v_pro);
  select * into v_row from public.request_log where id = v_req;
  assert v_row.status = 'withdrawn' and v_row.decided_at is not null and v_row.decided_by is null,
    'FAIL: a withdrawn request is closed with no founder';
  perform pg_temp.expect_error(format('select public.request_approve(%L, %L, null, null, %L)', v_req, v_admin, '{"slug": "x"}'),
    '55000', 'a withdrawn request cannot be approved');
  v_checks := v_checks + 3;

  ---------------------------------------------------------------- name: deny
  v_req := public.request_submit('professional_name_change', v_pro, '{"name": "Anna New", "reason": null}');
  perform pg_temp.expect_error(format('select public.request_reject(%L, %L, %L)', v_req, v_admin, '  '),
    '22023', 'denying needs a reason');
  perform public.request_reject(v_req, v_admin, 'The name does not match your licence.');
  assert (select status from public.request_log where id = v_req) = 'rejected'
    and (select name from public.professionals where id = v_pro) = 'Anna Old',
    'FAIL: a denied name changes nothing';
  perform pg_temp.expect_error(format('select public.request_withdraw(%L, %L)', v_req, v_pro),
    '55000', 'a decided request cannot be withdrawn');
  v_checks := v_checks + 3;

  ---------------------------------------------------------------- name: approve
  v_req := public.request_submit('professional_name_change', v_pro, '{"name": "anna new", "reason": "I married"}');
  perform pg_temp.expect_error(format('select public.request_approve(%L, %L)', v_req, v_partner),
    '42501', 'a partner cannot approve');
  perform pg_temp.expect_error(format('select public.request_approve(%L, %L)', v_req, v_admin),
    '22023', 'approving a name needs the new address');
  perform pg_temp.expect_error(
    format('select public.request_approve(%L, %L, null, null, %L)', v_req, v_admin,
           jsonb_build_object('slug', 'pcr-other-' || v_tag)),
    '23505', 'another profile''s address is refused');
  -- An address that still forwards to someone else stays theirs.
  insert into public.professional_slug_redirects (slug, professional_id)
  values ('pcr-taken-' || v_tag, v_pro2);
  perform pg_temp.expect_error(
    format('select public.request_approve(%L, %L, null, null, %L)', v_req, v_admin,
           jsonb_build_object('slug', 'pcr-taken-' || v_tag)),
    '23505', 'an address that forwards to someone else is refused');
  assert (select status from public.request_log where id = v_req) = 'pending'
    and (select name from public.professionals where id = v_pro) = 'Anna Old',
    'FAIL: a refused approval leaves the request open and the name unchanged';
  v_checks := v_checks + 5;

  -- The founder corrects the capitals while approving.
  perform public.request_approve(v_req, v_admin, '{"name": "Anna New", "reason": "I married"}'::jsonb, null,
    jsonb_build_object('slug', 'pcr-anna-new-' || v_tag));
  select * into v_row from public.request_log where id = v_req;
  assert v_row.status = 'approved' and v_row.decided_by = v_admin,
    'FAIL: the founder''s approval is recorded';
  assert v_row.details ->> 'name' = 'anna new' and v_row.approved_details ->> 'name' = 'Anna New',
    'FAIL: what she asked and what was approved are both kept';
  assert v_row.outcome = jsonb_build_object('professional_id', v_pro, 'name', 'Anna New',
      'slug', 'pcr-anna-new-' || v_tag, 'previous_slug', v_slug),
    'FAIL: the outcome says what changed';
  assert (select name from public.professionals where id = v_pro) = 'Anna New'
    and (select slug from public.professionals where id = v_pro) = 'pcr-anna-new-' || v_tag,
    'FAIL: the approved name and address are live';
  assert (select professional_id from public.professional_slug_redirects where slug = v_slug) = v_pro,
    'FAIL: the old address forwards to her';
  v_checks := v_checks + 5;

  -- Changing back: her old address is live again and no longer forwards.
  v_req := public.request_submit('professional_name_change', v_pro, '{"name": "Anna Old"}');
  perform public.request_approve(v_req, v_admin, null, null, jsonb_build_object('slug', v_slug));
  assert (select slug from public.professionals where id = v_pro) = v_slug
    and not exists (select 1 from public.professional_slug_redirects where slug = v_slug)
    and (select professional_id from public.professional_slug_redirects
         where slug = 'pcr-anna-new-' || v_tag) = v_pro,
    'FAIL: going back frees the old address and forwards the newer one';
  v_checks := v_checks + 1;

  -- Same address (only the spelling changed): nothing forwards to itself.
  v_req := public.request_submit('professional_name_change', v_pro, '{"name": "Ánna Old"}');
  perform public.request_approve(v_req, v_admin, null, null, jsonb_build_object('slug', v_slug));
  assert (select name from public.professionals where id = v_pro) = 'Ánna Old'
    and not exists (select 1 from public.professional_slug_redirects where slug = v_slug),
    'FAIL: a name change that keeps the address adds no forward';
  assert (select outcome ->> 'previous_slug' from public.request_log where id = v_req) is null,
    'FAIL: an unchanged address has no previous address';
  v_checks := v_checks + 2;

  -- The name changed some other way since she asked: stop, do not overwrite.
  v_req := public.request_submit('professional_name_change', v_pro, '{"name": "Anna Third"}');
  update public.professionals set name = 'Anna Edited' where id = v_pro;
  perform pg_temp.expect_error(
    format('select public.request_approve(%L, %L, null, null, %L)', v_req, v_admin,
           jsonb_build_object('slug', 'pcr-anna-third-' || v_tag)),
    '55000', 'a name that changed since the request stops the approval');
  perform public.request_withdraw(v_req, v_pro);
  v_checks := v_checks + 1;

  ---------------------------------------------------------------- photo: submit
  v_req := public.request_submit('professional_photo_change', v_pro,
    jsonb_build_object('photo_path', 'professional_photo_change/' || v_pro || '/new.jpg'));
  select * into v_row from public.request_log where id = v_req;
  assert v_row.status = 'pending' and v_row.before_snapshot = '{"avatar_url": "profiles/x/old.jpg"}'::jsonb,
    'FAIL: a photo change waits for a founder and keeps the live photo';
  assert (select avatar_url from public.professionals where id = v_pro) = 'profiles/x/old.jpg',
    'FAIL: the live photo does not change before approval';
  perform pg_temp.expect_error(
    format('select public.request_submit(%L, %L, %L)', 'professional_photo_change', v_pro, '{"photo_path": "a/b.jpg"}'),
    '23505', 'one open photo request at a time');
  perform pg_temp.expect_error(
    format('select public.request_submit(%L, %L, %L)', 'professional_photo_change', v_pro2, '{"photo_path": ""}'),
    '22023', 'a photo request needs its photo');
  v_checks := v_checks + 4;

  -- A name request can be open beside a photo request.
  v_req2 := public.request_submit('professional_name_change', v_pro, '{"name": "Anna Beside"}');
  perform public.request_withdraw(v_req2, v_pro);
  v_checks := v_checks + 1;

  ---------------------------------------------------------------- photo: remove (recorded)
  v_req2 := public.professional_photo_remove(v_pro);
  select * into v_row from public.request_log where id = v_req2;
  assert v_row.request_type = 'professional_photo_removal' and v_row.status = 'recorded'
    and v_row.before_snapshot = '{"avatar_url": "profiles/x/old.jpg"}'::jsonb,
    'FAIL: removing the photo is recorded at once with the old photo';
  assert (select avatar_url from public.professionals where id = v_pro) is null,
    'FAIL: the photo is removed';
  assert public.professional_photo_remove(v_pro) is null,
    'FAIL: removing when there is no photo records nothing';
  perform pg_temp.expect_error(format('select public.professional_photo_remove(%L)', v_listing),
    '22023', 'a listing that never signed up cannot remove a photo');
  v_checks := v_checks + 4;

  ---------------------------------------------------------------- photo: approve
  perform pg_temp.expect_error(format('select public.request_approve(%L, %L)', v_req, v_admin),
    '22023', 'approving a photo needs the published photo');
  -- She removed her photo meanwhile: the approved one still goes live.
  perform public.request_approve(v_req, v_admin, null, null, '{"avatar_path": "profiles/x/new.jpg"}'::jsonb);
  select * into v_row from public.request_log where id = v_req;
  assert v_row.status = 'approved'
    and v_row.outcome = jsonb_build_object('professional_id', v_pro, 'avatar_url', 'profiles/x/new.jpg'),
    'FAIL: the photo approval is recorded with the published photo';
  assert (select avatar_url from public.professionals where id = v_pro) = 'profiles/x/new.jpg',
    'FAIL: the approved photo is live';
  v_checks := v_checks + 3;

  v_req := public.request_submit('professional_photo_change', v_pro, '{"photo_path": "a/next.jpg"}');
  perform public.request_reject(v_req, v_admin, 'The photo shows a logo, not you.');
  assert (select avatar_url from public.professionals where id = v_pro) = 'profiles/x/new.jpg',
    'FAIL: a denied photo changes nothing';
  v_checks := v_checks + 1;

  ---------------------------------------------------------------- access
  assert not has_function_privilege('anon', 'public.professional_photo_remove(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.professional_photo_remove(uuid)', 'execute')
    and has_function_privilege('service_role', 'public.professional_photo_remove(uuid)', 'execute'),
    'FAIL: only the service role removes a photo';
  assert not has_function_privilege('anon', 'public.request_approve(uuid, uuid, jsonb, text, jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public.request_approve(uuid, uuid, jsonb, text, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.request_submit(text, uuid, jsonb, smallint)', 'execute')
    and not has_function_privilege('authenticated', 'public.request_submit(text, uuid, jsonb, smallint)', 'execute'),
    'FAIL: anon and signed-in users cannot submit or approve';
  assert not has_function_privilege('service_role',
      'public.request_apply_professional_name_change(public.request_log, jsonb, jsonb)', 'execute')
    and not has_function_privilege('service_role',
      'public.request_apply_professional_photo_change(public.request_log, jsonb, jsonb)', 'execute'),
    'FAIL: the apply steps run only inside request_approve';
  v_checks := v_checks + 3;

  raise exception 'ALL professional_profile_change TESTS PASSED (% checks); rolled back', v_checks;
end
$test$;

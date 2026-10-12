-- Database tests for the Profile details changed from Settings
-- (migration *_professional_profile_details).
--
-- Settings → Profile (user, 2026-10-10): "Patients I see" (adults, children or all),
-- "How you help patients" (bio), languages and qualifications all change as she
-- pleases, with no founder, and every change is recorded in request_log:
-- - patients_seen and qualifications are new columns on professionals;
-- - qualifications is a list of at most 6 lines (title, institution, optional year),
--   each added or removed on its own.
--
-- Run against TESTING only. One transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL professional_profile_details TESTS PASSED (…)" means
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
  v_listing uuid;
  v_req uuid;
  v_out jsonb;
  v_qid uuid;
  v_row public.request_log%rowtype;
  v_i int;
  v_fn text;
begin
  ---------------------------------------------------------------- fixtures
  insert into public.professionals (name, slug, is_registered, auth_user_id, registration_email, languages)
  values ('Pd Pro', 'pd-pro-' || v_tag, true, pg_temp.new_login('pd-pro-' || v_tag || '@integration.test'),
          'pd-pro-' || v_tag || '@integration.test', array['English'])
  returning id into v_pro;
  insert into public.professionals (name, slug, is_registered)
  values ('Pd Listing', 'pd-listing-' || v_tag, false)
  returning id into v_listing;

  ---------------------------------------------------------------- columns and types
  assert (select patients_seen is null and qualifications = '[]'::jsonb
          from public.professionals where id = v_pro),
    'FAIL: a professional starts with no "patients I see" and no qualifications';
  assert (select count(*) from public.request_types
          where name in ('professional_patients_seen_change', 'professional_bio_change',
                         'professional_languages_change', 'professional_qualification_add',
                         'professional_qualification_removal')
            and not requires_approval and is_edit) = 5,
    'FAIL: the five changes need no founder and are recorded at once';
  perform pg_temp.expect_error(
    format('update public.professionals set patients_seen = %L where id = %L', 'teenagers', v_pro),
    '23514', 'the column takes adults, children or all only');
  perform pg_temp.expect_error(
    format('update public.professionals set qualifications = %L where id = %L', '{"a": 1}', v_pro),
    '23514', 'qualifications is a list');
  v_checks := v_checks + 4;

  ---------------------------------------------------------------- patients I see
  v_req := public.professional_patients_seen_set(v_pro, 'children');
  select * into v_row from public.request_log where id = v_req;
  assert v_row.request_type = 'professional_patients_seen_change' and v_row.status = 'recorded'
    and v_row.before_snapshot = '{"patients_seen": null}'::jsonb
    and v_row.details = '{"patients_seen": "children"}'::jsonb,
    'FAIL: the first choice is recorded at once with the old and new value';
  assert (select patients_seen from public.professionals where id = v_pro) = 'children',
    'FAIL: the choice is saved';
  assert public.professional_patients_seen_set(v_pro, 'children') is null,
    'FAIL: the same choice records nothing';
  v_req := public.professional_patients_seen_set(v_pro, 'all');
  assert (select before_snapshot from public.request_log where id = v_req) = '{"patients_seen": "children"}'::jsonb
    and (select patients_seen from public.professionals where id = v_pro) = 'all',
    'FAIL: a change is saved and keeps the old value';
  perform pg_temp.expect_error(format('select public.professional_patients_seen_set(%L, %L)', v_pro, 'teenagers'),
    '22023', 'an unknown choice is refused');
  perform pg_temp.expect_error(format('select public.professional_patients_seen_set(%L, null)', v_pro),
    '22023', 'the choice cannot be emptied');
  perform pg_temp.expect_error(format('select public.professional_patients_seen_set(%L, %L)', v_listing, 'all'),
    '22023', 'a listing that never signed up cannot choose');
  v_checks := v_checks + 7;

  ---------------------------------------------------------------- bio
  v_req := public.professional_bio_set(v_pro, '  I help with knees.  ');
  select * into v_row from public.request_log where id = v_req;
  assert v_row.request_type = 'professional_bio_change' and v_row.status = 'recorded'
    and v_row.before_snapshot = '{"bio": null}'::jsonb
    and v_row.details = '{"bio": "I help with knees."}'::jsonb,
    'FAIL: a bio is recorded at once, trimmed, with the old text';
  assert (select bio from public.professionals where id = v_pro) = 'I help with knees.',
    'FAIL: the bio is saved';
  assert public.professional_bio_set(v_pro, 'I help with knees.') is null,
    'FAIL: the same bio records nothing';
  v_req := public.professional_bio_set(v_pro, '   ');
  assert (select bio from public.professionals where id = v_pro) is null
    and (select details from public.request_log where id = v_req) = '{"bio": null}'::jsonb
    and (select before_snapshot from public.request_log where id = v_req) = '{"bio": "I help with knees."}'::jsonb,
    'FAIL: an emptied bio is saved as none and recorded';
  perform pg_temp.expect_error(format('select public.professional_bio_set(%L, %L)', v_pro, repeat('a', 1001)),
    '22023', 'a bio over 1000 characters is refused');
  perform pg_temp.expect_error(format('select public.professional_bio_set(%L, %L)', v_listing, 'Hello'),
    '22023', 'a listing that never signed up cannot write a bio');
  v_checks := v_checks + 6;

  ---------------------------------------------------------------- languages
  v_req := public.professional_languages_set(v_pro, array['Greek', 'English']);
  select * into v_row from public.request_log where id = v_req;
  assert v_row.request_type = 'professional_languages_change' and v_row.status = 'recorded'
    and v_row.before_snapshot = '{"languages": ["English"]}'::jsonb
    and v_row.details = '{"languages": ["Greek", "English"]}'::jsonb,
    'FAIL: languages are recorded at once with the old and new list';
  assert (select languages from public.professionals where id = v_pro) = array['Greek', 'English'],
    'FAIL: the languages are saved';
  assert public.professional_languages_set(v_pro, array['English', 'Greek']) is null,
    'FAIL: the same languages in another order record nothing';
  perform pg_temp.expect_error(format('select public.professional_languages_set(%L, %L)', v_pro, '{}'),
    '22023', 'at least one language');
  perform pg_temp.expect_error(format('select public.professional_languages_set(%L, null)', v_pro),
    '22023', 'languages need a value');
  perform pg_temp.expect_error(format('select public.professional_languages_set(%L, %L)', v_pro, '{English,"  "}'),
    '22023', 'an empty language is refused');
  perform pg_temp.expect_error(format('select public.professional_languages_set(%L, %L)', v_listing, '{English}'),
    '22023', 'a listing that never signed up cannot set languages');
  v_checks := v_checks + 7;

  ---------------------------------------------------------------- qualifications: add
  perform pg_temp.expect_error(
    format('select public.professional_qualification_add(%L, %L, %L, 2010)', v_pro, ' ', 'Uni'),
    '22023', 'a qualification needs a title');
  perform pg_temp.expect_error(
    format('select public.professional_qualification_add(%L, %L, %L, 2010)', v_pro, 'MD', ''),
    '22023', 'a qualification needs an institution');
  perform pg_temp.expect_error(
    format('select public.professional_qualification_add(%L, %L, %L, 1900)', v_pro, 'MD', 'Uni'),
    '22023', 'a year before 1950 is refused');
  perform pg_temp.expect_error(
    format('select public.professional_qualification_add(%L, %L, %L, %s)', v_pro, 'MD', 'Uni',
           extract(year from now())::int + 1),
    '22023', 'a year in the future is refused');
  perform pg_temp.expect_error(
    format('select public.professional_qualification_add(%L, %L, %L, 2010)', v_listing, 'MD', 'Uni'),
    '22023', 'a listing that never signed up cannot add one');
  assert (select count(*) from public.request_log where professional_id = v_pro
          and request_type like 'professional_qualification%') = 0,
    'FAIL: a refused qualification records nothing';
  v_checks := v_checks + 6;

  v_out := public.professional_qualification_add(v_pro, '  MD,   Medicine ', ' University of Athens ', 2010);
  v_qid := (v_out -> 'qualification' ->> 'id')::uuid;
  select * into v_row from public.request_log where id = (v_out ->> 'request_id')::uuid;
  assert v_out -> 'qualification' = jsonb_build_object('id', v_qid, 'title', 'MD, Medicine',
      'institution', 'University of Athens', 'year', 2010),
    'FAIL: the added line comes back with its id, spaces tidied';
  assert v_row.request_type = 'professional_qualification_add' and v_row.status = 'recorded'
    and v_row.before_snapshot = '{"qualifications": []}'::jsonb
    and v_row.details = v_out -> 'qualification',
    'FAIL: adding is recorded at once with the line and the list before';
  assert (select qualifications from public.professionals where id = v_pro) = jsonb_build_array(v_out -> 'qualification'),
    'FAIL: the line is saved on her profile';
  v_out := public.professional_qualification_add(v_pro, 'Fellowship', 'Royal College', null);
  assert v_out -> 'qualification' -> 'year' = 'null'::jsonb
    and (select jsonb_array_length(qualifications) from public.professionals where id = v_pro) = 2,
    'FAIL: the year is optional';
  v_checks := v_checks + 4;

  for v_i in 3..6 loop
    perform public.professional_qualification_add(v_pro, 'Course ' || v_i, 'Somewhere', 2000 + v_i);
  end loop;
  perform pg_temp.expect_error(
    format('select public.professional_qualification_add(%L, %L, %L, 2010)', v_pro, 'Seventh', 'Uni'),
    '23514', 'at most 6 qualifications');
  perform pg_temp.expect_error(
    format('update public.professionals set qualifications = qualifications || %L::jsonb where id = %L',
           '[{"title": "x"}]', v_pro),
    '23514', 'the column itself refuses a seventh');
  v_checks := v_checks + 2;

  ---------------------------------------------------------------- qualifications: remove
  perform pg_temp.expect_error(
    format('select public.professional_qualification_remove(%L, %L)', v_pro, gen_random_uuid()),
    'P0002', 'a line she does not have cannot be removed');
  v_req := public.professional_qualification_remove(v_pro, v_qid);
  select * into v_row from public.request_log where id = v_req;
  assert v_row.request_type = 'professional_qualification_removal' and v_row.status = 'recorded'
    and v_row.details ->> 'id' = v_qid::text and v_row.details ->> 'title' = 'MD, Medicine'
    and jsonb_array_length(v_row.before_snapshot -> 'qualifications') = 6,
    'FAIL: removing is recorded at once with the line and the list before';
  assert (select jsonb_array_length(qualifications) = 5
            and not qualifications @> jsonb_build_array(jsonb_build_object('id', v_qid))
          from public.professionals where id = v_pro),
    'FAIL: the removed line is gone and the others stay';
  v_checks := v_checks + 3;

  ---------------------------------------------------------------- access
  foreach v_fn in array array[
    'public.professional_patients_seen_set(uuid, text)',
    'public.professional_bio_set(uuid, text)',
    'public.professional_languages_set(uuid, text[])',
    'public.professional_qualification_add(uuid, text, text, integer)',
    'public.professional_qualification_remove(uuid, uuid)'
  ] loop
    assert not has_function_privilege('anon', v_fn, 'execute')
      and not has_function_privilege('authenticated', v_fn, 'execute')
      and has_function_privilege('service_role', v_fn, 'execute'),
      format('FAIL: only the service role calls %s', v_fn);
    v_checks := v_checks + 1;
  end loop;
  assert not has_column_privilege('authenticated', 'public.professionals', 'patients_seen', 'update')
    and not has_column_privilege('authenticated', 'public.professionals', 'qualifications', 'update')
    and not has_column_privilege('anon', 'public.professionals', 'qualifications', 'update'),
    'FAIL: the new columns are not writable through a session';
  v_checks := v_checks + 1;

  raise exception 'ALL professional_profile_details TESTS PASSED (% checks); rolled back', v_checks;
end
$test$;

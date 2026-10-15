-- Database tests for the phone-reveal events
-- (migrations *_user_events_reveal_sources and *_user_events_reveal_sources_step2).
--
-- What a patient revealed and where (user, 2026-10-15):
-- - event_type: show_clinic_phone_number (was show_phone_number) or
--   show_personal_mobile_number (new);
-- - source: registered_ / unregistered_professional_profile_page,
--   registered_ / unregistered_professional_finder_card, or clinic_page (a clinic's own
--   page: a clinic, no professional).
-- Step 1 accepted the old names (show_phone_number; finder_card, professional_profile_page)
-- until the new code was deployed; step 2 renamed the old rows and refuses the old names.
--
-- Run against TESTING only. One transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL user_events_reveal_sources TESTS PASSED (…)" means
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

-- One event; the SQL text, so a refusal can be checked with expect_error.
create or replace function pg_temp.ev(
  p_type text, p_source text, p_pro uuid, p_clinic uuid, p_visitor text default null
)
returns text
language sql
as $f$
  select format(
    'insert into public.user_events (event_type, actor_type, visitor_key, professional_id, clinic_id, source) values (%L, %L, %L, %L, %L, %L)',
    p_type, 'visitor', p_visitor, p_pro, p_clinic, p_source);
$f$;


do $test$
declare
  v_tag text := substr(md5(random()::text), 1, 8);
  v_checks int := 0;
  v_reg uuid;
  v_listing uuid;
  v_clinic uuid;
  v_src text;
  v_row record;
begin
  ---------------------------------------------------------------- fixtures
  insert into public.professionals (name, slug, is_registered, auth_user_id, registration_email)
  values ('Ue Registered', 'ue-reg-' || v_tag, true, pg_temp.new_login('ue-reg-' || v_tag || '@integration.test'),
          'ue-reg-' || v_tag || '@integration.test')
  returning id into v_reg;
  insert into public.professionals (name, slug, is_registered)
  values ('Ue Listing', 'ue-listing-' || v_tag, false)
  returning id into v_listing;
  select id into v_clinic from public.clinics where not is_archived limit 1;
  assert v_clinic is not null, 'FAIL: fixture needs a clinic';

  ---------------------------------------------------------------- a clinic's phone
  foreach v_src in array array['registered_professional_profile_page', 'registered_professional_finder_card'] loop
    execute pg_temp.ev('show_clinic_phone_number', v_src, v_reg, v_clinic);
  end loop;
  foreach v_src in array array['unregistered_professional_profile_page', 'unregistered_professional_finder_card'] loop
    execute pg_temp.ev('show_clinic_phone_number', v_src, v_listing, v_clinic);
  end loop;
  v_checks := v_checks + 1;
  execute pg_temp.ev('show_clinic_phone_number', 'clinic_page', null, v_clinic);
  v_checks := v_checks + 1;
  perform pg_temp.expect_error(pg_temp.ev('show_clinic_phone_number', 'clinic_page', null, null),
    '23514', 'a clinic page click names the clinic');
  perform pg_temp.expect_error(pg_temp.ev('show_clinic_phone_number', 'clinic_page', v_listing, v_clinic),
    '23514', 'a clinic page click has no professional');
  perform pg_temp.expect_error(pg_temp.ev('show_clinic_phone_number', 'registered_professional_profile_page', null, v_clinic),
    '23514', 'a click on a professional names her');
  perform pg_temp.expect_error(pg_temp.ev('show_clinic_phone_number', 'somewhere_else', v_listing, v_clinic),
    '23514', 'an unknown source is refused');
  v_checks := v_checks + 4;

  ---------------------------------------------------------------- her personal mobile
  execute pg_temp.ev('show_personal_mobile_number', 'registered_professional_profile_page', v_reg, null);
  v_checks := v_checks + 1;
  perform pg_temp.expect_error(pg_temp.ev('show_personal_mobile_number', 'registered_professional_profile_page', v_reg, v_clinic),
    '23514', 'a personal mobile belongs to no clinic');
  perform pg_temp.expect_error(pg_temp.ev('show_personal_mobile_number', 'registered_professional_profile_page', null, null),
    '23514', 'a personal mobile names the professional');
  perform pg_temp.expect_error(pg_temp.ev('show_personal_mobile_number', 'unregistered_professional_profile_page', v_listing, null),
    '23514', 'only a registered profile shows a personal mobile');
  v_checks := v_checks + 3;

  ---------------------------------------------------------------- votes for online booking
  execute pg_temp.ev('request_online_appointment', 'unregistered_professional_finder_card', v_listing, v_clinic, 'visitor-a-' || v_tag);
  execute pg_temp.ev('request_online_appointment', 'unregistered_professional_profile_page', v_listing, v_clinic, 'visitor-b-' || v_tag);
  v_checks := v_checks + 1;
  perform pg_temp.expect_error(pg_temp.ev('request_online_appointment', 'registered_professional_profile_page', v_reg, v_clinic, 'visitor-c-' || v_tag),
    '23514', 'a registered professional takes bookings: no vote');
  v_checks := v_checks + 1;

  ---------------------------------------------------------------- the old names (step 2: gone)
  assert not exists (
    select 1 from public.user_events
    where event_type = 'show_phone_number' or source in ('finder_card', 'professional_profile_page')
  ), 'FAIL: step 2 renamed every row with an old name';
  v_checks := v_checks + 1;
  perform pg_temp.expect_error(pg_temp.ev('show_phone_number', 'finder_card', v_listing, v_clinic),
    '23514', 'the old event name is refused');
  perform pg_temp.expect_error(pg_temp.ev('show_clinic_phone_number', 'finder_card', v_listing, v_clinic),
    '23514', 'the old finder source is refused for a phone');
  perform pg_temp.expect_error(pg_temp.ev('request_online_appointment', 'professional_profile_page', v_listing, v_clinic, 'visitor-d-' || v_tag),
    '23514', 'the old profile source is refused for a vote');
  perform pg_temp.expect_error(pg_temp.ev('show_something', 'unregistered_professional_finder_card', v_listing, v_clinic),
    '23514', 'an unknown event type is refused');
  v_checks := v_checks + 4;

  ---------------------------------------------------------------- the founders' counts
  -- Unregistered listings only (the demand to show them), finder and profile apart.
  select * into v_row from public.founder_user_event_stats('show_clinic_phone_number', null) s
  where s.professional_id = v_listing;
  assert v_row.event_count = 2 and v_row.finder_count = 1 and v_row.profile_count = 1,
    format('FAIL: a listing''s phone clicks, finder and profile apart (got %s)', row_to_json(v_row));
  assert not exists (select 1 from public.founder_user_event_stats('show_phone_number', null)),
    'FAIL: the old name counts nothing any more';
  assert not exists (select 1 from public.founder_user_event_stats('show_clinic_phone_number', null) s
                     where s.professional_id = v_reg),
    'FAIL: registered professionals are not in the founders'' call-to-book counts';
  select * into v_row from public.founder_user_event_stats('request_online_appointment', null) s
  where s.professional_id = v_listing;
  assert v_row.event_count = 2 and v_row.visitor_count = 2 and v_row.finder_count = 1 and v_row.profile_count = 1,
    format('FAIL: votes, finder and profile apart (got %s)', row_to_json(v_row));
  v_checks := v_checks + 4;

  ---------------------------------------------------------------- access
  assert not has_function_privilege('anon', 'public.founder_user_event_stats(text, timestamptz)', 'execute')
    and not has_function_privilege('authenticated', 'public.founder_user_event_stats(text, timestamptz)', 'execute')
    and has_function_privilege('service_role', 'public.founder_user_event_stats(text, timestamptz)', 'execute'),
    'FAIL: only the service role reads the founders'' counts';
  assert not has_table_privilege('anon', 'public.user_events', 'insert')
    and not has_table_privilege('authenticated', 'public.user_events', 'insert')
    and not has_table_privilege('anon', 'public.user_events', 'select'),
    'FAIL: user_events stays service role only';
  v_checks := v_checks + 2;

  raise exception 'ALL user_events_reveal_sources TESTS PASSED (% checks); rolled back', v_checks;
end
$test$;

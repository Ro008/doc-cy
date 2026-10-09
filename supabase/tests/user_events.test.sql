-- Database tests for Point E4 (migrations *_create_user_events and *_drop_legacy_event_tables).
--
-- Run against TESTING only (Supabase SQL editor or the MCP execute_sql tool).
-- It writes test rows and always ends in an error, so everything rolls back: the final
-- message is the result. "ALL user_events TESTS PASSED (…)" means success; any "FAIL: …"
-- names the broken rule.

do $test$
declare
  v_checks int := 0;
  v_pro uuid;
  v_pro2 uuid;
  v_clinic uuid;
  v_since timestamptz := now();
  r record;
begin
  select id into v_pro from public.professionals where not is_archived order by created_at limit 1;
  select id into v_pro2 from public.professionals where not is_archived and id <> v_pro order by created_at limit 1;
  select id into v_clinic from public.clinics order by created_at limit 1;
  if v_pro is null or v_pro2 is null or v_clinic is null then
    raise exception 'SETUP: need two professionals and a clinic';
  end if;

  -- 1. The table and its columns.
  if to_regclass('public.user_events') is null then
    raise exception 'FAIL: user_events does not exist';
  end if;
  if (select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns
      where table_schema = 'public' and table_name = 'user_events')
     <> 'id,event_type,actor_type,actor_id,visitor_key,professional_id,clinic_id,source,details,created_at' then
    raise exception 'FAIL: unexpected user_events columns';
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.user_events'::regclass
                 and contype = 'f' and pg_get_constraintdef(oid) like '%professionals(id) ON DELETE CASCADE') then
    raise exception 'FAIL: professional_id must cascade on delete';
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.user_events'::regclass
                 and contype = 'f' and pg_get_constraintdef(oid) like '%clinics(id) ON DELETE SET NULL') then
    raise exception 'FAIL: clinic_id must be set null on delete';
  end if;
  v_checks := v_checks + 1;

  -- 2. Service role only: RLS on, no policies, nothing granted to anon or authenticated.
  if not (select relrowsecurity from pg_class where oid = 'public.user_events'::regclass) then
    raise exception 'FAIL: RLS is off on user_events';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_events') then
    raise exception 'FAIL: user_events has a policy';
  end if;
  if exists (select 1 from information_schema.role_table_grants
             where table_schema = 'public' and table_name = 'user_events'
               and grantee in ('anon', 'authenticated', 'PUBLIC')) then
    raise exception 'FAIL: anon or authenticated has a grant on user_events';
  end if;
  if has_function_privilege('anon', 'public.founder_user_event_stats(text, timestamptz)', 'execute')
     or has_function_privilege('authenticated', 'public.founder_user_event_stats(text, timestamptz)', 'execute') then
    raise exception 'FAIL: founder_user_event_stats is executable by anon or authenticated';
  end if;
  v_checks := v_checks + 1;

  -- 3. Each event type has its shape.
  insert into public.user_events (event_type, professional_id, clinic_id, source)
  values ('show_phone_number', v_pro, v_clinic, 'finder_card');
  insert into public.user_events (event_type, source, visitor_key, details)
  values ('missing_professional_report', 'finder_empty_state', 'k-report',
          '{"requested_name": "Dr Test", "specialty": null, "district": null, "search_name": null}');
  begin
    insert into public.user_events (event_type, professional_id, source) values ('page_view', v_pro, 'finder_card');
    raise exception 'FAIL: an unknown event_type was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.user_events (event_type, source) values ('show_phone_number', 'finder_card');
    raise exception 'FAIL: a click without a professional was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.user_events (event_type, professional_id, source)
    values ('request_online_appointment', v_pro, 'booking_modal');
    raise exception 'FAIL: an unknown source was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.user_events (event_type, source, details)
    values ('missing_professional_report', 'finder_empty_state', '{"specialty": "Cardiology"}');
    raise exception 'FAIL: a report without requested_name was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.user_events (event_type, source, details)
    values ('missing_professional_report', 'finder_empty_state', '{"requested_name": "  "}');
    raise exception 'FAIL: a report with a blank requested_name was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.user_events (event_type, professional_id, source, details)
    values ('missing_professional_report', v_pro, 'finder_empty_state', '{"requested_name": "Dr Test"}');
    raise exception 'FAIL: a report naming a professional was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.user_events (event_type, professional_id, source, actor_type)
    values ('show_phone_number', v_pro, 'finder_card', 'robot');
    raise exception 'FAIL: an unknown actor_type was accepted';
  exception when check_violation then null;
  end;
  v_checks := v_checks + 1;

  -- 4. One online-appointment vote per visitor and professional; votes without a key are kept.
  insert into public.user_events (event_type, professional_id, source, visitor_key)
  values ('request_online_appointment', v_pro, 'finder_card', 'k-vote');
  begin
    insert into public.user_events (event_type, professional_id, source, visitor_key)
    values ('request_online_appointment', v_pro, 'professional_profile_page', 'k-vote');
    raise exception 'FAIL: a second vote from the same visitor was accepted';
  exception when unique_violation then null;
  end;
  insert into public.user_events (event_type, professional_id, source, visitor_key)
  values ('request_online_appointment', v_pro2, 'finder_card', 'k-vote'),
         ('request_online_appointment', v_pro, 'professional_profile_page', null),
         ('request_online_appointment', v_pro, 'finder_card', null),
         ('show_phone_number', v_pro, 'professional_profile_page', 'k-vote'),
         ('show_phone_number', v_pro, 'professional_profile_page', 'k-vote');
  v_checks := v_checks + 1;

  -- 5. Founder stats: clicks count events, votes count visitors (a vote without a key counts once).
  select * into r from public.founder_user_event_stats('show_phone_number', v_since) where professional_id = v_pro;
  if r.event_count <> 3 or r.finder_count <> 1 or r.profile_count <> 2 then
    raise exception 'FAIL: click stats % / % / %, expected 3 / 1 / 2', r.event_count, r.finder_count, r.profile_count;
  end if;
  select * into r from public.founder_user_event_stats('request_online_appointment', v_since) where professional_id = v_pro;
  if r.event_count <> 3 or r.visitor_count <> 3 then
    raise exception 'FAIL: vote stats % events / % visitors, expected 3 / 3', r.event_count, r.visitor_count;
  end if;
  if exists (select 1 from public.founder_user_event_stats('request_online_appointment', now() + interval '1 day')) then
    raise exception 'FAIL: p_since does not filter';
  end if;
  if exists (select 1 from public.founder_user_event_stats('missing_professional_report', null)) then
    raise exception 'FAIL: reports have no professional, so no stat rows';
  end if;
  v_checks := v_checks + 1;

  -- 6. The old tables, their stats functions and the backfill helper are gone.
  if to_regclass('public.professional_call_to_book_clicks') is not null
     or to_regclass('public.professional_patient_booking_requests') is not null
     or to_regclass('public.missing_professional_requests') is not null then
    raise exception 'FAIL: an old event table still exists';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public'
               and p.proname in ('founder_call_to_book_stats', 'founder_manual_vote_stats', 'user_events_backfill_legacy')) then
    raise exception 'FAIL: an old stats function or the backfill helper still exists';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public'
               and p.prosrc ~ '(call_to_book_clicks|patient_booking_requests|missing_professional_requests)') then
    raise exception 'FAIL: a public function still names an old table';
  end if;
  v_checks := v_checks + 1;

  raise exception 'ALL user_events TESTS PASSED (% checks)', v_checks;
end
$test$;

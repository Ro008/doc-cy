-- Database test for migration *_user_events_mobile_finder_card (user, 2026-10-16).
--
-- Run against TESTING or a local stack (Supabase SQL editor or the MCP execute_sql tool).
-- It writes test rows and always ends in an error, so everything rolls back: the final
-- message is the result. "ALL mobile_finder_card TESTS PASSED (…)" means success; any "FAIL: …"
-- names the broken rule.

do $test$
declare
  v_checks int := 0;
  v_pro uuid;
  v_clinic uuid;
begin
  select id into v_pro from public.professionals where not is_archived order by created_at limit 1;
  select id into v_clinic from public.clinics order by created_at limit 1;
  if v_pro is null then
    raise exception 'FAIL: no professional to test with';
  end if;

  -- 1. "Mobile Number" on a registered professional's finder card is recorded.
  insert into public.user_events (event_type, professional_id, source, details)
  values ('show_personal_mobile_number', v_pro, 'registered_professional_finder_card', '{}');
  v_checks := v_checks + 1;

  -- 2. Her profile page still is.
  insert into public.user_events (event_type, professional_id, source, details)
  values ('show_personal_mobile_number', v_pro, 'registered_professional_profile_page', '{}');
  v_checks := v_checks + 1;

  -- 3. Only registered professionals show a mobile, and it never names a clinic.
  begin
    insert into public.user_events (event_type, professional_id, source, details)
    values ('show_personal_mobile_number', v_pro, 'unregistered_professional_finder_card', '{}');
    raise exception 'FAIL: a mobile reveal on an unregistered card was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.user_events (event_type, professional_id, source, details)
    values ('show_personal_mobile_number', v_pro, 'clinic_page', '{}');
    raise exception 'FAIL: a mobile reveal on a clinic page was accepted';
  exception when check_violation then null;
  end;
  if v_clinic is not null then
    begin
      insert into public.user_events (event_type, professional_id, clinic_id, source, details)
      values ('show_personal_mobile_number', v_pro, v_clinic, 'registered_professional_finder_card', '{}');
      raise exception 'FAIL: a mobile reveal naming a clinic was accepted';
    exception when check_violation then null;
    end;
  end if;
  begin
    insert into public.user_events (event_type, source, details)
    values ('show_personal_mobile_number', 'registered_professional_finder_card', '{}');
    raise exception 'FAIL: a mobile reveal with no professional was accepted';
  exception when check_violation then null;
  end;
  v_checks := v_checks + 1;

  -- 4. The other rules are unchanged.
  insert into public.user_events (event_type, source, details)
  values ('support_message', 'support_form', '{"message": "Hello"}');
  if v_clinic is not null then
    insert into public.user_events (event_type, professional_id, clinic_id, source, details)
    values ('show_clinic_phone_number', v_pro, v_clinic, 'registered_professional_finder_card', '{}');
  end if;
  begin
    insert into public.user_events (event_type, professional_id, source, details)
    values ('request_online_appointment', v_pro, 'registered_professional_finder_card', '{}');
    raise exception 'FAIL: a vote from a registered card was accepted';
  exception when check_violation then null;
  end;
  v_checks := v_checks + 1;

  raise exception 'ALL mobile_finder_card TESTS PASSED (% groups)', v_checks;
end
$test$;

-- Database test for migration *_user_events_support_message (user + Livio, 2026-10-16).
--
-- Run against TESTING or a local stack (Supabase SQL editor or the MCP execute_sql tool).
-- It writes test rows and always ends in an error, so everything rolls back: the final
-- message is the result. "ALL support_message TESTS PASSED (…)" means success; any "FAIL: …"
-- names the broken rule.

do $test$
declare
  v_checks int := 0;
  v_pro uuid;
  v_id uuid;
begin
  select id into v_pro from public.professionals where not is_archived order by created_at limit 1;

  -- 1. A visitor's message and a signed-in sender's message are accepted.
  insert into public.user_events (event_type, source, details)
  values ('support_message', 'support_form',
          '{"topic": "General Question", "message": "Hello", "email": "a@b.co", "url": "https://mydoccy.com/", "user_id": null, "context": null}');
  insert into public.user_events (event_type, actor_type, actor_id, source, details)
  values ('support_message', 'professional', gen_random_uuid(), 'support_form',
          '{"topic": "General Question", "message": "Hello", "email": null, "url": null, "user_id": null, "context": {"kind": "incorrect_listing_info", "professional": "Petros Marcou"}}');
  v_checks := v_checks + 1;

  -- 2. The row needs a real message, the right source, and no professional or clinic.
  begin
    insert into public.user_events (event_type, source, details) values ('support_message', 'support_form', '{}');
    raise exception 'FAIL: a support message without a message was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.user_events (event_type, source, details)
    values ('support_message', 'support_form', '{"message": "   "}');
    raise exception 'FAIL: a blank support message was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.user_events (event_type, source, details)
    values ('support_message', 'finder_empty_state', '{"message": "Hello"}');
    raise exception 'FAIL: a support message with another source was accepted';
  exception when check_violation then null;
  end;
  if v_pro is not null then
    begin
      insert into public.user_events (event_type, professional_id, source, details)
      values ('support_message', v_pro, 'support_form', '{"message": "Hello"}');
      raise exception 'FAIL: a support message naming a professional was accepted';
    exception when check_violation then null;
    end;
  end if;
  v_checks := v_checks + 1;

  -- 3. The other event types still work, and the source is not borrowed by them.
  insert into public.user_events (event_type, source, details)
  values ('missing_professional_report', 'finder_empty_state', '{"requested_name": "Dr Test"}');
  begin
    insert into public.user_events (event_type, source, details)
    values ('missing_professional_report', 'support_form', '{"requested_name": "Dr Test"}');
    raise exception 'FAIL: a missing-professional report with the support source was accepted';
  exception when check_violation then null;
  end;
  v_checks := v_checks + 1;

  -- 4. Purging a professional never touches a support message (it has no professional_id).
  if v_pro is not null then
    delete from public.user_events where professional_id = v_pro;
    if (select count(*) from public.user_events where event_type = 'support_message') < 2 then
      raise exception 'FAIL: deleting a professional''s events removed a support message';
    end if;
  end if;
  v_checks := v_checks + 1;

  raise exception 'ALL support_message TESTS PASSED (% groups)', v_checks;
end
$test$;

-- Point E4 step 2: the code reads and writes user_events only, so the three old event
-- tables and their stats functions go. Production after merge.
--
-- First the step-1 backfill runs again, for rows the old code wrote after step 1, and a
-- guard refuses to drop anything user_events doesn't cover (a duplicate vote counts as
-- covered when that visitor's vote for the professional is there). Dynamic SQL so the
-- file still runs once the tables are gone.

do $guard$
declare
  v_missing bigint;
begin
  if to_regprocedure('public.user_events_backfill_legacy()') is not null then
    perform public.user_events_backfill_legacy();
  end if;

  if to_regclass('public.professional_call_to_book_clicks') is not null then
    execute $q$
      select count(*) from public.professional_call_to_book_clicks c
      where not exists (select 1 from public.user_events e where e.id = c.id)
    $q$ into v_missing;
    if v_missing > 0 then
      raise exception 'E4: % call-to-book clicks are not in user_events', v_missing;
    end if;
  end if;

  if to_regclass('public.professional_patient_booking_requests') is not null then
    execute $q$
      select count(*) from public.professional_patient_booking_requests r
      where not exists (select 1 from public.user_events e where e.id = r.id)
        and not exists (
          select 1 from public.user_events e
          where e.event_type = 'request_online_appointment'
            and e.professional_id = r.professional_id
            and e.visitor_key = nullif(btrim(r.voter_key), ''))
    $q$ into v_missing;
    if v_missing > 0 then
      raise exception 'E4: % online-appointment votes are not in user_events', v_missing;
    end if;
  end if;

  if to_regclass('public.missing_professional_requests') is not null then
    execute $q$
      select count(*) from public.missing_professional_requests m
      where not exists (select 1 from public.user_events e where e.id = m.id)
    $q$ into v_missing;
    if v_missing > 0 then
      raise exception 'E4: % missing-professional reports are not in user_events', v_missing;
    end if;
  end if;
end
$guard$;

drop function if exists public.founder_call_to_book_stats(timestamptz);
drop function if exists public.founder_manual_vote_stats(timestamptz);
drop function if exists public.user_events_backfill_legacy();

drop table if exists public.professional_call_to_book_clicks;
drop table if exists public.professional_patient_booking_requests;
drop table if exists public.missing_professional_requests;

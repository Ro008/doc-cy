-- Phone reveals say what was revealed and where, step 2 of 2 (user, 2026-10-15).
--
-- Step 1 (*_user_events_reveal_sources) added the new names and kept the old ones while
-- the old code was live. The new code is deployed (b462386) and writes only the new names,
-- so this renames the old rows and stops accepting the old names:
--   event_type show_phone_number       -> show_clinic_phone_number
--   source     finder_card             -> unregistered_professional_finder_card
--   source     professional_profile_page -> unregistered_professional_profile_page
-- The old sources were only ever written for unregistered listings (the "Call to book"
-- button and the online-booking vote), whatever the listing became later.
--
-- Backward-compatible with the deployed code (it reads both names until the clean-up PR).
-- Safe to run twice: the renames find nothing the second time.

-- Both names in one statement: step 1's checks pair the old type with the old sources only.
update public.user_events
set event_type = case when event_type = 'show_phone_number' then 'show_clinic_phone_number' else event_type end,
    source = case source
      when 'finder_card' then 'unregistered_professional_finder_card'
      when 'professional_profile_page' then 'unregistered_professional_profile_page'
      else source
    end
where event_type = 'show_phone_number' or source in ('finder_card', 'professional_profile_page');

alter table public.user_events drop constraint if exists user_events_event_type_check;
alter table public.user_events add constraint user_events_event_type_check check (
  event_type in (
    'show_clinic_phone_number', 'show_personal_mobile_number', 'request_online_appointment',
    'missing_professional_report'
  )
);

alter table public.user_events drop constraint if exists user_events_shape_check;
-- Shared columns are real columns; what only one type has lives in details. (coalesce:
-- a check that evaluates to null passes.)
alter table public.user_events add constraint user_events_shape_check check (
  (event_type = 'show_clinic_phone_number'
    and professional_id is not null
    and source in ('registered_professional_profile_page', 'unregistered_professional_profile_page',
                   'registered_professional_finder_card', 'unregistered_professional_finder_card'))
  or (event_type = 'show_clinic_phone_number'
    and source = 'clinic_page'
    and professional_id is null
    and clinic_id is not null)
  or (event_type = 'show_personal_mobile_number'
    and professional_id is not null
    and clinic_id is null
    and source = 'registered_professional_profile_page')
  or (event_type = 'request_online_appointment'
    and professional_id is not null
    and source in ('unregistered_professional_profile_page', 'unregistered_professional_finder_card'))
  or (event_type = 'missing_professional_report'
    and professional_id is null
    and clinic_id is null
    and source = 'finder_empty_state'
    and coalesce(jsonb_typeof(details -> 'requested_name') = 'string'
                 and btrim(details ->> 'requested_name') <> '', false))
);

-- The founders' per-listing counts ("Call to book", online-booking votes): unregistered
-- listings only, the demand to show them before they sign up.
create or replace function public.founder_user_event_stats(
  p_event_type text,
  p_since timestamptz default null
)
returns table(
  professional_id uuid,
  event_count bigint,
  visitor_count bigint,
  finder_count bigint,
  profile_count bigint,
  last_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select e.professional_id,
         count(*) as event_count,
         count(distinct coalesce(e.visitor_key, 'event:' || e.id::text)) as visitor_count,
         count(*) filter (where e.source = 'unregistered_professional_finder_card') as finder_count,
         count(*) filter (where e.source = 'unregistered_professional_profile_page') as profile_count,
         max(e.created_at) as last_at
  from public.user_events e
  where e.event_type = p_event_type
    and e.professional_id is not null
    and e.source in ('unregistered_professional_finder_card', 'unregistered_professional_profile_page')
    and (p_since is null or e.created_at >= p_since)
  group by e.professional_id
$$;

comment on function public.founder_user_event_stats(text, timestamptz) is
  'The founders'' per-listing counts of one event type (clinic phone reveals, online-booking votes): unregistered listings only, finder and profile apart. Service role only.';

revoke all on function public.founder_user_event_stats(text, timestamptz) from public, anon, authenticated;
grant execute on function public.founder_user_event_stats(text, timestamptz) to service_role;

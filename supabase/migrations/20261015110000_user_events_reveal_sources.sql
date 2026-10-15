-- Phone reveals say what was revealed and where, step 1 of 2 (user, 2026-10-15).
--
-- event_type
--   show_clinic_phone_number     a clinic's phone (was show_phone_number)
--   show_personal_mobile_number  the professional's own mobile (new)
-- source: where the click was, and whether the professional was registered at that moment
--   registered_professional_profile_page    unregistered_professional_profile_page
--   registered_professional_finder_card     unregistered_professional_finder_card
--   clinic_page                             a clinic's own page: a clinic, no professional
-- Online-booking votes (request_online_appointment) are for unregistered listings only.
--
-- Step 1 (this file, before merge): the old names stay allowed, because the running code
-- writes them until the new code is deployed. Step 2 (after the deploy) renames the old
-- rows and stops accepting the old names. Backward-compatible; safe to run twice.

alter table public.user_events drop constraint if exists user_events_event_type_check;
alter table public.user_events add constraint user_events_event_type_check check (
  event_type in (
    'show_clinic_phone_number', 'show_personal_mobile_number', 'request_online_appointment',
    'missing_professional_report',
    'show_phone_number' -- old name, until step 2
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
    and source in ('unregistered_professional_profile_page', 'unregistered_professional_finder_card',
                   'finder_card', 'professional_profile_page'))
  -- The old names, until step 2.
  or (event_type = 'show_phone_number'
    and professional_id is not null
    and source in ('finder_card', 'professional_profile_page'))
  or (event_type = 'missing_professional_report'
    and professional_id is null
    and clinic_id is null
    and source = 'finder_empty_state'
    and coalesce(jsonb_typeof(details -> 'requested_name') = 'string'
                 and btrim(details ->> 'requested_name') <> '', false))
);

-- The founders' per-listing counts ("Call to book", online-booking votes): unregistered
-- listings only, the demand to show them before they sign up. Old and new names count
-- together until step 2, whichever name the caller asks for.
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
         count(*) filter (where e.source in ('unregistered_professional_finder_card', 'finder_card')) as finder_count,
         count(*) filter (where e.source in ('unregistered_professional_profile_page', 'professional_profile_page')) as profile_count,
         max(e.created_at) as last_at
  from public.user_events e
  where (e.event_type = p_event_type
         or (p_event_type in ('show_clinic_phone_number', 'show_phone_number')
             and e.event_type in ('show_clinic_phone_number', 'show_phone_number')))
    and e.professional_id is not null
    and e.source in ('unregistered_professional_finder_card', 'unregistered_professional_profile_page',
                     'finder_card', 'professional_profile_page')
    and (p_since is null or e.created_at >= p_since)
  group by e.professional_id
$$;

comment on function public.founder_user_event_stats(text, timestamptz) is
  'The founders'' per-listing counts of one event type (clinic phone reveals, online-booking votes): unregistered listings only, finder and profile apart. Service role only.';

revoke all on function public.founder_user_event_stats(text, timestamptz) from public, anon, authenticated;
grant execute on function public.founder_user_event_stats(text, timestamptz) to service_role;

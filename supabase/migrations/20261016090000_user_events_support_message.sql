-- Support-form messages are kept in user_events (user + Livio, 2026-10-16).
--
-- Formspree only archives 30 days on our plan, and a "Report incorrect info" arrived with no way to
-- answer. The form now also posts to /api/support-message, which writes one row per message:
--   event_type 'support_message', source 'support_form'
--   actor_id   the signed-in user (actor_type 'professional'), null for a visitor
--   details    everything: topic, message, email, url, user_id and the listing context
-- The row names no professional or clinic, so purging a professional never deletes it: these rows
-- are kept forever (user, 2026-10-16).
--
-- Backward-compatible: only widens the two checks; no existing row or code is affected.

alter table public.user_events drop constraint if exists user_events_event_type_check;
alter table public.user_events add constraint user_events_event_type_check check (
  event_type in (
    'show_clinic_phone_number', 'show_personal_mobile_number', 'request_online_appointment',
    'missing_professional_report', 'support_message'
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
  or (event_type = 'support_message'
    and professional_id is null
    and clinic_id is null
    and source = 'support_form'
    and coalesce(jsonb_typeof(details -> 'message') = 'string'
                 and btrim(details ->> 'message') <> '', false))
);

-- "Mobile Number" on a registered professional's finder card (Finder G, step 4; user, 2026-10-16).
--
-- The card reveals her personal mobile on a click, as her profile's "Show mobile" does, and the
-- click is recorded like the clinic phone's: event_type 'show_personal_mobile_number', source
-- 'registered_professional_finder_card'. Only registered professionals show a mobile, and the row
-- names no clinic.
--
-- Backward-compatible: only widens the shape check; no existing row or code is affected.

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
    and source in ('registered_professional_profile_page', 'registered_professional_finder_card'))
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

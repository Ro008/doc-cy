-- professional_settings is no longer written through the professional's own session
-- (user, 2026-10-12).
--
-- Its values now change through database functions (service role) that check them and
-- record every change in request_log: professional_holiday_set (holiday mode) and
-- professional_mobile_visibility_set (show the mobile on the profile). A direct write
-- through /rest/v1 would skip both the checks and the record, so the write privileges
-- leave anon and authenticated. Reading stays (the row-level policies are untouched).
--
-- Not backward compatible with code that saves Settings through the session
-- (app/api/doctor-settings before feat/settings-redesign): Production only after that
-- merge. Re-runnable.

revoke insert, update, delete, truncate, references, trigger
  on public.professional_settings from anon, authenticated;

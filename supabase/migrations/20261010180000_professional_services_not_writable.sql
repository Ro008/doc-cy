-- Services are no longer written through the professional's own session
-- (user, 2026-10-10).
--
-- They now go through professional_service_add / _update / _remove (service role),
-- which record every change in request_log and keep the rules (at most 20, no name
-- twice, a price in euros). A direct write through /rest/v1 would skip both, so the
-- write privileges on professional_services leave anon and authenticated. Reading
-- stays (the row-level policies are untouched).
--
-- Not backward compatible with code that writes them through the session
-- (app/api/doctor-services before feat/settings-redesign): Production only after that
-- merge. Re-runnable.

revoke insert, update, delete, truncate, references, trigger
  on public.professional_services from anon, authenticated;

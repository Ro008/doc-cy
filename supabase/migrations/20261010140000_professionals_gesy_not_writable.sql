-- GeSY is no longer written through the professional's own session (user, 2026-10-10).
--
-- "I see GeSY patients" now goes through professional_gesy_set (service role), which
-- records every change in request_log. So is_gesy leaves the short list of columns
-- "authenticated" may update on her own professionals row
-- (20261009160000_professionals_update_columns): a direct write through /rest/v1
-- would skip the record.
--
-- Not backward compatible with code that writes is_gesy through the session
-- (app/api/doctor-gesy before feat/settings-redesign): Production only after that
-- merge, and after 20261009160000 (which grants the column). Re-runnable.

revoke update (is_gesy) on public.professionals from authenticated;

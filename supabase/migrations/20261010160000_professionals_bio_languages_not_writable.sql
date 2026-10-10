-- Bio and languages are no longer written through the professional's own session
-- (user, 2026-10-10).
--
-- They now go through professional_bio_set / professional_languages_set (service
-- role), which record every change in request_log. So both leave the short list of
-- columns "authenticated" may update on her own professionals row
-- (20261009160000_professionals_update_columns): a direct write through /rest/v1
-- would skip the record.
--
-- Not backward compatible with code that writes them through the session
-- (app/api/doctor-settings before feat/settings-redesign): Production only after that
-- merge, and after 20261009160000 (which grants the columns). Re-runnable.

revoke update (bio, languages) on public.professionals from authenticated;

-- What a signed-in professional may change on her own professionals row (security fix,
-- found 2026-10-09).
--
-- "authenticated" had every table privilege on professionals. With the update policy
-- professionals_update_own (own row, emailed sign-in step) she could set her own
-- pro_access_until, subscription_tier, is_registered, slug or mobile_number straight
-- through /rest/v1, skipping every check and record. INSERT/DELETE had no policy, so
-- RLS refused them, but they are not needed either.
--
-- Now only the columns her session-client routes write stay open:
--   bio, languages        app/api/doctor-settings
--   is_gesy               app/api/doctor-gesy
--   auth_session_revoked_after, auth_keep_session_id   app/api/auth/revoke-other-sessions
-- Everything else goes through the service role (the mobile through
-- professional_mobile_set, which records it). SELECT stays (RLS: own row only).
--
-- Not backward compatible with code that writes mobile_number through the session
-- (master before feat/settings-redesign): Production only after that merge.
-- Revoking a table privilege also revokes the column privileges it covered.
-- Re-runnable.

revoke insert, update, delete, truncate, references, trigger on public.professionals from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.professionals from anon;

grant update (bio, languages, is_gesy, auth_session_revoked_after, auth_keep_session_id)
  on public.professionals to authenticated;

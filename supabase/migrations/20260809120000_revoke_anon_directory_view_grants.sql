-- P0 anti-scraping: stop anonymous/authenticated PostgREST dumps of directory views.
-- App public reads must use the service_role key on the server (finder/clinics/profiles already do for manual data).
-- Views remain for trusted server code and clarity of "safe columns"; they are not browser-readable.

REVOKE SELECT ON public.directory_manual_public FROM anon, authenticated;
REVOKE SELECT ON public.clinics_public FROM anon, authenticated;
REVOKE SELECT ON public.doctors_public FROM anon, authenticated;

-- Ensure service_role can still read the views (SSR / scripts / internal tools).
GRANT SELECT ON public.directory_manual_public TO service_role;
GRANT SELECT ON public.clinics_public TO service_role;
GRANT SELECT ON public.doctors_public TO service_role;

COMMENT ON VIEW public.directory_manual_public IS
  'Server-only manual finder fields (service_role). Excludes ghs_code, email, gender. Not granted to anon/authenticated.';

COMMENT ON VIEW public.clinics_public IS
  'Server-only clinic profile fields (service_role). Excludes ghs_code. Not granted to anon/authenticated.';

COMMENT ON VIEW public.doctors_public IS
  'Server-only registered doctor public profile fields (service_role). Conditional phone via show_phone_public. Not granted to anon/authenticated.';

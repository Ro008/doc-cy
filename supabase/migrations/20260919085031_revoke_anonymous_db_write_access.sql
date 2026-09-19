-- Close three ways for an anonymous visitor to write to the database using the public
-- anon key that ships in every browser.
--
-- 1) clinics_public was a single-table view, so Postgres made it auto-updatable. It ran
--    with its owner's rights (security_invoker = false), bypassing RLS on clinics, and
--    anon held INSERT / UPDATE / DELETE on it. Verified on Testing inside a rolled-back
--    block: as anon, an INSERT succeeded, and one unfiltered DELETE removed every
--    non-archived clinic (4,181 -> 0), which would also cascade through
--    professional_clinics. Nothing in the app reads this view, so it is dropped.
--
-- 2) doctors_public and professionals_public carried the same stray write grants. They
--    are not auto-updatable, so the writes failed anyway, but no grant should say
--    otherwise. anon and authenticated never had SELECT on them; every read goes
--    through the service role, which is unaffected.
--
-- 3) absorb_unregistered_into_registered and register_doctor_with_founder_lock are
--    SECURITY DEFINER with no check on the caller, and were executable by anon through
--    /rest/v1/rpc. The first merges a scraped listing into a registered professional
--    and deletes the listing; the second creates a registered professional and can
--    consume one of the 50 founding-member slots. Every legitimate caller uses the
--    service role on the server (the three /api/internal routes and app/register), so
--    EXECUTE is revoked from everyone else and granted to service_role explicitly.

DROP VIEW IF EXISTS public.clinics_public;

REVOKE ALL ON public.doctors_public FROM anon, authenticated;
REVOKE ALL ON public.professionals_public FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.absorb_unregistered_into_registered(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.absorb_unregistered_into_registered(uuid, uuid)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.register_doctor_with_founder_lock(
  uuid, text, text, text, text, text[], text, text, text, boolean, uuid, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_doctor_with_founder_lock(
  uuid, text, text, text, text, text[], text, text, text, boolean, uuid, text
) TO service_role;

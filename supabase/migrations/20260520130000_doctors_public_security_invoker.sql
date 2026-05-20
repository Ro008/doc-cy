-- Security Advisor: views without security_invoker run as definer and can bypass RLS semantics.
-- doctors_select_public already allows anon/authenticated SELECT; invoker keeps column filtering safe.
DROP VIEW IF EXISTS public.doctors_public;

CREATE VIEW public.doctors_public
WITH (security_invoker = on)
AS
SELECT
  d.id,
  d.name,
  d.specialty,
  d.bio,
  d.clinic_address,
  d.slug,
  d.status,
  d.languages,
  d.created_at,
  d.is_specialty_approved,
  d.is_gesy
FROM public.doctors d;

GRANT SELECT ON public.doctors_public TO anon, authenticated;

COMMENT ON VIEW public.doctors_public IS
  'Public directory / profile fields only. Do not add email, phone, internal_email, or license columns.';

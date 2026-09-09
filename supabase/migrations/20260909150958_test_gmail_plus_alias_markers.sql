-- Manual prod QA Gmail plus-aliases must be test profiles (hidden from Finder).
-- Keep in sync with lib/doctor-test-profile.ts.

CREATE OR REPLACE FUNCTION public.is_test_doctor_registration_email(p_email text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    coalesce(lower(trim(p_email)), '') ~ '@(test-doccy\.com\.cy|integration\.test)$'
    OR coalesce(lower(trim(p_email)), '') ~ '@.+\.testing$'
    OR coalesce(lower(trim(p_email)), '')
      ~ '^(doccyteam|rociosirvent|liviolanzo)\+.+@gmail\.com$'
    OR coalesce(lower(trim(p_email)), '') LIKE '%rociosirvent%';
$$;

COMMENT ON FUNCTION public.is_test_doctor_registration_email(text) IS
  'QA/smoke emails: CI domains, Gmail +aliases (doccyteam|rociosirvent|liviolanzo), and any email containing rociosirvent.';

UPDATE public.professionals
SET is_test_profile = true
WHERE coalesce(is_test_profile, false) = false
  AND (
    public.is_test_doctor_registration_email(email)
    OR public.is_test_doctor_registration_email(registration_email)
  );

-- Part 2 of closing anonymous access (part 1: 20260919085031_revoke_anonymous_db_write_access).
--
-- 1) Doctors' licence documents were publicly readable. The doctor-verifications bucket
--    was public, so any object downloaded by URL, and the policy "Permitir lectura
--    publica de licencias" let anyone list the bucket - confirmed in Production as anon:
--    27 files visible. Two further policies let anon upload anything, with no size or
--    type limit. Nothing needs either: the internal review screen opens licences through
--    a short-lived signed URL created with the service role
--    (app/api/internal/doctors/[id]/license/route.ts), and no code uploads to this
--    bucket any more (newest object 2026-04-28). The bucket becomes private and all three
--    policies go; service_role bypasses storage policies, so signed URLs keep working.
--
-- 2) Avatar policies let any signed-in user INSERT or UPDATE any object in the avatars
--    bucket - checking the bucket and the role, never the owner - so one professional
--    could overwrite another's photo. Every avatar upload goes through the service role
--    (app/api/doctor-avatar, app/register), and photos are served by public URL from a
--    public bucket, which needs no policy. All four avatar policies are dropped.
--
-- Policy names are Production's. Testing has no storage policies, hence IF EXISTS.

UPDATE storage.buckets SET public = false WHERE id = 'doctor-verifications';

DROP POLICY IF EXISTS "Permitir lectura publica de licencias" ON storage.objects;
DROP POLICY IF EXISTS "Permitir subida anonima de licencias" ON storage.objects;
DROP POLICY IF EXISTS "doctor_verifications_anon_insert_licenses" ON storage.objects;

DROP POLICY IF EXISTS "Doctors Upload Access 1oj01fe_0" ON storage.objects;
DROP POLICY IF EXISTS "Doctors Upload Access 1oj01fe_1" ON storage.objects;
DROP POLICY IF EXISTS "Doctors Upload Access 1oj01fe_2" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access 1oj01fe_0" ON storage.objects;

-- 3) Supabase's default privileges grant EXECUTE to PUBLIC, anon and authenticated on
--    every new function in public, which is how absorb_unregistered_into_registered and
--    register_doctor_with_founder_lock ended up callable anonymously. From now on a new
--    function created by the migration role (postgres) is private until a migration
--    grants it. A future function that RLS policies call (like is_doctor_owner) needs an
--    explicit GRANT EXECUTE ... TO authenticated. Existing functions are unaffected.
--
--    Both statements are needed. A schema-scoped REVOKE can only remove what schema-level
--    defaults granted; anon still reached new functions through PUBLIC's built-in global
--    EXECUTE default, so that is revoked globally for the postgres role. Verified on
--    Testing with a throwaway function: anon=false, authenticated=false,
--    service_role=true (kept by the public schema default), postgres=true (owner).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- 4) Pin search_path on the five functions the advisor flags. Their bodies use only
--    built-ins (lower, trim, regexp_replace, normalize, initcap, LIKE) or NEW/OLD, so an
--    empty search_path is safe; outputs were fingerprinted before and after.
--    _doccy_normalize_lang_token exists only in Production, hence the existence check.
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public._doccy_normalize_lang_token(text)',
    'public.is_test_doctor_registration_email(text)',
    'public.is_qa_claim_directory_listing(text,text)',
    'public.professionals_prevent_unregister()',
    'public.normalize_professional_person_name(text)'
  ] LOOP
    IF to_regprocedure(f) IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = %L', f, '');
    END IF;
  END LOOP;
END;
$$;

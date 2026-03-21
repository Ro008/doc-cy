-- Private bucket for license / ID uploads at registration (server uses anon key in app/register).
-- 1) Create bucket in Dashboard → Storage → New bucket → id: doctor-verifications → Private
--    Or: insert into storage.buckets (id, name, public) values ('doctor-verifications', 'doctor-verifications', false);
--
-- 2) Allow unauthenticated inserts only under folder `licenses/` (registration runs before auth session exists).

DROP POLICY IF EXISTS "doctor_verifications_anon_insert_licenses" ON storage.objects;

CREATE POLICY "doctor_verifications_anon_insert_licenses"
ON storage.objects FOR INSERT TO anon
WITH CHECK (
  bucket_id = 'doctor-verifications'
  AND name LIKE 'licenses/%'
);

-- Service role bypasses RLS; internal signed-URL route uses service role.

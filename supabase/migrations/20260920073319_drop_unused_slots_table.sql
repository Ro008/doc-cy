-- Drop the dead `slots` table.
--
-- Availability has long been computed from doctor_settings / professional_clinics
-- schedules (lib/public/compute-public-booking-slots.ts), never from stored rows.
-- `slots` holds 0 rows on Testing and Production, nothing reads or writes it from
-- application code, and no view, function, trigger or inbound foreign key depends on
-- it (its only constraint is its own slots_doctor_id_fkey).
--
-- Dropping it also closes a write surface: the table still carried
-- INSERT/UPDATE/DELETE grants to anon and authenticated, the same family of exposure
-- 20260919085031_revoke_anonymous_db_write_access closed for clinics.
--
-- The one remaining mention, supabase/rls_doctors_appointments_slots_settings.sql, is
-- an unreferenced legacy script whose slots block is already guarded by
-- to_regclass('public.slots') IS NOT NULL, so it becomes a no-op.
--
-- Guarded: refuse to drop if the table ever holds data, rather than destroying it
-- silently. Idempotent: the to_regclass check makes a re-run a no-op.
DO $$
DECLARE
  v_rows bigint;
BEGIN
  IF to_regclass('public.slots') IS NULL THEN
    RAISE NOTICE 'public.slots already dropped; nothing to do.';
    RETURN;
  END IF;

  EXECUTE 'SELECT count(*) FROM public.slots' INTO v_rows;
  IF v_rows > 0 THEN
    RAISE EXCEPTION 'public.slots holds % row(s); refusing to drop. Investigate before re-running.', v_rows;
  END IF;

  DROP TABLE public.slots;
  RAISE NOTICE 'public.slots dropped.';
END $$;

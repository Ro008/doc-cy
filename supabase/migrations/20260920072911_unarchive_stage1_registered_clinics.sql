-- Reverse 20260918154948_archive_backfilled_registered_clinics for real professionals.
--
-- That migration archived every clinic the Stage 1 location backfill created, so the
-- public /clinics directory would not list practices named after individual people.
-- The product decision has since changed: GeSY itself lists practices under the
-- doctor's name, and DocCy will do the same. Clinics named after a professional are
-- legitimate (see "User decisions to respect" in the work plan), so the registered
-- professionals' own clinics belong in the directory.
--
-- Targeting mirrors the migration it reverses: the Stage 1 backfill copied
-- doctor_locations.id onto the professional_clinics join row it created, so a join row
-- whose id is also a doctor_locations id marks exactly the rows it produced. Scraped
-- directory clinics have no such join row and are never touched.
--
-- Narrower than the reversal in one respect, deliberately: test profiles stay archived.
-- On Testing every backfilled clinic belongs to an is_test_profile professional, so this
-- matches 0 rows there; on Production it matches the 2 real ones (Stephan Meyer,
-- Karina Mino). The rule is what decides, not hardcoded ids.
--
-- Idempotent: the is_archived = true filter makes a re-run match nothing.
DO $$
DECLARE
  v_updated bigint;
BEGIN
  -- Point D eventually drops doctor_locations; keep this file replayable after that.
  IF to_regclass('public.doctor_locations') IS NULL THEN
    RAISE NOTICE 'doctor_locations is gone; Stage-1 backfilled clinics cannot be identified. Skipping.';
    RETURN;
  END IF;

  UPDATE public.clinics c
  SET is_archived = false
  WHERE c.is_archived = true
    AND EXISTS (
      SELECT 1
      FROM public.professional_clinics pc
      JOIN public.doctor_locations dl ON dl.id = pc.id
      JOIN public.professionals p ON p.id = pc.professional_id
      WHERE pc.clinic_id = c.id
        AND COALESCE(p.is_test_profile, false) = false
        AND p.is_registered = true
        AND p.is_archived = false
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'unarchive_stage1_registered_clinics: % clinic(s) un-archived.', v_updated;
END $$;

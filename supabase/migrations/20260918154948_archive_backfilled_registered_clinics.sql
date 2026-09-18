-- Keep the clinics created by the location backfill out of the public directory.
--
-- 20260918093247_professional_clinics_rich_join_table.sql creates one `clinics` row
-- per registered professional's location. That migration changes no read path, but
-- the data still lands in a table the public clinic directory reads unfiltered:
-- app/clinics/[[...filters]]/page.tsx lists every clinic with is_archived = false,
-- with no visibility flag and no requirement that it have linked professionals.
--
-- The backfill names each row after the professional, not after a practice
-- (`v_name := rec.doctor_name || ...`), so on production those rows would surface at
-- /clinics as entries named after two individual people. Stage 1 needs them to exist;
-- it does not need them public. Archive them until the practices have real names.
--
-- Targeting: the backfill copies doctor_locations.id onto the professional_clinics
-- join row it creates, so a join row whose id is also a doctor_locations id marks
-- exactly the rows it produced. Scraped directory clinics have no such join row and
-- are never touched.
--
-- Idempotent: re-running matches nothing once the rows are archived.

UPDATE public.clinics c
SET is_archived = true
WHERE c.is_archived = false
  AND EXISTS (
    SELECT 1
    FROM public.professional_clinics pc
    JOIN public.doctor_locations dl ON dl.id = pc.id
    WHERE pc.clinic_id = c.id
  );

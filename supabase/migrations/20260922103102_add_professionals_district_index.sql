-- Point C3 follow-up: keep an index on professionals.district.
--
-- C3 (20260922095256) dropped professionals_district_specialty_idx
-- (district, specialty) WHERE is_archived = false, because the specialty column is
-- gone. Production's pg_stat_user_indexes showed it still in use after #195 for its
-- leading column: district-filtered finder reads (`district = ... AND
-- is_archived = false`). This keeps that access path without the dropped column.
--
-- Idempotent. On a table of ~7k rows the build is instant, so no CONCURRENTLY
-- (which cannot run inside the migration transaction anyway).

create index if not exists professionals_district_idx
  on public.professionals (district)
  where is_archived = false;

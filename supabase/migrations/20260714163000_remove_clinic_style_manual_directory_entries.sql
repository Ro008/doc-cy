-- Remove clinic-style manual directory listings (not individual health professionals).
--
-- These four rows were deleted directly from prod + testing on 2026-07-14 (no PR).
-- Earlier migrations still INSERT them (physiotherapy + dentist batches). This migration
-- must run after those inserts (and after slug backfill) so db reset / migration replay
-- does not re-publish SEO landings for clinic brands.
--
-- See .cursor/rules/manual-directory-import-workflow.mdc § "Clinic-style names".

delete from public.directory_manual
where slug in (
  'body-and-brain-physiotherapy-center',
  'the-physical-therapy-center',
  'nbg-physiotherapy-performance',
  'papapavlou-dental-clinic'
)
or address_maps_link like '%cid=4817451952650553188%'
or address_maps_link like '%cid=12784628686587124485%'
or address_maps_link like '%cid=13427698065646106699%'
or address_maps_link like '%cid=2452361967142578349%';

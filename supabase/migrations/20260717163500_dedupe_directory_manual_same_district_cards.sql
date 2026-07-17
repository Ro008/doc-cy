-- Deduplicate remaining directory_manual cards that share name + specialty + district.
-- Keep the more useful phone/Maps row (same rule as Psychiatry cleanup).

delete from public.directory_manual
where is_archived = false
  and slug in (
    'savvas-hadjiphilippou-paphos',
    'anastasis-anastasiadis-nicosia-2',
    'andrea-shaelou-nicosia-2',
    'andreas-matheou-paphos-2',
    'melina-georgiou-koureos-limassol'
  );

-- Deduplicate Psychiatry cards that share name + specialty + district.
-- Keep the more useful Maps/phone row; drop the sibling slug.

delete from public.directory_manual
where specialty = 'Psychiatry'
  and is_archived = false
  and slug in (
    'christina-stavrinidou-paphos-2',
    'constantinos-stylianou-paphos-2',
    'george-mikellides-paphos-2',
    'marina-antoniou-limassol',
    'vassilis-kafetzopoulos-nicosia-2'
  );

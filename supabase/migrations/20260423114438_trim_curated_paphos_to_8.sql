-- Keep only 8 curated professionals in Paphos for UI review/demo.
DELETE FROM public.directory_manual
WHERE district = 'Paphos'
  AND is_archived = false
  AND name NOT IN (
    'Michaela Koundourou',
    'Elena Ioannou',
    'Nicholas Paphitis',
    'Christos Savva',
    'Ariadni Charalambous',
    'Xenia Georgiou',
    'Nikolas Tsappas',
    'Zinonas Evagorou'
  );
update public.directory_manual
set address_maps_link = 'https://share.google/UP7Bxmp3mDmCglHe4'
where is_archived = false
  and lower(name) = lower('Alexandra Koumpi')
  and specialty = 'Ophthalmology'
  and district = 'Paphos';

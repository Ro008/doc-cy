-- Update maps links with user-verified addresses for two ophthalmology entries.
update public.directory_manual
set
  address_maps_link = 'https://maps.app.goo.gl/ZqcHyioUqqTtA5Bi7',
  updated_at = now()
where lower(name) = lower('Antonis Glykeriou')
  and is_archived = false;

update public.directory_manual
set
  address_maps_link = 'https://maps.app.goo.gl/SsJEJcVV6P4ndw2LA',
  updated_at = now()
where lower(name) = lower('Maria Phylactou')
  and is_archived = false;

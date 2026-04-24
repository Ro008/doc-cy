-- Correct district and maps link for Anastasis Panaretou based on provided address.
update public.directory_manual
set
  district = 'Paphos'::public.cyprus_district,
  address_maps_link = 'https://maps.app.goo.gl/KwEJ1dPi2emWBAxJ6',
  updated_at = now()
where lower(name) = lower('Anastasis Panaretou')
  and is_archived = false;

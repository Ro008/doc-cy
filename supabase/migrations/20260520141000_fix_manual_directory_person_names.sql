-- Name cleanup: directory cards should show a person name (first + optional last),
-- not clinic/brand text from Google listings (e.g. "Andronikos Speech Therapy Center").

update public.directory_manual
set
  name = 'Andronikos',
  updated_at = now()
where is_archived = false
  and address_maps_link = 'https://maps.app.goo.gl/tichBSfGwdiKUj5U8';

update public.directory_manual
set
  name = 'Polydorou',
  updated_at = now()
where is_archived = false
  and address_maps_link = 'https://maps.app.goo.gl/jFXYoexJ88J4mFoG6'
  and lower(name) = lower('Dr Polydorou');

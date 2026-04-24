-- Revert manual directory to verified district subset only.
delete from public.directory_manual;

insert into public.directory_manual (
  name,
  specialty,
  district,
  address_maps_link
)
values
  (
    'Michaela Koundourou',
    'Pediatric Dentistry',
    'Paphos',
    'https://maps.app.goo.gl/Wh4Ldecmk7Ssg47FA'
  ),
  (
    'Elena Ioannou',
    'Dentistry',
    'Paphos',
    'https://maps.app.goo.gl/8HcbjcDfjJjea8n86'
  ),
  (
    'Nicholas Paphitis',
    'Dentistry',
    'Paphos',
    'https://maps.app.goo.gl/Xgrb3uzkfPYdXXAJ9'
  ),
  (
    'Christos Savva',
    'Dentistry',
    'Paphos',
    'https://maps.app.goo.gl/JNENZebCDnc4rmAH9'
  );

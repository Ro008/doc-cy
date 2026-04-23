-- Manual curated listings for Health Finder (Paphos sample).
-- Only required fields: name, specialty, district, address_maps_link.
-- Replace current manual rows with this controlled sample set.

DELETE FROM public.directory_manual;

INSERT INTO public.directory_manual (
  name,
  specialty,
  district,
  address_maps_link
)
VALUES
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
    'https://maps.app.goo.gl/v3KeEU1LHfXzYgrVA'
  ),
  (
    'Christos Savva',
    'Dentistry',
    'Paphos',
    'https://maps.app.goo.gl/JqsZdBhpTAH9xP8JA'
  );

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
    'https://maps.google.com/?q=%CE%91%CE%BD%CE%B4%CF%81%CE%AD%CE%B1+%CE%88%CE%BB%CE%BB%CE%B7%CE%BD%CE%B1+1,+%CE%94%CE%B9%CE%B1%CE%BC+203,+Paphos+8025,+Cyprus'
  ),
  (
    'Elena Ioannou',
    'Dentistry',
    'Paphos',
    'https://maps.google.com/?q=Eleutherias+Ave+79,+Chlorakas+8220,+Cyprus'
  );

-- Normalize recent manual directory entries to person-only names and cleaned specialties.
update public.directory_manual
set
  name = v.name,
  specialty = v.specialty,
  district = v.district::public.cyprus_district,
  updated_at = now()
from (
  values
    ('https://maps.app.goo.gl/h1y1bw1iF7qE3tyDA', 'Elena Neophytou', 'Aesthetician/ Cosmetologist', 'Nicosia'),
    ('https://maps.app.goo.gl/tT5nT2xNFd8EHTki8', 'Antonis Hadjieftychiou', 'Plastic Surgery', 'Nicosia'),
    ('https://maps.app.goo.gl/a4GyvxsNNqGDU7Q4A', 'Phaedon Christofi', 'Plastic Surgery', 'Nicosia'),
    ('https://maps.app.goo.gl/N2kNqxsJxqXquMZr9', 'Panagiotis Ermogenous', 'Plastic Surgery', 'Nicosia'),
    ('https://maps.app.goo.gl/958MDriq5js1PJTz9', 'Demetris Stavrou', 'Plastic Surgery', 'Nicosia'),
    ('https://maps.app.goo.gl/XQGepToybLX6xH2b7', 'Iakovos Georgiou', 'Plastic Surgery', 'Nicosia'),
    ('https://maps.app.goo.gl/xT9iQDsa9Rx6X1CD7', 'Stavros Economou', 'Plastic Surgery', 'Limassol'),
    ('https://maps.app.goo.gl/XbT5sUtJiFBGuZjTA', 'Angelos Karatzias', 'Plastic Surgery', 'Nicosia'),
    ('https://maps.app.goo.gl/NfWuu41S2QchdtGw6', 'Constantinos Michael', 'Plastic Surgery', 'Nicosia'),
    ('https://maps.app.goo.gl/3NZNdYe2nbXQQiaq6', 'Gina Korfiati', 'Plastic Surgery', 'Nicosia'),
    ('https://maps.app.goo.gl/zAp9hmfnnNaErpg28', 'Petros Pariza', 'Plastic Surgery', 'Nicosia'),
    ('https://maps.app.goo.gl/VjBczcZ7KkKZwSkv8', 'Demetris Stavrou', 'Plastic Surgery', 'Limassol'),
    ('https://maps.app.goo.gl/eQiTT55dERa7grHZ8', 'Christos Kitsios', 'Plastic Surgery', 'Nicosia')
) as v(address_maps_link, name, specialty, district)
where public.directory_manual.address_maps_link = v.address_maps_link
  and public.directory_manual.is_archived = false;

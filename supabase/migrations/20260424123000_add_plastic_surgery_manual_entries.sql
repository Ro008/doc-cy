-- Add curated aesthetics/plastic-surgery professionals from latest batch.
insert into public.directory_manual (
  name,
  specialty,
  district,
  address_maps_link
)
select
  v.name,
  v.specialty,
  v.district::public.cyprus_district,
  v.address_maps_link
from (
  values
    ('Elena Neophytou', 'Aesthetician/ Cosmetologist', 'Nicosia', 'https://maps.app.goo.gl/h1y1bw1iF7qE3tyDA'),
    ('Antonis Hadjieftychiou', 'Plastic Surgery', 'Nicosia', 'https://maps.app.goo.gl/tT5nT2xNFd8EHTki8'),
    ('Phaedon Christofi', 'Plastic Surgery', 'Nicosia', 'https://maps.app.goo.gl/a4GyvxsNNqGDU7Q4A'),
    ('Panagiotis Ermogenous', 'Plastic Surgery', 'Nicosia', 'https://maps.app.goo.gl/N2kNqxsJxqXquMZr9'),
    ('Demetris Stavrou', 'Plastic Surgery', 'Nicosia', 'https://maps.app.goo.gl/958MDriq5js1PJTz9'),
    ('Iakovos Georgiou', 'Plastic Surgery', 'Nicosia', 'https://maps.app.goo.gl/XQGepToybLX6xH2b7'),
    ('Stavros Economou', 'Plastic Surgery', 'Limassol', 'https://maps.app.goo.gl/xT9iQDsa9Rx6X1CD7'),
    ('Angelos Karatzias', 'Plastic Surgery', 'Nicosia', 'https://maps.app.goo.gl/XbT5sUtJiFBGuZjTA'),
    ('Constantinos Michael', 'Plastic Surgery', 'Nicosia', 'https://maps.app.goo.gl/NfWuu41S2QchdtGw6'),
    ('Gina Korfiati', 'Plastic Surgery', 'Nicosia', 'https://maps.app.goo.gl/3NZNdYe2nbXQQiaq6'),
    ('Petros Pariza', 'Plastic Surgery', 'Nicosia', 'https://maps.app.goo.gl/zAp9hmfnnNaErpg28'),
    ('Demetris Stavrou', 'Plastic Surgery', 'Limassol', 'https://maps.app.goo.gl/VjBczcZ7KkKZwSkv8'),
    ('Christos Kitsios', 'Plastic Surgery', 'Nicosia', 'https://maps.app.goo.gl/eQiTT55dERa7grHZ8')
) as v(name, specialty, district, address_maps_link)
where not exists (
  select 1
  from public.directory_manual d
  where lower(d.name) = lower(v.name)
    and d.is_archived = false
);

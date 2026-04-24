-- Add curated nutrition and dietetics professionals from latest batch.
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
    ('Alexandra Papasavva', 'Nutrition/ Dietetics', 'Paphos', 'https://maps.app.goo.gl/w5jmwPj1MsNMj1rR7'),
    ('Theofano Pericleous', 'Nutrition/ Dietetics', 'Paphos', 'https://maps.app.goo.gl/dGhXNbgLLg5cocaV8'),
    ('Stavroulla Erodotou', 'Nutrition/ Dietetics', 'Paphos', 'https://maps.app.goo.gl/nesJaFxjYPj2GRxk9'),
    ('Rafaella Theodorou', 'Nutrition/ Dietetics', 'Paphos', 'https://maps.app.goo.gl/HAmRATCvHtKioEQKA'),
    ('Georgia Charpidi', 'Nutrition/ Dietetics', 'Paphos', 'https://maps.app.goo.gl/GoxrGwyraS5M43Y56'),
    ('Katerina Loizou', 'Nutrition/ Dietetics', 'Limassol', 'https://maps.app.goo.gl/bBWdwnixSveXhXny7'),
    ('Nicole Pileidi', 'Nutrition/ Dietetics', 'Limassol', 'https://maps.app.goo.gl/A2UwAUfhKrqyegP26'),
    ('Tina Christoudias', 'Nutrition/ Dietetics', 'Limassol', 'https://maps.app.goo.gl/regHABCaXoyZx7rP7'),
    ('Avgoustina Panagiotou', 'Nutrition/ Dietetics', 'Larnaca', 'https://maps.app.goo.gl/Fz7pJ1e5AgUf4Mq68'),
    ('Elisavet Paraskeva', 'Nutrition/ Dietetics', 'Larnaca', 'https://maps.app.goo.gl/ivFr3S8ykXWrHKLA7'),
    ('Talia Evangelou', 'Nutrition/ Dietetics', 'Larnaca', 'https://maps.app.goo.gl/Ln3BHLga7TVhFB7S9'),
    ('Spyros Petrou', 'Nutrition/ Dietetics', 'Larnaca', 'https://maps.app.goo.gl/wGNpLKEV7P4H6r768')
) as v(name, specialty, district, address_maps_link)
where not exists (
  select 1
  from public.directory_manual d
  where d.is_archived = false
    and (
      lower(d.name) = lower(v.name)
      or d.address_maps_link = v.address_maps_link
    )
);

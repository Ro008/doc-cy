-- Limassol manual directory batch 5. Names: person only; district from postal address.

update public.directory_manual d
set
  name = v.name,
  address_maps_link = v.maps,
  district = v.district::public.cyprus_district,
  updated_at = now()
from (
  values
    (
      'Dr. Antonios Toursidis',
      'Antonios Toursidis',
      'Limassol',
      'https://maps.app.goo.gl/kWbHGxscFAUSyJax9'
    ),
    (
      'Dr Andreas Charalampous',
      'Andreas Charalampous',
      'Limassol',
      'https://maps.app.goo.gl/kDghMsV2omYkYyYGA'
    ),
    (
      'Dr. Christian Onisim',
      'Christian Onisim',
      'Limassol',
      'https://maps.app.goo.gl/ja3gYdsvHcfAaDiB6'
    ),
    (
      'Dr Constantinos Charalambous',
      'Constantinos Charalambous',
      'Limassol',
      'https://maps.app.goo.gl/ZhCaeTN2Z5DFwPeM6'
    )
) as v(match_name, name, district, maps)
where d.is_archived = false
  and lower(d.name) = lower(v.match_name);

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
    (
      'Triantafyllos Giannakopoulos',
      'Vascular Surgery',
      'Limassol',
      'https://maps.app.goo.gl/B16QTwYYFYNwgj1n8'
    ),
    (
      'Maria Ioanna Anastassiades',
      'General Practice',
      'Limassol',
      'https://maps.app.goo.gl/5ffjvQQRTYYhks1A9'
    ),
    (
      'Christina Stefanou',
      'General Practice',
      'Limassol',
      'https://maps.app.goo.gl/j2WFgGMejcaYEiYh7'
    ),
    (
      'Georgios Konstantinou',
      'Internal Medicine',
      'Limassol',
      'https://maps.app.goo.gl/54ZkZcG3SBqvf3Kd6'
    ),
    (
      'Maria Charalambous Ivanova',
      'Dentistry',
      'Limassol',
      'https://maps.app.goo.gl/9af57tLsj9fTpHfC8'
    ),
    (
      'Eleni Siamplettou',
      'Dentistry',
      'Limassol',
      'https://maps.app.goo.gl/19Y8hNy5ruuuL97q8'
    ),
    (
      'Andreas Colios',
      'Dentistry',
      'Limassol',
      'https://maps.app.goo.gl/TVLcUHPSyLK1NH567'
    ),
    (
      'Stephanos Tsitsis',
      'Dentistry',
      'Limassol',
      'https://maps.app.goo.gl/cJ3qi6dAa8XJWzRT7'
    ),
    (
      'Neofytos Ioannides',
      'Dentistry',
      'Limassol',
      'https://maps.app.goo.gl/vMA9xFFQXme3PpD79'
    ),
    (
      'Iliana Rizopoulou',
      'Dentistry',
      'Limassol',
      'https://maps.app.goo.gl/3CHFAXH4MGoRWtks8'
    )
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

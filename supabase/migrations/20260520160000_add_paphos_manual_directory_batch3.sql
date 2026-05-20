-- Paphos manual directory batch 3. Names: person only; district from postal address.

update public.directory_manual d
set
  address_maps_link = v.maps,
  district = v.district::public.cyprus_district,
  updated_at = now()
from (
  values
    ('George Loizides', 'Paphos', 'https://maps.app.goo.gl/JrsyW3nsbAAeGapL7'),
    ('Alexandros Georgiou', 'Paphos', 'https://maps.app.goo.gl/8Xz2ZpGevDKL3n327'),
    ('Maria Paschalidou', 'Paphos', 'https://maps.app.goo.gl/mcpU2SNRwVz7QKSu8'),
    ('Savvas Hadjiraftis', 'Paphos', 'https://maps.app.goo.gl/WTh6JTti8mcwUHgdA'),
    ('Elena Ioannou', 'Paphos', 'https://maps.app.goo.gl/6PuKa2q9ybX6Au7k8'),
    ('Sokratis Sokratous', 'Paphos', 'https://maps.app.goo.gl/YG7xXwQQ3B7mDSrZ8'),
    ('Herodotou Nicos', 'Paphos', 'https://maps.app.goo.gl/41d4zL14YBRDWBtHA'),
    ('Theofano Pericleous', 'Paphos', 'https://maps.app.goo.gl/WirsRrqKHh7TcR4K9')
) as v(name, district, maps)
where d.is_archived = false
  and lower(d.name) = lower(v.name);

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
      'Eftychia Angelou',
      'Dermatology',
      'Paphos',
      'https://maps.app.goo.gl/AoEWWFibyeDVU2oN9'
    ),
    (
      'Olympia Evagorou',
      'Psychiatry',
      'Paphos',
      'https://maps.app.goo.gl/kpe7jbd9UG7MPmB27'
    ),
    (
      'Panagiotis Antonakas',
      'General Practice',
      'Paphos',
      'https://maps.app.goo.gl/r1znAucEhbxTJDmZ6'
    ),
    (
      'Vasileios Adamopoulos',
      'Urology',
      'Paphos',
      'https://maps.app.goo.gl/wMNiHstMHmpD1652A'
    ),
    (
      'Chrysovalantis Christodoulou',
      'Cardiology',
      'Paphos',
      'https://maps.app.goo.gl/M93aZRnN9kY8J1M16'
    ),
    (
      'Marina Liasidou',
      'General Practice',
      'Paphos',
      'https://maps.app.goo.gl/MwrLdBnCJ15sVNd77'
    ),
    (
      'Viera Palek',
      'Podiatry',
      'Paphos',
      'https://maps.app.goo.gl/sAJXZkJMb6twtmbW9'
    ),
    (
      'Kyriakos Kyriakou',
      'Cardiology',
      'Paphos',
      'https://maps.app.goo.gl/tXinn6ztcHxAEoPg8'
    ),
    (
      'Vasileios Manettas',
      'ENT',
      'Paphos',
      'https://maps.app.goo.gl/NrfDahZan5DS1QKj6'
    ),
    (
      'Nikoletta Evripidou',
      'Cardiology',
      'Paphos',
      'https://maps.app.goo.gl/Yhhr99vGYL25K8Pw6'
    ),
    (
      'Andreas Andreou',
      'General Practice',
      'Paphos',
      'https://maps.app.goo.gl/NC3aCVr4X1aA6cKe8'
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

-- Paphos / Polis / Pegeia manual directory batch (patient-sourced Google listings + postal addresses).
-- Names: person only. District from address text (Pegeia, Polis, Tala, Paphos → Paphos).

-- Refresh maps links / district where the professional already exists under another URL.
update public.directory_manual d
set
  address_maps_link = v.maps,
  district = v.district::public.cyprus_district,
  updated_at = now()
from (
  values
    ('Spyridakis Chrysostomou', 'Paphos', 'https://maps.app.goo.gl/MGsRErVaifdWhwCr9'),
    ('Dimitra Georgiou', 'Paphos', 'https://maps.app.goo.gl/rvcYag3xVFymdYME9'),
    ('Ionas Miliatos', 'Paphos', 'https://maps.app.goo.gl/LXEkm4Som6MkTcfZ7')
) as v(name, district, maps)
where d.is_archived = false
  and lower(d.name) = lower(v.name);

update public.directory_manual
set
  specialty = 'Gynecology',
  updated_at = now()
where is_archived = false
  and lower(name) = lower('Dimitra Georgiou');

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
      'Theodora Bartzou',
      'General Practice',
      'Paphos',
      'https://maps.app.goo.gl/yWLZBV4HgoWvc2s9A'
    ),
    (
      'Georgios Petrou',
      'General Practice',
      'Paphos',
      'https://maps.app.goo.gl/991ndnQ2zf6uWLAb9'
    ),
    (
      'George Vorkas',
      'Radiology',
      'Paphos',
      'https://maps.app.goo.gl/oKncZmZkGhVEya2q6'
    ),
    (
      'Anastasiya B',
      'Psychology',
      'Paphos',
      'https://maps.app.goo.gl/f4JSD9453GHEhYae9'
    ),
    (
      'Costas Papadopoulos',
      'Urology',
      'Paphos',
      'https://maps.app.goo.gl/eJnSpRasYiTLejVQA'
    ),
    (
      'Fotis Vasiliou',
      'General Practice',
      'Paphos',
      'https://maps.app.goo.gl/oPbrVyJ5WoCcyqbj8'
    ),
    (
      'Andreas Antoniades',
      'ENT',
      'Paphos',
      'https://maps.app.goo.gl/tBieQSMUcretYVXK9'
    ),
    (
      'Nicodemos Kosti',
      'Gastroenterology',
      'Paphos',
      'https://maps.app.goo.gl/eNWu8ob3ywiodidS9'
    ),
    (
      'Stelios Kakoyiannis',
      'General Practice',
      'Paphos',
      'https://maps.app.goo.gl/mZ4V93HBjjQbowhu6'
    ),
    (
      'Nikoletta Louka',
      'Podiatry',
      'Paphos',
      'https://maps.app.goo.gl/rWLxhSouZhgNeQVk8'
    ),
    (
      'Charis Stylianou',
      'Pediatrics',
      'Paphos',
      'https://maps.app.goo.gl/a9bH6ad7U8A1K2kWA'
    ),
    (
      'Kristia Chrysostomou',
      'Orthopedics',
      'Paphos',
      'https://maps.app.goo.gl/pkfr9U8baMQjsD5B6'
    ),
    (
      'Maria Iasonos',
      'General Practice',
      'Paphos',
      'https://maps.app.goo.gl/jJKumt7LGnM21sGU6'
    ),
    (
      'Stelios Papasavvas',
      'Gastroenterology',
      'Paphos',
      'https://maps.app.goo.gl/MmTu9d7stvnQ8YZa6'
    ),
    (
      'Maria Machattou',
      'Rheumatology',
      'Paphos',
      'https://maps.app.goo.gl/p3S3xv96oi29MauF7'
    ),
    (
      'Anthoula Loizidou',
      'Pediatrics',
      'Paphos',
      'https://maps.app.goo.gl/xr5SWocrSdR1NXAu6'
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

-- Paphos / Limassol manual directory batch 4. Names: person only; district from postal address.

update public.directory_manual d
set
  address_maps_link = v.maps,
  district = v.district::public.cyprus_district,
  updated_at = now()
from (
  values
    ('Nikolas Stavris', 'Paphos', 'https://maps.app.goo.gl/p7VeH9oJ9UGA9frq6'),
    ('Nikolas Tsappas', 'Paphos', 'https://maps.app.goo.gl/6xLK8KgvpTsTPAwG6'),
    ('Panayiotis Christou', 'Paphos', 'https://maps.app.goo.gl/5gdZyBbrsPU36Twe8'),
    (
      'Anastasios Tranoulis',
      'Paphos',
      'https://maps.app.goo.gl/5UmLC3KZ4kNRHYGr5'
    )
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
      'Mattheos Philippou',
      'ENT',
      'Paphos',
      'https://maps.app.goo.gl/ve3QEkeaGKtg1XJZ7'
    ),
    (
      'Giannis Kesidis',
      'Urology',
      'Paphos',
      'https://maps.app.goo.gl/ATv3Q6Qz8vDZsK43A'
    ),
    (
      'Inesa Kesova',
      'Gynecology',
      'Paphos',
      'https://maps.app.goo.gl/eUDGqwnsAg9gcdvQ7'
    ),
    (
      'Antonio Stavrou',
      'General Practice',
      'Limassol',
      'https://maps.app.goo.gl/y2mHhdJim6ZWo3fL8'
    ),
    (
      'Christina Stavrinidou',
      'Psychiatry',
      'Paphos',
      'https://maps.app.goo.gl/WqvKRaT9BkmABM2S9'
    ),
    (
      'Ekaterina Fominenkova',
      'Ophthalmology',
      'Paphos',
      'https://maps.app.goo.gl/4punAF2ZQJN4EuhL8'
    ),
    (
      'Giannis Ioannou',
      'Neurosurgery',
      'Paphos',
      'https://maps.app.goo.gl/ieVvC2ynHk5fLdqf8'
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

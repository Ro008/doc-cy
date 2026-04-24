-- Add curated dermatology, pediatrics, and ophthalmology entries.
-- Also correct Elena Neophytou district based on provided Paphos address.

update public.directory_manual
set
  district = 'Paphos'::public.cyprus_district,
  updated_at = now()
where address_maps_link = 'https://maps.app.goo.gl/h1y1bw1iF7qE3tyDA'
  and is_archived = false;

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
    ('Vera Politou', 'Dermatology', 'Paphos', 'https://maps.app.goo.gl/qmagUZLsBgrBreXE9'),
    ('Christiana Zacharia Sotiriou', 'Dermatology', 'Nicosia', 'https://maps.app.goo.gl/LZu37LETW3TogkGA6'),
    ('Elena Thomaidou', 'Dermatology', 'Larnaca', 'https://maps.app.goo.gl/kRtrV8VhiQcmfbEY8'),
    ('Eleni Iosifidou', 'Dermatology', 'Larnaca', 'https://maps.app.goo.gl/D492Lmq7R55z6kkJ7'),
    ('Andreas Christodoulou', 'Dermatology', 'Larnaca', 'https://maps.app.goo.gl/tRrgzhhDqh9TWEPUA'),
    ('Georgia Marangou', 'Pediatrics', 'Paphos', 'https://maps.app.goo.gl/4ixUbAzag2pWywaT9'),
    ('Giorgos Naifa', 'Pediatrics', 'Paphos', 'https://maps.app.goo.gl/6zGCuMs7sUAtz1CL6'),
    ('Maria Paschalidou', 'Pediatrics', 'Paphos', 'https://maps.app.goo.gl/xrXim3AF5DC93KM9A'),
    ('Christos Demetriou', 'Pediatrics', 'Paphos', 'https://maps.app.goo.gl/rYXJ6rXiLxU36UgM8'),
    ('George Loizides', 'Pediatrics', 'Paphos', 'https://maps.app.goo.gl/fkoAHpSBKGMJKRK86'),
    ('Artemis Polycarpou', 'Pediatrics', 'Paphos', 'https://maps.app.goo.gl/6anTf4FPnXTBeyve7'),
    ('Charis Neocleous', 'Pediatrics', 'Paphos', 'https://maps.app.goo.gl/8sZ8uhzaA5yEunoA7'),
    ('Renos Petrou', 'Pediatrics', 'Limassol', 'https://maps.app.goo.gl/Wb2LRn98NSPFq2vN6'),
    ('Valentina Stavrou', 'Ophthalmology', 'Paphos', 'https://maps.app.goo.gl/T7oWgsj1QUy6hC4c8'),
    ('Ionas Miliatos', 'Ophthalmology', 'Paphos', 'https://maps.app.goo.gl/mKibZaTuoKr36zFK8'),
    ('Alexandros Georgiou', 'Ophthalmology', 'Paphos', 'https://maps.app.goo.gl/qyiy5DVWCbkGeNzv6'),
    ('Charis Antoniou', 'Ophthalmology', 'Paphos', 'https://maps.app.goo.gl/8U9iDxAk4Em2sDpP6'),
    ('Nikolas Stavris', 'Ophthalmology', 'Paphos', 'https://maps.app.goo.gl/w1httwyHHqnT9bqo6'),
    ('Savvas Hadjiraftis', 'Ophthalmology', 'Paphos', 'https://maps.app.goo.gl/bJzeXPVRBfWhsADJ6'),
    ('Panayiotis Christou', 'Ophthalmology', 'Paphos', 'https://maps.app.goo.gl/ytswnWjHq9sKJoyg8'),
    ('Alexandra Koumpi', 'Ophthalmology', 'Paphos', 'https://maps.app.goo.gl/TzDvzRZVzgVjUWMm7'),
    ('Elias Elia', 'Ophthalmology', 'Limassol', 'https://maps.app.goo.gl/64hbdM1CsF9zbyQ38'),
    ('Antonis Glykeriou', 'Ophthalmology', 'Nicosia', 'https://maps.app.goo.gl/LPpTMA7ptkcDpV726'),
    ('Maria Phylactou', 'Ophthalmology', 'Nicosia', 'https://maps.app.goo.gl/j3WEHEfeoGMHhoFD9')
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

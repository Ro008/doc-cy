-- Add manual directory entries to support popular Finder SEO links.
-- Idempotent insert: skips existing rows by maps link or same name+specialty+distrct.

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
    ('Dr. Olga Constantinides', 'Dentistry', 'Nicosia', 'https://maps.app.goo.gl/P2GzCboYio2b4Lee9'),
    ('Dr Adonis Panagidis', 'Dentistry', 'Nicosia', 'https://maps.app.goo.gl/QKEzYLpSK7jNPwqMA'),
    ('Dr. Antonios Toursidis', 'Dentistry', 'Limassol', 'https://maps.app.goo.gl/uyh7ujiZYgkMrBHj8'),
    ('Dr Andreas Charalampous', 'Dentistry', 'Limassol', 'https://maps.app.goo.gl/8mzsvVLcRGTa2pcz9'),
    ('Dr. Christian Onisim', 'Dentistry', 'Limassol', 'https://maps.app.goo.gl/8Z54qRSDxFsRYfQQ8'),
    ('Christos Yiapanis', 'Physiotherapy', 'Limassol', 'https://maps.app.goo.gl/EWtHhEidkNghKSQKA'),
    ('Michel Issa', 'Physiotherapy', 'Limassol', 'https://maps.app.goo.gl/jRc7Jwnoy9SSyq6e9'),
    ('Xoufaridis Aris', 'Physiotherapy', 'Limassol', 'https://maps.app.goo.gl/6f7wz9j3dp21GGkTA'),
    ('Dr Constantinos Charalambous', 'Dentistry', 'Larnaca', 'https://maps.app.goo.gl/GDapwBUcjQr8R21j8'),
    ('Evripides C. Constantinides', 'Dentistry', 'Larnaca', 'https://maps.app.goo.gl/4bt12ojsn6KgJ41q9'),
    ('Dr. Andreas Pamboris', 'Dentistry', 'Larnaca', 'https://maps.app.goo.gl/ckbDxfXpzLVv3jsk7'),
    ('Michalis Panagiotou', 'Physiotherapy', 'Larnaca', 'https://maps.app.goo.gl/u4uSBMAZAA8fQ2sa6'),
    ('Fryni Ioannou', 'Physiotherapy', 'Larnaca', 'https://maps.app.goo.gl/jQfbmLGHeQT7M1Dw6'),
    ('Anna Manentzou', 'Psychology', 'Larnaca', 'https://maps.app.goo.gl/FBDFb4fHfeEhCjeY8'),
    ('Stefanie Christodoulou', 'Psychology', 'Larnaca', 'https://maps.app.goo.gl/N6cEPGLk5K9grJQK9'),
    ('Dr Stella Konia', 'Psychology', 'Larnaca', 'https://maps.app.goo.gl/nYVbBzdEi9ukCbm96')
) as v(name, specialty, district, address_maps_link)
where not exists (
  select 1
  from public.directory_manual d
  where d.is_archived = false
    and (
      d.address_maps_link = v.address_maps_link
      or (
        lower(d.name) = lower(v.name)
        and lower(d.specialty) = lower(v.specialty)
        and d.district = v.district::public.cyprus_district
      )
    )
);

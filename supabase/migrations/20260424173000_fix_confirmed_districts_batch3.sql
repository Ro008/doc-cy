-- Apply user-confirmed district corrections batch 3.
update public.directory_manual
set
  district = v.district::public.cyprus_district,
  updated_at = now()
from (
  values
    ('Anastasios Tranoulis', 'Paphos'),
    ('Andreas Matheou', 'Paphos'),
    ('Elias Elia', 'Limassol'),
    ('Antonis Hadjieftychiou', 'Paphos'),
    ('Chris Liassides', 'Limassol'),
    ('Constantinos Michael', 'Limassol'),
    ('Costas Christoforou', 'Larnaca'),
    ('Dimitra Georgiou', 'Paphos'),
    ('Evangelia Andreou', 'Larnaca'),
    ('Gina Korfiati', 'Larnaca'),
    ('Iakovos Georgiou', 'Limassol'),
    ('Irina Mzavanatze-Stampolidou', 'Paphos'),
    ('Niki Agathokleous', 'Limassol'),
    ('Panagiotis Ermogenous', 'Paphos'),
    ('Phaedon Christofi', 'Paphos')
) as v(name, district)
where lower(public.directory_manual.name) = lower(v.name)
  and public.directory_manual.is_archived = false;

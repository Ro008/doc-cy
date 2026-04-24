-- Add curated midwifery and gynecology professionals from latest batch.
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
    ('Athena Kozyraki', 'Midwifery', 'Paphos', 'https://maps.app.goo.gl/4UEj3TBBmckt53Cv9'),
    ('Costas Christoforou', 'Gynecology', 'Nicosia', 'https://maps.app.goo.gl/jFEeMh3SPZhLwuxXA'),
    ('Andrie Constantinou', 'Medicine', 'Limassol', 'https://maps.app.goo.gl/QCDyes9CDGbgzs38A'),
    ('Eva Oikonomou', 'Midwifery', 'Famagusta', 'https://maps.app.goo.gl/hMWin6UyShwVMP2e9'),
    ('Niki Agathokleous', 'Obstetrics/ Gynecology', 'Nicosia', 'https://maps.app.goo.gl/68fps27eyT3EEbeq5'),
    ('Andreas Matheou', 'Obstetrics/ Gynecology', 'Nicosia', 'https://maps.app.goo.gl/FmDnnbNoFqASgUpm7'),
    ('Dimitra Georgiou', 'Obstetrics/ Gynecology', 'Nicosia', 'https://maps.app.goo.gl/kYVviMBYjNmiyt277'),
    ('Spyridakis Chrysostomou', 'Medicine', 'Paphos', 'https://maps.app.goo.gl/dwaGVUQp2bg7sDbT8'),
    ('Georges Parpas', 'Obstetrics/ Gynecology', 'Paphos', 'https://maps.app.goo.gl/FMjusNbTi6M9Rb2K7'),
    ('Anastasis Panaretou', 'Fetal Medicine', 'Paphos', 'https://maps.app.goo.gl/KwEJ1dPi2emWBAxJ6'),
    ('Irina Mzavanatze-Stampolidou', 'Obstetrics/ Gynecology', 'Nicosia', 'https://maps.app.goo.gl/XTG4piLhPYVPpAM9A'),
    ('Konstantinos Mikellidis', 'Obstetrics/ Gynecology', 'Paphos', 'https://maps.app.goo.gl/QJCGaSnxVDM94KWw5'),
    ('Anastasios Tranoulis', 'Gynecologic Oncology', 'Nicosia', 'https://maps.app.goo.gl/wt1Hd9eu3mSvtv868'),
    ('Dimitrios Grigoriou', 'Obstetrics/ Gynecology', 'Nicosia', 'https://maps.app.goo.gl/D8qLhojiSP8rcKje6'),
    ('Maria Gavrilina', 'Obstetrics/ Gynecology', 'Nicosia', 'https://maps.app.goo.gl/LcJFMjjT6R5XfEja8'),
    ('Evangelia Andreou', 'Obstetrics/ Gynecology', 'Nicosia', 'https://maps.app.goo.gl/8FgwFPGdKwn225z78'),
    ('Chris Liassides', 'Obstetrics/ Gynecology', 'Nicosia', 'https://maps.app.goo.gl/HF1ERtQThAzKRrps8'),
    ('Nikoletta Chatziapostolou', 'Obstetrics/ Gynecology', 'Larnaca', 'https://maps.app.goo.gl/LKySTscsSZV3upNh6')
) as v(name, specialty, district, address_maps_link)
where not exists (
  select 1
  from public.directory_manual d
  where lower(d.name) = lower(v.name)
    and d.is_archived = false
);

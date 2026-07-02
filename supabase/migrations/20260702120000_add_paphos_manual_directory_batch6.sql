-- Paphos manual directory batch 6.
-- Charis Leonidou was in an early seed but removed by later curation migrations — insert fresh.
-- New: Maya, Giorgos Leonidou, Margaritas, Katerina Kkese.

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
      'Charis Leonidou',
      'Dentistry',
      'Paphos',
      'https://maps.app.goo.gl/VzfpSoNMQFK3eZ6X7'
    ),
    (
      'Maya',
      'Holistic Cosmetology',
      'Paphos',
      'https://maps.google.com/?q=Poseidonos+Ave+47,+Limnaria+Westpark,+Paphos+8042,+Cyprus'
    ),
    (
      'Giorgos Leonidou',
      'Dentistry',
      'Paphos',
      'https://maps.app.goo.gl/ZHqmazPbuwKXsdzr9'
    ),
    (
      'Margaritas',
      'Laser & Medical Aesthetics',
      'Paphos',
      'https://maps.google.com/?q=Margaritas+LASER+Beauty+Lab,+Vasilikou+33,+Anavargos,+Paphos+8026,+Cyprus'
    ),
    (
      'Katerina Kkese',
      'Gynecology',
      'Paphos',
      'https://maps.google.com/?q=Evangelismos+Private+Hospital,+87+Vasileos+Constantinou+XIII,+Paphos+8021,+Cyprus'
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

insert into public.directory_manual (
  name,
  specialty,
  district,
  address_maps_link
)
select
  'Valentina Oflidou',
  'Dermatology',
  'Paphos',
  'https://maps.app.goo.gl/RDejcWME7Xr6tZtM6'
where not exists (
  select 1
  from public.directory_manual
  where lower(name) = lower('Valentina Oflidou')
    and is_archived = false
);

-- Append Savvas Themistocleous (Maven Physiotherapy & Rehabilitation Centre, Paphos).

insert into public.directory_manual (
  name,
  specialty,
  district,
  address_maps_link,
  phone,
  latitude,
  longitude
)
select
  'Savvas Themistocleous',
  'Physiotherapy & Rehabilitation',
  'Paphos'::public.cyprus_district,
  'https://maps.google.com/?cid=13841722789540947871',
  '99 999840',
  34.7739086,
  32.4422369
where not exists (
  select 1
  from public.directory_manual d
  where d.is_archived = false
    and (
      lower(d.name) = lower('Savvas Themistocleous')
      or d.address_maps_link = 'https://maps.google.com/?cid=13841722789540947871'
    )
);

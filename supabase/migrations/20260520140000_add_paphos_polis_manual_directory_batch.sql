-- Curated manual directory batch (Polis / Paphos area) from patient-sourced Google listings.
-- Name field: person only (strip clinic/brand text, Dr prefix, ratings). Specialty stays separate.
-- Duplicate guard: skip when name or maps link already exists.

update public.directory_manual
set
  specialty = 'Gynecology',
  district = 'Paphos'::public.cyprus_district,
  address_maps_link = 'https://maps.app.goo.gl/EzZ3KWw9d9gNwYd67',
  updated_at = now()
where is_archived = false
  and lower(name) = lower('Andreas Matheou');

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
      'Athanasios Athanasiou',
      'General Practice',
      'Paphos',
      'https://maps.app.goo.gl/MC3UrETpvw2wVfKXA'
    ),
    (
      'Polydorou',
      'General Practice',
      'Paphos',
      'https://maps.app.goo.gl/jFXYoexJ88J4mFoG6'
    ),
    (
      'Maria Vasiliadou',
      'General Practice',
      'Paphos',
      'https://maps.app.goo.gl/rYYTvfzioUGueZmz8'
    ),
    (
      'Stavroula Chrysostomou',
      'Ophthalmology',
      'Paphos',
      'https://maps.app.goo.gl/YRPxjob9uQGayUaU8'
    ),
    (
      'Andronikos',
      'Speech Therapy',
      'Paphos',
      'https://maps.app.goo.gl/tichBSfGwdiKUj5U8'
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

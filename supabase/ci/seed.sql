-- Synthetic directory seed for the CI Supabase stack (scripts/ci-db/load.mjs).
-- Fake people and clinics only: no real practitioner data, no logins, no appointments.
-- Two unregistered listings per district x specialty below, each with its own clinic,
-- so every footer quick link (city x Dentists / Dermatologists / Physiotherapists)
-- has results. Specs that need registered professionals create their own.
-- Phones use +357 00 …, which no Cyprus number starts with.

with
  districts(district, lat, lng) as (
    values
      ('Nicosia'::public.cyprus_district, 35.1725, 33.3650),
      ('Limassol', 34.6841, 33.0379),
      ('Paphos', 34.7720, 32.4297),
      ('Larnaca', 34.9229, 33.6233),
      ('Famagusta', 35.0400, 33.9800)
  ),
  wanted(slug) as (
    values ('dentist'), ('dermato-venereology'), ('physiotherapist'), ('gynecology'),
           ('paediatrics'), ('cardiology'), ('otorhinolaryngology')
  ),
  specs as (
    select s.id, s.name, s.slug, row_number() over (order by s.slug) as n
    from public.specialties s join wanted w using (slug)
  ),
  first_names(n, first_name) as (
    values (1, 'Eleni'), (2, 'Christos'), (3, 'Maria'), (4, 'Andreas'), (5, 'Sofia'),
           (6, 'Nikos'), (7, 'Anna'), (8, 'Giorgos'), (9, 'Katerina'), (10, 'Petros')
  ),
  last_names(n, last_name) as (
    values (1, 'Demetriou'), (2, 'Charalambous'), (3, 'Kyriakou'), (4, 'Ioannou'), (5, 'Savva'),
           (6, 'Hadjipetrou'), (7, 'Loizou'), (8, 'Panayiotou'), (9, 'Stylianou'), (10, 'Michael')
  ),
  rows as (
    select
      d.district, d.lat, d.lng, sp.id as specialty_id, sp.name as specialty_name, sp.slug as specialty_slug,
      k,
      row_number() over (order by d.district, sp.slug, k) as seq
    from districts d cross join specs sp cross join generate_series(1, 2) as k
  ),
  people as (
    select
      r.*,
      md5('ci-pro-' || r.seq)::uuid as professional_id,
      md5('ci-clinic-' || r.seq)::uuid as clinic_id,
      f.first_name || ' ' || l.last_name as name
    from rows r
    join first_names f on f.n = 1 + (r.seq % 10)
    join last_names l on l.n = 1 + ((r.seq / 10) % 10)
  ),
  ins_clinics as (
    insert into public.clinics (id, name, slug, district, town, address, phone, latitude, longitude)
    select
      clinic_id,
      name || ' ' || specialty_name || ' Clinic',
      'ci-clinic-' || seq,
      district,
      district::text,
      seq || ' Synthetic Street, ' || district::text,
      '+35700' || lpad(seq::text, 6, '0'),
      lat + seq * 0.001,
      lng + seq * 0.001
    from people
    returning id
  ),
  ins_pros as (
    -- Location lives on the clinic, through the link below (Point E5).
    insert into public.professionals (
      id, name, slug, languages, is_gesy, is_archived, is_registered, is_test_profile
    )
    select
      professional_id,
      name,
      lower(replace(name, ' ', '-')) || '-' || specialty_slug || '-' || seq,
      array['Greek', 'English'],
      seq % 2 = 0,
      false, false, false
    from people
    where clinic_id in (select id from ins_clinics)
    returning id
  ),
  ins_links as (
    insert into public.professional_clinics (professional_id, clinic_id, is_primary, sort_order)
    select professional_id, clinic_id, true, 0
    from people
    where professional_id in (select id from ins_pros)
    returning professional_id
  )
insert into public.professional_specialties (professional_id, specialty, specialty_id, is_approved)
select professional_id, specialty_name, specialty_id, true
from people
where professional_id in (select professional_id from ins_links);

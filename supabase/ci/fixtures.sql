-- Fixture doctor for the booking and account lanes (scripts/ci-db/fixtures.mjs).
-- :auth_user_id is the login fixtures.mjs creates through the local Auth API first.
-- Mirrors the Testing profile the specs were written against: registered, verified,
-- bookable Monday–Friday 09:00–18:00 at one Larnaca clinic, one service, Neurology.
--
-- Goes through the same triggers as a real sign-up: inserting a registered professional
-- creates its settings and primary location (paused, as for anyone new), and the
-- location is mirrored into professional_clinics. The update below then fills in the
-- clinic and opens bookings, and the triggers copy that onto the clinic link and settings.

\set ON_ERROR_STOP on

insert into public.professionals (
  id, name, slug, district, town, phone, email, registration_email, mobile_number, languages,
  is_gesy, clinic_address, latitude, longitude, finder_visible, is_archived, is_registered,
  is_test_profile, auth_user_id, status, subscription_tier,
  trial_notice_seen_at, pro_access_until
)
values (
  md5('ci-fixture-andreas-nikos')::uuid, :'name', :'slug', 'Larnaca', 'Larnaca', '+35700999002',
  :'email', :'email', '+35700999003', :'languages'::text[], true, '1 Fixture Street, Larnaca',
  34.9229, 33.6233, true, false, true, true, :'auth_user_id'::uuid, 'verified', 'founder',
  now(), now() + interval '1 year'
);

update public.doctor_locations
set
  district = 'Larnaca',
  town = 'Larnaca',
  clinic_address = '1 Fixture Street, Larnaca',
  latitude = 34.9229,
  longitude = 33.6233,
  pause_online_bookings = false,
  monday = true, tuesday = true, wednesday = true, thursday = true, friday = true,
  saturday = false, sunday = false,
  start_time = '09:00',
  end_time = '18:00',
  slot_duration_minutes = 30,
  weekly_schedule = jsonb_build_object(
    'monday',    jsonb_build_object('enabled', true,  'start_time', '09:00:00', 'end_time', '18:00:00'),
    'tuesday',   jsonb_build_object('enabled', true,  'start_time', '09:00:00', 'end_time', '18:00:00'),
    'wednesday', jsonb_build_object('enabled', true,  'start_time', '09:00:00', 'end_time', '18:00:00'),
    'thursday',  jsonb_build_object('enabled', true,  'start_time', '09:00:00', 'end_time', '18:00:00'),
    'friday',    jsonb_build_object('enabled', true,  'start_time', '09:00:00', 'end_time', '18:00:00'),
    'saturday',  jsonb_build_object('enabled', false, 'start_time', '09:00:00', 'end_time', '18:00:00'),
    'sunday',    jsonb_build_object('enabled', false, 'start_time', '09:00:00', 'end_time', '18:00:00')
  )
where doctor_id = md5('ci-fixture-andreas-nikos')::uuid and is_primary;

insert into public.doctor_services (doctor_id, name, price)
values (md5('ci-fixture-andreas-nikos')::uuid, 'Neurology consultation', 40);

insert into public.professional_specialties (professional_id, specialty, specialty_id, license_number, is_approved)
select md5('ci-fixture-andreas-nikos')::uuid, s.name, s.id, 'CI-NEURO-0001', true
from public.specialties s
where s.name = :'specialty';

-- Fail the load (not a spec, minutes later) if the triggers did not leave a bookable clinic.
do $$
begin
  if not exists (
    select 1
    from public.professional_clinics pc
    join public.clinics c on c.id = pc.clinic_id
    join public.professional_settings ps on ps.professional_id = pc.professional_id
    where pc.professional_id = md5('ci-fixture-andreas-nikos')::uuid
      and pc.is_primary and not pc.pause_online_bookings and not ps.pause_online_bookings
      and nullif(btrim(c.address), '') is not null
  ) then
    raise exception 'Fixture doctor andreas-nikos is not bookable after the load.';
  end if;
end $$;

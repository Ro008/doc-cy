-- Fixture doctor for the booking and account lanes (scripts/ci-db/fixtures.mjs).
-- :auth_user_id is the login fixtures.mjs creates through the local Auth API first.
-- Mirrors the Testing profile the specs were written against: registered, verified,
-- bookable Monday–Friday 09:00–18:00 at one Larnaca clinic, one service, Neurology.
--
-- Inserting a registered professional creates its account settings through the same
-- trigger as a real sign-up. The clinic and its primary link are then written the way an
-- approved registration writes them (clinics + professional_clinics), open for bookings:
-- the schedule and the pause live on the link (Point E6).

\set ON_ERROR_STOP on

insert into public.professionals (
  id, name, slug, email, registration_email, mobile_number, languages,
  is_gesy, is_archived, is_registered,
  is_test_profile, auth_user_id, status, subscription_tier,
  trial_notice_seen_at, pro_access_until
)
values (
  md5('ci-fixture-andreas-nikos')::uuid, :'name', :'slug',
  :'email', :'email', '+35700999003', :'languages'::text[], true,
  false, true, true, :'auth_user_id'::uuid, 'verified', 'founder',
  now(), now() + interval '1 year'
);

insert into public.clinics (id, name, slug, district, town, address, latitude, longitude, phone)
values (
  md5('ci-fixture-andreas-nikos-clinic')::uuid, 'CI Fixture Clinic Larnaca', 'ci-fixture-clinic-larnaca',
  'Larnaca', 'Larnaca', '1 Fixture Street, Larnaca', 34.9229, 33.6233, '24999002'
);

insert into public.professional_clinics (
  professional_id, clinic_id, is_primary, sort_order, pause_online_bookings,
  monday, tuesday, wednesday, thursday, friday, saturday, sunday,
  start_time, end_time, slot_duration_minutes, weekly_schedule
)
values (
  md5('ci-fixture-andreas-nikos')::uuid, md5('ci-fixture-andreas-nikos-clinic')::uuid, true, 0, false,
  true, true, true, true, true, false, false,
  '09:00', '18:00', 30,
  jsonb_build_object(
    'monday',    jsonb_build_object('enabled', true,  'start_time', '09:00:00', 'end_time', '18:00:00'),
    'tuesday',   jsonb_build_object('enabled', true,  'start_time', '09:00:00', 'end_time', '18:00:00'),
    'wednesday', jsonb_build_object('enabled', true,  'start_time', '09:00:00', 'end_time', '18:00:00'),
    'thursday',  jsonb_build_object('enabled', true,  'start_time', '09:00:00', 'end_time', '18:00:00'),
    'friday',    jsonb_build_object('enabled', true,  'start_time', '09:00:00', 'end_time', '18:00:00'),
    'saturday',  jsonb_build_object('enabled', false, 'start_time', '09:00:00', 'end_time', '18:00:00'),
    'sunday',    jsonb_build_object('enabled', false, 'start_time', '09:00:00', 'end_time', '18:00:00')
  )
);

insert into public.doctor_services (doctor_id, name, price)
values (md5('ci-fixture-andreas-nikos')::uuid, 'Neurology consultation', 40);

insert into public.professional_specialties (professional_id, specialty, specialty_id, license_number, is_approved)
select md5('ci-fixture-andreas-nikos')::uuid, s.name, s.id, 'CI-NEURO-0001', true
from public.specialties s
where s.name = :'specialty';

-- Fail the load (not a spec, minutes later) if the fixture is not a bookable clinic.
do $$
begin
  if not exists (
    select 1
    from public.professional_clinics pc
    join public.clinics c on c.id = pc.clinic_id
    join public.professional_settings ps on ps.professional_id = pc.professional_id
    where pc.professional_id = md5('ci-fixture-andreas-nikos')::uuid
      and pc.is_primary and not pc.pause_online_bookings
      and nullif(btrim(c.address), '') is not null
  ) then
    raise exception 'Fixture doctor andreas-nikos is not bookable after the load.';
  end if;
end $$;

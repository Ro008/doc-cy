-- Registration redesign, step 1 (Point D3b core): an appointment's clinic is the
-- professional's clinic link, professional_clinics, not doctor_locations.
--
-- Approving a registration will create only clinics + professional_clinics rows, so a
-- booking must be able to reference a join row that has no doctor_locations twin.
-- D1's mirror gives every located doctor_locations row a join row with the SAME id,
-- so existing appointment location ids stay valid; the check below refuses to run if
-- any does not. Clinics still being set up (the addressless "bridge" rows) have no
-- join row and are no longer bookable; the booking routes refuse them first.
--
-- ON DELETE SET NULL as before: leaving a clinic keeps the appointment.
-- Idempotent: re-running drops and re-adds the same constraint.

do $$
declare
  v_orphans bigint;
begin
  if to_regclass('public.professional_clinics') is null then
    raise exception 'public.professional_clinics is missing';
  end if;

  select count(*) into v_orphans
  from public.appointments a
  where a.location_id is not null
    and not exists (select 1 from public.professional_clinics pc where pc.id = a.location_id);

  if v_orphans > 0 then
    raise exception 'appointments with a location_id that has no professional_clinics row: %', v_orphans;
  end if;
end $$;

alter table public.appointments drop constraint if exists appointments_location_id_fkey;

alter table public.appointments
  add constraint appointments_location_id_fkey
  foreign key (location_id) references public.professional_clinics (id) on delete set null;

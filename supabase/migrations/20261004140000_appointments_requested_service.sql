-- The service a patient may ask for when booking (user, 2026-10-04). Optional, one of the
-- professional's own professional_services. The picker UI is built on another branch.
--
-- Two columns on appointments and on appointment_drafts (so the choice survives the
-- email-confirmation step):
-- - professional_service_id: the service; set null if she deletes it, so the visit stays.
-- - service_name: a copy of the name taken at booking, so renaming or deleting the service
--   later doesn't change what was asked (like the patient_* columns).
-- A trigger refuses another professional's service and fills service_name from the service,
-- whatever the caller sent. Additive only: safe before or after the merge.

alter table public.appointments add column if not exists professional_service_id uuid;
alter table public.appointments add column if not exists service_name text;
alter table public.appointment_drafts add column if not exists professional_service_id uuid;
alter table public.appointment_drafts add column if not exists service_name text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'appointments_professional_service_id_fkey') then
    alter table public.appointments
      add constraint appointments_professional_service_id_fkey
      foreign key (professional_service_id) references public.professional_services (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'appointment_drafts_professional_service_id_fkey') then
    alter table public.appointment_drafts
      add constraint appointment_drafts_professional_service_id_fkey
      foreign key (professional_service_id) references public.professional_services (id) on delete set null;
  end if;
  -- A chosen service always has its name (the trigger fills it); a name alone means the
  -- service was deleted since.
  if not exists (select 1 from pg_constraint where conname = 'appointments_service_name_check') then
    alter table public.appointments
      add constraint appointments_service_name_check
      check ((professional_service_id is null or service_name is not null) and char_length(service_name) <= 200);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'appointment_drafts_service_name_check') then
    alter table public.appointment_drafts
      add constraint appointment_drafts_service_name_check
      check ((professional_service_id is null or service_name is not null) and char_length(service_name) <= 200);
  end if;
end
$$;

-- For ON DELETE SET NULL when a service is deleted.
create index if not exists appointments_professional_service_id_idx
  on public.appointments (professional_service_id) where professional_service_id is not null;
create index if not exists appointment_drafts_professional_service_id_idx
  on public.appointment_drafts (professional_service_id) where professional_service_id is not null;

create or replace function public.appointments_requested_service_check()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare
  v_name text;
begin
  if new.professional_service_id is null then
    return new;
  end if;
  select s.name into v_name
  from public.professional_services s
  where s.id = new.professional_service_id and s.professional_id = new.professional_id;
  if v_name is null then
    raise exception 'That service isn''t offered by this professional.'
      using errcode = '23514';
  end if;
  new.service_name := v_name;
  return new;
end
$fn$;

revoke all on function public.appointments_requested_service_check() from public, anon, authenticated;

drop trigger if exists appointments_requested_service_check on public.appointments;
create trigger appointments_requested_service_check
  before insert or update of professional_service_id, professional_id on public.appointments
  for each row execute function public.appointments_requested_service_check();

drop trigger if exists appointment_drafts_requested_service_check on public.appointment_drafts;
create trigger appointment_drafts_requested_service_check
  before insert or update of professional_service_id, professional_id on public.appointment_drafts
  for each row execute function public.appointments_requested_service_check();

-- Settings → Clinics, stage 3 (user, 2026-10-11): booking limits per clinic, the
-- cancellation deadline each visit keeps, and the recording of a clinic's hours,
-- limits and online-booking switch.
--
-- 1. How far ahead patients book, the minimum notice and the online cancellation
--    deadline belong to each clinic: three columns on professional_clinics, filled once
--    from the professional's own values (professional_settings).
-- 2. Until the old professional_settings columns are dropped (after the merge), code
--    that still writes them reaches every clinic of that professional.
-- 3. A visit keeps the cancellation deadline it was confirmed with
--    (appointments.patient_cancel_notice_hours; older visits have none and read the
--    clinic's value).
-- 4. Three recorded request types and their functions: a change is saved and recorded
--    together, and saving the same values records nothing.
--
-- Backward-compatible: nothing the running code uses is renamed or dropped.

-- 1. The limits on each clinic link.
do $cols$
begin
  if not exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'professional_clinics'
        and column_name = 'booking_horizon_days') then
    alter table public.professional_clinics
      add column booking_horizon_days integer not null default 90,
      add column minimum_notice_hours integer not null default 2,
      add column patient_cancel_notice_hours integer not null default 12;

    -- Once, with the columns: every clinic of a professional starts with her values.
    if exists (select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'professional_settings'
          and column_name = 'booking_horizon_days') then
      update public.professional_clinics pc
      set booking_horizon_days = case when ps.booking_horizon_days in (14, 30, 90, 180)
              then ps.booking_horizon_days else 90 end,
          minimum_notice_hours = case when ps.minimum_notice_hours in (1, 2, 4, 12, 24, 48, 72, 168)
              then ps.minimum_notice_hours else 2 end,
          patient_cancel_notice_hours = case when ps.patient_cancel_notice_hours in (12, 24, 48)
              then ps.patient_cancel_notice_hours else 12 end
      from public.professional_settings ps
      where ps.professional_id = pc.professional_id
        and (ps.booking_horizon_days, ps.minimum_notice_hours, ps.patient_cancel_notice_hours)
            is distinct from (90, 2, 12);
    end if;
  end if;
end
$cols$;

alter table public.professional_clinics
  drop constraint if exists professional_clinics_booking_horizon_days_check,
  drop constraint if exists professional_clinics_minimum_notice_hours_check,
  drop constraint if exists professional_clinics_cancel_notice_check;
alter table public.professional_clinics
  add constraint professional_clinics_booking_horizon_days_check
    check (booking_horizon_days in (14, 30, 90, 180)),
  add constraint professional_clinics_minimum_notice_hours_check
    check (minimum_notice_hours in (1, 2, 4, 12, 24, 48, 72, 168)),
  add constraint professional_clinics_cancel_notice_check
    check (patient_cancel_notice_hours in (12, 24, 48));

comment on column public.professional_clinics.booking_horizon_days is
  'How far ahead patients can book this professional at this clinic (14 / 30 / 90 / 180 days).';
comment on column public.professional_clinics.minimum_notice_hours is
  'The shortest notice for an online booking at this clinic, in hours.';
comment on column public.professional_clinics.patient_cancel_notice_hours is
  'Until how many hours before a visit at this clinic the patient can cancel online (12 / 24 / 48). A confirmed visit keeps its own copy (appointments.patient_cancel_notice_hours).';

-- 2. Old code still writes the professional's own limits: they reach her clinics.
create or replace function public.professional_settings_limits_to_clinics()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.professional_clinics pc
  set booking_horizon_days = case when new.booking_horizon_days in (14, 30, 90, 180)
          then new.booking_horizon_days else pc.booking_horizon_days end,
      minimum_notice_hours = case when new.minimum_notice_hours in (1, 2, 4, 12, 24, 48, 72, 168)
          then new.minimum_notice_hours else pc.minimum_notice_hours end,
      patient_cancel_notice_hours = case when new.patient_cancel_notice_hours in (12, 24, 48)
          then new.patient_cancel_notice_hours else pc.patient_cancel_notice_hours end,
      updated_at = now()
  where pc.professional_id = new.professional_id;
  return null;
end
$$;

comment on function public.professional_settings_limits_to_clinics() is
  'Temporary, until professional_settings loses its three limit columns: a change of them (old code) is copied to every clinic of that professional.';
revoke all on function public.professional_settings_limits_to_clinics() from public, anon, authenticated;

do $sync$
begin
  drop trigger if exists professional_settings_limits_to_clinics on public.professional_settings;
  if exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'professional_settings'
        and column_name = 'booking_horizon_days') then
    create trigger professional_settings_limits_to_clinics
      after update of booking_horizon_days, minimum_notice_hours, patient_cancel_notice_hours
      on public.professional_settings
      for each row
      when ((old.booking_horizon_days, old.minimum_notice_hours, old.patient_cancel_notice_hours)
            is distinct from
            (new.booking_horizon_days, new.minimum_notice_hours, new.patient_cancel_notice_hours))
      execute function public.professional_settings_limits_to_clinics();
  end if;
end
$sync$;

-- 3. A visit keeps the cancellation deadline it was confirmed with.
alter table public.appointments
  add column if not exists patient_cancel_notice_hours integer;
alter table public.appointments
  drop constraint if exists appointments_cancel_notice_check;
alter table public.appointments
  add constraint appointments_cancel_notice_check
    check (patient_cancel_notice_hours is null or patient_cancel_notice_hours in (12, 24, 48));
comment on column public.appointments.patient_cancel_notice_hours is
  'The online cancellation deadline (hours before the visit) this visit was confirmed with, copied from the clinic link at confirmation. Empty for a visit confirmed before 2026-10 or not confirmed yet: the clinic''s current value applies.';

create or replace function public.appointments_keep_cancel_notice()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.patient_cancel_notice_hours is null
     and upper(new.status::text) = 'CONFIRMED'
     and (tg_op = 'INSERT' or upper(old.status::text) is distinct from 'CONFIRMED') then
    select pc.patient_cancel_notice_hours into new.patient_cancel_notice_hours
    from public.professional_clinics pc
    where pc.professional_id = new.professional_id and pc.clinic_id = new.clinic_id;
  end if;
  return new;
end
$$;

comment on function public.appointments_keep_cancel_notice() is
  'When a visit becomes confirmed, copies the clinic link''s online cancellation deadline onto it, so a later change in Settings leaves the visit alone.';
revoke all on function public.appointments_keep_cancel_notice() from public, anon, authenticated;

drop trigger if exists appointments_keep_cancel_notice on public.appointments;
create trigger appointments_keep_cancel_notice
  before insert or update of status on public.appointments
  for each row execute function public.appointments_keep_cancel_notice();

-- 4. The three recorded types.
insert into public.request_types (name, requires_approval, is_edit, description)
values
  (
    'professional_clinic_hours_change',
    false,
    true,
    'The professional changed her hours at a clinic in Settings: open days, hours, breaks or slot length. details: link_id, clinic_id, clinic_name and the new week (weekly_schedule, slot_duration_minutes, day columns). Recorded at once; before_snapshot keeps the week before.'
  ),
  (
    'professional_clinic_limits_change',
    false,
    true,
    'The professional changed the booking limits of a clinic in Settings. details: link_id, clinic_id, clinic_name, booking_horizon_days, minimum_notice_hours, patient_cancel_notice_hours. Recorded at once; before_snapshot keeps the limits before.'
  ),
  (
    'professional_clinic_online_booking_change',
    false,
    true,
    'The professional switched online booking on or off at a clinic. details: link_id, clinic_id, clinic_name, online_booking. Recorded at once; before_snapshot keeps the switch before.'
  )
on conflict (name) do update set description = excluded.description;

-- 5. request_submit: the snapshot step of the three types.
create or replace function public.request_submit(
  p_request_type text,
  p_professional_id uuid,
  p_details jsonb,
  p_details_version smallint default 1
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_type public.request_types%rowtype;
  v_name text;
  v_email text;
  v_registered boolean;
  v_new_name text;
  v_spec_slug text;
  v_snapshot jsonb;
  v_status text;
  v_id uuid;
begin
  select * into v_type from public.request_types where name = p_request_type;
  if not found then
    raise exception 'unknown request type %', p_request_type using errcode = '22023';
  end if;
  if p_details is null or jsonb_typeof(p_details) <> 'object' then
    raise exception 'request details must be a JSON object' using errcode = '22023';
  end if;
  if p_details_version is null or p_details_version < 1 then
    raise exception 'details_version must be at least 1' using errcode = '22023';
  end if;

  select name, coalesce(registration_email, email), is_registered into v_name, v_email, v_registered
  from public.professionals where id = p_professional_id;
  if not found then
    raise exception 'professional % not found', p_professional_id using errcode = 'P0002';
  end if;

  if v_type.is_edit then
    -- Each edit type captures the live values it changes here (its "before"),
    -- added with the type, e.g. if p_request_type = 'clinic_edit' then ... end if;
    if p_request_type = 'professional_mobile_change' then
      select jsonb_build_object('mobile_number', mobile_number) into v_snapshot
      from public.professionals where id = p_professional_id;
    elsif p_request_type = 'professional_mobile_visibility_change' then
      v_snapshot := jsonb_build_object(
        'show_mobile_on_profile',
        coalesce(
          (select show_mobile_on_profile from public.professional_settings
           where professional_id = p_professional_id),
          false
        )
      );
    elsif p_request_type in ('professional_name_change', 'professional_photo_change', 'professional_photo_removal') then
      if v_registered is not true then
        raise exception 'professional % has not signed up', p_professional_id using errcode = '22023';
      end if;
      if p_request_type = 'professional_name_change' then
        v_new_name := btrim(coalesce(p_details ->> 'name', ''));
        if v_new_name = '' or length(v_new_name) > 80 then
          raise exception 'a name change needs a name of 1 to 80 characters' using errcode = '22023';
        end if;
        if v_new_name = btrim(coalesce(v_name, '')) then
          raise exception 'that is already her name' using errcode = '22023';
        end if;
        select jsonb_build_object('name', name, 'slug', slug) into v_snapshot
        from public.professionals where id = p_professional_id;
      else
        if p_request_type = 'professional_photo_change'
           and btrim(coalesce(p_details ->> 'photo_path', '')) = '' then
          raise exception 'a photo change needs photo_path' using errcode = '22023';
        end if;
        select jsonb_build_object('avatar_url', avatar_url) into v_snapshot
        from public.professionals where id = p_professional_id;
      end if;
    elsif p_request_type = 'professional_gesy_change' then
      select jsonb_build_object('is_gesy', coalesce(is_gesy, false)) into v_snapshot
      from public.professionals where id = p_professional_id;
    elsif p_request_type in ('professional_specialty_add', 'professional_specialty_removal') then
      if v_registered is not true then
        raise exception 'professional % has not signed up', p_professional_id using errcode = '22023';
      end if;
      v_spec_slug := public.specialty_slug(coalesce(p_details ->> 'name', ''));
      if btrim(coalesce(p_details ->> 'name', '')) = '' or v_spec_slug is null or v_spec_slug = 'all' then
        raise exception 'a specialty request needs a specialty' using errcode = '22023';
      end if;
      if p_request_type = 'professional_specialty_add' then
        if btrim(coalesce(p_details ->> 'license_number', '')) = ''
           or length(btrim(p_details ->> 'license_number')) > 80 then
          raise exception 'a specialty request needs a licence number of 1 to 80 characters'
            using errcode = '22023';
        end if;
        if exists (
          select 1 from public.professional_specialties ps
          join public.specialties s on s.id = ps.specialty_id
          where ps.professional_id = p_professional_id and s.slug = v_spec_slug
        ) then
          raise exception 'she already has this specialty' using errcode = '22023';
        end if;
        if (select count(*) from public.professional_specialties ps
            where ps.professional_id = p_professional_id) >= 5 then
          raise exception 'a professional has at most 5 specialties' using errcode = '22023';
        end if;
        select jsonb_build_object('specialties', coalesce(jsonb_agg(
            jsonb_build_object('name', ps.specialty, 'license_number', ps.license_number)
            order by ps.specialty), '[]'::jsonb))
        into v_snapshot
        from public.professional_specialties ps where ps.professional_id = p_professional_id;
      else
        select jsonb_build_object('name', ps.specialty, 'license_number', ps.license_number)
        into v_snapshot
        from public.professional_specialties ps
        join public.specialties s on s.id = ps.specialty_id
        where ps.professional_id = p_professional_id and s.slug = v_spec_slug;
        if v_snapshot is null then
          raise exception 'she does not have this specialty' using errcode = 'P0002';
        end if;
      end if;
    elsif p_request_type in (
      'professional_patients_seen_change', 'professional_bio_change', 'professional_languages_change',
      'professional_qualification_add', 'professional_qualification_removal'
    ) then
      if v_registered is not true then
        raise exception 'professional % has not signed up', p_professional_id using errcode = '22023';
      end if;
      select case p_request_type
               when 'professional_patients_seen_change' then jsonb_build_object('patients_seen', patients_seen)
               when 'professional_bio_change' then jsonb_build_object('bio', bio)
               when 'professional_languages_change' then jsonb_build_object('languages', to_jsonb(languages))
               else jsonb_build_object('qualifications', qualifications)
             end
      into v_snapshot
      from public.professionals where id = p_professional_id;
    elsif p_request_type in (
      'professional_service_add', 'professional_service_change', 'professional_service_removal'
    ) then
      if v_registered is not true then
        raise exception 'professional % has not signed up', p_professional_id using errcode = '22023';
      end if;
      select jsonb_build_object('services', coalesce(jsonb_agg(
          jsonb_build_object('id', s.id, 'name', s.name, 'price', s.price)
          order by s.created_at, s.id), '[]'::jsonb))
      into v_snapshot
      from public.professional_services s where s.professional_id = p_professional_id;
    elsif p_request_type = 'professional_email_change' then
      if v_registered is not true then
        raise exception 'professional % has not signed up', p_professional_id using errcode = '22023';
      end if;
      select jsonb_build_object('registration_email', registration_email) into v_snapshot
      from public.professionals where id = p_professional_id;
    elsif p_request_type in ('professional_clinic_join', 'professional_clinic_leave') then
      if v_registered is not true then
        raise exception 'professional % has not signed up', p_professional_id using errcode = '22023';
      end if;
      if p_request_type = 'professional_clinic_join' then
        select jsonb_build_object('clinics', coalesce(jsonb_agg(
            jsonb_build_object('clinic_id', c.id, 'clinic_name', c.name)
            order by pc.sort_order, pc.created_at, pc.id), '[]'::jsonb))
        into v_snapshot
        from public.professional_clinics pc
        join public.clinics c on c.id = pc.clinic_id
        where pc.professional_id = p_professional_id;
      else
        select jsonb_build_object('settings', to_jsonb(pc)) into v_snapshot
        from public.professional_clinics pc
        where pc.professional_id = p_professional_id
          and pc.clinic_id::text = p_details ->> 'clinic_id';
        if v_snapshot is null then
          raise exception 'she does not work at this clinic' using errcode = 'P0002';
        end if;
      end if;
    elsif p_request_type = 'professional_clinic_add' then
      if v_registered is not true then
        raise exception 'professional % has not signed up', p_professional_id using errcode = '22023';
      end if;
      perform public.professional_clinic_new_check(p_details);
      if (select count(*) from public.professional_clinics pc
          join public.clinics c on c.id = pc.clinic_id
          where pc.professional_id = p_professional_id and not c.is_archived) >= 5 then
        raise exception 'a professional has at most 5 clinics' using errcode = '23514';
      end if;
      select jsonb_build_object('clinics', coalesce(jsonb_agg(
          jsonb_build_object('clinic_id', c.id, 'clinic_name', c.name)
          order by pc.sort_order, pc.created_at, pc.id), '[]'::jsonb))
      into v_snapshot
      from public.professional_clinics pc
      join public.clinics c on c.id = pc.clinic_id
      where pc.professional_id = p_professional_id;
    elsif p_request_type = 'professional_clinic_details_change' then
      if v_registered is not true then
        raise exception 'professional % has not signed up', p_professional_id using errcode = '22023';
      end if;
      select jsonb_build_object(
        'name', c.name, 'address', c.address, 'district', c.district, 'town', c.town,
        'latitude', c.latitude, 'longitude', c.longitude, 'clinic_place_id', c.clinic_place_id,
        'phone', c.phone)
      into v_snapshot
      from public.professional_clinics pc
      join public.clinics c on c.id = pc.clinic_id
      where pc.professional_id = p_professional_id and not c.is_archived
        and pc.clinic_id::text = p_details ->> 'clinic_id';
      if v_snapshot is null then
        raise exception 'she does not work at this clinic' using errcode = 'P0002';
      end if;
      perform public.professional_clinic_changes_check(p_details -> 'changes', v_snapshot);
    elsif p_request_type in ('professional_clinic_hours_change', 'professional_clinic_limits_change',
                             'professional_clinic_online_booking_change') then
      if v_registered is not true then
        raise exception 'professional % has not signed up', p_professional_id using errcode = '22023';
      end if;
      select case p_request_type
          when 'professional_clinic_hours_change' then jsonb_build_object(
            'monday', pc.monday, 'tuesday', pc.tuesday, 'wednesday', pc.wednesday, 'thursday', pc.thursday,
            'friday', pc.friday, 'saturday', pc.saturday, 'sunday', pc.sunday,
            'start_time', pc.start_time, 'end_time', pc.end_time,
            'weekly_schedule', pc.weekly_schedule,
            'break_start', pc.break_start, 'break_end', pc.break_end,
            'slot_duration_minutes', pc.slot_duration_minutes)
          when 'professional_clinic_limits_change' then jsonb_build_object(
            'booking_horizon_days', pc.booking_horizon_days,
            'minimum_notice_hours', pc.minimum_notice_hours,
            'patient_cancel_notice_hours', pc.patient_cancel_notice_hours)
          else jsonb_build_object('online_booking', not pc.pause_online_bookings)
        end
      into v_snapshot
      from public.professional_clinics pc
      where pc.professional_id = p_professional_id
        and pc.id::text = p_details ->> 'link_id';
      if v_snapshot is null then
        raise exception 'she does not work at this clinic' using errcode = 'P0002';
      end if;
    end if;
    if v_snapshot is null then
      raise exception 'request type % has no snapshot step yet', p_request_type using errcode = '0A000';
    end if;
  end if;

  v_status := case when v_type.requires_approval then 'pending' else 'recorded' end;
  begin
    insert into public.request_log (
      request_type, status, details, details_version, before_snapshot,
      professional_id, requester_name, requester_email, decided_at
    )
    values (
      p_request_type, v_status, p_details, p_details_version, v_snapshot,
      p_professional_id, v_name, v_email, case when v_status = 'recorded' then now() end
    )
    returning id into v_id;
  exception
    when unique_violation then
      raise exception 'this professional already has a pending % request', p_request_type
        using errcode = '23505';
  end;
  return v_id;
end
$$;

-- 6. Her hours at a clinic. p_hours carries the columns as Settings computes them:
--    monday … sunday, start_time, end_time, weekly_schedule, break_start, break_end,
--    slot_duration_minutes. Returns the record's id, or null when nothing changed.
create or replace function public.professional_clinic_hours_set(
  p_professional_id uuid,
  p_link_id uuid,
  p_hours jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_pc public.professional_clinics%rowtype;
  v_clinic_name text;
  v_days boolean[];
  v_start time;
  v_end time;
  v_break_start time;
  v_break_end time;
  v_week jsonb;
  v_slot integer;
  v_id uuid;
  v_day text;
begin
  if p_hours is null or jsonb_typeof(p_hours) <> 'object'
     or jsonb_typeof(p_hours -> 'weekly_schedule') is distinct from 'object' then
    raise exception 'the hours need the week' using errcode = '22023';
  end if;
  v_week := p_hours -> 'weekly_schedule';
  foreach v_day in array array['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] loop
    if jsonb_typeof(p_hours -> v_day) is distinct from 'boolean'
       or jsonb_typeof(v_week -> v_day) is distinct from 'object' then
      raise exception 'the hours need every day of the week' using errcode = '22023';
    end if;
    v_days := v_days || (p_hours ->> v_day)::boolean;
  end loop;
  begin
    v_start := (p_hours ->> 'start_time')::time;
    v_end := (p_hours ->> 'end_time')::time;
    v_break_start := nullif(p_hours ->> 'break_start', '')::time;
    v_break_end := nullif(p_hours ->> 'break_end', '')::time;
    v_slot := (p_hours ->> 'slot_duration_minutes')::integer;
  exception when others then
    raise exception 'the hours hold a time or a slot length that cannot be read' using errcode = '22023';
  end;
  if v_start is null or v_end is null then
    raise exception 'the hours need a start and an end' using errcode = '22023';
  end if;
  if v_slot is null or v_slot < 5 or v_slot > 480 then
    raise exception 'a slot lasts 5 to 480 minutes' using errcode = '22023';
  end if;

  select * into v_pc from public.professional_clinics pc
  where pc.id = p_link_id and pc.professional_id = p_professional_id
  for update;
  if not found then
    raise exception 'she does not work at this clinic' using errcode = 'P0002';
  end if;

  if (v_pc.monday, v_pc.tuesday, v_pc.wednesday, v_pc.thursday, v_pc.friday, v_pc.saturday, v_pc.sunday,
      v_pc.start_time, v_pc.end_time, v_pc.break_start, v_pc.break_end, v_pc.slot_duration_minutes,
      v_pc.weekly_schedule)
     is not distinct from
     (v_days[1], v_days[2], v_days[3], v_days[4], v_days[5], v_days[6], v_days[7],
      v_start, v_end, v_break_start, v_break_end, v_slot, v_week) then
    return null;
  end if;

  select c.name into v_clinic_name from public.clinics c where c.id = v_pc.clinic_id;
  v_id := public.request_submit('professional_clinic_hours_change', p_professional_id,
    jsonb_build_object(
      'link_id', v_pc.id, 'clinic_id', v_pc.clinic_id, 'clinic_name', v_clinic_name,
      'monday', v_days[1], 'tuesday', v_days[2], 'wednesday', v_days[3], 'thursday', v_days[4],
      'friday', v_days[5], 'saturday', v_days[6], 'sunday', v_days[7],
      'start_time', v_start, 'end_time', v_end,
      'weekly_schedule', v_week,
      'break_start', v_break_start, 'break_end', v_break_end,
      'slot_duration_minutes', v_slot));
  update public.professional_clinics
  set monday = v_days[1], tuesday = v_days[2], wednesday = v_days[3], thursday = v_days[4],
      friday = v_days[5], saturday = v_days[6], sunday = v_days[7],
      start_time = v_start, end_time = v_end,
      weekly_schedule = v_week,
      break_start = v_break_start, break_end = v_break_end,
      slot_duration_minutes = v_slot,
      updated_at = now()
  where id = v_pc.id;
  return v_id;
end
$$;

-- 7. The booking limits of a clinic. A value left out (null) keeps what is there.
create or replace function public.professional_clinic_limits_set(
  p_professional_id uuid,
  p_link_id uuid,
  p_booking_horizon_days integer,
  p_minimum_notice_hours integer,
  p_patient_cancel_notice_hours integer
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_pc public.professional_clinics%rowtype;
  v_clinic_name text;
  v_horizon integer;
  v_notice integer;
  v_cancel integer;
  v_id uuid;
begin
  if p_booking_horizon_days is not null and p_booking_horizon_days not in (14, 30, 90, 180) then
    raise exception 'patients book 14, 30, 90 or 180 days ahead' using errcode = '22023';
  end if;
  if p_minimum_notice_hours is not null and p_minimum_notice_hours not in (1, 2, 4, 12, 24, 48, 72, 168) then
    raise exception 'that minimum notice is not on the list' using errcode = '22023';
  end if;
  if p_patient_cancel_notice_hours is not null and p_patient_cancel_notice_hours not in (12, 24, 48) then
    raise exception 'patients cancel online until 12, 24 or 48 hours before' using errcode = '22023';
  end if;

  select * into v_pc from public.professional_clinics pc
  where pc.id = p_link_id and pc.professional_id = p_professional_id
  for update;
  if not found then
    raise exception 'she does not work at this clinic' using errcode = 'P0002';
  end if;
  v_horizon := coalesce(p_booking_horizon_days, v_pc.booking_horizon_days);
  v_notice := coalesce(p_minimum_notice_hours, v_pc.minimum_notice_hours);
  v_cancel := coalesce(p_patient_cancel_notice_hours, v_pc.patient_cancel_notice_hours);
  if (v_horizon, v_notice, v_cancel)
     is not distinct from
     (v_pc.booking_horizon_days, v_pc.minimum_notice_hours, v_pc.patient_cancel_notice_hours) then
    -- Still refuse a listing that has not signed up, as request_submit would.
    if not exists (select 1 from public.professionals p where p.id = p_professional_id and p.is_registered) then
      raise exception 'professional % has not signed up', p_professional_id using errcode = '22023';
    end if;
    return null;
  end if;

  select c.name into v_clinic_name from public.clinics c where c.id = v_pc.clinic_id;
  v_id := public.request_submit('professional_clinic_limits_change', p_professional_id,
    jsonb_build_object(
      'link_id', v_pc.id, 'clinic_id', v_pc.clinic_id, 'clinic_name', v_clinic_name,
      'booking_horizon_days', v_horizon, 'minimum_notice_hours', v_notice,
      'patient_cancel_notice_hours', v_cancel));
  update public.professional_clinics
  set booking_horizon_days = v_horizon, minimum_notice_hours = v_notice,
      patient_cancel_notice_hours = v_cancel, updated_at = now()
  where id = v_pc.id;
  return v_id;
end
$$;

-- 8. The online-booking switch of a clinic (the server checks her access first).
create or replace function public.professional_clinic_online_booking_set(
  p_professional_id uuid,
  p_link_id uuid,
  p_online_booking boolean
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_pc public.professional_clinics%rowtype;
  v_clinic_name text;
  v_id uuid;
begin
  if p_online_booking is null then
    raise exception 'online booking is on or off' using errcode = '22023';
  end if;
  select * into v_pc from public.professional_clinics pc
  where pc.id = p_link_id and pc.professional_id = p_professional_id
  for update;
  if not found then
    raise exception 'she does not work at this clinic' using errcode = 'P0002';
  end if;
  if v_pc.pause_online_bookings = (not p_online_booking) then
    return null;
  end if;

  select c.name into v_clinic_name from public.clinics c where c.id = v_pc.clinic_id;
  v_id := public.request_submit('professional_clinic_online_booking_change', p_professional_id,
    jsonb_build_object(
      'link_id', v_pc.id, 'clinic_id', v_pc.clinic_id, 'clinic_name', v_clinic_name,
      'online_booking', p_online_booking));
  update public.professional_clinics
  set pause_online_bookings = not p_online_booking, updated_at = now()
  where id = v_pc.id;
  return v_id;
end
$$;

comment on function public.professional_clinic_hours_set(uuid, uuid, jsonb) is
  'The professional changes her hours at a clinic (days, hours, breaks, slot length): saved and recorded in request_log together; null when nothing changed. Service role only: the server checks the session first.';
comment on function public.professional_clinic_limits_set(uuid, uuid, integer, integer, integer) is
  'The professional changes the booking limits of a clinic: saved and recorded in request_log together; null when nothing changed. Service role only: the server checks the session first.';
comment on function public.professional_clinic_online_booking_set(uuid, uuid, boolean) is
  'The professional switches online booking on or off at a clinic: saved and recorded in request_log together; null when nothing changed. Service role only: the server checks the session and her access first.';

revoke all on function public.professional_clinic_hours_set(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.professional_clinic_limits_set(uuid, uuid, integer, integer, integer)
  from public, anon, authenticated;
revoke all on function public.professional_clinic_online_booking_set(uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.professional_clinic_hours_set(uuid, uuid, jsonb) to service_role;
grant execute on function public.professional_clinic_limits_set(uuid, uuid, integer, integer, integer) to service_role;
grant execute on function public.professional_clinic_online_booking_set(uuid, uuid, boolean) to service_role;

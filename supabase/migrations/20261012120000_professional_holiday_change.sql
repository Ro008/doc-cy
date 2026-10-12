-- Settings → holiday mode (user, 2026-10-11): no founders' approval, every change
-- recorded.
--
-- 1. A recorded request type, professional_holiday_change.
-- 2. professional_holiday_set saves the holiday and its record together, and checks the
--    dates: a holiday cannot start in the past or end before it starts; one that is
--    running may keep its start and move its end. A holiday whose end date has passed
--    counts as off: switching it off only clears the old dates.
--
-- No new columns: the dates stay on professional_settings (holiday_mode_enabled,
-- holiday_start_date, holiday_end_date). Backward-compatible: nothing is renamed or
-- dropped.

-- 1. The recorded type.
insert into public.request_types (name, requires_approval, is_edit, description)
values (
  'professional_holiday_change',
  false,
  true,
  'The professional switched holiday mode on or off, or changed its dates, in Settings. details: enabled, start_date, end_date (dates empty when off). Recorded at once; before_snapshot keeps the holiday before.'
)
on conflict (name) do update set description = excluded.description;

-- 2. request_submit: the snapshot step of the type.
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
    elsif p_request_type = 'professional_holiday_change' then
      if v_registered is not true then
        raise exception 'professional % has not signed up', p_professional_id using errcode = '22023';
      end if;
      select jsonb_build_object(
          'enabled', ps.holiday_mode_enabled,
          'start_date', ps.holiday_start_date,
          'end_date', ps.holiday_end_date)
      into v_snapshot
      from public.professional_settings ps
      where ps.professional_id = p_professional_id;
      -- No settings row yet: holiday mode was off.
      v_snapshot := coalesce(v_snapshot,
        jsonb_build_object('enabled', false, 'start_date', null, 'end_date', null));
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

-- 3. Her holiday. Returns the record's id, or null when nothing changed. "Today" is
--    the day in Cyprus.
create or replace function public.professional_holiday_set(
  p_professional_id uuid,
  p_enabled boolean,
  p_start_date date,
  p_end_date date
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Nicosia')::date;
  v_registered boolean;
  v_ps public.professional_settings%rowtype;
  v_has_row boolean;
  v_was_on boolean;
  v_was_live boolean;
  v_id uuid;
begin
  if p_enabled is null then
    raise exception 'holiday mode is on or off' using errcode = '22023';
  end if;
  select p.is_registered into v_registered from public.professionals p where p.id = p_professional_id;
  if not found then
    raise exception 'professional % not found', p_professional_id using errcode = 'P0002';
  end if;
  if v_registered is not true then
    raise exception 'professional % has not signed up', p_professional_id using errcode = '22023';
  end if;

  select * into v_ps from public.professional_settings ps
  where ps.professional_id = p_professional_id
  for update;
  v_has_row := found;
  v_was_on := v_has_row and v_ps.holiday_mode_enabled
    and v_ps.holiday_start_date is not null and v_ps.holiday_end_date is not null;
  -- A holiday whose end date has passed counts as off.
  v_was_live := v_was_on and v_ps.holiday_end_date >= v_today;

  if not p_enabled then
    if not v_was_live then
      -- Nothing to switch off; old dates left behind are cleared without a record.
      if v_has_row and (v_ps.holiday_mode_enabled or v_ps.holiday_start_date is not null
          or v_ps.holiday_end_date is not null) then
        update public.professional_settings
        set holiday_mode_enabled = false, holiday_start_date = null, holiday_end_date = null, updated_at = now()
        where professional_id = p_professional_id;
      end if;
      return null;
    end if;
    v_id := public.request_submit('professional_holiday_change', p_professional_id,
      jsonb_build_object('enabled', false, 'start_date', null, 'end_date', null));
    update public.professional_settings
    set holiday_mode_enabled = false, holiday_start_date = null, holiday_end_date = null, updated_at = now()
    where professional_id = p_professional_id;
    return v_id;
  end if;

  if p_start_date is null or p_end_date is null then
    raise exception 'a holiday needs both dates' using errcode = '22023';
  end if;
  -- The same holiday again (every save of Settings sends it): nothing to do, even
  -- when it has ended since the page was opened.
  if v_was_on and v_ps.holiday_start_date = p_start_date and v_ps.holiday_end_date = p_end_date then
    return null;
  end if;
  if p_end_date < p_start_date then
    raise exception 'a holiday ends on or after the day it starts' using errcode = '22023';
  end if;
  if p_end_date < v_today then
    raise exception 'a holiday cannot end in the past' using errcode = '22023';
  end if;
  -- Only a holiday that is running keeps a start in the past.
  if p_start_date < v_today
     and not (v_was_live and v_ps.holiday_start_date = p_start_date) then
    raise exception 'a holiday cannot start in the past' using errcode = '22023';
  end if;

  v_id := public.request_submit('professional_holiday_change', p_professional_id,
    jsonb_build_object('enabled', true, 'start_date', p_start_date, 'end_date', p_end_date));
  insert into public.professional_settings as ps
    (professional_id, holiday_mode_enabled, holiday_start_date, holiday_end_date, updated_at)
  values (p_professional_id, true, p_start_date, p_end_date, now())
  on conflict (professional_id) do update
  set holiday_mode_enabled = true, holiday_start_date = excluded.holiday_start_date,
      holiday_end_date = excluded.holiday_end_date, updated_at = now();
  return v_id;
end
$$;

comment on function public.professional_holiday_set(uuid, boolean, date, date) is
  'The professional switches holiday mode on or off or changes its dates: saved on professional_settings and recorded in request_log together; null when nothing changed. Refuses a start in the past (unless the holiday is running and keeps its start) and an end before the start. Service role only: the server checks the session first.';

revoke all on function public.professional_holiday_set(uuid, boolean, date, date) from public, anon, authenticated;
grant execute on function public.professional_holiday_set(uuid, boolean, date, date) to service_role;

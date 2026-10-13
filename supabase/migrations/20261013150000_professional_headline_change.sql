-- The headline on the public profile (Settings → Profile → "Headline", user 2026-10-13).
--
-- One optional line under her name on her public page, at most 90 characters. It changes
-- as she pleases: no founder, but every change is recorded in request_log, like her bio.
-- It is public text under her name, so it changes at most 5 times in a rolling 30 days
-- (like joining a clinic), not the 20 a day of the everyday settings.
--
-- 1. professionals.profile_headline (null: no headline; one line, 1 to 90 characters).
-- 2. Request type professional_headline_change: recorded at once, 5 in 30 days.
-- 3. request_submit keeps the old headline as the record's before_snapshot.
-- 4. professional_headline_set makes the change and its record together (service role
--    only: the server checks the session first).
--
-- Backward-compatible (a new column, type and function; request_submit keeps its
-- signature, so grants are kept). Re-runnable.

-- 1. The column. Sessions cannot write it: "authenticated" has UPDATE on two named
--    columns of professionals only, and anon reads nothing of the table.
alter table public.professionals
  add column if not exists profile_headline text;

alter table public.professionals drop constraint if exists professionals_profile_headline_check;
alter table public.professionals add constraint professionals_profile_headline_check
  check (
    char_length(profile_headline) between 1 and 90
    and profile_headline = btrim(profile_headline)
    and profile_headline !~ '[\n\r\t]'
  );

comment on column public.professionals.profile_headline is
  'The optional line under her name on her public profile: one line, at most 90 characters. Null: none. Written by professional_headline_set.';

-- 2. The request type and how often (request_types; request_frequency_check enforces it).
insert into public.request_types (name, requires_approval, is_edit, description, limit_count, limit_window)
values (
  'professional_headline_change',
  false,
  true,
  'The professional changed the headline on her public profile in Settings. Recorded at once; before_snapshot keeps the old text. At most 5 in 30 days.',
  5,
  interval '30 days'
)
on conflict (name) do update
set description = excluded.description,
    limit_count = excluded.limit_count,
    limit_window = excluded.limit_window;

-- 3. request_submit: as in *_request_frequency_limits, plus the headline's snapshot.
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

  -- How often she may make this kind of change (request_types; DC429 when too often).
  perform public.request_frequency_check(p_request_type, p_professional_id, p_details);

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
      'professional_qualification_add', 'professional_qualification_removal', 'professional_headline_change'
    ) then
      if v_registered is not true then
        raise exception 'professional % has not signed up', p_professional_id using errcode = '22023';
      end if;
      select case p_request_type
               when 'professional_patients_seen_change' then jsonb_build_object('patients_seen', patients_seen)
               when 'professional_bio_change' then jsonb_build_object('bio', bio)
               when 'professional_languages_change' then jsonb_build_object('languages', to_jsonb(languages))
               when 'professional_headline_change' then jsonb_build_object('profile_headline', profile_headline)
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

-- 4. The headline: on one line (runs of spaces, tabs and line breaks become one space),
--    trimmed, empty means none, at most 90 characters.
create or replace function public.professional_headline_set(p_professional_id uuid, p_headline text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_headline text := nullif(btrim(regexp_replace(coalesce(p_headline, ''), '\s+', ' ', 'g')), '');
  v_current text;
  v_id uuid;
begin
  if char_length(v_headline) > 90 then
    raise exception 'a headline has at most 90 characters' using errcode = '22023';
  end if;
  select profile_headline into v_current from public.professionals where id = p_professional_id for update;
  if not found then
    raise exception 'professional % not found', p_professional_id using errcode = 'P0002';
  end if;
  if v_current is not distinct from v_headline then
    return null;
  end if;

  v_id := public.request_submit(
    'professional_headline_change', p_professional_id, jsonb_build_object('profile_headline', v_headline));
  update public.professionals set profile_headline = v_headline, updated_at = now() where id = p_professional_id;
  return v_id;
end
$$;

comment on function public.professional_headline_set(uuid, text) is
  'The professional changes the headline on her public profile: recorded in request_log at once, at most 5 in 30 days (DC429). Service role only: the server checks the session first.';

revoke all on function public.professional_headline_set(uuid, text) from public, anon, authenticated;
grant execute on function public.professional_headline_set(uuid, text) to service_role;

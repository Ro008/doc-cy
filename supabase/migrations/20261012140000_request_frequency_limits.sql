-- How often a professional can change a setting (user, 2026-10-12).
--
-- Nothing limited this before: she could send the founders a request, withdraw it and
-- send it again without end, flip a public setting all day, or (a script, a stuck
-- button) write thousands of records.
--
-- 1. The limits live on request_types, one row per kind of change:
--      limit_count in limit_window   how many, in how long (both or neither);
--      limit_scope_key               count per value of this key of details (per clinic);
--      wait_after_approval           no new request this long after an approved one.
-- 2. The values, by rule:
--      requests for the founders        3 in 30 days (withdrawn and denied ones count);
--      a name change                    and 90 days after an approved one (it moves her
--                                       public address);
--      joining / leaving a clinic       5 in 30 days each;
--      every other recorded setting     20 a day (only there to stop runaway use);
--      hours, limits, booking switch    counted per clinic (link_id);
--      clinic details requests          counted per clinic (clinic_id);
--      registration, email change       no limit (the email change has its own).
-- 3. request_frequency_check raises DC429 when she is over a limit, with the time she
--    can change it again in DETAIL (UTC) and the kind in HINT ('window' or
--    'after_approval').
-- 4. request_submit runs the check. Every change goes through it, in the same
--    transaction as the change itself, so a refused change is rolled back as a whole and
--    records nothing. Approvals, denials and the founders' corrections are not limited.
--
-- Backward-compatible: columns are added, nothing is renamed or dropped.

-- 1. The columns.
alter table public.request_types
  add column if not exists limit_count integer,
  add column if not exists limit_window interval,
  add column if not exists limit_scope_key text,
  add column if not exists wait_after_approval interval;

comment on column public.request_types.limit_count is
  'How many requests of this type one professional may make within limit_window. Null: no limit.';
comment on column public.request_types.limit_window is
  'The rolling period limit_count is counted in. Set together with limit_count.';
comment on column public.request_types.limit_scope_key is
  'A key of details: the count is kept per value of it (per clinic). Null: per professional.';
comment on column public.request_types.wait_after_approval is
  'No new request of this type this long after an approved one. Null: no wait.';

alter table public.request_types drop constraint if exists request_types_limit_shape;
alter table public.request_types add constraint request_types_limit_shape check (
  (limit_count is null) = (limit_window is null)
  and (limit_count is null or limit_count >= 1)
  and (limit_window is null or limit_window > interval '0')
  and (wait_after_approval is null or wait_after_approval > interval '0')
  and (limit_scope_key is null or (limit_count is not null and limit_scope_key ~ '^[a-z][a-z0-9_]*$'))
);

-- 2. The values, by rule (no type is named unless the rule is about it).
update public.request_types
set limit_count = 3, limit_window = interval '30 days'
where requires_approval and is_edit;

update public.request_types
set wait_after_approval = interval '90 days'
where name = 'professional_name_change';

update public.request_types
set limit_count = 5, limit_window = interval '30 days'
where name in ('professional_clinic_join', 'professional_clinic_leave');

update public.request_types
set limit_count = 20, limit_window = interval '1 day'
where not requires_approval and is_edit
  and name like 'professional\_%'
  and name not in ('professional_clinic_join', 'professional_clinic_leave', 'professional_email_change');

update public.request_types
set limit_scope_key = 'link_id'
where name in ('professional_clinic_hours_change', 'professional_clinic_limits_change',
               'professional_clinic_online_booking_change');

update public.request_types
set limit_scope_key = 'clinic_id'
where name = 'professional_clinic_details_change';

-- 3. The check.
create or replace function public.request_frequency_check(
  p_request_type text,
  p_professional_id uuid,
  p_details jsonb
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_type public.request_types%rowtype;
  v_scope text;
  v_at timestamptz;
begin
  select * into v_type from public.request_types where name = p_request_type;
  if not found or p_professional_id is null then
    return;
  end if;

  if v_type.wait_after_approval is not null then
    select max(decided_at) into v_at
    from public.request_log
    where professional_id = p_professional_id
      and request_type = p_request_type
      and status = 'approved';
    if v_at is not null and v_at + v_type.wait_after_approval > now() then
      raise exception 'a % request was approved recently', p_request_type
        using errcode = 'DC429',
              detail = to_char((v_at + v_type.wait_after_approval) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
              hint = 'after_approval';
    end if;
  end if;

  if v_type.limit_count is null then
    return;
  end if;
  if v_type.limit_scope_key is not null then
    v_scope := p_details ->> v_type.limit_scope_key;
  end if;
  -- The limit_count-th newest request in the window: when there is one she is at the
  -- limit, and it opens again when that one leaves the window.
  select created_at into v_at
  from public.request_log
  where professional_id = p_professional_id
    and request_type = p_request_type
    and created_at > now() - v_type.limit_window
    and (v_type.limit_scope_key is null
         or (details ->> v_type.limit_scope_key) is not distinct from v_scope)
  order by created_at desc
  offset v_type.limit_count - 1
  limit 1;
  if found then
    raise exception 'too many % requests: % in %', p_request_type, v_type.limit_count, v_type.limit_window
      using errcode = 'DC429',
            detail = to_char((v_at + v_type.limit_window) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            hint = 'window';
  end if;
end
$$;

comment on function public.request_frequency_check(text, uuid, jsonb) is
  'Raises DC429 when the professional is over the type''s limit (request_types): DETAIL is when she can change it again (UTC), HINT is window or after_approval. Run by request_submit.';

revoke all on function public.request_frequency_check(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.request_frequency_check(text, uuid, jsonb) to service_role;

-- 4. request_submit runs the check.
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

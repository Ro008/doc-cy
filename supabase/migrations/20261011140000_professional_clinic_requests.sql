-- Clinic requests from Settings (Settings → Clinics, user 2026-10-11).
--
-- Two things about a clinic need a founder, because clinics are curated by DocCy and
-- shared by the professionals who work there:
-- - professional_clinic_add: a clinic DocCy does not have yet. details: name, address,
--   district, town, latitude, longitude, place_id, phone (the shape a clinic proposed at
--   registration has). Approving creates the clinic and she joins it, with online
--   booking off and the starting week; founders may correct the details first, or
--   approve with options {"existing_clinic_id": …} when DocCy already has the clinic
--   (she joins that one and nothing is created). One waiting request at a time.
-- - professional_clinic_details_change: the name, address (with its pin) or phone of a
--   clinic she works at. details: clinic_id and changes {name?, address? + location
--   {district, town, latitude, longitude, place_id}, phone?}. before_snapshot keeps the
--   clinic as it was; approving stops when a field she asked to change was changed
--   meanwhile. One open request per clinic. The clinic's web address (slug) stays.
-- A clinic phone is a Cyprus landline (22 to 26) or mobile (94 to 97, 99), 8 digits.
-- Leaving a clinic withdraws her open details request for it.
--
-- Backward-compatible (new types, functions and indexes; the changed functions keep
-- their signatures, so grants are kept). Re-runnable.

-- 1. Request types.
insert into public.request_types (name, requires_approval, is_edit, description)
values
  (
    'professional_clinic_add',
    true,
    true,
    'The professional asked for a clinic DocCy does not have yet, in Settings. details: name, address, district, town, latitude, longitude, place_id, phone. Approving creates the clinic and she joins it (or, with options.existing_clinic_id, she joins a clinic DocCy already has). before_snapshot keeps the clinics she had.'
  ),
  (
    'professional_clinic_details_change',
    true,
    true,
    'The professional asked to change the name, address or phone of a clinic she works at, in Settings. details: clinic_id, changes {name, address + location, phone}. Approving changes the clinic for everyone who works there. before_snapshot keeps the clinic as it was.'
  )
on conflict (name) do update set description = excluded.description;

-- 2. One new-clinic request waiting per professional; one open details request per
--    professional and clinic.
create unique index if not exists request_log_one_pending_professional_clinic_add_idx
  on public.request_log (professional_id) where status = 'pending' and request_type = 'professional_clinic_add';
create unique index if not exists request_log_one_pending_professional_clinic_details_idx
  on public.request_log (professional_id, (details ->> 'clinic_id'))
  where status = 'pending' and request_type = 'professional_clinic_details_change';

-- 3. What a clinic's details must look like.
create or replace function public.professional_clinic_phone_ok(p_phone text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_phone, '') ~ '^(2[2-6]|9[4-79])[0-9]{6}$';
$$;

-- A place: an address with its district and pin (22023 when not usable).
create or replace function public.professional_clinic_place_check(p_address text, p_place jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if btrim(coalesce(p_address, '')) = '' or length(btrim(p_address)) > 300 then
    raise exception 'a clinic needs an address of 1 to 300 characters' using errcode = '22023';
  end if;
  if p_place is null or jsonb_typeof(p_place) <> 'object' then
    raise exception 'a clinic address needs its pin' using errcode = '22023';
  end if;
  begin
    perform (p_place ->> 'district')::public.cyprus_district;
  exception when invalid_text_representation then
    raise exception 'unknown district %', p_place ->> 'district' using errcode = '22023';
  end;
  if p_place ->> 'district' is null
     or jsonb_typeof(p_place -> 'latitude') is distinct from 'number'
     or jsonb_typeof(p_place -> 'longitude') is distinct from 'number'
     or (p_place ->> 'latitude')::double precision not between 34 and 36
     or (p_place ->> 'longitude')::double precision not between 32 and 35 then
    raise exception 'a clinic address needs a district and a pin in Cyprus' using errcode = '22023';
  end if;
end
$$;

-- A clinic DocCy does not have yet.
create or replace function public.professional_clinic_new_check(p_details jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if btrim(coalesce(p_details ->> 'name', '')) = '' or length(btrim(p_details ->> 'name')) > 120 then
    raise exception 'a clinic needs a name of 1 to 120 characters' using errcode = '22023';
  end if;
  perform public.professional_clinic_place_check(p_details ->> 'address', p_details);
  if not public.professional_clinic_phone_ok(p_details ->> 'phone') then
    raise exception 'a clinic phone is a Cyprus landline or mobile, 8 digits' using errcode = '22023';
  end if;
end
$$;

-- Changes to a clinic's details, against the clinic as it is (p_current: the snapshot
-- request_submit takes). At least one of name, address, phone, and each one different.
create or replace function public.professional_clinic_changes_check(p_changes jsonb, p_current jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_key text;
  v_differs boolean := false;
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then
    raise exception 'a clinic change needs its changes' using errcode = '22023';
  end if;
  for v_key in select jsonb_object_keys(p_changes) loop
    if v_key not in ('name', 'address', 'location', 'phone') then
      raise exception 'a clinic change is about its name, address or phone, not %', v_key using errcode = '22023';
    end if;
  end loop;
  if p_changes ? 'name' then
    if btrim(coalesce(p_changes ->> 'name', '')) = '' or length(btrim(p_changes ->> 'name')) > 120 then
      raise exception 'a clinic needs a name of 1 to 120 characters' using errcode = '22023';
    end if;
    v_differs := v_differs or btrim(p_changes ->> 'name') is distinct from p_current ->> 'name';
  end if;
  if p_changes ? 'address' then
    perform public.professional_clinic_place_check(p_changes ->> 'address', p_changes -> 'location');
    v_differs := true;
  elsif p_changes ? 'location' then
    raise exception 'a new pin comes with its address' using errcode = '22023';
  end if;
  if p_changes ? 'phone' then
    if not public.professional_clinic_phone_ok(p_changes ->> 'phone') then
      raise exception 'a clinic phone is a Cyprus landline or mobile, 8 digits' using errcode = '22023';
    end if;
    v_differs := v_differs or p_changes ->> 'phone' is distinct from p_current ->> 'phone';
  end if;
  if not v_differs then
    raise exception 'a clinic change needs something that differs' using errcode = '22023';
  end if;
end
$$;

-- 4. request_submit: the checks and snapshot steps of the two types.
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

-- 5. Approval step: the new clinic (or the clinic DocCy already has).
create or replace function public.request_apply_professional_clinic_add(
  p_req public.request_log,
  p_details jsonb,
  p_options jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_clinic_id uuid := nullif(coalesce(p_options, '{}'::jsonb) ->> 'existing_clinic_id', '')::uuid;
  v_created boolean := false;
  v_link uuid := gen_random_uuid();
  v_order int;
begin
  perform 1 from public.professionals where id = p_req.professional_id for update;
  if not found then
    raise exception 'the professional no longer exists' using errcode = 'P0002';
  end if;
  if (select count(*) from public.professional_clinics pc
      join public.clinics c on c.id = pc.clinic_id
      where pc.professional_id = p_req.professional_id and not c.is_archived) >= 5 then
    raise exception 'she already has 5 clinics: deny the request' using errcode = '55000';
  end if;

  if v_clinic_id is not null then
    if not exists (select 1 from public.clinics c where c.id = v_clinic_id and not c.is_archived) then
      raise exception 'clinic % not found', v_clinic_id using errcode = 'P0002';
    end if;
    if exists (select 1 from public.professional_clinics pc
               where pc.professional_id = p_req.professional_id and pc.clinic_id = v_clinic_id) then
      raise exception 'she already works at this clinic: deny the request' using errcode = '55000';
    end if;
  else
    perform public.professional_clinic_new_check(p_details);
    insert into public.clinics (name, slug, district, address, town, latitude, longitude, clinic_place_id, phone)
    values (
      btrim(p_details ->> 'name'),
      public.request_clinic_slug(p_details ->> 'name'),
      (p_details ->> 'district')::public.cyprus_district,
      btrim(p_details ->> 'address'),
      nullif(btrim(coalesce(p_details ->> 'town', '')), ''),
      (p_details ->> 'latitude')::double precision,
      (p_details ->> 'longitude')::double precision,
      nullif(btrim(coalesce(p_details ->> 'place_id', '')), ''),
      p_details ->> 'phone'
    )
    returning id into v_clinic_id;
    v_created := true;
  end if;

  select coalesce(max(pc.sort_order), -1) + 1 into v_order
  from public.professional_clinics pc where pc.professional_id = p_req.professional_id;
  insert into public.professional_clinics (
    id, professional_id, clinic_id, sort_order, pause_online_bookings,
    monday, tuesday, wednesday, thursday, friday, saturday, sunday,
    start_time, end_time, slot_duration_minutes
  )
  values (
    v_link, p_req.professional_id, v_clinic_id, v_order, true,
    true, true, true, true, true, false, false,
    '09:00', '17:00', 30
  );
  return jsonb_build_object(
    'professional_id', p_req.professional_id, 'clinic_id', v_clinic_id, 'link_id', v_link, 'created', v_created);
end
$$;

-- 6. Approval step: the clinic's details. Stops (55000) when she has left the clinic,
--    or when something she asked to change was changed since she asked.
create or replace function public.request_apply_professional_clinic_details_change(
  p_req public.request_log,
  p_details jsonb,
  p_options jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_clinic public.clinics%rowtype;
  v_changes jsonb := p_details -> 'changes';
  v_place jsonb := p_details -> 'changes' -> 'location';
  v_before jsonb := coalesce(p_req.before_snapshot, '{}'::jsonb);
  v_current jsonb;
  v_changed jsonb := '[]'::jsonb;
begin
  if p_details ->> 'clinic_id' is distinct from p_req.details ->> 'clinic_id' then
    raise exception 'a correction stays with the clinic she asked about' using errcode = '22023';
  end if;
  select * into v_clinic from public.clinics c
  where c.id::text = p_req.details ->> 'clinic_id' and not c.is_archived
  for update;
  if not found then
    raise exception 'the clinic no longer exists' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.professional_clinics pc
                 where pc.professional_id = p_req.professional_id and pc.clinic_id = v_clinic.id) then
    raise exception 'she no longer works at this clinic: deny the request' using errcode = '55000';
  end if;

  v_current := jsonb_build_object('name', v_clinic.name, 'address', v_clinic.address, 'phone', v_clinic.phone);
  perform public.professional_clinic_changes_check(v_changes, v_current);
  if (v_changes ? 'name' and v_clinic.name is distinct from v_before ->> 'name')
     or (v_changes ? 'address' and v_clinic.address is distinct from v_before ->> 'address')
     or (v_changes ? 'phone' and v_clinic.phone is distinct from v_before ->> 'phone') then
    raise exception 'the clinic changed since this request was made' using errcode = '55000';
  end if;

  if v_changes ? 'name' then
    update public.clinics set name = btrim(v_changes ->> 'name'), updated_at = now() where id = v_clinic.id;
    v_changed := v_changed || '"name"'::jsonb;
  end if;
  if v_changes ? 'address' then
    update public.clinics
    set address = btrim(v_changes ->> 'address'),
        district = (v_place ->> 'district')::public.cyprus_district,
        town = nullif(btrim(coalesce(v_place ->> 'town', '')), ''),
        latitude = (v_place ->> 'latitude')::double precision,
        longitude = (v_place ->> 'longitude')::double precision,
        clinic_place_id = nullif(btrim(coalesce(v_place ->> 'place_id', '')), ''),
        -- The old Maps link pointed at the old address.
        address_maps_link = null,
        updated_at = now()
    where id = v_clinic.id;
    v_changed := v_changed || '"address"'::jsonb;
  end if;
  if v_changes ? 'phone' then
    update public.clinics set phone = v_changes ->> 'phone', updated_at = now() where id = v_clinic.id;
    v_changed := v_changed || '"phone"'::jsonb;
  end if;
  return jsonb_build_object('clinic_id', v_clinic.id, 'changed', v_changed);
end
$$;

-- 7. request_approve: the two new approval steps.
create or replace function public.request_approve(
  p_request_id uuid,
  p_admin_id uuid,
  p_corrected_details jsonb default null,
  p_note text default null,
  p_options jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.request_log%rowtype;
  v_details jsonb;
  v_outcome jsonb;
  v_professional uuid;
begin
  if p_corrected_details is not null and jsonb_typeof(p_corrected_details) <> 'object' then
    raise exception 'corrected details must be a JSON object' using errcode = '22023';
  end if;
  if p_options is not null and jsonb_typeof(p_options) <> 'object' then
    raise exception 'approval options must be a JSON object' using errcode = '22023';
  end if;

  select * into v_req from public.request_log where id = p_request_id for update;
  if not found then
    raise exception 'request % not found', p_request_id using errcode = 'P0002';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'request % is already %', p_request_id, v_req.status using errcode = '55000';
  end if;
  perform public.request_assert_founder(p_admin_id);

  v_details := coalesce(p_corrected_details, v_req.details);
  -- Each type's approval step: for edit types, stop with a conflict if the live
  -- values no longer match before_snapshot; then apply v_details and set v_outcome.
  if v_req.request_type = 'professional_registration' then
    v_outcome := public.request_apply_professional_registration(v_req, v_details, p_options);
    v_professional := (v_outcome ->> 'professional_id')::uuid;
  elsif v_req.request_type = 'professional_name_change' then
    v_outcome := public.request_apply_professional_name_change(v_req, v_details, p_options);
  elsif v_req.request_type = 'professional_photo_change' then
    v_outcome := public.request_apply_professional_photo_change(v_req, v_details, p_options);
  elsif v_req.request_type = 'professional_specialty_add' then
    v_outcome := public.request_apply_professional_specialty_add(v_req, v_details, p_options);
  elsif v_req.request_type = 'professional_clinic_add' then
    v_outcome := public.request_apply_professional_clinic_add(v_req, v_details, p_options);
  elsif v_req.request_type = 'professional_clinic_details_change' then
    v_outcome := public.request_apply_professional_clinic_details_change(v_req, v_details, p_options);
  end if;
  if v_outcome is null then
    raise exception 'request type % has no approval step yet', v_req.request_type using errcode = '0A000';
  end if;

  perform set_config('doccy.request_decision', p_request_id::text, true);
  update public.request_log
  set status = 'approved',
      decided_at = now(),
      decided_by = p_admin_id,
      decision_note = nullif(btrim(coalesce(p_note, '')), ''),
      approved_details = p_corrected_details,
      outcome = v_outcome,
      professional_id = coalesce(professional_id, v_professional)
  where id = p_request_id;
  perform set_config('doccy.request_decision', '', true);
  return p_request_id;
end
$$;

-- 8. Leaving a clinic withdraws her open details request for it.
create or replace function public.professional_clinic_leave(p_professional_id uuid, p_link_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_clinic public.clinics%rowtype;
  v_open uuid;
  v_id uuid;
begin
  perform 1 from public.professionals where id = p_professional_id for update;
  if not found then
    raise exception 'professional % not found', p_professional_id using errcode = 'P0002';
  end if;
  select c.* into v_clinic
  from public.professional_clinics pc
  join public.clinics c on c.id = pc.clinic_id
  where pc.id = p_link_id and pc.professional_id = p_professional_id;
  if not found then
    raise exception 'she does not work at this clinic' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.professional_clinics pc
    join public.clinics c on c.id = pc.clinic_id
    where pc.professional_id = p_professional_id and pc.id <> p_link_id and not c.is_archived
  ) then
    raise exception 'a professional keeps at least one clinic' using errcode = '23514';
  end if;

  -- A change she asked for at this clinic is no longer hers to ask.
  for v_open in
    select r.id from public.request_log r
    where r.professional_id = p_professional_id and r.status = 'pending'
      and r.request_type = 'professional_clinic_details_change'
      and r.details ->> 'clinic_id' = v_clinic.id::text
  loop
    perform public.request_withdraw(v_open, p_professional_id);
  end loop;

  v_id := public.request_submit('professional_clinic_leave', p_professional_id, jsonb_build_object(
    'link_id', p_link_id, 'clinic_id', v_clinic.id, 'clinic_name', v_clinic.name, 'clinic_address', v_clinic.address));
  delete from public.professional_clinics where id = p_link_id;
  return v_id;
end
$$;

comment on function public.professional_clinic_phone_ok(text) is
  'True for a clinic phone as it is kept: a Cyprus landline (22 to 26) or mobile (94 to 97, 99), 8 digits.';
comment on function public.professional_clinic_place_check(text, jsonb) is
  'A clinic address with its district and pin; 22023 when not usable.';
comment on function public.professional_clinic_new_check(jsonb) is
  'The details of a clinic DocCy does not have yet; 22023 when not usable.';
comment on function public.professional_clinic_changes_check(jsonb, jsonb) is
  'Changes to a clinic''s name, address or phone against the clinic as it is; 22023 when not usable or nothing differs.';
comment on function public.request_apply_professional_clinic_add(public.request_log, jsonb, jsonb) is
  'Approval step of professional_clinic_add: creates the clinic (or takes options.existing_clinic_id) and links her to it. Called by request_approve only.';
comment on function public.request_apply_professional_clinic_details_change(public.request_log, jsonb, jsonb) is
  'Approval step of professional_clinic_details_change: changes the clinic''s name, address or phone. Called by request_approve only.';

revoke all on function public.professional_clinic_phone_ok(text) from public, anon, authenticated;
revoke all on function public.professional_clinic_place_check(text, jsonb) from public, anon, authenticated;
revoke all on function public.professional_clinic_new_check(jsonb) from public, anon, authenticated;
revoke all on function public.professional_clinic_changes_check(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.request_apply_professional_clinic_add(public.request_log, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.request_apply_professional_clinic_details_change(public.request_log, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.professional_clinic_phone_ok(text) to service_role;
grant execute on function public.professional_clinic_place_check(text, jsonb) to service_role;
grant execute on function public.professional_clinic_new_check(jsonb) to service_role;
grant execute on function public.professional_clinic_changes_check(jsonb, jsonb) to service_role;

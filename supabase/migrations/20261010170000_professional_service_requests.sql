-- Services changed from Settings (Settings → Services & prices, user 2026-10-10).
--
-- She adds, changes and removes the services on her price list as she pleases: no
-- founder, but every change is recorded in request_log, like the Profile details.
-- A service has a name (1 to 80 characters) and an optional price in euros, kept as
-- text in professional_services.price: an amount ("120", "49.50") or a lowest price
-- ("From 80"). At most 20 services, and no name twice (capitals aside). Each function
-- makes the change and its record together (service role only: the server checks the
-- session first).
--
-- Backward-compatible (new types and functions; request_submit keeps its signature,
-- so grants are kept). Re-runnable.

-- 1. Request types.
insert into public.request_types (name, requires_approval, is_edit, description)
values
  (
    'professional_service_add',
    false,
    true,
    'The professional added a service to her price list in Settings. details: id, name, price. Recorded at once; before_snapshot keeps the list she had.'
  ),
  (
    'professional_service_change',
    false,
    true,
    'The professional changed the name or price of a service in Settings. details: id and the new name and price. Recorded at once; before_snapshot keeps the list she had.'
  ),
  (
    'professional_service_removal',
    false,
    true,
    'The professional removed a service from her price list in Settings. details: the removed service. Recorded at once; before_snapshot keeps the list she had.'
  )
on conflict (name) do update set description = excluded.description;

-- 2. request_submit: the snapshot step of the three types.
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

-- 3. A name as it is kept (trimmed, single-spaced) and a price as it is kept
--    (null, an amount, or "From " and an amount); 22023 when not usable.
create or replace function public.professional_service_clean(p_name text, p_price text)
returns table (name text, price text)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_price text := nullif(btrim(coalesce(p_price, '')), '');
begin
  if v_name = '' or length(v_name) > 80 then
    raise exception 'a service needs a name of 1 to 80 characters' using errcode = '22023';
  end if;
  if v_price is not null and v_price !~ '^(From )?[0-9]{1,5}(\.[0-9]{1,2})?$' then
    raise exception 'the price of a service is an amount in euros, or From and an amount' using errcode = '22023';
  end if;
  return query select v_name, v_price;
end
$$;

-- 4. Add a service (at most 20: 23514; a name she already lists: 23505).
--    Returns {request_id, service}.
create or replace function public.professional_service_add(p_professional_id uuid, p_name text, p_price text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_name text;
  v_price text;
  v_line jsonb;
  v_sid uuid := gen_random_uuid();
  v_id uuid;
begin
  select c.name, c.price into v_name, v_price from public.professional_service_clean(p_name, p_price) c;
  -- Her row is the lock: two changes to her list wait for each other.
  perform 1 from public.professionals where id = p_professional_id for update;
  if not found then
    raise exception 'professional % not found', p_professional_id using errcode = 'P0002';
  end if;
  if (select count(*) from public.professional_services s where s.professional_id = p_professional_id) >= 20 then
    raise exception 'a professional lists at most 20 services' using errcode = '23514';
  end if;
  if exists (select 1 from public.professional_services s
             where s.professional_id = p_professional_id and lower(btrim(s.name)) = lower(v_name)) then
    raise exception 'she already lists this service' using errcode = '23505';
  end if;

  v_line := jsonb_build_object('id', v_sid, 'name', v_name, 'price', v_price);
  v_id := public.request_submit('professional_service_add', p_professional_id, v_line);
  insert into public.professional_services (id, professional_id, name, price)
  values (v_sid, p_professional_id, v_name, v_price);
  return jsonb_build_object('request_id', v_id, 'service', v_line);
end
$$;

-- 5. Change the name or price of one of her services (P0002 when it is not hers).
--    Returns {request_id, service}; request_id is null when nothing changed.
create or replace function public.professional_service_update(
  p_professional_id uuid,
  p_service_id uuid,
  p_name text,
  p_price text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_name text;
  v_price text;
  v_current public.professional_services%rowtype;
  v_line jsonb;
  v_id uuid;
begin
  select c.name, c.price into v_name, v_price from public.professional_service_clean(p_name, p_price) c;
  perform 1 from public.professionals where id = p_professional_id for update;
  if not found then
    raise exception 'professional % not found', p_professional_id using errcode = 'P0002';
  end if;
  select * into v_current from public.professional_services s
  where s.id = p_service_id and s.professional_id = p_professional_id;
  if not found then
    raise exception 'she does not list this service' using errcode = 'P0002';
  end if;

  v_line := jsonb_build_object('id', p_service_id, 'name', v_name, 'price', v_price);
  if v_current.name = v_name and v_current.price is not distinct from v_price then
    return jsonb_build_object('request_id', null, 'service', v_line);
  end if;
  if exists (select 1 from public.professional_services s
             where s.professional_id = p_professional_id and s.id <> p_service_id
               and lower(btrim(s.name)) = lower(v_name)) then
    raise exception 'she already lists this service' using errcode = '23505';
  end if;

  v_id := public.request_submit('professional_service_change', p_professional_id, v_line);
  update public.professional_services set name = v_name, price = v_price where id = p_service_id;
  return jsonb_build_object('request_id', v_id, 'service', v_line);
end
$$;

-- 6. Remove one of her services (P0002 when it is not hers). Visits booked for it keep
--    the name they were booked with (appointments.service_name).
create or replace function public.professional_service_remove(p_professional_id uuid, p_service_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_current public.professional_services%rowtype;
  v_id uuid;
begin
  perform 1 from public.professionals where id = p_professional_id for update;
  if not found then
    raise exception 'professional % not found', p_professional_id using errcode = 'P0002';
  end if;
  select * into v_current from public.professional_services s
  where s.id = p_service_id and s.professional_id = p_professional_id;
  if not found then
    raise exception 'she does not list this service' using errcode = 'P0002';
  end if;

  v_id := public.request_submit('professional_service_removal', p_professional_id,
    jsonb_build_object('id', v_current.id, 'name', v_current.name, 'price', v_current.price));
  delete from public.professional_services where id = p_service_id;
  return v_id;
end
$$;

comment on function public.professional_service_clean(text, text) is
  'A service name and price as they are kept; 22023 when not usable. Used by professional_service_add / _update.';
comment on function public.professional_service_add(uuid, text, text) is
  'The professional adds a service (at most 20, no name twice): recorded in request_log at once. Service role only: the server checks the session first.';
comment on function public.professional_service_update(uuid, uuid, text, text) is
  'The professional changes the name or price of a service: recorded in request_log at once. Service role only: the server checks the session first.';
comment on function public.professional_service_remove(uuid, uuid) is
  'The professional removes a service: recorded in request_log at once. Service role only: the server checks the session first.';

revoke all on function public.professional_service_clean(text, text) from public, anon, authenticated;
revoke all on function public.professional_service_add(uuid, text, text) from public, anon, authenticated;
revoke all on function public.professional_service_update(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.professional_service_remove(uuid, uuid) from public, anon, authenticated;
grant execute on function public.professional_service_clean(text, text) to service_role;
grant execute on function public.professional_service_add(uuid, text, text) to service_role;
grant execute on function public.professional_service_update(uuid, uuid, text, text) to service_role;
grant execute on function public.professional_service_remove(uuid, uuid) to service_role;

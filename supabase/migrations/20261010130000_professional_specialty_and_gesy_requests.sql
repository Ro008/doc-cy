-- Specialties and GeSY changed from Settings (Settings → Profile, user 2026-10-10).
--
-- Removing a specialty needs nobody: professional_specialty_remove records it at
-- once (with the specialty and its licence number), but never removes the last one.
-- Adding one, from the catalogue or new, needs a founder, as at registration: a
-- request_log row born "pending" whose details keep the licence number; one open
-- request per professional; at most 5 specialties. Approving writes it to her
-- profile (a new label joins the catalogue through the existing trigger).
-- GeSY goes on and off as she pleases: professional_gesy_set records each change.
--
-- Backward-compatible (new types and functions; request_submit and request_approve
-- keep their signatures, so grants are kept). Re-runnable.

-- 1. Request types.
insert into public.request_types (name, requires_approval, is_edit, description)
values
  (
    'professional_specialty_add',
    true,
    true,
    'The professional asked to add a specialty in Settings. details: name, from_catalogue, license_number. Approving adds it to her profile (a new label joins the catalogue). before_snapshot keeps the specialties she had.'
  ),
  (
    'professional_specialty_removal',
    false,
    true,
    'The professional removed a specialty in Settings (never her last one). Recorded at once; before_snapshot keeps its name and licence number.'
  ),
  (
    'professional_gesy_change',
    false,
    true,
    'The professional turned "I see GeSY patients" on or off in Settings. Recorded at once; before_snapshot keeps the old value.'
  )
on conflict (name) do update set description = excluded.description;

-- 2. One open specialty request per professional.
create unique index if not exists request_log_one_pending_professional_specialty_add_idx
  on public.request_log (professional_id) where status = 'pending' and request_type = 'professional_specialty_add';

-- 3. request_submit: checks and snapshot steps for the three types.
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

-- 4. Approval step: the specialty. A catalogue specialty takes the catalogue's
--    spelling; a new one joins the catalogue (professional_specialties_resolve_specialty).
create or replace function public.request_apply_professional_specialty_add(
  p_req public.request_log,
  p_details jsonb,
  p_options jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_details ->> 'name', ''));
  v_license text := btrim(coalesce(p_details ->> 'license_number', ''));
  v_slug text := public.specialty_slug(coalesce(p_details ->> 'name', ''));
  v_catalogue_name text;
  v_specialty_id uuid;
begin
  if v_name = '' or v_slug is null or v_slug = 'all' then
    raise exception 'a specialty request needs a specialty' using errcode = '22023';
  end if;
  if v_license = '' or length(v_license) > 80 then
    raise exception 'a specialty request needs a licence number of 1 to 80 characters' using errcode = '22023';
  end if;

  perform 1 from public.professionals where id = p_req.professional_id for update;
  if not found then
    raise exception 'the professional no longer exists' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.professional_specialties ps
    join public.specialties s on s.id = ps.specialty_id
    where ps.professional_id = p_req.professional_id and s.slug = v_slug
  ) then
    raise exception 'she already has this specialty: deny the request' using errcode = '55000';
  end if;
  if (select count(*) from public.professional_specialties ps
      where ps.professional_id = p_req.professional_id) >= 5 then
    raise exception 'she already has 5 specialties: deny the request' using errcode = '55000';
  end if;

  select s.name into v_catalogue_name from public.specialties s where s.slug = v_slug;
  insert into public.professional_specialties (professional_id, specialty, license_number)
  values (p_req.professional_id, coalesce(v_catalogue_name, v_name), v_license)
  returning specialty_id into v_specialty_id;

  return jsonb_build_object(
    'professional_id', p_req.professional_id,
    'specialty', coalesce(v_catalogue_name, v_name),
    'specialty_id', v_specialty_id,
    'license_number', v_license,
    'catalogue_added', v_catalogue_name is null
  );
end
$$;

-- 5. request_approve: the new approval step.
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

-- 6. Remove a specialty: no founder, recorded at once. Never her last one (23514).
create or replace function public.professional_specialty_remove(p_professional_id uuid, p_specialty text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_slug text := public.specialty_slug(coalesce(p_specialty, ''));
  v_row_id uuid;
  v_id uuid;
begin
  -- One change at a time per professional, so two removals cannot both leave "one".
  perform 1 from public.professionals where id = p_professional_id for update;
  if not found then
    raise exception 'professional % not found', p_professional_id using errcode = 'P0002';
  end if;

  select ps.id into v_row_id
  from public.professional_specialties ps
  join public.specialties s on s.id = ps.specialty_id
  where ps.professional_id = p_professional_id and s.slug = v_slug;
  if v_row_id is null then
    raise exception 'she does not have this specialty' using errcode = 'P0002';
  end if;
  if (select count(*) from public.professional_specialties ps
      where ps.professional_id = p_professional_id) <= 1 then
    raise exception 'a professional keeps at least one specialty' using errcode = '23514';
  end if;

  v_id := public.request_submit('professional_specialty_removal', p_professional_id,
    jsonb_build_object('name', p_specialty));
  delete from public.professional_specialties where id = v_row_id;
  return v_id;
end
$$;

-- 7. GeSY on or off: recorded at once. Returns the request id, or null when
--    nothing changed.
create or replace function public.professional_gesy_set(p_professional_id uuid, p_is_gesy boolean)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_registered boolean;
  v_current boolean;
  v_id uuid;
begin
  if p_is_gesy is null then
    raise exception 'GeSY needs a value' using errcode = '22023';
  end if;
  select is_registered, coalesce(is_gesy, false) into v_registered, v_current
  from public.professionals where id = p_professional_id
  for update;
  if not found then
    raise exception 'professional % not found', p_professional_id using errcode = 'P0002';
  end if;
  if v_registered is not true then
    raise exception 'professional % has not signed up', p_professional_id using errcode = '22023';
  end if;
  if v_current = p_is_gesy then
    return null;
  end if;

  v_id := public.request_submit('professional_gesy_change', p_professional_id,
    jsonb_build_object('is_gesy', p_is_gesy));
  update public.professionals set is_gesy = p_is_gesy, updated_at = now() where id = p_professional_id;
  return v_id;
end
$$;

comment on function public.request_apply_professional_specialty_add(public.request_log, jsonb, jsonb) is
  'Approval step of professional_specialty_add: adds the specialty with its licence number. Called only by request_approve.';
comment on function public.professional_specialty_remove(uuid, text) is
  'The professional removes a specialty (never her last): recorded in request_log at once. Service role only: the server checks the session first.';
comment on function public.professional_gesy_set(uuid, boolean) is
  'The professional turns GeSY on or off: recorded in request_log at once. Service role only: the server checks the session first.';

revoke all on function public.request_apply_professional_specialty_add(public.request_log, jsonb, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.professional_specialty_remove(uuid, text) from public, anon, authenticated;
revoke all on function public.professional_gesy_set(uuid, boolean) from public, anon, authenticated;
grant execute on function public.professional_specialty_remove(uuid, text) to service_role;
grant execute on function public.professional_gesy_set(uuid, boolean) to service_role;

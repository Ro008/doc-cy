-- Profile details changed from Settings (Settings → Profile, user 2026-10-10).
--
-- "Patients I see" (adults, children or all), "How you help patients" (bio),
-- languages and qualifications change as she pleases: no founder, but every change
-- is recorded in request_log, like GeSY. Two new columns on professionals:
-- patients_seen (null until she chooses) and qualifications (a list of at most 6
-- lines: id, title, institution, year). Each has a function that makes the change
-- and its record together (service role only: the server checks the session first).
--
-- Backward-compatible (new columns, types and functions; request_submit keeps its
-- signature, so grants are kept). Re-runnable.

-- 1. Columns.
alter table public.professionals
  add column if not exists patients_seen text,
  add column if not exists qualifications jsonb not null default '[]'::jsonb;

alter table public.professionals drop constraint if exists professionals_patients_seen_check;
alter table public.professionals add constraint professionals_patients_seen_check
  check (patients_seen in ('adults', 'children', 'all'));
alter table public.professionals drop constraint if exists professionals_qualifications_check;
alter table public.professionals add constraint professionals_qualifications_check
  check (case when jsonb_typeof(qualifications) = 'array' then jsonb_array_length(qualifications) <= 6 else false end);

comment on column public.professionals.patients_seen is
  'Who she sees: adults, children or all. Null until she chooses in Settings. Written by professional_patients_seen_set.';
comment on column public.professionals.qualifications is
  'Her qualifications, at most 6: [{id, title, institution, year}]. Written by professional_qualification_add / _remove.';

-- 2. Request types.
insert into public.request_types (name, requires_approval, is_edit, description)
values
  (
    'professional_patients_seen_change',
    false,
    true,
    'The professional chose who she sees (adults, children, all) in Settings. Recorded at once; before_snapshot keeps the old value.'
  ),
  (
    'professional_bio_change',
    false,
    true,
    'The professional changed "How you help patients" (bio) in Settings. Recorded at once; before_snapshot keeps the old text.'
  ),
  (
    'professional_languages_change',
    false,
    true,
    'The professional changed her languages in Settings. Recorded at once; before_snapshot keeps the old list.'
  ),
  (
    'professional_qualification_add',
    false,
    true,
    'The professional added a qualification in Settings. details: id, title, institution, year. Recorded at once; before_snapshot keeps the list she had.'
  ),
  (
    'professional_qualification_removal',
    false,
    true,
    'The professional removed a qualification in Settings. details: the removed line. Recorded at once; before_snapshot keeps the list she had.'
  )
on conflict (name) do update set description = excluded.description;

-- 3. request_submit: the snapshot step of the five types.
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

-- 4. Patients I see. Returns the request id, or null when nothing changed.
create or replace function public.professional_patients_seen_set(p_professional_id uuid, p_patients_seen text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_current text;
  v_id uuid;
begin
  if p_patients_seen is null or p_patients_seen not in ('adults', 'children', 'all') then
    raise exception 'patients seen is adults, children or all' using errcode = '22023';
  end if;
  select patients_seen into v_current from public.professionals where id = p_professional_id for update;
  if not found then
    raise exception 'professional % not found', p_professional_id using errcode = 'P0002';
  end if;
  if v_current is not distinct from p_patients_seen then
    return null;
  end if;

  v_id := public.request_submit('professional_patients_seen_change', p_professional_id,
    jsonb_build_object('patients_seen', p_patients_seen));
  update public.professionals set patients_seen = p_patients_seen, updated_at = now()
  where id = p_professional_id;
  return v_id;
end
$$;

-- 5. Bio ("How you help patients"): trimmed, empty means none, at most 1000 characters.
create or replace function public.professional_bio_set(p_professional_id uuid, p_bio text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_bio text := nullif(btrim(coalesce(p_bio, '')), '');
  v_current text;
  v_id uuid;
begin
  if length(v_bio) > 1000 then
    raise exception 'a bio has at most 1000 characters' using errcode = '22023';
  end if;
  select bio into v_current from public.professionals where id = p_professional_id for update;
  if not found then
    raise exception 'professional % not found', p_professional_id using errcode = 'P0002';
  end if;
  if v_current is not distinct from v_bio then
    return null;
  end if;

  v_id := public.request_submit('professional_bio_change', p_professional_id, jsonb_build_object('bio', v_bio));
  update public.professionals set bio = v_bio, updated_at = now() where id = p_professional_id;
  return v_id;
end
$$;

-- 6. Languages: at least one, none empty. The same languages in another order
--    change nothing. (The server checks the labels against the list it offers.)
create or replace function public.professional_languages_set(p_professional_id uuid, p_languages text[])
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_languages text[];
  v_current text[];
  v_id uuid;
begin
  if p_languages is null or cardinality(p_languages) = 0 then
    raise exception 'choose at least one language' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_languages) l where btrim(coalesce(l, '')) = '') then
    raise exception 'a language cannot be empty' using errcode = '22023';
  end if;
  -- Trimmed, without repeats, in the order she chose them.
  select array_agg(l order by first_at) into v_languages
  from (select btrim(l) as l, min(ord) as first_at
        from unnest(p_languages) with ordinality as t(l, ord) group by btrim(l)) picked;

  select languages into v_current from public.professionals where id = p_professional_id for update;
  if not found then
    raise exception 'professional % not found', p_professional_id using errcode = 'P0002';
  end if;
  if (select coalesce(array_agg(x order by x), '{}') from unnest(coalesce(v_current, '{}')) x)
     = (select array_agg(x order by x) from unnest(v_languages) x) then
    return null;
  end if;

  v_id := public.request_submit('professional_languages_change', p_professional_id,
    jsonb_build_object('languages', to_jsonb(v_languages)));
  update public.professionals set languages = v_languages, updated_at = now() where id = p_professional_id;
  return v_id;
end
$$;

-- 7. Add a qualification (at most 6: 23514). Returns {request_id, qualification}.
create or replace function public.professional_qualification_add(
  p_professional_id uuid,
  p_title text,
  p_institution text,
  p_year integer
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_title text := btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g'));
  v_institution text := btrim(regexp_replace(coalesce(p_institution, ''), '\s+', ' ', 'g'));
  v_current jsonb;
  v_line jsonb;
  v_id uuid;
begin
  if v_title = '' or length(v_title) > 80 then
    raise exception 'a qualification needs a title of 1 to 80 characters' using errcode = '22023';
  end if;
  if v_institution = '' or length(v_institution) > 100 then
    raise exception 'a qualification needs an institution of 1 to 100 characters' using errcode = '22023';
  end if;
  if p_year is not null and (p_year < 1950 or p_year > extract(year from now())::int) then
    raise exception 'the year of a qualification is between 1950 and this year' using errcode = '22023';
  end if;

  select qualifications into v_current from public.professionals where id = p_professional_id for update;
  if not found then
    raise exception 'professional % not found', p_professional_id using errcode = 'P0002';
  end if;
  if jsonb_array_length(v_current) >= 6 then
    raise exception 'a professional lists at most 6 qualifications' using errcode = '23514';
  end if;

  v_line := jsonb_build_object('id', gen_random_uuid(), 'title', v_title,
    'institution', v_institution, 'year', p_year);
  v_id := public.request_submit('professional_qualification_add', p_professional_id, v_line);
  update public.professionals set qualifications = v_current || jsonb_build_array(v_line), updated_at = now()
  where id = p_professional_id;
  return jsonb_build_object('request_id', v_id, 'qualification', v_line);
end
$$;

-- 8. Remove a qualification by its id (P0002 when it is not hers).
create or replace function public.professional_qualification_remove(
  p_professional_id uuid,
  p_qualification_id uuid
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_current jsonb;
  v_line jsonb;
  v_id uuid;
begin
  select qualifications into v_current from public.professionals where id = p_professional_id for update;
  if not found then
    raise exception 'professional % not found', p_professional_id using errcode = 'P0002';
  end if;
  select q into v_line from jsonb_array_elements(v_current) q
  where q ->> 'id' = p_qualification_id::text limit 1;
  if v_line is null then
    raise exception 'she does not have this qualification' using errcode = 'P0002';
  end if;

  v_id := public.request_submit('professional_qualification_removal', p_professional_id, v_line);
  update public.professionals
  set qualifications = coalesce(
        (select jsonb_agg(q order by ord) from jsonb_array_elements(v_current) with ordinality as t(q, ord)
         where q ->> 'id' <> p_qualification_id::text),
        '[]'::jsonb),
      updated_at = now()
  where id = p_professional_id;
  return v_id;
end
$$;

comment on function public.professional_patients_seen_set(uuid, text) is
  'The professional chooses who she sees: recorded in request_log at once. Service role only: the server checks the session first.';
comment on function public.professional_bio_set(uuid, text) is
  'The professional changes her bio: recorded in request_log at once. Service role only: the server checks the session first.';
comment on function public.professional_languages_set(uuid, text[]) is
  'The professional changes her languages: recorded in request_log at once. Service role only: the server checks the session first.';
comment on function public.professional_qualification_add(uuid, text, text, integer) is
  'The professional adds a qualification (at most 6): recorded in request_log at once. Service role only: the server checks the session first.';
comment on function public.professional_qualification_remove(uuid, uuid) is
  'The professional removes a qualification: recorded in request_log at once. Service role only: the server checks the session first.';

revoke all on function public.professional_patients_seen_set(uuid, text) from public, anon, authenticated;
revoke all on function public.professional_bio_set(uuid, text) from public, anon, authenticated;
revoke all on function public.professional_languages_set(uuid, text[]) from public, anon, authenticated;
revoke all on function public.professional_qualification_add(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.professional_qualification_remove(uuid, uuid) from public, anon, authenticated;
grant execute on function public.professional_patients_seen_set(uuid, text) to service_role;
grant execute on function public.professional_bio_set(uuid, text) to service_role;
grant execute on function public.professional_languages_set(uuid, text[]) to service_role;
grant execute on function public.professional_qualification_add(uuid, text, text, integer) to service_role;
grant execute on function public.professional_qualification_remove(uuid, uuid) to service_role;

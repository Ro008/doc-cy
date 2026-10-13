-- Joining and leaving a clinic from Settings (Settings → Clinics, user 2026-10-11).
--
-- She joins a clinic DocCy already has at once: no founder, recorded in request_log.
-- The clinic starts with the week given at registration (Monday to Friday, 9 to 17,
-- 30 minutes) and with online booking off until she switches it on. At most 5 clinics.
-- She leaves a clinic at once too, recorded with the settings she had there, but never
-- her last clinic (an archived clinic does not count): the functions refuse it, and
-- the table refuses to be left empty for a signed-up professional. Each function makes
-- the change and its record together (service role only: the server checks the
-- session first). Visits at a clinic she left are kept: appointments point at the
-- clinic, not at her link to it.
--
-- There is no "primary clinic" (user, 2026-10-11): her clinics are ordered by
-- sort_order, then created_at. The two functions that used
-- professional_clinics.is_primary stop here; the column itself is dropped later, once
-- the code that no longer reads it is live.
--
-- So that nothing moves on screen, the order is first rewritten to what is shown today:
-- the clinic marked primary first, then the rest as they were (step 7).
--
-- Backward-compatible (new types, functions and a trigger; the changed functions keep
-- their signatures, so grants are kept; the code that still sorts by is_primary first
-- sees the same order). Re-runnable.

-- 1. Request types.
insert into public.request_types (name, requires_approval, is_edit, description)
values
  (
    'professional_clinic_join',
    false,
    true,
    'The professional joined a clinic DocCy already has, in Settings. details: link_id, clinic_id, clinic_name, clinic_address. Recorded at once; before_snapshot keeps the clinics she had.'
  ),
  (
    'professional_clinic_leave',
    false,
    true,
    'The professional left a clinic in Settings. details: link_id, clinic_id, clinic_name, clinic_address. Recorded at once; before_snapshot keeps her settings at that clinic (hours, slot length, online booking).'
  )
on conflict (name) do update set description = excluded.description;

-- 2. request_submit: the snapshot step of the two types.
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

-- 3. Join a clinic DocCy has (P0002 unknown or archived clinic; 23505 already hers;
--    23514 already 5 clinics; 22023 not signed up). Returns {request_id, link_id, clinic_id}.
create or replace function public.professional_clinic_join(p_professional_id uuid, p_clinic_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_clinic public.clinics%rowtype;
  v_link uuid := gen_random_uuid();
  v_order int;
  v_id uuid;
begin
  -- Her row is the lock: two changes to her clinics wait for each other.
  perform 1 from public.professionals where id = p_professional_id for update;
  if not found then
    raise exception 'professional % not found', p_professional_id using errcode = 'P0002';
  end if;
  select * into v_clinic from public.clinics c where c.id = p_clinic_id and not c.is_archived;
  if not found then
    raise exception 'clinic % not found', p_clinic_id using errcode = 'P0002';
  end if;
  if exists (select 1 from public.professional_clinics pc
             where pc.professional_id = p_professional_id and pc.clinic_id = p_clinic_id) then
    raise exception 'she already works at this clinic' using errcode = '23505';
  end if;
  if (select count(*) from public.professional_clinics pc
      join public.clinics c on c.id = pc.clinic_id
      where pc.professional_id = p_professional_id and not c.is_archived) >= 5 then
    raise exception 'a professional has at most 5 clinics' using errcode = '23514';
  end if;

  v_id := public.request_submit('professional_clinic_join', p_professional_id, jsonb_build_object(
    'link_id', v_link, 'clinic_id', v_clinic.id, 'clinic_name', v_clinic.name, 'clinic_address', v_clinic.address));
  select coalesce(max(pc.sort_order), -1) + 1 into v_order
  from public.professional_clinics pc where pc.professional_id = p_professional_id;
  insert into public.professional_clinics (
    id, professional_id, clinic_id, sort_order, pause_online_bookings,
    monday, tuesday, wednesday, thursday, friday, saturday, sunday,
    start_time, end_time, slot_duration_minutes
  )
  values (
    v_link, p_professional_id, p_clinic_id, v_order, true,
    true, true, true, true, true, false, false,
    '09:00', '17:00', 30
  );
  return jsonb_build_object('request_id', v_id, 'link_id', v_link, 'clinic_id', p_clinic_id);
end
$$;

-- 4. Leave one of her clinics, by her link to it (P0002 not hers; 23514 it is her last
--    clinic that is not archived). Returns the request id.
create or replace function public.professional_clinic_leave(p_professional_id uuid, p_link_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_clinic public.clinics%rowtype;
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

  v_id := public.request_submit('professional_clinic_leave', p_professional_id, jsonb_build_object(
    'link_id', p_link_id, 'clinic_id', v_clinic.id, 'clinic_name', v_clinic.name, 'clinic_address', v_clinic.address));
  delete from public.professional_clinics where id = p_link_id;
  return v_id;
end
$$;

-- 5. The table itself keeps one clinic for a signed-up professional. Checked at the
--    end of the transaction, so replacing her clinics in one go (the registration
--    approval) and deleting the professional herself both still work.
create or replace function public.professional_clinics_keep_one()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.professionals p where p.id = old.professional_id and p.is_registered)
     and not exists (select 1 from public.professional_clinics pc where pc.professional_id = old.professional_id) then
    raise exception 'a professional keeps at least one clinic' using errcode = '23514';
  end if;
  return null;
end
$$;

drop trigger if exists professional_clinics_keep_one on public.professional_clinics;
create constraint trigger professional_clinics_keep_one
  after delete on public.professional_clinics
  deferrable initially deferred
  for each row execute function public.professional_clinics_keep_one();

-- 6. No "primary clinic": a visit whose clinic she has since left takes the slot
--    length of her first clinic, and the registration approval no longer marks one.
create or replace function public.public_professionals_occupied_datetimes(
  p_professional_ids uuid[],
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE(professional_id uuid, appointment_datetime timestamptz)
LANGUAGE sql
STABLE
SET search_path = ''
AS $function$
  SELECT DISTINCT sub.professional_id, sub.appointment_datetime
  FROM (
    -- Active visits: every slot start the visit covers.
    SELECT a.professional_id AS professional_id,
      (a.appointment_datetime + (gs.n::text || ' minutes')::interval) AS appointment_datetime
    FROM public.appointments a
    INNER JOIN public.professionals d ON d.id = a.professional_id
    LEFT JOIN LATERAL (
      SELECT pp.slot_duration_minutes FROM public.professional_clinics pp
      WHERE pp.professional_id = a.professional_id
      ORDER BY pp.sort_order, pp.created_at LIMIT 1
    ) AS prim ON true
    LEFT JOIN public.professional_clinics pc
      ON pc.professional_id = a.professional_id AND pc.clinic_id = a.clinic_id
    CROSS JOIN LATERAL (
      SELECT
        GREATEST(COALESCE(pc.slot_duration_minutes, prim.slot_duration_minutes, 30), 1) AS step_m,
        GREATEST(COALESCE(a.duration_minutes, pc.slot_duration_minutes, prim.slot_duration_minutes, 30), 1) AS dur_m,
        GREATEST(COALESCE(pc.slot_duration_minutes, prim.slot_duration_minutes, 30), 1) AS book_m
    ) AS meta
    CROSS JOIN LATERAL generate_series(
      0,
      ((meta.dur_m - 1) / meta.step_m) * meta.step_m,
      meta.step_m
    ) AS gs(n)
    WHERE a.professional_id = ANY(p_professional_ids)
      AND d.is_registered
      AND a.status IN ('REQUESTED', 'CONFIRMED')
      AND (a.appointment_datetime + (gs.n::text || ' minutes')::interval) >= p_from
      AND (a.appointment_datetime + (gs.n::text || ' minutes')::interval) <= p_to

    UNION ALL

    -- Live counter-offers: every slot start each proposed time covers.
    SELECT a.professional_id,
      (ps.elem::timestamptz + (gs.n::text || ' minutes')::interval)
    FROM public.appointments a
    INNER JOIN public.professionals d ON d.id = a.professional_id
    LEFT JOIN LATERAL (
      SELECT pp.slot_duration_minutes FROM public.professional_clinics pp
      WHERE pp.professional_id = a.professional_id
      ORDER BY pp.sort_order, pp.created_at LIMIT 1
    ) AS prim ON true
    LEFT JOIN public.professional_clinics pc
      ON pc.professional_id = a.professional_id AND pc.clinic_id = a.clinic_id
    CROSS JOIN LATERAL jsonb_array_elements_text(
      COALESCE(a.proposed_slots, '[]'::jsonb)
    ) AS ps(elem)
    CROSS JOIN LATERAL (
      SELECT
        GREATEST(COALESCE(pc.slot_duration_minutes, prim.slot_duration_minutes, 30), 1) AS step_m,
        GREATEST(COALESCE(a.duration_minutes, pc.slot_duration_minutes, prim.slot_duration_minutes, 30), 1) AS dur_m,
        GREATEST(COALESCE(pc.slot_duration_minutes, prim.slot_duration_minutes, 30), 1) AS book_m
    ) AS meta
    CROSS JOIN LATERAL generate_series(
      0,
      ((meta.dur_m - 1) / meta.step_m) * meta.step_m,
      meta.step_m
    ) AS gs(n)
    WHERE a.professional_id = ANY(p_professional_ids)
      AND d.is_registered
      AND a.status = 'NEEDS_RESCHEDULE'
      AND a.proposal_expires_at IS NOT NULL
      AND a.proposal_expires_at > now()
      AND jsonb_array_length(COALESCE(a.proposed_slots, '[]'::jsonb)) > 0
      AND (ps.elem::timestamptz + (gs.n::text || ' minutes')::interval) >= p_from
      AND (ps.elem::timestamptz + (gs.n::text || ' minutes')::interval) <= p_to

    UNION ALL

    -- Active visits: earlier slot starts whose booking would overlap the visit.
    SELECT a.professional_id,
      (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval)
    FROM public.appointments a
    INNER JOIN public.professionals d ON d.id = a.professional_id
    LEFT JOIN LATERAL (
      SELECT pp.slot_duration_minutes FROM public.professional_clinics pp
      WHERE pp.professional_id = a.professional_id
      ORDER BY pp.sort_order, pp.created_at LIMIT 1
    ) AS prim ON true
    LEFT JOIN public.professional_clinics pc
      ON pc.professional_id = a.professional_id AND pc.clinic_id = a.clinic_id
    CROSS JOIN LATERAL (
      SELECT
        GREATEST(COALESCE(pc.slot_duration_minutes, prim.slot_duration_minutes, 30), 1) AS step_m,
        GREATEST(COALESCE(a.duration_minutes, pc.slot_duration_minutes, prim.slot_duration_minutes, 30), 1) AS dur_m,
        GREATEST(COALESCE(pc.slot_duration_minutes, prim.slot_duration_minutes, 30), 1) AS book_m
    ) AS meta
    CROSS JOIN LATERAL (
      SELECT
        a.appointment_datetime AS bs,
        a.appointment_datetime + (meta.dur_m::text || ' minutes')::interval AS be
    ) AS iv
    CROSS JOIN LATERAL generate_series(
      1,
      LEAST(
        2000,
        CEIL(
          (EXTRACT(EPOCH FROM (iv.be - iv.bs)) / 60.0) / NULLIF(meta.step_m, 0)
          + meta.book_m / NULLIF(meta.step_m, 0)
          + 5
        )::int
      )
    ) AS bk(k)
    WHERE a.professional_id = ANY(p_professional_ids)
      AND d.is_registered
      AND a.status IN ('REQUESTED', 'CONFIRMED')
      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval)
          + (meta.book_m::text || ' minutes')::interval > iv.bs
      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) < iv.be
      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) >= p_from
      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) <= p_to

    UNION ALL

    -- Live counter-offers: earlier slot starts whose booking would overlap them.
    SELECT a.professional_id,
      (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval)
    FROM public.appointments a
    INNER JOIN public.professionals d ON d.id = a.professional_id
    LEFT JOIN LATERAL (
      SELECT pp.slot_duration_minutes FROM public.professional_clinics pp
      WHERE pp.professional_id = a.professional_id
      ORDER BY pp.sort_order, pp.created_at LIMIT 1
    ) AS prim ON true
    LEFT JOIN public.professional_clinics pc
      ON pc.professional_id = a.professional_id AND pc.clinic_id = a.clinic_id
    CROSS JOIN LATERAL jsonb_array_elements_text(
      COALESCE(a.proposed_slots, '[]'::jsonb)
    ) AS ps(elem)
    CROSS JOIN LATERAL (
      SELECT
        GREATEST(COALESCE(pc.slot_duration_minutes, prim.slot_duration_minutes, 30), 1) AS step_m,
        GREATEST(COALESCE(a.duration_minutes, pc.slot_duration_minutes, prim.slot_duration_minutes, 30), 1) AS dur_m,
        GREATEST(COALESCE(pc.slot_duration_minutes, prim.slot_duration_minutes, 30), 1) AS book_m
    ) AS meta
    CROSS JOIN LATERAL (
      SELECT
        ps.elem::timestamptz AS bs,
        ps.elem::timestamptz + (meta.dur_m::text || ' minutes')::interval AS be
    ) AS iv
    CROSS JOIN LATERAL generate_series(
      1,
      LEAST(
        2000,
        CEIL(
          (EXTRACT(EPOCH FROM (iv.be - iv.bs)) / 60.0) / NULLIF(meta.step_m, 0)
          + meta.book_m / NULLIF(meta.step_m, 0)
          + 5
        )::int
      )
    ) AS bk(k)
    WHERE a.professional_id = ANY(p_professional_ids)
      AND d.is_registered
      AND a.status = 'NEEDS_RESCHEDULE'
      AND a.proposal_expires_at IS NOT NULL
      AND a.proposal_expires_at > now()
      AND jsonb_array_length(COALESCE(a.proposed_slots, '[]'::jsonb)) > 0
      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval)
          + (meta.book_m::text || ' minutes')::interval > iv.bs
      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) < iv.be
      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) >= p_from
      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) <= p_to
  ) AS sub
$function$;

comment on function public.public_professionals_occupied_datetimes(uuid[], timestamptz, timestamptz) is
  'Slot starts taken for many professionals at once. Service role only. The single source of the occupancy rules; slot length from the visit''s clinic link (clinic_id), else her first clinic, else 30 min. Must match lib/appointment-overlap.ts.';

create or replace function public.request_apply_professional_registration(
  p_req public.request_log,
  p_details jsonb,
  p_options jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_options jsonb := coalesce(p_options, '{}'::jsonb);
  v_slug text := nullif(btrim(coalesce(v_options ->> 'slug', '')), '');
  v_avatar text := nullif(btrim(coalesce(v_options ->> 'avatar_path', '')), '');
  v_months int;
  v_until timestamptz;
  v_email text := btrim(coalesce(p_details ->> 'email', ''));
  v_name text;
  v_founders boolean := coalesce((p_req.details ->> 'founders_club')::boolean, false);
  v_tier text;
  v_is_test boolean;
  v_listing_id uuid;
  v_listing public.professionals%rowtype;
  v_pro uuid;
  v_previous_slug text;
  v_clinic jsonb;
  v_clinic_id uuid;
  v_created boolean;
  v_district public.cyprus_district;
  v_clinics_out jsonb := '[]'::jsonb;
  v_i int := 0;
  v_spec jsonb;
begin
  -- The email is the applicant's login: founders can't change it.
  if v_email is distinct from btrim(coalesce(p_req.details ->> 'email', '')) or v_email = '' then
    raise exception 'the email is the applicant''s login and can''t be changed' using errcode = '22023';
  end if;
  if v_slug is null then
    raise exception 'approving a registration needs a slug' using errcode = '22023';
  end if;
  if p_req.applicant_auth_user_id is null
     or not exists (select 1 from auth.users u where u.id = p_req.applicant_auth_user_id) then
    raise exception 'the applicant''s login no longer exists' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.professionals p where p.auth_user_id = p_req.applicant_auth_user_id) then
    raise exception 'the applicant''s login already has a professional profile' using errcode = '55000';
  end if;

  v_name := btrim(btrim(coalesce(p_details ->> 'first_name', '')) || ' ' || btrim(coalesce(p_details ->> 'last_name', '')));
  if v_name = '' or coalesce(p_details ->> 'gender', '') not in ('male', 'female')
     or jsonb_typeof(p_details -> 'gesy') <> 'boolean'
     or jsonb_typeof(p_details -> 'languages') <> 'array' or jsonb_array_length(p_details -> 'languages') = 0
     or jsonb_typeof(p_details -> 'specialties') <> 'array' or jsonb_array_length(p_details -> 'specialties') = 0
     or jsonb_typeof(p_details -> 'clinics') <> 'array' or jsonb_array_length(p_details -> 'clinics') = 0 then
    raise exception 'the registration details are incomplete' using errcode = '22023';
  end if;

  if v_options ? 'trial_months' and jsonb_typeof(v_options -> 'trial_months') <> 'null' then
    if jsonb_typeof(v_options -> 'trial_months') <> 'number'
       or (v_options ->> 'trial_months')::numeric <> trunc((v_options ->> 'trial_months')::numeric)
       or (v_options ->> 'trial_months')::numeric not between 0 and 24 then
      raise exception 'trial months must be a whole number from 0 to 24' using errcode = '22023';
    end if;
    v_months := (v_options ->> 'trial_months')::int;
  else
    select (s.value #>> '{}')::int into v_months from public.app_settings s where s.key = 'trial_months';
    v_months := coalesce(v_months, 6);
  end if;
  v_until := case when v_months > 0
    then ((now() at time zone 'Asia/Nicosia') + make_interval(months => v_months)) at time zone 'Asia/Nicosia'
  end;

  v_tier := case when v_founders then 'founder' else 'standard' end;
  v_is_test := public.is_test_doctor_registration_email(v_email);

  v_listing_id := nullif(p_details ->> 'claimed_professional_id', '')::uuid;
  if v_listing_id is not null then
    select * into v_listing from public.professionals p where p.id = v_listing_id for update;
    if not found then
      raise exception 'the claimed listing % no longer exists', v_listing_id using errcode = 'P0002';
    end if;
    if v_listing.is_registered or v_listing.is_archived then
      raise exception 'the claimed listing is already registered (or archived): check the listing URL'
        using errcode = '55000';
    end if;
    v_previous_slug := v_listing.slug;
    update public.professionals p
    set is_registered = true,
        auth_user_id = p_req.applicant_auth_user_id,
        name = v_name,
        gender = p_details ->> 'gender',
        is_gesy = (p_details ->> 'gesy')::boolean,
        registration_email = v_email,
        mobile_number = nullif(btrim(coalesce(p_details ->> 'mobile', '')), ''),
        languages = array(select jsonb_array_elements_text(p_details -> 'languages')),
        avatar_url = v_avatar,
        slug = v_slug,
        subscription_tier = v_tier,
        is_test_profile = v_is_test or p.is_test_profile,
        pro_access_until = v_until,
        updated_at = now()
    where p.id = v_listing_id;
    v_pro := v_listing_id;
    if v_previous_slug is not null and btrim(v_previous_slug) <> ''
       and lower(btrim(v_previous_slug)) <> lower(v_slug) then
      insert into public.professional_slug_redirects (slug, professional_id)
      values (v_previous_slug, v_pro)
      on conflict (slug) do update set professional_id = excluded.professional_id;
    end if;
    delete from public.professional_specialties ps where ps.professional_id = v_pro;
    -- Only the links go; clinics are deleted by founders alone.
    delete from public.professional_clinics pc where pc.professional_id = v_pro;
  else
    insert into public.professionals (
      auth_user_id, name, gender, is_gesy, registration_email, mobile_number, languages,
      avatar_url, slug, is_registered, subscription_tier, is_test_profile,
      pro_access_until, is_archived
    )
    values (
      p_req.applicant_auth_user_id, v_name, p_details ->> 'gender', (p_details ->> 'gesy')::boolean, v_email,
      nullif(btrim(coalesce(p_details ->> 'mobile', '')), ''),
      array(select jsonb_array_elements_text(p_details -> 'languages')),
      v_avatar, v_slug, true, v_tier, v_is_test,
      v_until, false
    )
    returning id into v_pro;
  end if;

  insert into public.professional_settings (professional_id)
  values (v_pro)
  on conflict (professional_id) do nothing;

  -- Specialties (a custom label joins the catalogue).
  for v_spec in select * from jsonb_array_elements(p_details -> 'specialties') loop
    if btrim(coalesce(v_spec ->> 'name', '')) = '' then
      raise exception 'every specialty needs a name' using errcode = '22023';
    end if;
    insert into public.professional_specialties (professional_id, specialty, license_number)
    values (v_pro, btrim(v_spec ->> 'name'), nullif(btrim(coalesce(v_spec ->> 'license_number', '')), ''));
  end loop;

  -- Clinics: picked ones are linked, proposed ones created. Links start paused, with
  -- the default weekday hours registration has always given.
  for v_clinic in select * from jsonb_array_elements(p_details -> 'clinics') loop
    v_clinic_id := nullif(v_clinic ->> 'clinic_id', '')::uuid;
    v_created := false;
    if v_clinic_id is not null then
      if not exists (select 1 from public.clinics c where c.id = v_clinic_id and not c.is_archived) then
        raise exception 'clinic % not found', v_clinic_id using errcode = 'P0002';
      end if;
    else
      if btrim(coalesce(v_clinic ->> 'name', '')) = '' or btrim(coalesce(v_clinic ->> 'address', '')) = '' then
        raise exception 'a new clinic needs a name and an address' using errcode = '22023';
      end if;
      begin
        v_district := (v_clinic ->> 'district')::public.cyprus_district;
      exception when invalid_text_representation then
        raise exception 'unknown district %', v_clinic ->> 'district' using errcode = '22023';
      end;
      insert into public.clinics (name, slug, district, address, town, latitude, longitude, clinic_place_id, phone)
      values (
        btrim(v_clinic ->> 'name'),
        public.request_clinic_slug(v_clinic ->> 'name'),
        v_district,
        btrim(v_clinic ->> 'address'),
        nullif(btrim(coalesce(v_clinic ->> 'town', '')), ''),
        (v_clinic ->> 'latitude')::double precision,
        (v_clinic ->> 'longitude')::double precision,
        nullif(btrim(coalesce(v_clinic ->> 'place_id', '')), ''),
        -- The public Call button shows the clinic's phone (8 national digits; the app validates it).
        nullif(btrim(coalesce(v_clinic ->> 'phone', '')), '')
      )
      returning id into v_clinic_id;
      v_created := true;
    end if;
    insert into public.professional_clinics (
      professional_id, clinic_id, sort_order, pause_online_bookings,
      monday, tuesday, wednesday, thursday, friday, saturday, sunday,
      start_time, end_time, slot_duration_minutes
    )
    values (
      v_pro, v_clinic_id, v_i, true,
      true, true, true, true, true, false, false,
      '09:00', '17:00', 30
    );
    v_clinics_out := v_clinics_out || jsonb_build_object('clinic_id', v_clinic_id, 'created', v_created);
    v_i := v_i + 1;
  end loop;

  return jsonb_build_object(
    'professional_id', v_pro,
    'claimed_listing', v_listing_id is not null,
    'slug', v_slug,
    'previous_slug', case when v_listing_id is not null then v_previous_slug end,
    'subscription_tier', v_tier,
    'trial_months', v_months,
    'pro_access_until', v_until,
    'avatar_path', v_avatar,
    'clinics', v_clinics_out
  );
end
$$;

-- 7. Keep today's order without is_primary: number each professional's clinics from 0,
--    the primary one first, then by the old sort_order and date. Skipped once the
--    column is gone.
do $do$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'professional_clinics' and column_name = 'is_primary'
  ) then
    execute $sql$
      update public.professional_clinics pc
      set sort_order = r.position
      from (
        select id, (row_number() over (
          partition by professional_id order by is_primary desc, sort_order, created_at, id
        ) - 1)::int as position
        from public.professional_clinics
      ) r
      where r.id = pc.id and pc.sort_order is distinct from r.position
    $sql$;
  end if;
end
$do$;

comment on function public.professional_clinic_join(uuid, uuid) is
  'The professional joins a clinic DocCy has (at most 5, online booking off to start): recorded in request_log at once. Service role only: the server checks the session first.';
comment on function public.professional_clinic_leave(uuid, uuid) is
  'The professional leaves a clinic, never her last one: recorded in request_log at once with her settings there. Service role only: the server checks the session first.';
comment on function public.professional_clinics_keep_one() is
  'Constraint trigger: a signed-up professional is never left without a clinic.';

revoke all on function public.professional_clinic_join(uuid, uuid) from public, anon, authenticated;
revoke all on function public.professional_clinic_leave(uuid, uuid) from public, anon, authenticated;
revoke all on function public.professional_clinics_keep_one() from public, anon, authenticated;
grant execute on function public.professional_clinic_join(uuid, uuid) to service_role;
grant execute on function public.professional_clinic_leave(uuid, uuid) to service_role;

-- Point E6: professional_settings keeps professional-level settings only (holiday,
-- booking horizon, minimum notice; user, 2026-10-01). The schedule (days, hours, break,
-- slot length, pause) lives on each clinic link (professional_clinics, Point D3a); the
-- copies of the primary link on professional_settings, kept in step by
-- professional_clinics_sync_primary_settings, are dropped. Nothing in the app reads or
-- writes them any more. Backward-compatible once that code is live: apply to Production
-- after the PR merges.

-- Guard: the copies hold nothing the links don't (each row equals its primary link, or
-- the professional has no primary link with hours).
do $$
begin
  if to_regclass('public.professional_settings') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'professional_settings'
         and column_name = 'slot_duration_minutes'
     )
     and exists (
       select 1
       from public.professional_settings ps
       join public.professional_clinics pc
         on pc.professional_id = ps.professional_id and pc.is_primary and pc.start_time is not null
       join public.professionals p on p.id = ps.professional_id and p.is_registered
       where (ps.pause_online_bookings, ps.monday, ps.tuesday, ps.wednesday, ps.thursday,
              ps.friday, ps.saturday, ps.sunday, ps.start_time, ps.end_time,
              ps.weekly_schedule, ps.break_start, ps.break_end, ps.slot_duration_minutes)
             is distinct from
             (pc.pause_online_bookings, pc.monday, pc.tuesday, pc.wednesday, pc.thursday,
              pc.friday, pc.saturday, pc.sunday, pc.start_time, pc.end_time,
              pc.weekly_schedule, pc.break_start, pc.break_end, pc.slot_duration_minutes)
     ) then
    raise exception 'a professional_settings schedule differs from its primary clinic link';
  end if;
end
$$;

-- 1. Occupancy: an appointment with no clinic takes the primary clinic's slot length
--    instead of the copy (otherwise as in 20260925070110_batch_professionals_occupied_datetimes;
--    CREATE OR REPLACE keeps the comment and grants).
CREATE OR REPLACE FUNCTION public.public_professionals_occupied_datetimes(
  p_professional_ids uuid[],
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE(professional_id uuid, location_id uuid, appointment_datetime timestamptz)
LANGUAGE sql
STABLE
SET search_path = ''
AS $function$
  SELECT DISTINCT sub.professional_id, sub.location_id, sub.appointment_datetime
  FROM (
    -- Active visits: every slot start the visit covers.
    SELECT a.doctor_id AS professional_id, a.location_id,
      (a.appointment_datetime + (gs.n::text || ' minutes')::interval) AS appointment_datetime
    FROM public.appointments a
    INNER JOIN public.professionals d ON d.id = a.doctor_id
    LEFT JOIN LATERAL (
      SELECT pp.slot_duration_minutes FROM public.professional_clinics pp
      WHERE pp.professional_id = a.doctor_id AND pp.is_primary
      ORDER BY pp.sort_order, pp.created_at LIMIT 1
    ) AS prim ON true
    LEFT JOIN public.professional_clinics pc ON pc.id = a.location_id
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
    WHERE a.doctor_id = ANY(p_professional_ids)
      AND d.status = 'verified'
      AND a.status IN ('REQUESTED', 'CONFIRMED')
      AND (a.appointment_datetime + (gs.n::text || ' minutes')::interval) >= p_from
      AND (a.appointment_datetime + (gs.n::text || ' minutes')::interval) <= p_to

    UNION ALL

    -- Live counter-offers: every slot start each proposed time covers.
    SELECT a.doctor_id, a.location_id,
      (ps.elem::timestamptz + (gs.n::text || ' minutes')::interval)
    FROM public.appointments a
    INNER JOIN public.professionals d ON d.id = a.doctor_id
    LEFT JOIN LATERAL (
      SELECT pp.slot_duration_minutes FROM public.professional_clinics pp
      WHERE pp.professional_id = a.doctor_id AND pp.is_primary
      ORDER BY pp.sort_order, pp.created_at LIMIT 1
    ) AS prim ON true
    LEFT JOIN public.professional_clinics pc ON pc.id = a.location_id
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
    WHERE a.doctor_id = ANY(p_professional_ids)
      AND d.status = 'verified'
      AND a.status = 'NEEDS_RESCHEDULE'
      AND a.proposal_expires_at IS NOT NULL
      AND a.proposal_expires_at > now()
      AND jsonb_array_length(COALESCE(a.proposed_slots, '[]'::jsonb)) > 0
      AND (ps.elem::timestamptz + (gs.n::text || ' minutes')::interval) >= p_from
      AND (ps.elem::timestamptz + (gs.n::text || ' minutes')::interval) <= p_to

    UNION ALL

    -- Active visits: earlier slot starts whose booking would overlap the visit.
    SELECT a.doctor_id, a.location_id,
      (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval)
    FROM public.appointments a
    INNER JOIN public.professionals d ON d.id = a.doctor_id
    LEFT JOIN LATERAL (
      SELECT pp.slot_duration_minutes FROM public.professional_clinics pp
      WHERE pp.professional_id = a.doctor_id AND pp.is_primary
      ORDER BY pp.sort_order, pp.created_at LIMIT 1
    ) AS prim ON true
    LEFT JOIN public.professional_clinics pc ON pc.id = a.location_id
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
    WHERE a.doctor_id = ANY(p_professional_ids)
      AND d.status = 'verified'
      AND a.status IN ('REQUESTED', 'CONFIRMED')
      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval)
          + (meta.book_m::text || ' minutes')::interval > iv.bs
      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) < iv.be
      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) >= p_from
      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) <= p_to

    UNION ALL

    -- Live counter-offers: earlier slot starts whose booking would overlap them.
    SELECT a.doctor_id, a.location_id,
      (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval)
    FROM public.appointments a
    INNER JOIN public.professionals d ON d.id = a.doctor_id
    LEFT JOIN LATERAL (
      SELECT pp.slot_duration_minutes FROM public.professional_clinics pp
      WHERE pp.professional_id = a.doctor_id AND pp.is_primary
      ORDER BY pp.sort_order, pp.created_at LIMIT 1
    ) AS prim ON true
    LEFT JOIN public.professional_clinics pc ON pc.id = a.location_id
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
    WHERE a.doctor_id = ANY(p_professional_ids)
      AND d.status = 'verified'
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

-- 2. Registering creates the account settings row only (otherwise as in
--    20261001064808_drop_doctor_locations).
create or replace function public.create_professional_settings_on_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.is_registered, false) then
    insert into public.professional_settings (professional_id)
    values (new.id)
    on conflict (professional_id) do nothing;
  end if;
  return new;
end
$$;

-- 3. Approving a registration creates the account settings row only; its clinic links
--    start paused (otherwise as in 20261001094427_drop_professionals_finder_visible_segment).
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
        status = 'verified',
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
      avatar_url, slug, status, is_registered, subscription_tier, is_test_profile,
      pro_access_until, is_archived
    )
    values (
      p_req.applicant_auth_user_id, v_name, p_details ->> 'gender', (p_details ->> 'gesy')::boolean, v_email,
      nullif(btrim(coalesce(p_details ->> 'mobile', '')), ''),
      array(select jsonb_array_elements_text(p_details -> 'languages')),
      v_avatar, v_slug, 'verified', true, v_tier, v_is_test,
      v_until, false
    )
    returning id into v_pro;
  end if;

  insert into public.professional_settings (professional_id)
  values (v_pro)
  on conflict (professional_id) do nothing;

  -- Specialties, approved by this decision (a custom label joins the catalogue).
  for v_spec in select * from jsonb_array_elements(p_details -> 'specialties') loop
    if btrim(coalesce(v_spec ->> 'name', '')) = '' then
      raise exception 'every specialty needs a name' using errcode = '22023';
    end if;
    insert into public.professional_specialties (professional_id, specialty, license_number, is_approved)
    values (v_pro, btrim(v_spec ->> 'name'), nullif(btrim(coalesce(v_spec ->> 'license_number', '')), ''), true);
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
      professional_id, clinic_id, is_primary, sort_order, pause_online_bookings,
      monday, tuesday, wednesday, thursday, friday, saturday, sunday,
      start_time, end_time, slot_duration_minutes
    )
    values (
      v_pro, v_clinic_id, v_i = 0, v_i, true,
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

-- 4. The copy trigger and its function.
drop trigger if exists professional_clinics_sync_primary_settings on public.professional_clinics;
drop function if exists public.professional_clinics_sync_primary_settings();

-- 5. The copies.
alter table public.professional_settings
  drop constraint if exists professional_settings_slot_duration_minutes_check;

alter table public.professional_settings
  drop column if exists monday,
  drop column if exists tuesday,
  drop column if exists wednesday,
  drop column if exists thursday,
  drop column if exists friday,
  drop column if exists saturday,
  drop column if exists sunday,
  drop column if exists start_time,
  drop column if exists end_time,
  drop column if exists break_start,
  drop column if exists break_end,
  drop column if exists slot_duration_minutes,
  drop column if exists weekly_schedule,
  drop column if exists pause_online_bookings;

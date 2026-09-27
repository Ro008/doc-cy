-- Registration redesign, build PR 4: approving professional_registration requests.
--
-- * request_approve gains p_options (per-type approval inputs chosen by the app:
--   for professional_registration the public slug, the approved photo's path in
--   the avatars bucket and an optional trial override). The four-argument version
--   is dropped so calls stay unambiguous.
-- * request_apply_professional_registration does the approval in the same
--   transaction as the decision: a new profile is inserted, or a claimed listing
--   (still unregistered, locked) is updated in place (same id, votes and clicks),
--   its specialties and clinic links replaced (clinics themselves are never
--   deleted) and its old slug redirected. Specialties are written approved;
--   picked clinics are linked, proposed ones created; links start paused with the
--   old path's default hours (Mon-Fri 09:00-17:00, 30-minute slots). The trial
--   sets pro_access_until (Cyprus calendar); 0 months = none (has_online_booking
--   follows it, so the transitional default trigger from build PR 2 leaves an
--   explicit "no access" alone).
--   No Point E columns (district, town, phone, addresses, coordinates) are written.
-- * create_primary_doctor_location skips its addressless doctor_locations row while
--   an approval runs (transaction-local doccy.registration_approval), so approved
--   professionals live only in clinics / professional_clinics. The old /register
--   path keeps its behaviour until the contract step after merge drops the trigger.
-- * The guard lets the approval fill professional_id on a registration request.
--
-- Backward-compatible (the old path is unchanged). Idempotent. Service role only.

-- 1. The old trigger skips approvals.
create or replace function public.create_primary_doctor_location()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
BEGIN
  IF NOT coalesce(NEW.is_registered, false) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.professional_settings (professional_id, pause_online_bookings)
  VALUES (NEW.id, true)
  ON CONFLICT (professional_id) DO NOTHING;

  -- An approved registration request has its clinics in professional_clinics only.
  IF coalesce(current_setting('doccy.registration_approval', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.doctor_locations WHERE doctor_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.doctor_locations (
    doctor_id,
    is_primary,
    sort_order,
    district,
    clinic_address,
    town,
    latitude,
    longitude,
    clinic_place_id
  )
  VALUES (
    NEW.id,
    true,
    0,
    NEW.district,
    NEW.clinic_address,
    NEW.town,
    NEW.latitude,
    NEW.longitude,
    NEW.clinic_place_id
  );
  RETURN NEW;
END;
$function$;

-- 2. The guard: an approval may fill professional_id on a registration request.
create or replace function public.request_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_type public.request_types%rowtype;
  v_start_status text;
begin
  if tg_op = 'TRUNCATE' then
    raise exception 'request_log is permanent: it cannot be truncated' using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'request_log is permanent: requests are never deleted' using errcode = '55000';
  end if;

  if tg_op = 'INSERT' then
    if new.professional_id is null and new.applicant_auth_user_id is null then
      raise exception 'a new request names its professional or its applicant' using errcode = '23514';
    end if;
    select * into v_type from public.request_types where name = new.request_type;
    if found then
      v_start_status := case when v_type.requires_approval then 'pending' else 'recorded' end;
      if new.status <> v_start_status then
        raise exception 'a % request starts as %', new.request_type, v_start_status using errcode = '23514';
      end if;
      if v_type.is_edit and new.before_snapshot is null then
        raise exception 'a % request needs before_snapshot', new.request_type using errcode = '23514';
      end if;
    end if;
    if new.decided_by is not null or new.decision_note is not null
       or new.approved_details is not null or new.outcome is not null then
      raise exception 'a new request has no decision' using errcode = '23514';
    end if;
    return new;
  end if;

  -- UPDATE. The ON DELETE SET NULL cascades (professional, login): only a link empties.
  if ((old.professional_id is not null and new.professional_id is null)
      or (old.applicant_auth_user_id is not null and new.applicant_auth_user_id is null))
     and (to_jsonb(new) - 'professional_id' - 'applicant_auth_user_id')
       = (to_jsonb(old) - 'professional_id' - 'applicant_auth_user_id')
     and (new.professional_id is null or new.professional_id = old.professional_id)
     and (new.applicant_auth_user_id is null or new.applicant_auth_user_id = old.applicant_auth_user_id) then
    return new;
  end if;

  if old.status <> 'pending' then
    raise exception 'request % is %: decided requests never change', old.id, old.status using errcode = '55000';
  end if;

  if new.id is distinct from old.id
     or new.request_type is distinct from old.request_type
     or new.details is distinct from old.details
     or new.details_version is distinct from old.details_version
     or new.before_snapshot is distinct from old.before_snapshot
     or (new.professional_id is distinct from old.professional_id
         and not (old.professional_id is null
                  and new.status = 'approved'
                  and old.request_type = 'professional_registration'))
     or new.applicant_auth_user_id is distinct from old.applicant_auth_user_id
     or new.requester_name is distinct from old.requester_name
     or new.requester_email is distinct from old.requester_email
     or new.created_at is distinct from old.created_at then
    raise exception 'only the decision can change on a pending request' using errcode = '55000';
  end if;

  if coalesce(current_setting('doccy.request_decision', true), '') <> old.id::text then
    raise exception 'requests are decided only through request_approve, request_reject or request_withdraw'
      using errcode = '55000';
  end if;
  if new.status = 'pending' then
    raise exception 'a decision closes the request' using errcode = '55000';
  end if;
  return new;
end
$$;

-- 3. Clinic slugs, the same rule the location mirror uses.
create or replace function public.request_clinic_slug(p_name text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_base text;
  v_slug text;
  v_n integer := 1;
begin
  v_base := trim(both '-' from regexp_replace(
    lower(translate(
      coalesce(p_name, ''),
      'áàâäãåÁÀÂÄÃÅéèêëÉÈÊËíìîïÍÌÎÏóòôöõÓÒÔÖÕúùûüÚÙÛÜñÑçÇýÿÝ',
      'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUnNcCyyY'
    )),
    '[^a-z0-9]+', '-', 'g'
  ));
  if v_base = '' then
    v_base := 'clinic';
  end if;
  v_slug := v_base;
  while exists (select 1 from public.clinics c where c.slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n::text;
  end loop;
  return v_slug;
end
$$;

-- 4. The professional_registration approval step. Called only by request_approve.
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

  -- The old registration trigger must not add an addressless doctor_locations row.
  perform set_config('doccy.registration_approval', 'on', true);

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
        has_online_booking = v_until is not null,
        finder_visible = true,
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
      pro_access_until, has_online_booking, finder_visible, is_archived
    )
    values (
      p_req.applicant_auth_user_id, v_name, p_details ->> 'gender', (p_details ->> 'gesy')::boolean, v_email,
      nullif(btrim(coalesce(p_details ->> 'mobile', '')), ''),
      array(select jsonb_array_elements_text(p_details -> 'languages')),
      v_avatar, v_slug, 'verified', true, v_tier, v_is_test,
      v_until, v_until is not null, true, false
    )
    returning id into v_pro;
  end if;

  insert into public.professional_settings (professional_id, pause_online_bookings)
  values (v_pro, true)
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
  -- the default hours the old registration path gave (doctor_locations' defaults).
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
      insert into public.clinics (name, slug, district, address, town, latitude, longitude, clinic_place_id)
      values (
        btrim(v_clinic ->> 'name'),
        public.request_clinic_slug(v_clinic ->> 'name'),
        v_district,
        btrim(v_clinic ->> 'address'),
        nullif(btrim(coalesce(v_clinic ->> 'town', '')), ''),
        (v_clinic ->> 'latitude')::double precision,
        (v_clinic ->> 'longitude')::double precision,
        nullif(btrim(coalesce(v_clinic ->> 'place_id', '')), '')
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

  perform set_config('doccy.registration_approval', '', true);

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

-- 5. request_approve with per-type options.
drop function if exists public.request_approve(uuid, uuid, jsonb, text);

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

-- 6. Access: service role only.
revoke all on function public.request_clinic_slug(text) from public, anon, authenticated;
revoke all on function public.request_apply_professional_registration(public.request_log, jsonb, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.request_approve(uuid, uuid, jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function public.request_clinic_slug(text) to service_role;
grant execute on function public.request_approve(uuid, uuid, jsonb, text, jsonb) to service_role;

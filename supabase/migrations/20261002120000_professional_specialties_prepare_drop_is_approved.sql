-- professional_specialties.is_approved, step 1 of 2 (backward-compatible): nothing
-- reads or writes the column any more.
--
-- Every row has been approved since the registration approval writes specialties
-- approved (E8 removed the custom-specialty review), so the column carries no
-- information. This step takes the three database objects that name it off it, so
-- step 2 (the next migration, applied once the code that stopped reading it is
-- deployed) can drop it:
--   1. professional_specialties_resolve_specialty() always adds a catalogue row for a
--      label that has none (it did so only for approved rows, which is every row);
--   2. its trigger no longer fires on UPDATE OF is_approved (dropping a column named
--      in a trigger's column list would silently drop the trigger with CASCADE);
--   3. request_apply_professional_registration no longer writes the column.
-- Running code is unaffected: the column and its default (true) are still there.
-- Idempotent. Needs no grants (CREATE OR REPLACE keeps them).

-- 1. Catalogue resolution without the approval branch.
create or replace function public.professional_specialties_resolve_specialty()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_label text := btrim(new.specialty);
  v_slug text := public.specialty_slug(new.specialty);
begin
  if v_slug is null or v_slug = 'all' then
    raise exception 'specialty label "%" has no usable slug', new.specialty;
  end if;

  select s.id into new.specialty_id
  from public.specialties s
  where s.slug = v_slug;

  if new.specialty_id is null then
    insert into public.specialties (name, slug)
    values (v_label, v_slug)
    on conflict (slug) do nothing;

    select s.id into new.specialty_id
    from public.specialties s
    where s.slug = v_slug;
  end if;

  return new;
end;
$function$;

-- 2. The trigger fires on the label and the id only.
drop trigger if exists professional_specialties_resolve_specialty on public.professional_specialties;
create trigger professional_specialties_resolve_specialty
  before insert or update of specialty, specialty_id on public.professional_specialties
  for each row execute function public.professional_specialties_resolve_specialty();

-- 3. Approval without the column (CREATE OR REPLACE keeps the comment and grants).
-- Generated from 20261002090100_drop_professionals_status.sql; only the specialty
-- insert and its comment changed.
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

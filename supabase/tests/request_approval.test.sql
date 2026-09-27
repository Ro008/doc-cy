-- Database tests for approving professional_registration requests
-- (migration *_registration_request_approval).
--
-- Run against TESTING only (Supabase SQL editor or the MCP execute_sql tool).
-- Everything runs in one transaction that ALWAYS rolls back: the final error
-- message is the result. "ALL request_approval TESTS PASSED (…)" means success; any
-- "FAIL: …" names the broken rule. Nothing is left behind.

create or replace function pg_temp.expect_error(p_sql text, p_state text, p_label text)
returns void
language plpgsql
as $f$
begin
  execute p_sql;
  raise exception 'FAIL: % (expected SQLSTATE %, but it succeeded)', p_label, p_state;
exception
  when others then
    if sqlerrm like 'FAIL:%' then
      raise;
    end if;
    if sqlstate <> p_state then
      raise exception 'FAIL: % (expected SQLSTATE %, got %: %)', p_label, p_state, sqlstate, sqlerrm;
    end if;
end
$f$;

create or replace function pg_temp.new_login(p_email text)
returns uuid
language plpgsql
as $f$
declare
  v_u uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (v_u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          p_email, now(), now(), now());
  return v_u;
end
$f$;

-- Version-1 registration details (see lib/professional-registration-request.ts).
create or replace function pg_temp.details(p_email text, p_last text, p_clinics jsonb, p_claim uuid default null)
returns jsonb
language sql
as $f$
  select jsonb_build_object(
    'first_name', 'Approval',
    'last_name', p_last,
    'gender', 'female',
    'gesy', true,
    'email', p_email,
    'mobile', '+35799123456',
    'languages', jsonb_build_array('English', 'Greek'),
    'photo', jsonb_build_object('bucket', 'request-uploads', 'path', 'professional_registration/x/photo.jpg'),
    'specialties', jsonb_build_array(
      jsonb_build_object('name', 'Cardiology', 'from_catalogue', true, 'license_number', 'LIC-1')),
    'clinics', p_clinics,
    'claimed_professional_id', p_claim,
    'disclaimer_accepted', true
  );
$f$;

-- A confirmed applicant with a pending request; returns the request id.
create or replace function pg_temp.new_request(p_email text, p_details jsonb)
returns uuid
language plpgsql
as $f$
declare
  v_login uuid := pg_temp.new_login(p_email);
  v_id uuid;
begin
  perform public.request_draft_submit('professional_registration', v_login, p_details, 1::smallint,
    'Approval ' || (p_details ->> 'last_name'), p_email);
  select request_id into v_id from public.request_draft_confirm(v_login);
  return v_id;
end
$f$;

do $test$
declare
  v_checks int := 0;
  v_tag text := substr(md5(random()::text), 1, 8);
  v_admin uuid;
  v_partner uuid;
  v_clinic uuid;
  v_clinics jsonb;
  v_email text;
  v_req uuid;
  v_req2 uuid;
  v_row public.request_log%rowtype;
  v_pro public.professionals%rowtype;
  v_expected timestamptz;
  v_n int;
  v_listing uuid;
  v_listing_clinic uuid;
  v_new_clinic uuid;
begin
  -- Setup: a founder, a partner, and an existing DocCy clinic to pick.
  insert into public.admin_users (auth_user_id, name, email, role)
  values (pg_temp.new_login('appr-founder-' || v_tag || '@integration.test'), 'Appr Founder',
          'appr-founder-' || v_tag || '@integration.test', 'founder')
  returning id into v_admin;
  insert into public.admin_users (auth_user_id, name, email, role)
  values (pg_temp.new_login('appr-partner-' || v_tag || '@integration.test'), 'Appr Partner',
          'appr-partner-' || v_tag || '@integration.test', 'partner')
  returning id into v_partner;
  insert into public.clinics (name, slug, district, address, town, latitude, longitude)
  values ('Appr Existing ' || v_tag, 'appr-existing-' || v_tag, 'Paphos', '1 Existing St, Paphos', 'Paphos', 34.77, 32.42)
  returning id into v_clinic;
  v_clinics := jsonb_build_array(
    jsonb_build_object('clinic_id', v_clinic, 'name', null, 'address', '1 Existing St, Paphos',
      'district', 'Paphos', 'town', 'Paphos', 'latitude', 34.77, 'longitude', 32.42, 'place_id', null),
    jsonb_build_object('clinic_id', null, 'name', 'Appr New Clinic ' || v_tag, 'address', '2 New Rd, Limassol',
      'district', 'Limassol', 'town', null, 'latitude', 34.68, 'longitude', 33.04, 'place_id', 'place-' || v_tag));

  -- 1. Access: service role only; the old four-argument version is gone.
  if to_regprocedure('public.request_approve(uuid, uuid, jsonb, text)') is not null then
    raise exception 'FAIL: the old request_approve(uuid, uuid, jsonb, text) should be dropped';
  end if;
  if has_function_privilege('anon', 'public.request_approve(uuid, uuid, jsonb, text, jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.request_approve(uuid, uuid, jsonb, text, jsonb)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.request_approve(uuid, uuid, jsonb, text, jsonb)', 'EXECUTE') then
    raise exception 'FAIL: request_approve must be callable by the service role only';
  end if;
  v_checks := v_checks + 2;

  -- 2. Approving a new profile creates the professional, clinics, links, specialties
  --    and settings in one go, with the trial override.
  v_email := 'appr-new-' || v_tag || '@integration.test';
  v_req := pg_temp.new_request(v_email, pg_temp.details(v_email, 'New ' || v_tag, v_clinics));
  perform pg_temp.expect_error(
    format($$select public.request_approve(%L, %L, null, null, jsonb_build_object('slug', 'appr-new-%s'))$$,
      v_req, v_partner, v_tag), '42501', 'a partner approving');
  perform public.request_approve(v_req, v_admin, null, 'Looks good',
    jsonb_build_object('slug', 'appr-new-' || v_tag, 'avatar_path', 'profiles/x/avatar.jpg', 'trial_months', 3));

  select * into v_row from public.request_log where id = v_req;
  select * into v_pro from public.professionals where id = v_row.professional_id;
  if v_row.status <> 'approved' or v_row.decided_by <> v_admin or v_pro.id is null then
    raise exception 'FAIL: the request should be approved and name its professional, got %', row_to_json(v_row);
  end if;
  v_expected := ((now() at time zone 'Asia/Nicosia') + make_interval(months => 3)) at time zone 'Asia/Nicosia';
  if v_pro.name <> 'Approval New ' || v_tag
     or v_pro.gender <> 'female' or v_pro.is_gesy is not true
     or v_pro.registration_email <> v_email or v_pro.mobile_number <> '+35799123456'
     or v_pro.languages <> array['English', 'Greek']
     or v_pro.avatar_url <> 'profiles/x/avatar.jpg'
     or v_pro.slug <> 'appr-new-' || v_tag
     or v_pro.status <> 'verified' or v_pro.is_registered is not true
     or v_pro.auth_user_id is distinct from v_row.applicant_auth_user_id
     or v_pro.subscription_tier <> 'standard'
     or v_pro.is_test_profile is not true
     or v_pro.pro_access_until is distinct from v_expected then
    raise exception 'FAIL: the new professional has the wrong fields: %', row_to_json(v_pro);
  end if;
  if (v_row.outcome ->> 'professional_id')::uuid is distinct from v_pro.id
     or (v_row.outcome ->> 'trial_months')::int <> 3
     or (v_row.outcome ->> 'claimed_listing')::boolean is not false then
    raise exception 'FAIL: the outcome should record the professional and the trial months, got %', v_row.outcome;
  end if;
  v_checks := v_checks + 4;

  -- Settings exist (bookings paused); no doctor_locations row (the old trigger skips approvals).
  if not exists (select 1 from public.professional_settings where professional_id = v_pro.id and pause_online_bookings) then
    raise exception 'FAIL: approval should create paused professional_settings';
  end if;
  if exists (select 1 from public.doctor_locations where doctor_id = v_pro.id) then
    raise exception 'FAIL: approval must not create doctor_locations rows';
  end if;
  v_checks := v_checks + 2;

  -- Clinics: the picked clinic is linked as primary; the proposed one is created and linked.
  if not exists (select 1 from public.professional_clinics
                 where professional_id = v_pro.id and clinic_id = v_clinic and is_primary and sort_order = 0
                   and pause_online_bookings) then
    raise exception 'FAIL: the picked clinic should be the primary link, paused';
  end if;
  -- Links start with the same default hours the old registration path gave
  -- (Mon-Fri 09:00-17:00, 30-minute slots), so the settings form opens clean.
  select count(*) into v_n from public.professional_clinics
  where professional_id = v_pro.id
    and monday and tuesday and wednesday and thursday and friday and not saturday and not sunday
    and start_time = '09:00' and end_time = '17:00' and slot_duration_minutes = 30;
  if v_n <> 2 then
    raise exception 'FAIL: both links should start with the default hours, % do', v_n;
  end if;
  v_checks := v_checks + 1;
  select c.id into v_new_clinic from public.professional_clinics pc join public.clinics c on c.id = pc.clinic_id
  where pc.professional_id = v_pro.id and not pc.is_primary and pc.sort_order = 1
    and c.name = 'Appr New Clinic ' || v_tag and c.slug = 'appr-new-clinic-' || v_tag
    and c.district = 'Limassol' and c.address = '2 New Rd, Limassol' and c.ghs_code is null
    and c.clinic_place_id = 'place-' || v_tag;
  if v_new_clinic is null then
    raise exception 'FAIL: the proposed clinic should be created (name, slug, district, address) and linked second';
  end if;
  if not exists (select 1 from public.professional_specialties ps join public.specialties s on s.id = ps.specialty_id
                 where ps.professional_id = v_pro.id and s.name = 'Cardiology' and ps.is_approved and ps.license_number = 'LIC-1') then
    raise exception 'FAIL: the approved specialty should be written with its licence';
  end if;
  v_checks := v_checks + 3;

  -- 3. A decided request can't be approved again.
  perform pg_temp.expect_error(
    format($$select public.request_approve(%L, %L, null, null, jsonb_build_object('slug', 'x-%s'))$$, v_req, v_admin, v_tag),
    '55000', 'approving twice');
  v_checks := v_checks + 1;

  -- 4. Refusals leave nothing behind: changed email, unknown clinic, missing slug, bad trial.
  v_email := 'appr-bad-' || v_tag || '@integration.test';
  v_req2 := pg_temp.new_request(v_email, pg_temp.details(v_email, 'Bad ' || v_tag, v_clinics));
  perform pg_temp.expect_error(
    format($$select public.request_approve(%L, %L, %L::jsonb, null, jsonb_build_object('slug', 'appr-bad-%s'))$$,
      v_req2, v_admin, pg_temp.details('other-' || v_tag || '@integration.test', 'Bad ' || v_tag, v_clinics), v_tag),
    '22023', 'changing the email');
  perform pg_temp.expect_error(
    format($$select public.request_approve(%L, %L, %L::jsonb, null, jsonb_build_object('slug', 'appr-bad-%s'))$$,
      v_req2, v_admin,
      pg_temp.details(v_email, 'Bad ' || v_tag, jsonb_build_array(
        jsonb_set(v_clinics -> 0, '{clinic_id}', to_jsonb(gen_random_uuid())))), v_tag),
    'P0002', 'an unknown clinic');
  perform pg_temp.expect_error(
    format($$select public.request_approve(%L, %L, null, null, '{}'::jsonb)$$, v_req2, v_admin),
    '22023', 'no slug');
  perform pg_temp.expect_error(
    format($$select public.request_approve(%L, %L, null, null, jsonb_build_object('slug', 'appr-bad-%s', 'trial_months', 25))$$,
      v_req2, v_admin, v_tag),
    '22023', 'trial months out of range');
  if exists (select 1 from public.professionals where registration_email = v_email)
     or (select status from public.request_log where id = v_req2) <> 'pending' then
    raise exception 'FAIL: a refused approval must leave no professional and the request pending';
  end if;
  v_checks := v_checks + 5;

  -- 5. Without an override the trial comes from app_settings; 0 months means no access.
  perform public.request_approve(v_req2, v_admin, null, null, jsonb_build_object('slug', 'appr-bad-' || v_tag));
  select * into v_row from public.request_log where id = v_req2;
  select * into v_pro from public.professionals where id = v_row.professional_id;
  v_expected := ((now() at time zone 'Asia/Nicosia')
    + make_interval(months => (select (value #>> '{}')::int from public.app_settings where key = 'trial_months')))
    at time zone 'Asia/Nicosia';
  if v_pro.pro_access_until is distinct from v_expected
     or (v_row.outcome ->> 'trial_months')::int <> (select (value #>> '{}')::int from public.app_settings where key = 'trial_months') then
    raise exception 'FAIL: without an override the trial should be app_settings.trial_months';
  end if;
  v_email := 'appr-zero-' || v_tag || '@integration.test';
  v_req2 := pg_temp.new_request(v_email, pg_temp.details(v_email, 'Zero ' || v_tag,
    jsonb_build_array(v_clinics -> 0)));
  perform public.request_approve(v_req2, v_admin, null, null,
    jsonb_build_object('slug', 'appr-zero-' || v_tag, 'trial_months', 0));
  if (select pro_access_until from public.professionals where registration_email = v_email) is not null then
    raise exception 'FAIL: a 0-month trial should give no access date';
  end if;
  v_checks := v_checks + 2;

  -- 6. A real applicant with a reserved place becomes a founder.
  v_email := 'appr-real-' || v_tag || '@example.org';
  v_req2 := pg_temp.new_request(v_email, pg_temp.details(v_email, 'Real ' || v_tag, jsonb_build_array(v_clinics -> 0)));
  if (select details -> 'founders_club' from public.request_log where id = v_req2) = 'true'::jsonb then
    perform public.request_approve(v_req2, v_admin, null, null, jsonb_build_object('slug', 'appr-real-' || v_tag));
    select * into v_pro from public.professionals where registration_email = v_email;
    if v_pro.subscription_tier <> 'founder' or v_pro.is_test_profile then
      raise exception 'FAIL: a reserved Founders'' Club place should make a (non-test) founder, got %', row_to_json(v_pro);
    end if;
    v_checks := v_checks + 1;
  end if;

  -- 7. Approving a claim updates the listing in place.
  insert into public.professionals (name, slug, is_registered, district, is_test_profile)
  values ('Old Listing ' || v_tag, 'old-listing-' || v_tag, false, 'Paphos', true)
  returning id into v_listing;
  insert into public.professional_specialties (professional_id, specialty, is_approved)
  values (v_listing, 'Dermatology', true);
  insert into public.clinics (name, slug, district, address)
  values ('Listing Clinic ' || v_tag, 'listing-clinic-' || v_tag, 'Paphos', '9 Old Rd')
  returning id into v_listing_clinic;
  insert into public.professional_clinics (professional_id, clinic_id, is_primary) values (v_listing, v_listing_clinic, true);

  v_email := 'appr-claim-' || v_tag || '@integration.test';
  v_req := pg_temp.new_request(v_email, pg_temp.details(v_email, 'Claim ' || v_tag, jsonb_build_array(v_clinics -> 0), v_listing));
  perform public.request_approve(v_req, v_admin, null, null,
    jsonb_build_object('slug', 'approval-claim-' || v_tag, 'trial_months', 1));
  select * into v_row from public.request_log where id = v_req;
  select * into v_pro from public.professionals where id = v_listing;
  if v_row.professional_id is distinct from v_listing
     or (v_row.outcome ->> 'claimed_listing')::boolean is not true
     or v_pro.is_registered is not true or v_pro.status <> 'verified'
     or v_pro.auth_user_id is distinct from v_row.applicant_auth_user_id
     or v_pro.name <> 'Approval Claim ' || v_tag or v_pro.slug <> 'approval-claim-' || v_tag then
    raise exception 'FAIL: the claimed listing should become the professional in place, got %', row_to_json(v_pro);
  end if;
  if not exists (select 1 from public.professional_slug_redirects where slug = 'old-listing-' || v_tag and professional_id = v_listing) then
    raise exception 'FAIL: the old slug should redirect to the listing';
  end if;
  if exists (select 1 from public.professional_specialties ps join public.specialties s on s.id = ps.specialty_id
             where ps.professional_id = v_listing and s.name = 'Dermatology')
     or not exists (select 1 from public.professional_specialties ps join public.specialties s on s.id = ps.specialty_id
                    where ps.professional_id = v_listing and s.name = 'Cardiology') then
    raise exception 'FAIL: the listing''s specialties should be replaced by the form''s';
  end if;
  if exists (select 1 from public.professional_clinics where professional_id = v_listing and clinic_id = v_listing_clinic)
     or not exists (select 1 from public.clinics where id = v_listing_clinic)
     or not exists (select 1 from public.professional_clinics where professional_id = v_listing and clinic_id = v_clinic and is_primary) then
    raise exception 'FAIL: clinic links should be replaced, and the old clinic kept';
  end if;
  if exists (select 1 from public.doctor_locations where doctor_id = v_listing) then
    raise exception 'FAIL: approving a claim must not create doctor_locations rows';
  end if;
  v_checks := v_checks + 5;

  -- 8. A second claim of the same (now registered) listing is a conflict.
  v_email := 'appr-claim2-' || v_tag || '@integration.test';
  v_req2 := pg_temp.new_request(v_email, pg_temp.details(v_email, 'Claimtwo ' || v_tag, jsonb_build_array(v_clinics -> 0), v_listing));
  perform pg_temp.expect_error(
    format($$select public.request_approve(%L, %L, null, null, jsonb_build_object('slug', 'appr-claim2-%s'))$$, v_req2, v_admin, v_tag),
    '55000', 'claiming a listing that is already registered');
  v_checks := v_checks + 1;

  -- 9. Outside approvals the old registration path still gets its location row.
  insert into public.professionals (auth_user_id, name, slug, is_registered, status, is_test_profile)
  values (pg_temp.new_login('appr-old-' || v_tag || '@integration.test'), 'Old Path ' || v_tag, 'old-path-' || v_tag,
          true, 'pending', true)
  returning id into v_listing;
  if not exists (select 1 from public.doctor_locations where doctor_id = v_listing) then
    raise exception 'FAIL: the old registration path should still get its primary location';
  end if;
  v_checks := v_checks + 1;

  raise exception 'ALL request_approval TESTS PASSED (% checks)', v_checks;
end
$test$;

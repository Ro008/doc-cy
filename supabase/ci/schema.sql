


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."cyprus_district" AS ENUM (
    'Nicosia',
    'Limassol',
    'Paphos',
    'Larnaca',
    'Famagusta'
);


ALTER TYPE "public"."cyprus_district" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."absorb_unregistered_into_registered"("p_registered_id" "uuid", "p_unregistered_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_registered public.professionals%ROWTYPE;
  v_unregistered public.professionals%ROWTYPE;
  v_old_slug text;
  v_new_slug text;
  v_ghs text;
BEGIN
  IF p_registered_id IS NULL OR p_unregistered_id IS NULL THEN
    RAISE EXCEPTION 'absorb_unregistered_into_registered requires both ids';
  END IF;
  IF p_registered_id = p_unregistered_id THEN
    RAISE EXCEPTION 'cannot absorb a professional into itself';
  END IF;

  SELECT * INTO v_registered
  FROM public.professionals
  WHERE id = p_registered_id
  FOR UPDATE;
  IF NOT FOUND OR v_registered.is_registered IS NOT TRUE THEN
    RAISE EXCEPTION 'registered professional % not found', p_registered_id;
  END IF;

  SELECT * INTO v_unregistered
  FROM public.professionals
  WHERE id = p_unregistered_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unregistered professional % not found', p_unregistered_id;
  END IF;
  IF v_unregistered.is_registered IS TRUE THEN
    RAISE EXCEPTION 'source professional % is registered; refuse absorb', p_unregistered_id;
  END IF;
  IF v_unregistered.is_archived IS TRUE THEN
    RETURN;
  END IF;

  INSERT INTO public.professional_clinics (professional_id, clinic_id, is_primary, created_at)
  SELECT p_registered_id, pc.clinic_id, pc.is_primary, pc.created_at
  FROM public.professional_clinics pc
  WHERE pc.professional_id = p_unregistered_id
  ON CONFLICT (professional_id, clinic_id) DO NOTHING;

  DELETE FROM public.professional_clinics
  WHERE professional_id = p_unregistered_id;

  UPDATE public.professional_patient_booking_requests
  SET professional_id = p_registered_id
  WHERE professional_id = p_unregistered_id;

  UPDATE public.professional_call_to_book_clicks
  SET professional_id = p_registered_id
  WHERE professional_id = p_unregistered_id;

  v_old_slug := nullif(btrim(coalesce(v_unregistered.slug, '')), '');
  v_new_slug := nullif(btrim(coalesce(v_registered.slug, '')), '');
  IF v_old_slug IS NOT NULL AND lower(v_old_slug) IS DISTINCT FROM lower(coalesce(v_new_slug, '')) THEN
    INSERT INTO public.professional_slug_redirects (slug, professional_id)
    VALUES (lower(v_old_slug), p_registered_id)
    ON CONFLICT (slug) DO UPDATE
      SET professional_id = EXCLUDED.professional_id;
  END IF;

  -- Archive first so ghs_code / slug unique indexes (active rows only) are free.
  UPDATE public.professionals
  SET is_archived = true, updated_at = now()
  WHERE id = p_unregistered_id;

  v_ghs := nullif(btrim(coalesce(v_registered.ghs_code, '')), '');
  IF v_ghs IS NULL THEN
    v_ghs := nullif(btrim(coalesce(v_unregistered.ghs_code, '')), '');
    IF v_ghs IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.professionals p
      WHERE p.id <> p_registered_id
        AND p.is_archived = false
        AND p.ghs_code = v_ghs
    ) THEN
      v_ghs := v_registered.ghs_code;
    END IF;
  ELSE
    v_ghs := v_registered.ghs_code;
  END IF;

  -- Intentionally does NOT touch `specialty` / `specialties`: those are owned
  -- by professional_specialties (license-backed) and must never be augmented by an
  -- absorbed unregistered listing.
  UPDATE public.professionals
  SET
    ghs_code = v_ghs,
    clinic_id = coalesce(v_registered.clinic_id, v_unregistered.clinic_id),
    is_gesy = coalesce(v_registered.is_gesy, false) OR coalesce(v_unregistered.is_gesy, false),
    gender = CASE
      WHEN nullif(btrim(coalesce(v_registered.gender, '')), '') IS NOT NULL
        THEN v_registered.gender
      ELSE v_unregistered.gender
    END,
    address_maps_link = CASE
      WHEN nullif(btrim(coalesce(v_registered.address_maps_link, '')), '') IS NOT NULL
        THEN v_registered.address_maps_link
      ELSE v_unregistered.address_maps_link
    END,
    address = CASE
      WHEN nullif(btrim(coalesce(v_registered.address, '')), '') IS NOT NULL
        THEN v_registered.address
      ELSE v_unregistered.address
    END,
    town = CASE
      WHEN nullif(btrim(coalesce(v_registered.town, '')), '') IS NOT NULL
        THEN v_registered.town
      ELSE v_unregistered.town
    END,
    latitude = coalesce(v_registered.latitude, v_unregistered.latitude),
    longitude = coalesce(v_registered.longitude, v_unregistered.longitude),
    updated_at = now()
  WHERE id = p_registered_id;
END;
$$;


ALTER FUNCTION "public"."absorb_unregistered_into_registered"("p_registered_id" "uuid", "p_unregistered_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."absorb_unregistered_into_registered"("p_registered_id" "uuid", "p_unregistered_id" "uuid") IS 'Archives the unregistered listing into the registered professional (clinics, booking requests, call-to-book clicks, slug redirect, address/gender/ghs/gesy fields). Never touches specialties - those stay governed by professional_specialties.';



CREATE OR REPLACE FUNCTION "public"."create_clinic_for_professional_location"("p_location_id" "uuid", "p_district" "public"."cyprus_district") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_loc public.doctor_locations%ROWTYPE;
  v_name text;
  v_base text;
  v_slug text;
  v_n integer := 1;
  v_clinic_id uuid;
BEGIN
  SELECT * INTO v_loc FROM public.doctor_locations WHERE id = p_location_id;

  SELECT p.name INTO v_name FROM public.professionals p WHERE p.id = v_loc.doctor_id;
  v_name := coalesce(nullif(btrim(v_name), ''), 'Clinic');

  v_base := trim(BOTH '-' FROM regexp_replace(
    lower(translate(
      v_name,
      'áàâäãåÁÀÂÄÃÅéèêëÉÈÊËíìîïÍÌÎÏóòôöõÓÒÔÖÕúùûüÚÙÛÜñÑçÇýÿÝ',
      'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUnNcCyyY'
    )),
    '[^a-z0-9]+', '-', 'g'
  ));
  IF v_base = '' THEN
    v_base := 'clinic';
  END IF;

  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM public.clinics c WHERE c.slug = v_slug) LOOP
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n::text;
  END LOOP;

  INSERT INTO public.clinics (
    name, slug, district, address, town, latitude, longitude, clinic_place_id
  )
  VALUES (
    v_name, v_slug, p_district, btrim(v_loc.clinic_address), v_loc.town,
    v_loc.latitude, v_loc.longitude, v_loc.clinic_place_id
  )
  RETURNING id INTO v_clinic_id;

  RETURN v_clinic_id;
END;
$$;


ALTER FUNCTION "public"."create_clinic_for_professional_location"("p_location_id" "uuid", "p_district" "public"."cyprus_district") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_primary_doctor_location"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT coalesce(NEW.is_registered, false) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.professional_settings (professional_id, pause_online_bookings)
  VALUES (NEW.id, true)
  ON CONFLICT (professional_id) DO NOTHING;

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
$$;


ALTER FUNCTION "public"."create_primary_doctor_location"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_test_data"("doctor_slug_param" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    DELETE FROM appointments 
    WHERE doctor_id IN (SELECT id FROM doctors WHERE slug = doctor_slug_param);
    
    DELETE FROM doctor_schedule_overrides 
    WHERE doctor_id IN (SELECT id FROM doctors WHERE slug = doctor_slug_param);
END;
$$;


ALTER FUNCTION "public"."delete_test_data"("doctor_slug_param" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."doctor_locations_mirror_to_professional_clinics"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.professional_clinics WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.mirror_location_to_professional_clinic(NEW.id, true);
    RETURN NEW;
  END IF;

  PERFORM public.mirror_location_to_professional_clinic(NEW.id, false);

  -- Copy only the settings this update changed on the location. A join row created
  -- just now was already seeded from NEW, so this leaves it as it is.
  UPDATE public.professional_clinics pc
  SET label = CASE WHEN NEW.label IS DISTINCT FROM OLD.label THEN NEW.label ELSE pc.label END,
      pause_online_bookings = CASE WHEN NEW.pause_online_bookings IS DISTINCT FROM OLD.pause_online_bookings
        THEN NEW.pause_online_bookings ELSE pc.pause_online_bookings END,
      monday = CASE WHEN NEW.monday IS DISTINCT FROM OLD.monday THEN NEW.monday ELSE pc.monday END,
      tuesday = CASE WHEN NEW.tuesday IS DISTINCT FROM OLD.tuesday THEN NEW.tuesday ELSE pc.tuesday END,
      wednesday = CASE WHEN NEW.wednesday IS DISTINCT FROM OLD.wednesday THEN NEW.wednesday ELSE pc.wednesday END,
      thursday = CASE WHEN NEW.thursday IS DISTINCT FROM OLD.thursday THEN NEW.thursday ELSE pc.thursday END,
      friday = CASE WHEN NEW.friday IS DISTINCT FROM OLD.friday THEN NEW.friday ELSE pc.friday END,
      saturday = CASE WHEN NEW.saturday IS DISTINCT FROM OLD.saturday THEN NEW.saturday ELSE pc.saturday END,
      sunday = CASE WHEN NEW.sunday IS DISTINCT FROM OLD.sunday THEN NEW.sunday ELSE pc.sunday END,
      start_time = CASE WHEN NEW.start_time IS DISTINCT FROM OLD.start_time THEN NEW.start_time ELSE pc.start_time END,
      end_time = CASE WHEN NEW.end_time IS DISTINCT FROM OLD.end_time THEN NEW.end_time ELSE pc.end_time END,
      weekly_schedule = CASE WHEN NEW.weekly_schedule IS DISTINCT FROM OLD.weekly_schedule
        THEN NEW.weekly_schedule ELSE pc.weekly_schedule END,
      break_start = CASE WHEN NEW.break_start IS DISTINCT FROM OLD.break_start THEN NEW.break_start ELSE pc.break_start END,
      break_end = CASE WHEN NEW.break_end IS DISTINCT FROM OLD.break_end THEN NEW.break_end ELSE pc.break_end END,
      slot_duration_minutes = CASE WHEN NEW.slot_duration_minutes IS DISTINCT FROM OLD.slot_duration_minutes
        THEN NEW.slot_duration_minutes ELSE pc.slot_duration_minutes END,
      updated_at = now()
  WHERE pc.id = NEW.id
    AND (NEW.label, NEW.pause_online_bookings, NEW.monday, NEW.tuesday, NEW.wednesday,
         NEW.thursday, NEW.friday, NEW.saturday, NEW.sunday, NEW.start_time, NEW.end_time,
         NEW.weekly_schedule, NEW.break_start, NEW.break_end, NEW.slot_duration_minutes)
        IS DISTINCT FROM
        (OLD.label, OLD.pause_online_bookings, OLD.monday, OLD.tuesday, OLD.wednesday,
         OLD.thursday, OLD.friday, OLD.saturday, OLD.sunday, OLD.start_time, OLD.end_time,
         OLD.weekly_schedule, OLD.break_start, OLD.break_end, OLD.slot_duration_minutes);

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."doctor_locations_mirror_to_professional_clinics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."founder_active_doctor_count"("p_since" timestamp with time zone) RETURNS bigint
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select count(distinct a.doctor_id)
  from public.appointments a
  where a.created_at >= p_since
$$;


ALTER FUNCTION "public"."founder_active_doctor_count"("p_since" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."founder_appointments_by_month"("p_since" timestamp with time zone) RETURNS TABLE("month_key" "text", "appt_count" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select to_char(date_trunc('month', a.created_at), 'YYYY-MM') as month_key,
         count(*) as appt_count
  from public.appointments a
  where a.created_at >= p_since
  group by 1
$$;


ALTER FUNCTION "public"."founder_appointments_by_month"("p_since" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."founder_call_to_book_stats"("p_since" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("professional_id" "uuid", "click_count" bigint, "finder_count" bigint, "profile_count" bigint, "last_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select c.professional_id,
         count(*) as click_count,
         count(*) filter (where c.source = 'finder_card') as finder_count,
         count(*) filter (where c.source = 'professional_profile_page') as profile_count,
         max(c.created_at) as last_at
  from public.professional_call_to_book_clicks c
  where p_since is null or c.created_at >= p_since
  group by c.professional_id
$$;


ALTER FUNCTION "public"."founder_call_to_book_stats"("p_since" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."founder_manual_vote_stats"("p_since" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS TABLE("professional_id" "uuid", "vote_count" bigint, "last_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select r.professional_id,
         count(distinct coalesce(nullif(btrim(r.voter_key), ''), 'legacy:' || r.id::text)) as vote_count,
         max(r.created_at) as last_at
  from public.professional_patient_booking_requests r
  where p_since is null or r.created_at >= p_since
  group by r.professional_id
$$;


ALTER FUNCTION "public"."founder_manual_vote_stats"("p_since" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."founders_club_places_taken"() RETURNS integer
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select (
    (select count(*) from public.professionals p
     where p.subscription_tier = 'founder'
       and p.is_registered = true
       and coalesce(p.is_test_profile, false) = false)
    + (select count(*) from public.request_drafts d
       where d.request_type = 'professional_registration'
         and (d.details -> 'founders_club') = 'true'::jsonb)
    + (select count(*) from public.request_log r
       where r.request_type = 'professional_registration'
         and r.status = 'pending'
         and (r.details -> 'founders_club') = 'true'::jsonb)
  )::int;
$$;


ALTER FUNCTION "public"."founders_club_places_taken"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_doctor_owner"("p_doctor_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.professionals p
    WHERE p.id = p_doctor_id
      AND p.is_registered = true
      AND p.auth_user_id IS NOT NULL
      AND p.auth_user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_doctor_owner"("p_doctor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_qa_claim_directory_listing"("p_name" "text", "p_slug" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  SELECT
    coalesce(p_name, '') LIKE 'QA Claim %'
    OR lower(coalesce(p_slug, '')) LIKE 'qa-claim-%';
$$;


ALTER FUNCTION "public"."is_qa_claim_directory_listing"("p_name" "text", "p_slug" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_qa_claim_directory_listing"("p_name" "text", "p_slug" "text") IS 'True for ephemeral testing clones used by the local claim-register e2e. Never true for real directory listings.';



CREATE OR REPLACE FUNCTION "public"."is_test_doctor_registration_email"("p_email" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $_$
  SELECT
    coalesce(lower(trim(p_email)), '') ~ '@(test-doccy\.com\.cy|integration\.test)$'
    OR coalesce(lower(trim(p_email)), '') ~ '@.+\.testing$'
    OR coalesce(lower(trim(p_email)), '')
      ~ '^(doccyteam|rociosirvent|liviolanzo)\+.+@gmail\.com$'
    OR coalesce(lower(trim(p_email)), '') LIKE '%rociosirvent%';
$_$;


ALTER FUNCTION "public"."is_test_doctor_registration_email"("p_email" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_test_doctor_registration_email"("p_email" "text") IS 'QA/smoke emails: CI domains, Gmail +aliases (doccyteam|rociosirvent|liviolanzo), and any email containing rociosirvent.';



CREATE OR REPLACE FUNCTION "public"."mirror_location_to_professional_clinic"("p_location_id" "uuid", "p_copy_settings" boolean DEFAULT true) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_loc public.doctor_locations%ROWTYPE;
  v_addr text;
  v_district public.cyprus_district;
  v_has_row boolean;
  v_created boolean := false;
  v_clinic public.clinics%ROWTYPE;
  v_owned boolean := false;
  v_adopt_id uuid;
  v_adopt_clinic uuid;
  v_new_clinic uuid;
BEGIN
  SELECT * INTO v_loc FROM public.doctor_locations WHERE id = p_location_id;
  IF NOT FOUND THEN
    DELETE FROM public.professional_clinics WHERE id = p_location_id;
    RETURN;
  END IF;

  v_addr := nullif(btrim(v_loc.clinic_address), '');
  IF v_loc.district IN (
    SELECT unnest(enum_range(NULL::public.cyprus_district))::text
  ) THEN
    v_district := v_loc.district::public.cyprus_district;
  END IF;

  SELECT c.* INTO v_clinic
  FROM public.professional_clinics pc
  JOIN public.clinics c ON c.id = pc.clinic_id
  WHERE pc.id = v_loc.id;
  v_has_row := FOUND;

  IF v_has_row THEN
    v_owned := v_clinic.ghs_code IS NULL AND NOT EXISTS (
      SELECT 1 FROM public.professional_clinics pc
      WHERE pc.clinic_id = v_clinic.id AND pc.id <> v_loc.id
    );
  END IF;

  IF v_has_row AND lower(btrim(v_clinic.address)) IS NOT DISTINCT FROM lower(v_addr) THEN
    -- Same place. Only a clinic this location owns takes its details.
    IF v_owned THEN
      UPDATE public.clinics c
      SET address = v_addr,
          district = coalesce(v_district, c.district),
          town = v_loc.town,
          latitude = v_loc.latitude,
          longitude = v_loc.longitude,
          clinic_place_id = v_loc.clinic_place_id,
          updated_at = now()
      WHERE c.id = v_clinic.id
        AND (c.address, c.district, c.town, c.latitude, c.longitude, c.clinic_place_id)
            IS DISTINCT FROM
            (v_addr, coalesce(v_district, c.district), v_loc.town, v_loc.latitude,
             v_loc.longitude, v_loc.clinic_place_id);
    END IF;
  ELSIF v_addr IS NULL THEN
    -- No address to place it at: keep whatever link exists, create none.
    IF NOT v_has_row THEN
      RETURN;
    END IF;
  ELSE
    -- A link of this professional that mirrors no location, at this address.
    SELECT pc.id, pc.clinic_id INTO v_adopt_id, v_adopt_clinic
    FROM public.professional_clinics pc
    JOIN public.clinics c ON c.id = pc.clinic_id
    WHERE pc.professional_id = v_loc.doctor_id
      AND pc.id <> v_loc.id
      AND lower(btrim(c.address)) = lower(v_addr)
      AND NOT EXISTS (SELECT 1 FROM public.doctor_locations d WHERE d.id = pc.id)
    ORDER BY pc.is_primary DESC, pc.created_at, pc.id
    LIMIT 1;

    IF v_adopt_id IS NOT NULL THEN
      IF v_has_row THEN
        DELETE FROM public.professional_clinics WHERE id = v_adopt_id;
        UPDATE public.professional_clinics SET clinic_id = v_adopt_clinic WHERE id = v_loc.id;
      ELSE
        -- Nothing references professional_clinics.id, so re-keying it is safe.
        UPDATE public.professional_clinics SET id = v_loc.id WHERE id = v_adopt_id;
        v_created := true;
      END IF;
    ELSIF v_owned THEN
      UPDATE public.clinics c
      SET address = v_addr,
          district = coalesce(v_district, c.district),
          town = v_loc.town,
          latitude = v_loc.latitude,
          longitude = v_loc.longitude,
          clinic_place_id = v_loc.clinic_place_id,
          updated_at = now()
      WHERE c.id = v_clinic.id;
    ELSE
      v_district := coalesce(v_district, v_clinic.district);
      IF v_district IS NULL THEN
        RETURN;
      END IF;
      v_new_clinic := public.create_clinic_for_professional_location(v_loc.id, v_district);
      IF v_has_row THEN
        UPDATE public.professional_clinics SET clinic_id = v_new_clinic WHERE id = v_loc.id;
      ELSE
        INSERT INTO public.professional_clinics (id, professional_id, clinic_id, created_at)
        VALUES (v_loc.id, v_loc.doctor_id, v_new_clinic, v_loc.created_at);
        v_created := true;
      END IF;
    END IF;
  END IF;

  -- Linkage stays owned by the location for now.
  UPDATE public.professional_clinics pc
  SET is_primary = v_loc.is_primary,
      sort_order = v_loc.sort_order,
      updated_at = now()
  WHERE pc.id = v_loc.id
    AND (pc.is_primary, pc.sort_order) IS DISTINCT FROM (v_loc.is_primary, v_loc.sort_order);

  -- Settings: a new join row starts from the location's; an existing one only when
  -- the caller asks (a backfill, or a location whose settings actually changed).
  IF p_copy_settings OR v_created THEN
    UPDATE public.professional_clinics pc
    SET label = v_loc.label,
        pause_online_bookings = v_loc.pause_online_bookings,
        monday = v_loc.monday,
        tuesday = v_loc.tuesday,
        wednesday = v_loc.wednesday,
        thursday = v_loc.thursday,
        friday = v_loc.friday,
        saturday = v_loc.saturday,
        sunday = v_loc.sunday,
        start_time = v_loc.start_time,
        end_time = v_loc.end_time,
        weekly_schedule = v_loc.weekly_schedule,
        break_start = v_loc.break_start,
        break_end = v_loc.break_end,
        slot_duration_minutes = v_loc.slot_duration_minutes,
        updated_at = now()
    WHERE pc.id = v_loc.id
      AND (pc.label, pc.pause_online_bookings,
           pc.monday, pc.tuesday, pc.wednesday, pc.thursday, pc.friday, pc.saturday,
           pc.sunday, pc.start_time, pc.end_time, pc.weekly_schedule, pc.break_start,
           pc.break_end, pc.slot_duration_minutes)
          IS DISTINCT FROM
          (v_loc.label, v_loc.pause_online_bookings,
           v_loc.monday, v_loc.tuesday, v_loc.wednesday, v_loc.thursday, v_loc.friday,
           v_loc.saturday, v_loc.sunday, v_loc.start_time, v_loc.end_time,
           v_loc.weekly_schedule, v_loc.break_start, v_loc.break_end,
           v_loc.slot_duration_minutes);
  END IF;
END;
$$;


ALTER FUNCTION "public"."mirror_location_to_professional_clinic"("p_location_id" "uuid", "p_copy_settings" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_professional_person_name"("value" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $$
  SELECT trim(both FROM regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          lower(normalize(coalesce(value, ''), NFD)),
          E'[\\u0300-\\u036f]',
          '',
          'g'
        ),
        '\y(dr|doctor|md|prof|mr|mrs|ms)\y\.?',
        '',
        'g'
      ),
      '[^a-z0-9[:space:]]',
      ' ',
      'g'
    ),
    '[[:space:]]+',
    ' ',
    'g'
  ));
$$;


ALTER FUNCTION "public"."normalize_professional_person_name"("value" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."professional_clinics_sync_primary_settings"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Only a configured practice location: a scraped listing's join rows have no hours.
  IF NOT coalesce(NEW.is_primary, false) OR NEW.start_time IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.is_primary IS NOT DISTINCT FROM NEW.is_primary
     AND (OLD.pause_online_bookings, OLD.monday, OLD.tuesday, OLD.wednesday, OLD.thursday,
          OLD.friday, OLD.saturday, OLD.sunday, OLD.start_time, OLD.end_time,
          OLD.weekly_schedule, OLD.break_start, OLD.break_end, OLD.slot_duration_minutes)
         IS NOT DISTINCT FROM
         (NEW.pause_online_bookings, NEW.monday, NEW.tuesday, NEW.wednesday, NEW.thursday,
          NEW.friday, NEW.saturday, NEW.sunday, NEW.start_time, NEW.end_time,
          NEW.weekly_schedule, NEW.break_start, NEW.break_end, NEW.slot_duration_minutes) THEN
    RETURN NEW;
  END IF;

  UPDATE public.professional_settings ps
  SET pause_online_bookings = NEW.pause_online_bookings,
      monday = NEW.monday,
      tuesday = NEW.tuesday,
      wednesday = NEW.wednesday,
      thursday = NEW.thursday,
      friday = NEW.friday,
      saturday = NEW.saturday,
      sunday = NEW.sunday,
      start_time = NEW.start_time,
      end_time = NEW.end_time,
      weekly_schedule = NEW.weekly_schedule,
      break_start = NEW.break_start,
      break_end = NEW.break_end,
      slot_duration_minutes = NEW.slot_duration_minutes,
      updated_at = now()
  WHERE ps.professional_id = NEW.professional_id
    AND EXISTS (
      SELECT 1 FROM public.professionals p
      WHERE p.id = NEW.professional_id AND p.is_registered
    );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."professional_clinics_sync_primary_settings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."professional_specialties_resolve_specialty"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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

  if new.specialty_id is null and new.is_approved then
    insert into public.specialties (name, slug)
    values (v_label, v_slug)
    on conflict (slug) do nothing;

    select s.id into new.specialty_id
    from public.specialties s
    where s.slug = v_slug;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."professional_specialties_resolve_specialty"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."professionals_default_pro_access_until"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_months integer;
begin
  if new.is_registered is true
     and coalesce(new.has_online_booking, false)
     and new.pro_access_until is null then
    select (s.value #>> '{}')::integer into v_months
    from public.app_settings s
    where s.key = 'trial_months';

    if coalesce(v_months, 0) > 0 then
      new.pro_access_until :=
        ((now() at time zone 'Asia/Nicosia') + make_interval(months => v_months))
        at time zone 'Asia/Nicosia';
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."professionals_default_pro_access_until"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."professionals_prevent_unregister"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF OLD.is_registered IS TRUE AND NEW.is_registered IS FALSE THEN
    RAISE EXCEPTION
      'professionals.is_registered cannot revert to false; delete the row to remove the account';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."professionals_prevent_unregister"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."public_doctor_occupied_datetimes"("p_doctor_id" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_location_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("appointment_datetime" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT DISTINCT o.appointment_datetime
  FROM public.public_professionals_occupied_datetimes(ARRAY[p_doctor_id], p_from, p_to) AS o
  WHERE p_location_id IS NULL OR o.location_id = p_location_id
$$;


ALTER FUNCTION "public"."public_doctor_occupied_datetimes"("p_doctor_id" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_location_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."public_professionals_occupied_datetimes"("p_professional_ids" "uuid"[], "p_from" timestamp with time zone, "p_to" timestamp with time zone) RETURNS TABLE("professional_id" "uuid", "location_id" "uuid", "appointment_datetime" timestamp with time zone)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT DISTINCT sub.professional_id, sub.location_id, sub.appointment_datetime
  FROM (
    -- Active visits: every slot start the visit covers.
    SELECT a.doctor_id AS professional_id, a.location_id,
      (a.appointment_datetime + (gs.n::text || ' minutes')::interval) AS appointment_datetime
    FROM public.appointments a
    INNER JOIN public.professionals d ON d.id = a.doctor_id
    LEFT JOIN public.professional_settings ds ON ds.professional_id = a.doctor_id
    LEFT JOIN public.professional_clinics pc ON pc.id = a.location_id
    CROSS JOIN LATERAL (
      SELECT
        GREATEST(COALESCE(pc.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS step_m,
        GREATEST(COALESCE(a.duration_minutes, pc.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS dur_m,
        GREATEST(COALESCE(pc.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS book_m
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
    LEFT JOIN public.professional_settings ds ON ds.professional_id = a.doctor_id
    LEFT JOIN public.professional_clinics pc ON pc.id = a.location_id
    CROSS JOIN LATERAL jsonb_array_elements_text(
      COALESCE(a.proposed_slots, '[]'::jsonb)
    ) AS ps(elem)
    CROSS JOIN LATERAL (
      SELECT
        GREATEST(COALESCE(pc.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS step_m,
        GREATEST(COALESCE(a.duration_minutes, pc.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS dur_m,
        GREATEST(COALESCE(pc.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS book_m
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
    LEFT JOIN public.professional_settings ds ON ds.professional_id = a.doctor_id
    LEFT JOIN public.professional_clinics pc ON pc.id = a.location_id
    CROSS JOIN LATERAL (
      SELECT
        GREATEST(COALESCE(pc.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS step_m,
        GREATEST(COALESCE(a.duration_minutes, pc.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS dur_m,
        GREATEST(COALESCE(pc.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS book_m
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
    LEFT JOIN public.professional_settings ds ON ds.professional_id = a.doctor_id
    LEFT JOIN public.professional_clinics pc ON pc.id = a.location_id
    CROSS JOIN LATERAL jsonb_array_elements_text(
      COALESCE(a.proposed_slots, '[]'::jsonb)
    ) AS ps(elem)
    CROSS JOIN LATERAL (
      SELECT
        GREATEST(COALESCE(pc.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS step_m,
        GREATEST(COALESCE(a.duration_minutes, pc.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS dur_m,
        GREATEST(COALESCE(pc.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS book_m
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
$$;


ALTER FUNCTION "public"."public_professionals_occupied_datetimes"("p_professional_ids" "uuid"[], "p_from" timestamp with time zone, "p_to" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."public_professionals_occupied_datetimes"("p_professional_ids" "uuid"[], "p_from" timestamp with time zone, "p_to" timestamp with time zone) IS 'Slot starts taken for many professionals at once, with each row''s clinic (location_id). Service role only. The single source of the occupancy rules; public_doctor_occupied_datetimes wraps it. Must match lib/appointment-overlap.ts.';



CREATE OR REPLACE FUNCTION "public"."register_professional_with_founder_lock"("p_auth_user_id" "uuid", "p_name" "text", "p_email" "text", "p_phone" "text", "p_languages" "text"[], "p_license_file_url" "text", "p_slug" "text", "p_specialties" "jsonb", "p_claim_listing_id" "uuid" DEFAULT NULL::"uuid", "p_directory_claim_source" "text" DEFAULT NULL::"text") RETURNS TABLE("professional_id" "uuid", "subscription_tier" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_founder_count int;
  v_tier text;
  v_new_id uuid;
begin
  if p_auth_user_id is null then
    raise exception 'p_auth_user_id is required';
  end if;

  if p_specialties is null
    or jsonb_typeof(p_specialties) <> 'array'
    or jsonb_array_length(p_specialties) = 0 then
    raise exception 'p_specialties must be a non-empty array';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_specialties) e
    where jsonb_typeof(e) <> 'object'
      or nullif(btrim(coalesce(e ->> 'specialty', '')), '') is null
  ) then
    raise exception 'every p_specialties entry needs a specialty';
  end if;

  perform pg_advisory_xact_lock(87201401, 3400);

  select count(*)::int into v_founder_count
  from public.professionals prof
  where prof.subscription_tier = 'founder'
    and prof.is_registered = true
    and coalesce(prof.is_test_profile, false) = false;

  v_tier := case when v_founder_count < 50 then 'founder' else 'standard' end;

  -- Always a fresh row. A claimed listing (p_claim_listing_id) is only
  -- referenced, never converted here: it stays untouched until Verify.
  insert into public.professionals (
    auth_user_id,
    name,
    registration_email,
    mobile_number,
    languages,
    license_file_url,
    status,
    slug,
    subscription_tier,
    is_test_profile,
    is_registered,
    has_online_booking,
    finder_visible,
    is_archived,
    claim_listing_id,
    directory_claim_source
  )
  values (
    p_auth_user_id,
    p_name,
    nullif(btrim(p_email), ''),
    nullif(btrim(p_phone), ''),
    p_languages,
    p_license_file_url,
    'pending',
    p_slug,
    v_tier,
    public.is_test_doctor_registration_email(p_email),
    true,
    true,
    true,
    false,
    p_claim_listing_id,
    nullif(btrim(coalesce(p_directory_claim_source, '')), '')
  )
  returning id into v_new_id;

  insert into public.professional_specialties (professional_id, specialty, license_number, is_approved)
  select
    v_new_id,
    btrim(e ->> 'specialty'),
    nullif(btrim(coalesce(e ->> 'license_number', '')), ''),
    coalesce((e ->> 'is_approved')::boolean, false)
  from jsonb_array_elements(p_specialties) e;

  return query select v_new_id, v_tier;
end;
$$;


ALTER FUNCTION "public"."register_professional_with_founder_lock"("p_auth_user_id" "uuid", "p_name" "text", "p_email" "text", "p_phone" "text", "p_languages" "text"[], "p_license_file_url" "text", "p_slug" "text", "p_specialties" "jsonb", "p_claim_listing_id" "uuid", "p_directory_claim_source" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_approve"("p_request_id" "uuid", "p_admin_id" "uuid", "p_corrected_details" "jsonb" DEFAULT NULL::"jsonb", "p_note" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_req public.request_log%rowtype;
  v_details jsonb;
  v_outcome jsonb;
begin
  if p_corrected_details is not null and jsonb_typeof(p_corrected_details) <> 'object' then
    raise exception 'corrected details must be a JSON object' using errcode = '22023';
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
  -- Each type's approval step goes here, added with the type: for edit types,
  -- stop with a conflict if the live values no longer match before_snapshot;
  -- then apply v_details and set v_outcome, e.g.
  --   if v_req.request_type = 'professional_registration' then v_outcome := ...; end if;
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
      outcome = v_outcome
  where id = p_request_id;
  perform set_config('doccy.request_decision', '', true);
  return p_request_id;
end
$$;


ALTER FUNCTION "public"."request_approve"("p_request_id" "uuid", "p_admin_id" "uuid", "p_corrected_details" "jsonb", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_assert_founder"("p_admin_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if not exists (
    select 1 from public.admin_users
    where id = p_admin_id and is_active and role = 'founder'
  ) then
    raise exception 'only an active founder can decide requests' using errcode = '42501';
  end if;
end
$$;


ALTER FUNCTION "public"."request_assert_founder"("p_admin_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_draft_confirm"("p_auth_user_id" "uuid", "p_request_type" "text" DEFAULT 'professional_registration'::"text") RETURNS TABLE("request_id" "uuid", "created" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_draft public.request_drafts%rowtype;
  v_confirmed_at timestamptz;
  v_id uuid;
begin
  select * into v_draft
  from public.request_drafts d
  where d.auth_user_id = p_auth_user_id and d.request_type = p_request_type
  for update;

  if not found then
    select r.id into v_id
    from public.request_log r
    where r.applicant_auth_user_id = p_auth_user_id
      and r.request_type = p_request_type
      and r.status = 'pending'
    order by r.created_at desc
    limit 1;
    if v_id is not null then
      return query select v_id, false;
    end if;
    return;
  end if;

  select u.email_confirmed_at into v_confirmed_at from auth.users u where u.id = p_auth_user_id;
  if v_confirmed_at is null then
    raise exception 'the applicant has not confirmed their email yet' using errcode = '55000';
  end if;

  insert into public.request_log (
    request_type, status, details, details_version,
    applicant_auth_user_id, requester_name, requester_email
  )
  values (
    v_draft.request_type, 'pending', v_draft.details, v_draft.details_version,
    p_auth_user_id, v_draft.requester_name, v_draft.requester_email
  )
  returning id into v_id;

  delete from public.request_drafts where id = v_draft.id;
  return query select v_id, true;
end
$$;


ALTER FUNCTION "public"."request_draft_confirm"("p_auth_user_id" "uuid", "p_request_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_draft_submit"("p_request_type" "text", "p_auth_user_id" "uuid", "p_details" "jsonb", "p_details_version" smallint, "p_requester_name" "text", "p_requester_email" "text") RETURNS TABLE("draft_id" "uuid", "founders_club" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_type public.request_types%rowtype;
  v_login_email text;
  v_details jsonb := p_details;
  v_founders boolean := false;
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
  if p_requester_name is null or btrim(p_requester_name) = ''
     or p_requester_email is null or btrim(p_requester_email) = '' then
    raise exception 'a draft names its requester' using errcode = '22023';
  end if;

  select u.email into v_login_email from auth.users u where u.id = p_auth_user_id;
  if not found then
    raise exception 'login % not found', p_auth_user_id using errcode = 'P0002';
  end if;

  if p_request_type = 'professional_registration' then
    if exists (select 1 from public.professionals p where p.auth_user_id = p_auth_user_id) then
      raise exception 'this login already belongs to a professional' using errcode = '23505';
    end if;
    if exists (
      select 1 from public.request_log r
      where r.applicant_auth_user_id = p_auth_user_id
        and r.request_type = 'professional_registration'
        and r.status = 'pending'
    ) then
      raise exception 'this login already has a pending registration request' using errcode = '23505';
    end if;

    -- Same lock as the old registration RPC, so two submits can't take the last place.
    perform pg_advisory_xact_lock(87201401, 3400);
    v_founders := not public.is_test_doctor_registration_email(p_requester_email)
      and not public.is_test_doctor_registration_email(v_login_email)
      and public.founders_club_places_taken() < 50;
    v_details := v_details || jsonb_build_object('founders_club', v_founders);
  end if;

  begin
    insert into public.request_drafts (
      request_type, auth_user_id, details, details_version, requester_name, requester_email
    )
    values (
      p_request_type, p_auth_user_id, v_details, p_details_version,
      btrim(p_requester_name), btrim(p_requester_email)
    )
    returning id into v_id;
  exception
    when unique_violation then
      raise exception 'this login already has a % draft', p_request_type using errcode = '23505';
  end;

  return query select v_id, v_founders;
end
$$;


ALTER FUNCTION "public"."request_draft_submit"("p_request_type" "text", "p_auth_user_id" "uuid", "p_details" "jsonb", "p_details_version" smallint, "p_requester_name" "text", "p_requester_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_drafts_expired"("p_older_than" interval DEFAULT '7 days'::interval) RETURNS TABLE("draft_id" "uuid", "auth_user_id" "uuid", "requester_email" "text", "email_confirmed" boolean, "photo_path" "text", "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select d.id, d.auth_user_id, d.requester_email, u.email_confirmed_at is not null,
         nullif(btrim(coalesce(d.details #>> '{photo,path}', '')), ''), d.created_at
  from public.request_drafts d
  join auth.users u on u.id = d.auth_user_id
  where d.created_at < now() - p_older_than
  order by d.created_at;
$$;


ALTER FUNCTION "public"."request_drafts_expired"("p_older_than" interval) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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
     or new.professional_id is distinct from old.professional_id
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


ALTER FUNCTION "public"."request_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_reject"("p_request_id" "uuid", "p_admin_id" "uuid", "p_note" "text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_req public.request_log%rowtype;
begin
  select * into v_req from public.request_log where id = p_request_id for update;
  if not found then
    raise exception 'request % not found', p_request_id using errcode = 'P0002';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'request % is already %', p_request_id, v_req.status using errcode = '55000';
  end if;
  perform public.request_assert_founder(p_admin_id);
  if p_note is null or btrim(p_note) = '' then
    raise exception 'a rejection needs a reason (it is emailed to the professional)' using errcode = '22023';
  end if;

  perform set_config('doccy.request_decision', p_request_id::text, true);
  update public.request_log
  set status = 'rejected', decided_at = now(), decided_by = p_admin_id, decision_note = btrim(p_note)
  where id = p_request_id;
  perform set_config('doccy.request_decision', '', true);
  return p_request_id;
end
$$;


ALTER FUNCTION "public"."request_reject"("p_request_id" "uuid", "p_admin_id" "uuid", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_submit"("p_request_type" "text", "p_professional_id" "uuid", "p_details" "jsonb", "p_details_version" smallint DEFAULT 1) RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_type public.request_types%rowtype;
  v_name text;
  v_email text;
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

  select name, email into v_name, v_email from public.professionals where id = p_professional_id;
  if not found then
    raise exception 'professional % not found', p_professional_id using errcode = 'P0002';
  end if;

  if v_type.is_edit then
    -- Each edit type captures the live values it changes here (its "before"),
    -- added with the type, e.g. if p_request_type = 'clinic_edit' then ... end if;
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


ALTER FUNCTION "public"."request_submit"("p_request_type" "text", "p_professional_id" "uuid", "p_details" "jsonb", "p_details_version" smallint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_withdraw"("p_request_id" "uuid", "p_professional_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_req public.request_log%rowtype;
begin
  select * into v_req from public.request_log where id = p_request_id for update;
  if not found then
    raise exception 'request % not found', p_request_id using errcode = 'P0002';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'request % is already %', p_request_id, v_req.status using errcode = '55000';
  end if;
  if p_professional_id is null or v_req.professional_id is distinct from p_professional_id then
    raise exception 'only the professional who made the request can withdraw it' using errcode = '42501';
  end if;

  perform set_config('doccy.request_decision', p_request_id::text, true);
  update public.request_log set status = 'withdrawn', decided_at = now() where id = p_request_id;
  perform set_config('doccy.request_decision', '', true);
  return p_request_id;
end
$$;


ALTER FUNCTION "public"."request_withdraw"("p_request_id" "uuid", "p_professional_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."specialty_slug"("p_label" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $_$
  select nullif(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            btrim(lower(normalize(coalesce(p_label, ''), NFKD))),
            '[^a-z0-9\s-]', '', 'g'),
          '\s+', '-', 'g'),
        '-+', '-', 'g'),
      '^-|-$', '', 'g'),
    '')
$_$;


ALTER FUNCTION "public"."specialty_slug"("p_label" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_primary_doctor_location"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.is_primary THEN
    UPDATE public.professionals
    SET
      district = CASE
        WHEN NEW.district IN (
          'Nicosia',
          'Limassol',
          'Paphos',
          'Larnaca',
          'Famagusta'
        ) THEN NEW.district::public.cyprus_district
        ELSE district
      END,
      clinic_address = NEW.clinic_address,
      town = NEW.town,
      latitude = NEW.latitude,
      longitude = NEW.longitude,
      clinic_place_id = NEW.clinic_place_id
    WHERE id = NEW.doctor_id;

    IF NOT EXISTS (SELECT 1 FROM public.professional_clinics pc WHERE pc.id = NEW.id) THEN
      UPDATE public.professional_settings
      SET
        pause_online_bookings = NEW.pause_online_bookings,
        monday = NEW.monday,
        tuesday = NEW.tuesday,
        wednesday = NEW.wednesday,
        thursday = NEW.thursday,
        friday = NEW.friday,
        saturday = NEW.saturday,
        sunday = NEW.sunday,
        start_time = NEW.start_time,
        end_time = NEW.end_time,
        weekly_schedule = NEW.weekly_schedule,
        break_start = NEW.break_start,
        break_end = NEW.break_end,
        slot_duration_minutes = NEW.slot_duration_minutes,
        updated_at = now()
      WHERE professional_id = NEW.doctor_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_primary_doctor_location"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auth_user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'founder'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_users_email_format" CHECK (("email" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'::"text")),
    CONSTRAINT "admin_users_name_not_blank" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "admin_users_role_check" CHECK (("role" = ANY (ARRAY['founder'::"text", 'partner'::"text"])))
);


ALTER TABLE "public"."admin_users" OWNER TO "postgres";


COMMENT ON TABLE "public"."admin_users" IS 'DocCy admins (internal directory / CRM). Service role only. Deactivate with is_active = false; do not delete.';



CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "app_settings_key_check" CHECK (("key" ~ '^[a-z][a-z0-9_]*$'::"text")),
    CONSTRAINT "app_settings_trial_months_valid" CHECK ((("key" <> 'trial_months'::"text") OR (("jsonb_typeof"("value") = 'number'::"text") AND ((("value" #>> '{}'::"text"[]))::numeric = "trunc"((("value" #>> '{}'::"text"[]))::numeric)) AND (((("value" #>> '{}'::"text"[]))::numeric >= (0)::numeric) AND ((("value" #>> '{}'::"text"[]))::numeric <= (24)::numeric)))))
);


ALTER TABLE "public"."app_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."app_settings" IS 'Settings founders change in the internal dashboard (service role only). trial_months: free-trial length in whole months for new professionals.';



CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "doctor_id" "uuid" NOT NULL,
    "patient_name" "text" NOT NULL,
    "patient_email" "text",
    "patient_phone" "text" NOT NULL,
    "appointment_datetime" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'confirmed'::"text" NOT NULL,
    "visit_type" "text",
    "visit_notes" "text",
    "synced_to_calendar" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "duration_minutes" integer DEFAULT 30 NOT NULL,
    "proposed_slots" "jsonb",
    "proposal_expires_at" timestamp with time zone,
    "reason" "text",
    "is_new_patient" boolean,
    "reschedule_access_token" "uuid",
    "attendance" "text",
    "location_id" "uuid",
    CONSTRAINT "appointments_attendance_check" CHECK ((("attendance" IS NULL) OR ("attendance" = 'no_show'::"text"))),
    CONSTRAINT "appointments_duration_minutes_check" CHECK ((("duration_minutes" > 0) AND ("duration_minutes" <= 480))),
    CONSTRAINT "appointments_status_check" CHECK (("status" = ANY (ARRAY['REQUESTED'::"text", 'PENDING'::"text", 'CONFIRMED'::"text", 'CANCELLED'::"text", 'REJECTED'::"text", 'COMPLETED'::"text", 'NEEDS_RESCHEDULE'::"text"])))
);

ALTER TABLE ONLY "public"."appointments" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."appointments"."patient_email" IS 'Patient email when provided; null for manual bookings without email.';



COMMENT ON COLUMN "public"."appointments"."visit_type" IS 'Category: First Consultation | Follow-up | Routine Check-up | Urgency';



COMMENT ON COLUMN "public"."appointments"."visit_notes" IS 'Optional patient note (app max 200 chars).';



COMMENT ON COLUMN "public"."appointments"."created_at" IS 'When the booking was created (dashboard KPIs).';



COMMENT ON COLUMN "public"."appointments"."proposed_slots" IS 'JSON array of ISO-8601 UTC start times offered to the patient while status is NEEDS_RESCHEDULE.';



COMMENT ON COLUMN "public"."appointments"."proposal_expires_at" IS 'When the temporary hold on proposed_slots ends (patient must pick before this).';



COMMENT ON COLUMN "public"."appointments"."is_new_patient" IS 'True when the patient selected first visit with this professional; false when returning; null for legacy/manual bookings.';



COMMENT ON COLUMN "public"."appointments"."reschedule_access_token" IS 'Secret token for the patient reschedule page; set when proposal is sent, cleared when resolved.';



COMMENT ON COLUMN "public"."appointments"."attendance" IS 'Doctor attendance marking; MVP supports no_show on past confirmed visits only.';



COMMENT ON COLUMN "public"."appointments"."location_id" IS 'Workplace this visit belongs to. Independent from other locations of the same professional.';



CREATE TABLE IF NOT EXISTS "public"."clinics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "district" "public"."cyprus_district" NOT NULL,
    "address" "text",
    "phone" "text",
    "address_maps_link" "text",
    "latitude" double precision,
    "longitude" double precision,
    "ghs_code" "text",
    "is_archived" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "town" "text",
    "clinic_place_id" "text"
);


ALTER TABLE "public"."clinics" OWNER TO "postgres";


COMMENT ON TABLE "public"."clinics" IS 'Healthcare facilities (clinics/hospitals). Linked from directory_manual via clinic_id. Not searchable in Finder (v1).';



COMMENT ON COLUMN "public"."clinics"."town" IS 'Municipality/village for this clinic location (GeSY town). Used by finder town filter.';



CREATE TABLE IF NOT EXISTS "public"."directory_manual_outreach_sent" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "manual_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "booking_count" integer DEFAULT 0 NOT NULL,
    "phone_click_count" integer DEFAULT 0 NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "window_end" timestamp with time zone NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."directory_manual_outreach_sent" OWNER TO "postgres";


COMMENT ON TABLE "public"."directory_manual_outreach_sent" IS 'Idempotency / cooldown log for weekly directory outreach emails. Service role only.';



CREATE TABLE IF NOT EXISTS "public"."directory_manual_outreach_unsubscribed" (
    "email_normalized" "text" NOT NULL,
    "manual_id" "uuid",
    "unsubscribed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."directory_manual_outreach_unsubscribed" OWNER TO "postgres";


COMMENT ON TABLE "public"."directory_manual_outreach_unsubscribed" IS 'Opt-out list for directory outreach, keyed by lower(trim(email)). Service role only.';



CREATE TABLE IF NOT EXISTS "public"."doctor_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "doctor_id" "uuid" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "label" "text",
    "district" "text",
    "clinic_address" "text",
    "town" "text",
    "latitude" double precision,
    "longitude" double precision,
    "clinic_place_id" "text",
    "pause_online_bookings" boolean DEFAULT true NOT NULL,
    "monday" boolean DEFAULT true NOT NULL,
    "tuesday" boolean DEFAULT true NOT NULL,
    "wednesday" boolean DEFAULT true NOT NULL,
    "thursday" boolean DEFAULT true NOT NULL,
    "friday" boolean DEFAULT true NOT NULL,
    "saturday" boolean DEFAULT false NOT NULL,
    "sunday" boolean DEFAULT false NOT NULL,
    "start_time" time without time zone DEFAULT '09:00:00'::time without time zone NOT NULL,
    "end_time" time without time zone DEFAULT '17:00:00'::time without time zone NOT NULL,
    "weekly_schedule" "jsonb",
    "break_start" time without time zone,
    "break_end" time without time zone,
    "slot_duration_minutes" integer DEFAULT 30 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "doctor_locations_slot_duration_minutes_check" CHECK (("slot_duration_minutes" > 0))
);


ALTER TABLE "public"."doctor_locations" OWNER TO "postgres";


COMMENT ON TABLE "public"."doctor_locations" IS 'Practice locations for a registered professional. Schedule and online-booking pause are per location.';



CREATE TABLE IF NOT EXISTS "public"."doctor_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "doctor_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "price" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."doctor_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."missing_professional_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requested_name" "text" NOT NULL,
    "specialty" "text",
    "district" "text",
    "search_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" DEFAULT 'finder_empty_state'::"text" NOT NULL,
    "voter_key" "text"
);


ALTER TABLE "public"."missing_professional_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."missing_professional_requests" IS 'Anonymous patient intent from finder empty state: names of doctors/clinics patients want on DocCy. Inserted only via server API (service role).';



CREATE TABLE IF NOT EXISTS "public"."professional_call_to_book_clicks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "clinic_id" "uuid",
    "source" "text" DEFAULT 'finder_card'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "directory_manual_call_to_book_clicks_source_chk" CHECK (("source" = ANY (ARRAY['finder_card'::"text", 'professional_profile_page'::"text"])))
);


ALTER TABLE "public"."professional_call_to_book_clicks" OWNER TO "postgres";


COMMENT ON TABLE "public"."professional_call_to_book_clicks" IS 'Anonymous Show-phone clicks on directory cards. Inserted only via server API (service role).';



CREATE TABLE IF NOT EXISTS "public"."professional_clinics" (
    "professional_id" "uuid" NOT NULL,
    "clinic_id" "uuid" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "label" "text",
    "pause_online_bookings" boolean DEFAULT true NOT NULL,
    "monday" boolean,
    "tuesday" boolean,
    "wednesday" boolean,
    "thursday" boolean,
    "friday" boolean,
    "saturday" boolean,
    "sunday" boolean,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "weekly_schedule" "jsonb",
    "break_start" time without time zone,
    "break_end" time without time zone,
    "slot_duration_minutes" integer,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."professional_clinics" OWNER TO "postgres";


COMMENT ON TABLE "public"."professional_clinics" IS 'Professionals may practice at multiple clinics. Clinic profiles list members via this join.';



COMMENT ON COLUMN "public"."professional_clinics"."pause_online_bookings" IS 'Per-clinic booking switch. Gated above by professionals.has_online_booking (entitlement) and professionals.is_registered.';



COMMENT ON COLUMN "public"."professional_clinics"."weekly_schedule" IS 'This clinic''s own schedule. NULL means never configured. Account-level policy (holidays, booking horizon, minimum notice) stays on doctor_settings.';



CREATE TABLE IF NOT EXISTS "public"."professional_monthly_digest_sent" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "month_key" "text" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "professional_monthly_digest_sent_month_key_check" CHECK (("month_key" ~ '^\d{4}-\d{2}$'::"text"))
);


ALTER TABLE "public"."professional_monthly_digest_sent" OWNER TO "postgres";


COMMENT ON TABLE "public"."professional_monthly_digest_sent" IS 'Tracks month-end practice digest emails sent to doctors (Cyprus yyyy-MM).';



CREATE TABLE IF NOT EXISTS "public"."professional_patient_booking_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" DEFAULT 'finder_card'::"text" NOT NULL,
    "voter_key" "text",
    "clinic_id" "uuid"
);


ALTER TABLE "public"."professional_patient_booking_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."professional_patient_booking_requests" IS 'Patient votes asking an unregistered listing to offer online booking.';



COMMENT ON COLUMN "public"."professional_patient_booking_requests"."voter_key" IS 'Opaque fingerprint (HMAC-SHA256 of client IP + manual_id) for counting unique voters; set server-side.';



COMMENT ON COLUMN "public"."professional_patient_booking_requests"."clinic_id" IS 'Practice location on the card when the patient tapped Request online booking, if known.';



CREATE TABLE IF NOT EXISTS "public"."professional_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "monday" boolean DEFAULT true NOT NULL,
    "tuesday" boolean DEFAULT true NOT NULL,
    "wednesday" boolean DEFAULT true NOT NULL,
    "thursday" boolean DEFAULT true NOT NULL,
    "friday" boolean DEFAULT true NOT NULL,
    "saturday" boolean DEFAULT false NOT NULL,
    "sunday" boolean DEFAULT false NOT NULL,
    "start_time" time without time zone DEFAULT '09:00:00'::time without time zone NOT NULL,
    "end_time" time without time zone DEFAULT '17:00:00'::time without time zone NOT NULL,
    "weekly_schedule" "jsonb",
    "break_start" time without time zone,
    "break_end" time without time zone,
    "pause_online_bookings" boolean DEFAULT true NOT NULL,
    "holiday_mode_enabled" boolean DEFAULT false NOT NULL,
    "holiday_start_date" "date",
    "holiday_end_date" "date",
    "booking_horizon_days" integer DEFAULT 90 NOT NULL,
    "minimum_notice_hours" integer DEFAULT 2 NOT NULL,
    "slot_duration_minutes" integer DEFAULT 30 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "show_phone_public" boolean DEFAULT false NOT NULL,
    "public_phone_source" "text" DEFAULT 'directory'::"text" NOT NULL,
    CONSTRAINT "professional_settings_booking_horizon_days_check" CHECK (("booking_horizon_days" = ANY (ARRAY[14, 30, 90, 180]))),
    CONSTRAINT "professional_settings_minimum_notice_hours_check" CHECK (("minimum_notice_hours" = ANY (ARRAY[1, 2, 4, 12, 24, 48, 72, 168]))),
    CONSTRAINT "professional_settings_public_phone_source_check" CHECK (("public_phone_source" = ANY (ARRAY['mobile'::"text", 'directory'::"text"]))),
    CONSTRAINT "professional_settings_slot_duration_minutes_check" CHECK (("slot_duration_minutes" > 0))
);

ALTER TABLE ONLY "public"."professional_settings" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."professional_settings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."professional_settings"."public_phone_source" IS 'Which professionals phone is used for the public Call button when show_phone_public is true.';



CREATE TABLE IF NOT EXISTS "public"."professional_slug_redirects" (
    "slug" "text" NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."professional_slug_redirects" OWNER TO "postgres";


COMMENT ON TABLE "public"."professional_slug_redirects" IS 'Old public slugs that should 308 to a surviving professional after a directory absorb.';



CREATE TABLE IF NOT EXISTS "public"."professional_specialties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "specialty" "text" NOT NULL,
    "license_number" "text",
    "is_approved" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "specialty_id" "uuid",
    CONSTRAINT "professional_specialties_approved_needs_specialty" CHECK ((("specialty_id" IS NOT NULL) OR ("is_approved" = false))),
    CONSTRAINT "professional_specialties_license_nonempty" CHECK ((("license_number" IS NULL) OR ("length"("btrim"("license_number")) > 0))),
    CONSTRAINT "professional_specialties_specialty_nonempty" CHECK (("length"("btrim"("specialty")) > 0))
);


ALTER TABLE "public"."professional_specialties" OWNER TO "postgres";


COMMENT ON TABLE "public"."professional_specialties" IS 'Which specialties each professional has. One row per (professional, specialty); license_number is null for scraped listings. specialty_id is derived from the label.';



CREATE TABLE IF NOT EXISTS "public"."professional_specialty_change_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "from_specialty" "text",
    "to_specialty" "text",
    "to_specialty_from_master" boolean DEFAULT true NOT NULL,
    "license_number" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "founder_note" "text",
    "request_kind" "text" DEFAULT 'add'::"text" NOT NULL,
    CONSTRAINT "professional_specialty_change_requests_request_kind_check" CHECK (("request_kind" = ANY (ARRAY['add'::"text", 'replace'::"text", 'remove'::"text"]))),
    CONSTRAINT "professional_specialty_change_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."professional_specialty_change_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."professional_specialty_change_requests" IS 'Doctor specialty change requests from agenda settings. Service-role APIs only; founder reviews in /internal/directory.';



COMMENT ON COLUMN "public"."professional_specialty_change_requests"."request_kind" IS 'add = new specialty; replace = swap from→to; remove = drop from_specialty (only when doctor has 2+).';



CREATE TABLE IF NOT EXISTS "public"."professionals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text",
    "district" "public"."cyprus_district",
    "town" "text",
    "phone" "text",
    "email" "text",
    "avatar_url" "text",
    "bio" "text",
    "languages" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "gender" "text",
    "is_gesy" boolean DEFAULT false NOT NULL,
    "clinic_address" "text",
    "address" "text",
    "address_maps_link" "text",
    "latitude" double precision,
    "longitude" double precision,
    "clinic_place_id" "text",
    "clinic_id" "uuid",
    "ghs_code" "text",
    "segment" "text",
    "finder_visible" boolean DEFAULT true NOT NULL,
    "is_archived" boolean DEFAULT false NOT NULL,
    "is_registered" boolean DEFAULT false NOT NULL,
    "has_online_booking" boolean DEFAULT false NOT NULL,
    "is_test_profile" boolean DEFAULT false NOT NULL,
    "auth_user_id" "uuid",
    "status" "text",
    "license_file_url" "text",
    "subscription_tier" "text",
    "specialty_requires_standard_at" timestamp with time zone,
    "auth_session_revoked_after" timestamp with time zone,
    "auth_keep_session_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "registration_email" "text",
    "mobile_number" "text",
    "trial_notice_seen_at" timestamp with time zone,
    "directory_claim_source" "text",
    "claim_listing_id" "uuid",
    "pro_access_until" timestamp with time zone,
    CONSTRAINT "professionals_booking_requires_registered" CHECK (((NOT "has_online_booking") OR "is_registered")),
    CONSTRAINT "professionals_directory_claim_source_check" CHECK ((("directory_claim_source" IS NULL) OR ("directory_claim_source" = ANY (ARRAY['card_link'::"text", 'email'::"text", 'name_specialty_district'::"text"])))),
    CONSTRAINT "professionals_registered_requires_auth" CHECK (((NOT "is_registered") OR ("auth_user_id" IS NOT NULL))),
    CONSTRAINT "professionals_registered_requires_status" CHECK (((NOT "is_registered") OR ("status" IS NOT NULL))),
    CONSTRAINT "professionals_status_check" CHECK ((("status" IS NULL) OR ("status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'rejected'::"text"])))),
    CONSTRAINT "professionals_subscription_tier_check" CHECK ((("subscription_tier" IS NULL) OR ("subscription_tier" = ANY (ARRAY['founder'::"text", 'standard'::"text"])))),
    CONSTRAINT "professionals_unregistered_no_status" CHECK (("is_registered" OR ("status" IS NULL)))
);


ALTER TABLE "public"."professionals" OWNER TO "postgres";


COMMENT ON TABLE "public"."professionals" IS 'Unified health-professional identity (registered accounts + directory listings).';



COMMENT ON COLUMN "public"."professionals"."is_registered" IS 'True after signup (self-serve or admin on their behalf). Sticky; only row deletion clears it.';



COMMENT ON COLUMN "public"."professionals"."has_online_booking" IS 'Entitlement to the online-booking product. True on register (launching offer). Later false if they cancel a paid subscription. Independent of per-clinic pause_online_bookings.';



COMMENT ON COLUMN "public"."professionals"."is_test_profile" IS 'QA / smoke profiles. Production Finder hides these unless NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES=1.';



COMMENT ON COLUMN "public"."professionals"."auth_user_id" IS 'Supabase Auth user. Required when is_registered; null for directory-only rows.';



COMMENT ON COLUMN "public"."professionals"."registration_email" IS 'Email typed at signup (login / DocCy emails). Distinct from directory email.';



COMMENT ON COLUMN "public"."professionals"."mobile_number" IS 'Mobile typed at signup (account / future SMS). Distinct from directory phone.';



COMMENT ON COLUMN "public"."professionals"."trial_notice_seen_at" IS 'When the verified professional dismissed the one-time first-login trial notice.';



COMMENT ON COLUMN "public"."professionals"."directory_claim_source" IS 'How this registered row converted an unregistered finder listing at signup: card_link (Activate online booking), email, or name_specialty_district. NULL when signup inserted a new row.';



COMMENT ON COLUMN "public"."professionals"."claim_listing_id" IS 'Unregistered finder listing this pending registration intends to claim (card_link). Set at signup, consumed by absorb_unregistered_into_registered at founder Verify. The referenced listing is never mutated before Verify.';



COMMENT ON COLUMN "public"."professionals"."pro_access_until" IS 'Pro tier (online bookings) is active while this is in the future. Set by the registration approval (trial) and, later, by payments. Null = never had it.';



CREATE TABLE IF NOT EXISTS "public"."request_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_type" "text" NOT NULL,
    "auth_user_id" "uuid" NOT NULL,
    "details" "jsonb" NOT NULL,
    "details_version" smallint NOT NULL,
    "requester_name" "text" NOT NULL,
    "requester_email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "request_drafts_details_object" CHECK (("jsonb_typeof"("details") = 'object'::"text")),
    CONSTRAINT "request_drafts_details_version_check" CHECK (("details_version" >= 1)),
    CONSTRAINT "request_drafts_requester_email_not_blank" CHECK (("btrim"("requester_email") <> ''::"text")),
    CONSTRAINT "request_drafts_requester_name_not_blank" CHECK (("btrim"("requester_name") <> ''::"text"))
);


ALTER TABLE "public"."request_drafts" OWNER TO "postgres";


COMMENT ON TABLE "public"."request_drafts" IS 'Submitted requests waiting for the applicant to confirm their email; then moved into request_log (request_draft_confirm). Purgeable: never an audit record.';



CREATE TABLE IF NOT EXISTS "public"."request_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_type" "text" NOT NULL,
    "status" "text" NOT NULL,
    "details" "jsonb" NOT NULL,
    "details_version" smallint NOT NULL,
    "before_snapshot" "jsonb",
    "approved_details" "jsonb",
    "outcome" "jsonb",
    "professional_id" "uuid",
    "requester_name" "text",
    "requester_email" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "decided_at" timestamp with time zone,
    "decided_by" "uuid",
    "decision_note" "text",
    "applicant_auth_user_id" "uuid",
    CONSTRAINT "request_log_approval_fields_only_when_approved" CHECK ((("status" = 'approved'::"text") OR (("approved_details" IS NULL) AND ("outcome" IS NULL)))),
    CONSTRAINT "request_log_approved_details_object" CHECK ((("approved_details" IS NULL) OR ("jsonb_typeof"("approved_details") = 'object'::"text"))),
    CONSTRAINT "request_log_before_snapshot_object" CHECK ((("before_snapshot" IS NULL) OR ("jsonb_typeof"("before_snapshot") = 'object'::"text"))),
    CONSTRAINT "request_log_decided_after_created" CHECK ((("decided_at" IS NULL) OR ("decided_at" >= "created_at"))),
    CONSTRAINT "request_log_decided_at_iff_closed" CHECK ((("status" = 'pending'::"text") = ("decided_at" IS NULL))),
    CONSTRAINT "request_log_decided_by_iff_admin_decision" CHECK ((("status" = ANY (ARRAY['approved'::"text", 'rejected'::"text"])) = ("decided_by" IS NOT NULL))),
    CONSTRAINT "request_log_details_object" CHECK (("jsonb_typeof"("details") = 'object'::"text")),
    CONSTRAINT "request_log_details_version_check" CHECK (("details_version" >= 1)),
    CONSTRAINT "request_log_outcome_object" CHECK ((("outcome" IS NULL) OR ("jsonb_typeof"("outcome") = 'object'::"text"))),
    CONSTRAINT "request_log_recorded_at_birth" CHECK ((("status" <> 'recorded'::"text") OR ("decided_at" = "created_at"))),
    CONSTRAINT "request_log_rejection_has_note" CHECK ((("status" <> 'rejected'::"text") OR (("decision_note" IS NOT NULL) AND ("btrim"("decision_note") <> ''::"text")))),
    CONSTRAINT "request_log_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'withdrawn'::"text", 'recorded'::"text"])))
);


ALTER TABLE "public"."request_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."request_log" IS 'Review requests and the permanent audit log. Never deleted; decided requests never change (trigger request_log_guard). details: as submitted, in business terms per type.';



COMMENT ON COLUMN "public"."request_log"."applicant_auth_user_id" IS 'The applicant''s login, for requests made before a professional exists (professional_registration). Emptied if the login is deleted; the request stays.';



CREATE TABLE IF NOT EXISTS "public"."request_types" (
    "name" "text" NOT NULL,
    "requires_approval" boolean NOT NULL,
    "is_edit" boolean DEFAULT false NOT NULL,
    "description" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "request_types_description_not_blank" CHECK (("btrim"("description") <> ''::"text")),
    CONSTRAINT "request_types_name_format" CHECK (("name" ~ '^[a-z][a-z0-9_]*$'::"text"))
);


ALTER TABLE "public"."request_types" OWNER TO "postgres";


COMMENT ON TABLE "public"."request_types" IS 'Kinds of review requests. requires_approval = false: recorded at once, never queued. is_edit: changes existing data, so before_snapshot is required.';



CREATE TABLE IF NOT EXISTS "public"."specialties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "specialties_name_nonempty" CHECK (("length"("btrim"("name")) > 0)),
    CONSTRAINT "specialties_slug_matches_name" CHECK (("slug" = "public"."specialty_slug"("name")))
);


ALTER TABLE "public"."specialties" OWNER TO "postgres";


COMMENT ON TABLE "public"."specialties" IS 'Approved specialty labels. slug = specialty_slug(name) = the finder URL segment.';



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clinics"
    ADD CONSTRAINT "clinics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clinics"
    ADD CONSTRAINT "clinics_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."professional_call_to_book_clicks"
    ADD CONSTRAINT "directory_manual_call_to_book_clicks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."directory_manual_outreach_sent"
    ADD CONSTRAINT "directory_manual_outreach_sent_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."directory_manual_outreach_unsubscribed"
    ADD CONSTRAINT "directory_manual_outreach_unsubscribed_pkey" PRIMARY KEY ("email_normalized");



ALTER TABLE ONLY "public"."professional_patient_booking_requests"
    ADD CONSTRAINT "directory_manual_patient_booking_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."doctor_locations"
    ADD CONSTRAINT "doctor_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."doctor_services"
    ADD CONSTRAINT "doctor_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."missing_professional_requests"
    ADD CONSTRAINT "missing_professional_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."professional_clinics"
    ADD CONSTRAINT "professional_clinics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."professional_clinics"
    ADD CONSTRAINT "professional_clinics_professional_id_clinic_id_key" UNIQUE ("professional_id", "clinic_id");



ALTER TABLE ONLY "public"."professional_monthly_digest_sent"
    ADD CONSTRAINT "professional_monthly_digest_sent_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."professional_monthly_digest_sent"
    ADD CONSTRAINT "professional_monthly_digest_sent_professional_id_month_key_key" UNIQUE ("professional_id", "month_key");



ALTER TABLE ONLY "public"."professional_settings"
    ADD CONSTRAINT "professional_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."professional_settings"
    ADD CONSTRAINT "professional_settings_professional_id_key" UNIQUE ("professional_id");



ALTER TABLE ONLY "public"."professional_slug_redirects"
    ADD CONSTRAINT "professional_slug_redirects_pkey" PRIMARY KEY ("slug");



ALTER TABLE ONLY "public"."professional_specialties"
    ADD CONSTRAINT "professional_specialties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."professional_specialties"
    ADD CONSTRAINT "professional_specialties_professional_id_specialty_id_key" UNIQUE ("professional_id", "specialty_id");



ALTER TABLE ONLY "public"."professional_specialties"
    ADD CONSTRAINT "professional_specialties_professional_id_specialty_key" UNIQUE ("professional_id", "specialty");



ALTER TABLE ONLY "public"."professional_specialty_change_requests"
    ADD CONSTRAINT "professional_specialty_change_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."professionals"
    ADD CONSTRAINT "professionals_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."professionals"
    ADD CONSTRAINT "professionals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."request_drafts"
    ADD CONSTRAINT "request_drafts_one_per_login" UNIQUE ("auth_user_id", "request_type");



ALTER TABLE ONLY "public"."request_drafts"
    ADD CONSTRAINT "request_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."request_log"
    ADD CONSTRAINT "request_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."request_types"
    ADD CONSTRAINT "request_types_pkey" PRIMARY KEY ("name");



ALTER TABLE ONLY "public"."specialties"
    ADD CONSTRAINT "specialties_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."specialties"
    ADD CONSTRAINT "specialties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."specialties"
    ADD CONSTRAINT "specialties_slug_key" UNIQUE ("slug");



CREATE UNIQUE INDEX "admin_users_email_lower_key" ON "public"."admin_users" USING "btree" ("lower"("email"));



CREATE UNIQUE INDEX "appointments_active_slot_unique" ON "public"."appointments" USING "btree" ("doctor_id", "appointment_datetime") WHERE ("status" = ANY (ARRAY['REQUESTED'::"text", 'PENDING'::"text", 'CONFIRMED'::"text"]));



CREATE UNIQUE INDEX "appointments_doctor_datetime_active_booking_null_location_key" ON "public"."appointments" USING "btree" ("doctor_id", "appointment_datetime") WHERE (("status" = ANY (ARRAY['REQUESTED'::"text", 'CONFIRMED'::"text"])) AND ("location_id" IS NULL));



CREATE INDEX "appointments_doctor_id_datetime_idx" ON "public"."appointments" USING "btree" ("doctor_id", "appointment_datetime");



CREATE UNIQUE INDEX "appointments_location_datetime_active_booking_key" ON "public"."appointments" USING "btree" ("location_id", "appointment_datetime") WHERE (("status" = ANY (ARRAY['REQUESTED'::"text", 'CONFIRMED'::"text"])) AND ("location_id" IS NOT NULL));



COMMENT ON INDEX "public"."appointments_location_datetime_active_booking_key" IS 'Prevents two active bookings at the same instant for one workplace. Other workplaces of the same professional are independent.';



CREATE INDEX "appointments_location_id_idx" ON "public"."appointments" USING "btree" ("location_id") WHERE ("location_id" IS NOT NULL);



CREATE UNIQUE INDEX "appointments_reschedule_access_token_key" ON "public"."appointments" USING "btree" ("reschedule_access_token") WHERE ("reschedule_access_token" IS NOT NULL);



CREATE INDEX "clinics_district_idx" ON "public"."clinics" USING "btree" ("district") WHERE ("is_archived" = false);



CREATE UNIQUE INDEX "clinics_ghs_code_active_uidx" ON "public"."clinics" USING "btree" ("ghs_code") WHERE (("ghs_code" IS NOT NULL) AND ("is_archived" = false));



CREATE INDEX "clinics_town_idx" ON "public"."clinics" USING "btree" ("town") WHERE (("is_archived" = false) AND ("town" IS NOT NULL));



CREATE INDEX "directory_manual_outreach_sent_manual_sent_idx" ON "public"."directory_manual_outreach_sent" USING "btree" ("manual_id", "sent_at" DESC);



CREATE INDEX "directory_manual_outreach_sent_sent_idx" ON "public"."directory_manual_outreach_sent" USING "btree" ("sent_at" DESC);



CREATE INDEX "directory_manual_outreach_unsubscribed_manual_id_idx" ON "public"."directory_manual_outreach_unsubscribed" USING "btree" ("manual_id");



CREATE INDEX "doctor_locations_district_idx" ON "public"."doctor_locations" USING "btree" ("district") WHERE ("district" IS NOT NULL);



CREATE INDEX "doctor_locations_doctor_id_idx" ON "public"."doctor_locations" USING "btree" ("doctor_id");



CREATE UNIQUE INDEX "doctor_locations_one_primary_idx" ON "public"."doctor_locations" USING "btree" ("doctor_id") WHERE "is_primary";



CREATE INDEX "doctor_services_doctor_id_idx" ON "public"."doctor_services" USING "btree" ("doctor_id", "created_at");



CREATE INDEX "missing_professional_requests_created_idx" ON "public"."missing_professional_requests" USING "btree" ("created_at" DESC);



CREATE INDEX "missing_professional_requests_name_context_idx" ON "public"."missing_professional_requests" USING "btree" ("requested_name", "specialty", "district", "created_at" DESC);



CREATE INDEX "professional_call_to_book_clicks_clinic_id_idx" ON "public"."professional_call_to_book_clicks" USING "btree" ("clinic_id");



CREATE INDEX "professional_call_to_book_clicks_created_idx" ON "public"."professional_call_to_book_clicks" USING "btree" ("created_at" DESC);



CREATE INDEX "professional_call_to_book_clicks_professional_created_idx" ON "public"."professional_call_to_book_clicks" USING "btree" ("professional_id", "created_at" DESC);



CREATE INDEX "professional_clinics_clinic_id_idx" ON "public"."professional_clinics" USING "btree" ("clinic_id");



CREATE INDEX "professional_clinics_primary_idx" ON "public"."professional_clinics" USING "btree" ("professional_id") WHERE ("is_primary" = true);



CREATE INDEX "professional_monthly_digest_sent_month_key_idx" ON "public"."professional_monthly_digest_sent" USING "btree" ("month_key");



CREATE INDEX "professional_patient_booking_requests_clinic_created_idx" ON "public"."professional_patient_booking_requests" USING "btree" ("clinic_id", "created_at" DESC) WHERE ("clinic_id" IS NOT NULL);



CREATE INDEX "professional_patient_booking_requests_professional_created_idx" ON "public"."professional_patient_booking_requests" USING "btree" ("professional_id", "created_at" DESC);



CREATE INDEX "professional_patient_booking_requests_professional_voter_create" ON "public"."professional_patient_booking_requests" USING "btree" ("professional_id", "voter_key", "created_at" DESC);



CREATE INDEX "professional_settings_professional_id_idx" ON "public"."professional_settings" USING "btree" ("professional_id");



CREATE INDEX "professional_slug_redirects_professional_id_idx" ON "public"."professional_slug_redirects" USING "btree" ("professional_id");



CREATE INDEX "professional_specialties_professional_id_idx" ON "public"."professional_specialties" USING "btree" ("professional_id");



CREATE INDEX "professional_specialties_specialty_id_idx" ON "public"."professional_specialties" USING "btree" ("specialty_id");



CREATE INDEX "professional_specialties_specialty_idx" ON "public"."professional_specialties" USING "btree" ("specialty");



CREATE UNIQUE INDEX "professional_specialty_change_requests_one_pending" ON "public"."professional_specialty_change_requests" USING "btree" ("professional_id") WHERE ("status" = 'pending'::"text");



CREATE INDEX "professional_specialty_change_requests_professional_idx" ON "public"."professional_specialty_change_requests" USING "btree" ("professional_id", "created_at" DESC);



CREATE INDEX "professional_specialty_change_requests_status_created_idx" ON "public"."professional_specialty_change_requests" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "professionals_claim_listing_id_idx" ON "public"."professionals" USING "btree" ("claim_listing_id");



CREATE INDEX "professionals_clinic_id_idx" ON "public"."professionals" USING "btree" ("clinic_id") WHERE (("clinic_id" IS NOT NULL) AND ("is_archived" = false));



CREATE INDEX "professionals_district_idx" ON "public"."professionals" USING "btree" ("district") WHERE ("is_archived" = false);



CREATE INDEX "professionals_finder_state_idx" ON "public"."professionals" USING "btree" ("is_archived", "finder_visible", "is_registered", "has_online_booking");



CREATE INDEX "professionals_finder_visible_idx" ON "public"."professionals" USING "btree" ("finder_visible") WHERE (("is_archived" = false) AND ("finder_visible" = true));



CREATE UNIQUE INDEX "professionals_ghs_code_active_uidx" ON "public"."professionals" USING "btree" ("ghs_code") WHERE (("ghs_code" IS NOT NULL) AND ("is_archived" = false));



CREATE INDEX "professionals_is_test_profile_idx" ON "public"."professionals" USING "btree" ("is_test_profile") WHERE ("is_test_profile" = true);



CREATE INDEX "professionals_slug_idx" ON "public"."professionals" USING "btree" ("slug");



CREATE UNIQUE INDEX "professionals_slug_unique_lower_idx" ON "public"."professionals" USING "btree" ("lower"(TRIM(BOTH FROM "slug"))) WHERE (("slug" IS NOT NULL) AND (TRIM(BOTH FROM "slug") <> ''::"text") AND ("is_archived" = false));



CREATE INDEX "professionals_town_idx" ON "public"."professionals" USING "btree" ("town") WHERE (("is_archived" = false) AND ("town" IS NOT NULL));



CREATE INDEX "request_drafts_created_idx" ON "public"."request_drafts" USING "btree" ("created_at");



CREATE INDEX "request_log_applicant_idx" ON "public"."request_log" USING "btree" ("applicant_auth_user_id", "created_at" DESC) WHERE ("applicant_auth_user_id" IS NOT NULL);



CREATE INDEX "request_log_decided_by_idx" ON "public"."request_log" USING "btree" ("decided_by") WHERE ("decided_by" IS NOT NULL);



CREATE UNIQUE INDEX "request_log_one_pending_professional_registration_idx" ON "public"."request_log" USING "btree" ("professional_id") WHERE (("status" = 'pending'::"text") AND ("request_type" = 'professional_registration'::"text"));



CREATE UNIQUE INDEX "request_log_one_pending_registration_per_applicant_idx" ON "public"."request_log" USING "btree" ("applicant_auth_user_id") WHERE (("status" = 'pending'::"text") AND ("request_type" = 'professional_registration'::"text"));



CREATE INDEX "request_log_pending_queue_idx" ON "public"."request_log" USING "btree" ("created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "request_log_professional_idx" ON "public"."request_log" USING "btree" ("professional_id", "created_at" DESC);



CREATE INDEX "request_log_type_status_idx" ON "public"."request_log" USING "btree" ("request_type", "status", "created_at" DESC);



CREATE OR REPLACE TRIGGER "doctor_locations_mirror_professional_clinics" AFTER INSERT OR DELETE OR UPDATE ON "public"."doctor_locations" FOR EACH ROW EXECUTE FUNCTION "public"."doctor_locations_mirror_to_professional_clinics"();



CREATE OR REPLACE TRIGGER "doctor_locations_sync_primary" AFTER INSERT OR UPDATE ON "public"."doctor_locations" FOR EACH ROW EXECUTE FUNCTION "public"."sync_primary_doctor_location"();



CREATE OR REPLACE TRIGGER "professional_clinics_sync_primary_settings" AFTER INSERT OR UPDATE ON "public"."professional_clinics" FOR EACH ROW EXECUTE FUNCTION "public"."professional_clinics_sync_primary_settings"();



CREATE OR REPLACE TRIGGER "professional_specialties_resolve_specialty" BEFORE INSERT OR UPDATE OF "specialty", "specialty_id", "is_approved" ON "public"."professional_specialties" FOR EACH ROW EXECUTE FUNCTION "public"."professional_specialties_resolve_specialty"();



CREATE OR REPLACE TRIGGER "professionals_create_primary_location" AFTER INSERT ON "public"."professionals" FOR EACH ROW WHEN (("new"."is_registered" = true)) EXECUTE FUNCTION "public"."create_primary_doctor_location"();



CREATE OR REPLACE TRIGGER "professionals_create_primary_location_on_claim" AFTER UPDATE OF "is_registered" ON "public"."professionals" FOR EACH ROW WHEN ((("old"."is_registered" IS DISTINCT FROM "new"."is_registered") AND ("new"."is_registered" = true))) EXECUTE FUNCTION "public"."create_primary_doctor_location"();



CREATE OR REPLACE TRIGGER "professionals_default_pro_access_until" BEFORE INSERT ON "public"."professionals" FOR EACH ROW EXECUTE FUNCTION "public"."professionals_default_pro_access_until"();



CREATE OR REPLACE TRIGGER "professionals_prevent_unregister" BEFORE UPDATE OF "is_registered" ON "public"."professionals" FOR EACH ROW EXECUTE FUNCTION "public"."professionals_prevent_unregister"();



CREATE OR REPLACE TRIGGER "request_log_guard" BEFORE INSERT OR DELETE OR UPDATE ON "public"."request_log" FOR EACH ROW EXECUTE FUNCTION "public"."request_guard"();



CREATE OR REPLACE TRIGGER "request_log_guard_truncate" BEFORE TRUNCATE ON "public"."request_log" FOR EACH STATEMENT EXECUTE FUNCTION "public"."request_guard"();



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."admin_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."professionals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."professional_clinics"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."professional_call_to_book_clicks"
    ADD CONSTRAINT "directory_manual_call_to_book_clicks_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."professional_call_to_book_clicks"
    ADD CONSTRAINT "directory_manual_call_to_book_clicks_manual_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."professional_clinics"
    ADD CONSTRAINT "directory_manual_clinics_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."professional_clinics"
    ADD CONSTRAINT "directory_manual_clinics_directory_manual_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."directory_manual_outreach_sent"
    ADD CONSTRAINT "directory_manual_outreach_sent_manual_id_fkey" FOREIGN KEY ("manual_id") REFERENCES "public"."professionals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."directory_manual_outreach_unsubscribed"
    ADD CONSTRAINT "directory_manual_outreach_unsubscribed_manual_id_fkey" FOREIGN KEY ("manual_id") REFERENCES "public"."professionals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."professional_patient_booking_requests"
    ADD CONSTRAINT "directory_manual_patient_booking_requests_manual_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doctor_locations"
    ADD CONSTRAINT "doctor_locations_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."professionals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."doctor_services"
    ADD CONSTRAINT "doctor_services_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."professionals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."professional_monthly_digest_sent"
    ADD CONSTRAINT "professional_monthly_digest_sent_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."professional_patient_booking_requests"
    ADD CONSTRAINT "professional_patient_booking_requests_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."professional_settings"
    ADD CONSTRAINT "professional_settings_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."professional_slug_redirects"
    ADD CONSTRAINT "professional_slug_redirects_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."professional_specialties"
    ADD CONSTRAINT "professional_specialties_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."professional_specialties"
    ADD CONSTRAINT "professional_specialties_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "public"."specialties"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."professional_specialty_change_requests"
    ADD CONSTRAINT "professional_specialty_change_requests_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."professionals"
    ADD CONSTRAINT "professionals_claim_listing_id_fkey" FOREIGN KEY ("claim_listing_id") REFERENCES "public"."professionals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."professionals"
    ADD CONSTRAINT "professionals_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."request_drafts"
    ADD CONSTRAINT "request_drafts_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."request_drafts"
    ADD CONSTRAINT "request_drafts_request_type_fkey" FOREIGN KEY ("request_type") REFERENCES "public"."request_types"("name") ON UPDATE RESTRICT ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."request_log"
    ADD CONSTRAINT "request_log_applicant_auth_user_id_fkey" FOREIGN KEY ("applicant_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."request_log"
    ADD CONSTRAINT "request_log_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "public"."admin_users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."request_log"
    ADD CONSTRAINT "request_log_professional_id_fkey" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."request_log"
    ADD CONSTRAINT "request_log_request_type_fkey" FOREIGN KEY ("request_type") REFERENCES "public"."request_types"("name") ON UPDATE RESTRICT ON DELETE RESTRICT;



ALTER TABLE "public"."admin_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "appointments_delete_doctor" ON "public"."appointments" FOR DELETE TO "authenticated" USING ("public"."is_doctor_owner"("doctor_id"));



CREATE POLICY "appointments_insert_public_booking" ON "public"."appointments" FOR INSERT TO "authenticated", "anon" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."professionals" "p"
  WHERE (("p"."id" = "appointments"."doctor_id") AND ("p"."is_registered" = true) AND ("p"."status" = 'verified'::"text")))));



CREATE POLICY "appointments_select_doctor" ON "public"."appointments" FOR SELECT TO "authenticated" USING ("public"."is_doctor_owner"("doctor_id"));



CREATE POLICY "appointments_update_doctor" ON "public"."appointments" FOR UPDATE TO "authenticated" USING ("public"."is_doctor_owner"("doctor_id")) WITH CHECK ("public"."is_doctor_owner"("doctor_id"));



ALTER TABLE "public"."clinics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."directory_manual_outreach_sent" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."directory_manual_outreach_unsubscribed" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."doctor_locations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "doctor_locations_delete_owner" ON "public"."doctor_locations" FOR DELETE TO "authenticated" USING (("public"."is_doctor_owner"("doctor_id") AND ("is_primary" = false)));



CREATE POLICY "doctor_locations_insert_owner" ON "public"."doctor_locations" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_doctor_owner"("doctor_id"));



CREATE POLICY "doctor_locations_select_public" ON "public"."doctor_locations" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "doctor_locations_update_owner" ON "public"."doctor_locations" FOR UPDATE TO "authenticated" USING ("public"."is_doctor_owner"("doctor_id")) WITH CHECK ("public"."is_doctor_owner"("doctor_id"));



ALTER TABLE "public"."doctor_services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "doctor_services_owner_delete" ON "public"."doctor_services" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."professionals" "p"
  WHERE (("p"."id" = "doctor_services"."doctor_id") AND ("p"."is_registered" = true) AND ("p"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "doctor_services_owner_insert" ON "public"."doctor_services" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."professionals" "p"
  WHERE (("p"."id" = "doctor_services"."doctor_id") AND ("p"."is_registered" = true) AND ("p"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "doctor_services_owner_update" ON "public"."doctor_services" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."professionals" "p"
  WHERE (("p"."id" = "doctor_services"."doctor_id") AND ("p"."is_registered" = true) AND ("p"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."professionals" "p"
  WHERE (("p"."id" = "doctor_services"."doctor_id") AND ("p"."is_registered" = true) AND ("p"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "doctor_services_public_read" ON "public"."doctor_services" FOR SELECT USING (true);



ALTER TABLE "public"."missing_professional_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."professional_call_to_book_clicks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."professional_clinics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."professional_monthly_digest_sent" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."professional_patient_booking_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."professional_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "professional_settings_delete_owner" ON "public"."professional_settings" FOR DELETE TO "authenticated" USING ("public"."is_doctor_owner"("professional_id"));



CREATE POLICY "professional_settings_insert_owner" ON "public"."professional_settings" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_doctor_owner"("professional_id"));



CREATE POLICY "professional_settings_select_public" ON "public"."professional_settings" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "professional_settings_update_owner" ON "public"."professional_settings" FOR UPDATE TO "authenticated" USING ("public"."is_doctor_owner"("professional_id")) WITH CHECK ("public"."is_doctor_owner"("professional_id"));



ALTER TABLE "public"."professional_slug_redirects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."professional_specialties" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "professional_specialties_select_own" ON "public"."professional_specialties" FOR SELECT USING (("professional_id" IN ( SELECT "p"."id"
   FROM "public"."professionals" "p"
  WHERE (("p"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."is_registered" = true)))));



ALTER TABLE "public"."professional_specialty_change_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "professional_specialty_change_requests_select_own" ON "public"."professional_specialty_change_requests" FOR SELECT USING (("professional_id" IN ( SELECT "p"."id"
   FROM "public"."professionals" "p"
  WHERE (("p"."auth_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."is_registered" = true)))));



ALTER TABLE "public"."professionals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "professionals_select_own" ON "public"."professionals" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "auth_user_id"));



CREATE POLICY "professionals_update_own" ON "public"."professionals" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "auth_user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "auth_user_id"));



ALTER TABLE "public"."request_drafts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."request_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."request_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."specialties" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."absorb_unregistered_into_registered"("p_registered_id" "uuid", "p_unregistered_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."absorb_unregistered_into_registered"("p_registered_id" "uuid", "p_unregistered_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_clinic_for_professional_location"("p_location_id" "uuid", "p_district" "public"."cyprus_district") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_clinic_for_professional_location"("p_location_id" "uuid", "p_district" "public"."cyprus_district") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_primary_doctor_location"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_primary_doctor_location"() TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_test_data"("doctor_slug_param" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_test_data"("doctor_slug_param" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_test_data"("doctor_slug_param" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."doctor_locations_mirror_to_professional_clinics"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."doctor_locations_mirror_to_professional_clinics"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."founder_active_doctor_count"("p_since" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."founder_active_doctor_count"("p_since" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."founder_appointments_by_month"("p_since" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."founder_appointments_by_month"("p_since" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."founder_call_to_book_stats"("p_since" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."founder_call_to_book_stats"("p_since" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."founder_manual_vote_stats"("p_since" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."founder_manual_vote_stats"("p_since" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."founders_club_places_taken"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."founders_club_places_taken"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_doctor_owner"("p_doctor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_doctor_owner"("p_doctor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_doctor_owner"("p_doctor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_qa_claim_directory_listing"("p_name" "text", "p_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_qa_claim_directory_listing"("p_name" "text", "p_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_qa_claim_directory_listing"("p_name" "text", "p_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_test_doctor_registration_email"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_test_doctor_registration_email"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_test_doctor_registration_email"("p_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."mirror_location_to_professional_clinic"("p_location_id" "uuid", "p_copy_settings" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mirror_location_to_professional_clinic"("p_location_id" "uuid", "p_copy_settings" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_professional_person_name"("value" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_professional_person_name"("value" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_professional_person_name"("value" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."professional_clinics_sync_primary_settings"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."professional_clinics_sync_primary_settings"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."professional_specialties_resolve_specialty"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."professional_specialties_resolve_specialty"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."professionals_default_pro_access_until"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."professionals_default_pro_access_until"() TO "service_role";



GRANT ALL ON FUNCTION "public"."professionals_prevent_unregister"() TO "anon";
GRANT ALL ON FUNCTION "public"."professionals_prevent_unregister"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."professionals_prevent_unregister"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."public_doctor_occupied_datetimes"("p_doctor_id" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_location_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."public_doctor_occupied_datetimes"("p_doctor_id" "uuid", "p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_location_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."public_professionals_occupied_datetimes"("p_professional_ids" "uuid"[], "p_from" timestamp with time zone, "p_to" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."public_professionals_occupied_datetimes"("p_professional_ids" "uuid"[], "p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."register_professional_with_founder_lock"("p_auth_user_id" "uuid", "p_name" "text", "p_email" "text", "p_phone" "text", "p_languages" "text"[], "p_license_file_url" "text", "p_slug" "text", "p_specialties" "jsonb", "p_claim_listing_id" "uuid", "p_directory_claim_source" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."register_professional_with_founder_lock"("p_auth_user_id" "uuid", "p_name" "text", "p_email" "text", "p_phone" "text", "p_languages" "text"[], "p_license_file_url" "text", "p_slug" "text", "p_specialties" "jsonb", "p_claim_listing_id" "uuid", "p_directory_claim_source" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."request_approve"("p_request_id" "uuid", "p_admin_id" "uuid", "p_corrected_details" "jsonb", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_approve"("p_request_id" "uuid", "p_admin_id" "uuid", "p_corrected_details" "jsonb", "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."request_assert_founder"("p_admin_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_assert_founder"("p_admin_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."request_draft_confirm"("p_auth_user_id" "uuid", "p_request_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_draft_confirm"("p_auth_user_id" "uuid", "p_request_type" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."request_draft_submit"("p_request_type" "text", "p_auth_user_id" "uuid", "p_details" "jsonb", "p_details_version" smallint, "p_requester_name" "text", "p_requester_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_draft_submit"("p_request_type" "text", "p_auth_user_id" "uuid", "p_details" "jsonb", "p_details_version" smallint, "p_requester_name" "text", "p_requester_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."request_drafts_expired"("p_older_than" interval) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_drafts_expired"("p_older_than" interval) TO "service_role";



REVOKE ALL ON FUNCTION "public"."request_guard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."request_reject"("p_request_id" "uuid", "p_admin_id" "uuid", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_reject"("p_request_id" "uuid", "p_admin_id" "uuid", "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."request_submit"("p_request_type" "text", "p_professional_id" "uuid", "p_details" "jsonb", "p_details_version" smallint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_submit"("p_request_type" "text", "p_professional_id" "uuid", "p_details" "jsonb", "p_details_version" smallint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."request_withdraw"("p_request_id" "uuid", "p_professional_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_withdraw"("p_request_id" "uuid", "p_professional_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."specialty_slug"("p_label" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."specialty_slug"("p_label" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_primary_doctor_location"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_primary_doctor_location"() TO "service_role";


















GRANT ALL ON TABLE "public"."admin_users" TO "service_role";



GRANT ALL ON TABLE "public"."app_settings" TO "service_role";



GRANT ALL ON TABLE "public"."appointments" TO "anon";
GRANT ALL ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";



GRANT ALL ON TABLE "public"."clinics" TO "anon";
GRANT ALL ON TABLE "public"."clinics" TO "authenticated";
GRANT ALL ON TABLE "public"."clinics" TO "service_role";



GRANT ALL ON TABLE "public"."directory_manual_outreach_sent" TO "service_role";



GRANT ALL ON TABLE "public"."directory_manual_outreach_unsubscribed" TO "service_role";



GRANT ALL ON TABLE "public"."doctor_locations" TO "anon";
GRANT ALL ON TABLE "public"."doctor_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."doctor_locations" TO "service_role";



GRANT ALL ON TABLE "public"."doctor_services" TO "anon";
GRANT ALL ON TABLE "public"."doctor_services" TO "authenticated";
GRANT ALL ON TABLE "public"."doctor_services" TO "service_role";



GRANT ALL ON TABLE "public"."missing_professional_requests" TO "anon";
GRANT ALL ON TABLE "public"."missing_professional_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."missing_professional_requests" TO "service_role";



GRANT ALL ON TABLE "public"."professional_call_to_book_clicks" TO "service_role";



GRANT ALL ON TABLE "public"."professional_clinics" TO "anon";
GRANT ALL ON TABLE "public"."professional_clinics" TO "authenticated";
GRANT ALL ON TABLE "public"."professional_clinics" TO "service_role";



GRANT ALL ON TABLE "public"."professional_monthly_digest_sent" TO "anon";
GRANT ALL ON TABLE "public"."professional_monthly_digest_sent" TO "authenticated";
GRANT ALL ON TABLE "public"."professional_monthly_digest_sent" TO "service_role";



GRANT ALL ON TABLE "public"."professional_patient_booking_requests" TO "anon";
GRANT ALL ON TABLE "public"."professional_patient_booking_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."professional_patient_booking_requests" TO "service_role";



GRANT ALL ON TABLE "public"."professional_settings" TO "anon";
GRANT ALL ON TABLE "public"."professional_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."professional_settings" TO "service_role";



GRANT ALL ON TABLE "public"."professional_slug_redirects" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."professional_specialties" TO "anon";
GRANT SELECT,MAINTAIN ON TABLE "public"."professional_specialties" TO "authenticated";
GRANT ALL ON TABLE "public"."professional_specialties" TO "service_role";



GRANT ALL ON TABLE "public"."professional_specialty_change_requests" TO "anon";
GRANT ALL ON TABLE "public"."professional_specialty_change_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."professional_specialty_change_requests" TO "service_role";



GRANT ALL ON TABLE "public"."professionals" TO "authenticated";
GRANT ALL ON TABLE "public"."professionals" TO "service_role";



GRANT SELECT,INSERT,DELETE ON TABLE "public"."request_drafts" TO "service_role";



GRANT SELECT,INSERT,UPDATE ON TABLE "public"."request_log" TO "service_role";



GRANT SELECT ON TABLE "public"."request_types" TO "service_role";



GRANT ALL ON TABLE "public"."specialties" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" REVOKE ALL ON FUNCTIONS FROM PUBLIC;





























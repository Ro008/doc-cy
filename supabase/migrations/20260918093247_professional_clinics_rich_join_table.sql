-- Stage 1 of unifying the location model.
--
-- Registered doctors keep practice locations in doctor_locations; scraped directory
-- listings use professional_clinics -> clinics. Two systems for one concept, which is
-- why finder search still filters location in JavaScript instead of SQL.
--
-- doctor_locations is already a (doctor, location) row with the clinic denormalized
-- into it, so this migration teaches professional_clinics to hold everything
-- doctor_locations holds, then backfills a clinic + join row for each existing
-- doctor_locations row.
--
-- Deliberately additive. doctor_locations keeps its data, appointments keeps its
-- foreign key, and no read path changes, so this ships safely on its own. Moving
-- reads, re-pointing appointments.location_id and dropping doctor_locations happen
-- in the cutover migration.
--
-- Join-row ids are copied from doctor_locations.id. The public ?location=<uuid>
-- parameter is bookmarkable and indexable, and its parser silently falls back to the
-- primary location rather than erroring, so a changed id would quietly show patients
-- the wrong clinic. Preserving the ids avoids that entirely.

-- ---------------------------------------------------------------------------
-- 1) Data fixups on the source rows, so the backfill below can stay rule-driven.
-- ---------------------------------------------------------------------------

-- Addresses captured through Google autocomplete under a non-English locale kept that
-- locale's name for the country ("Zypern", "Chipre"). Normalise before they become the
-- address on a shared clinic row.
UPDATE public.doctor_locations
SET clinic_address = regexp_replace(clinic_address, '(Zypern|Chipre|Chypre|Cipro)\s*$', 'Cyprus')
WHERE clinic_address ~ '(Zypern|Chipre|Chypre|Cipro)\s*$';

-- ---------------------------------------------------------------------------
-- 2) professional_clinics gains a surrogate primary key.
-- ---------------------------------------------------------------------------
-- Nothing references the composite key, so it demotes to UNIQUE (which keeps the
-- import script's ON CONFLICT (professional_id, clinic_id) working) and a stable
-- per-row id takes over as the primary key.

ALTER TABLE public.professional_clinics
  ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE public.professional_clinics
  DROP CONSTRAINT IF EXISTS directory_manual_clinics_pkey;

ALTER TABLE public.professional_clinics
  DROP CONSTRAINT IF EXISTS professional_clinics_pkey;

ALTER TABLE public.professional_clinics
  ADD CONSTRAINT professional_clinics_pkey PRIMARY KEY (id);

ALTER TABLE public.professional_clinics
  DROP CONSTRAINT IF EXISTS professional_clinics_professional_id_clinic_id_key;

ALTER TABLE public.professional_clinics
  ADD CONSTRAINT professional_clinics_professional_id_clinic_id_key
  UNIQUE (professional_id, clinic_id);

-- ---------------------------------------------------------------------------
-- 3) professional_clinics gains the per-(doctor, clinic) columns.
-- ---------------------------------------------------------------------------
-- The schedule columns are nullable on purpose: a scraped listing has no schedule,
-- and NULL says that honestly rather than inventing 09:00-17:00 for 9,000+ rows.
-- pause_online_bookings is NOT NULL DEFAULT true to match doctor_locations after
-- migration 20260916150000 - bookings stay off until somebody deliberately enables
-- them, and a scraped listing can never take one.

ALTER TABLE public.professional_clinics
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS pause_online_bookings boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS monday boolean,
  ADD COLUMN IF NOT EXISTS tuesday boolean,
  ADD COLUMN IF NOT EXISTS wednesday boolean,
  ADD COLUMN IF NOT EXISTS thursday boolean,
  ADD COLUMN IF NOT EXISTS friday boolean,
  ADD COLUMN IF NOT EXISTS saturday boolean,
  ADD COLUMN IF NOT EXISTS sunday boolean,
  ADD COLUMN IF NOT EXISTS start_time time without time zone,
  ADD COLUMN IF NOT EXISTS end_time time without time zone,
  ADD COLUMN IF NOT EXISTS weekly_schedule jsonb,
  ADD COLUMN IF NOT EXISTS break_start time without time zone,
  ADD COLUMN IF NOT EXISTS break_end time without time zone,
  ADD COLUMN IF NOT EXISTS slot_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.professional_clinics.pause_online_bookings IS
  'Per-clinic booking switch. Gated above by professionals.has_online_booking (entitlement) and professionals.is_registered.';
COMMENT ON COLUMN public.professional_clinics.weekly_schedule IS
  'This clinic''s own schedule. NULL means never configured. Account-level policy (holidays, booking horizon, minimum notice) stays on doctor_settings.';

-- clinics has address_maps_link and ghs_code; doctor_locations has a Google place id
-- with no counterpart. Carry it across so nothing is lost at cutover.
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS clinic_place_id text;

-- ---------------------------------------------------------------------------
-- 4) Backfill: one clinic + one join row per doctor_locations row.
-- ---------------------------------------------------------------------------
-- Rule driven rather than keyed on specific ids, because Testing and Production hold
-- different rows. Every location becomes a NEW clinic: ghs_code is the authoritative
-- clinic identifier and only GeSY-sourced rows have one, so there is nothing to match
-- these against. Clinics created here leave ghs_code null.
--
-- The clinic is named after the professional, which is normal for this data - GeSY
-- registers many practices under the practitioner's own name. A doctor with more than
-- one location gets a numeric suffix, because clinics.slug is UNIQUE.

DO $$
DECLARE
  rec record;
  v_name text;
  v_base text;
  v_slug text;
  v_n integer;
  v_clinic_id uuid;
BEGIN
  FOR rec IN
    SELECT dl.*,
           p.name AS doctor_name,
           row_number() OVER (
             PARTITION BY dl.doctor_id
             ORDER BY dl.is_primary DESC, dl.sort_order, dl.created_at, dl.id
           ) AS idx,
           count(*) OVER (PARTITION BY dl.doctor_id) AS total
    FROM public.doctor_locations dl
    JOIN public.professionals p ON p.id = dl.doctor_id
    WHERE dl.clinic_address IS NOT NULL
      AND dl.district IS NOT NULL
    ORDER BY dl.doctor_id, dl.is_primary DESC, dl.sort_order
  LOOP
    -- Already migrated (re-run, or the cutover partially applied).
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.professional_clinics pc WHERE pc.id = rec.id
    );

    v_name := rec.doctor_name ||
      CASE WHEN rec.total > 1 THEN ' ' || rec.idx::text ELSE '' END;

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

    -- clinics.slug is UNIQUE across 4,000+ existing rows, so a doctor sharing a name
    -- with an existing practice must not collide.
    v_slug := v_base;
    v_n := 1;
    WHILE EXISTS (SELECT 1 FROM public.clinics c WHERE c.slug = v_slug) LOOP
      v_n := v_n + 1;
      v_slug := v_base || '-' || v_n::text;
    END LOOP;

    INSERT INTO public.clinics (
      name, slug, district, address, town, latitude, longitude, clinic_place_id
    )
    VALUES (
      v_name,
      v_slug,
      rec.district::public.cyprus_district,
      rec.clinic_address,
      rec.town,
      rec.latitude,
      rec.longitude,
      rec.clinic_place_id
    )
    RETURNING id INTO v_clinic_id;

    INSERT INTO public.professional_clinics (
      id, professional_id, clinic_id, is_primary, sort_order, label,
      pause_online_bookings,
      monday, tuesday, wednesday, thursday, friday, saturday, sunday,
      start_time, end_time, weekly_schedule, break_start, break_end,
      slot_duration_minutes, created_at, updated_at
    )
    VALUES (
      rec.id, rec.doctor_id, v_clinic_id, rec.is_primary, rec.sort_order, rec.label,
      rec.pause_online_bookings,
      rec.monday, rec.tuesday, rec.wednesday, rec.thursday, rec.friday,
      rec.saturday, rec.sunday,
      rec.start_time, rec.end_time, rec.weekly_schedule, rec.break_start, rec.break_end,
      rec.slot_duration_minutes, rec.created_at, rec.updated_at
    );
  END LOOP;
END;
$$;

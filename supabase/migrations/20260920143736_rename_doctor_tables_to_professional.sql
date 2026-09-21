-- Point B: rename the remaining doctor_* tables to professional_*.
--
--   doctor_settings                  -> professional_settings
--   doctor_specialty_change_requests -> professional_specialty_change_requests
--   doctor_monthly_digest_sent       -> professional_monthly_digest_sent
--   finder_doctor_invitation_requests-> missing_professional_requests
--
-- and the owning FK column doctor_id -> professional_id on the three tables that
-- have one. Other tables keep doctor_id until their own rename:
--   appointments, doctor_services, doctor_locations (dropped in Point D),
--   doctor_specialties (restructured in Point C).
--
-- Deploy-order note: Vercel ships code at merge, migrations land separately, so
-- each renamed table keeps a compatibility view under its OLD name for one
-- release. The views are security_invoker, so RLS on the base table still
-- applies to anon/authenticated exactly as before -- verified by probing as anon
-- against both names. They are auto-updatable, and INSERT ... ON CONFLICT works
-- through them too (the conflict target resolves to the base table's unique
-- index), so the previous code's settings upsert keeps working. Drop the views
-- in the follow-up PR, once every deployment reads the new name.
--
-- Idempotent: every step is guarded, and the primary guard is "new name does not
-- exist yet as a table", so a re-run after the compat views exist is a no-op.

-- ---------------------------------------------------------------------------
-- 1. Rename the tables.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select *
    from (values
      ('doctor_settings',                   'professional_settings'),
      ('doctor_specialty_change_requests',  'professional_specialty_change_requests'),
      ('doctor_monthly_digest_sent',        'professional_monthly_digest_sent'),
      ('finder_doctor_invitation_requests', 'missing_professional_requests')
    ) as t(old_name, new_name)
  loop
    -- Only rename a real table, and only when the target name is still free.
    if to_regclass('public.' || r.old_name) is not null
       and to_regclass('public.' || r.new_name) is null
       and exists (
         select 1 from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = r.old_name and c.relkind = 'r'
       )
    then
      execute format('alter table public.%I rename to %I', r.old_name, r.new_name);
      raise notice 'renamed table %  ->  %', r.old_name, r.new_name;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Rename the owning FK column doctor_id -> professional_id.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select *
    from (values
      ('professional_settings'),
      ('professional_specialty_change_requests'),
      ('professional_monthly_digest_sent')
    ) as t(tbl)
  loop
    if exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = r.tbl and column_name = 'doctor_id'
       )
       and not exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = r.tbl and column_name = 'professional_id'
       )
    then
      execute format('alter table public.%I rename column doctor_id to professional_id', r.tbl);
      raise notice 'renamed %.doctor_id -> professional_id', r.tbl;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Rename constraints, indexes and policies so the names match the tables.
--    Purely cosmetic, but it keeps future migrations readable.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  -- Constraints (renaming a PK/UNIQUE constraint renames its index too).
  for r in
    select *
    from (values
      ('professional_settings', 'doctor_settings_pkey',                            'professional_settings_pkey'),
      ('professional_settings', 'doctor_settings_doctor_id_fkey',                  'professional_settings_professional_id_fkey'),
      ('professional_settings', 'doctor_settings_doctor_id_key',                   'professional_settings_professional_id_key'),
      ('professional_settings', 'doctor_settings_booking_horizon_days_check',      'professional_settings_booking_horizon_days_check'),
      ('professional_settings', 'doctor_settings_minimum_notice_hours_check',      'professional_settings_minimum_notice_hours_check'),
      ('professional_settings', 'doctor_settings_public_phone_source_check',       'professional_settings_public_phone_source_check'),
      ('professional_settings', 'doctor_settings_slot_duration_minutes_check',     'professional_settings_slot_duration_minutes_check'),

      ('professional_specialty_change_requests', 'doctor_specialty_change_requests_pkey',                'professional_specialty_change_requests_pkey'),
      ('professional_specialty_change_requests', 'doctor_specialty_change_requests_doctor_id_fkey',      'professional_specialty_change_requests_professional_id_fkey'),
      ('professional_specialty_change_requests', 'doctor_specialty_change_requests_request_kind_check',  'professional_specialty_change_requests_request_kind_check'),
      ('professional_specialty_change_requests', 'doctor_specialty_change_requests_status_check',        'professional_specialty_change_requests_status_check'),

      ('professional_monthly_digest_sent', 'doctor_monthly_digest_sent_pkey',                  'professional_monthly_digest_sent_pkey'),
      ('professional_monthly_digest_sent', 'doctor_monthly_digest_sent_doctor_id_fkey',        'professional_monthly_digest_sent_professional_id_fkey'),
      ('professional_monthly_digest_sent', 'doctor_monthly_digest_sent_doctor_id_month_key_key','professional_monthly_digest_sent_professional_id_month_key_key'),
      ('professional_monthly_digest_sent', 'doctor_monthly_digest_sent_month_key_check',       'professional_monthly_digest_sent_month_key_check'),

      ('missing_professional_requests', 'finder_doctor_invitation_requests_pkey', 'missing_professional_requests_pkey')
    ) as t(tbl, old_name, new_name)
  loop
    if to_regclass('public.' || r.tbl) is not null
       and exists (
         select 1 from pg_constraint con
         join pg_class cl on cl.oid = con.conrelid
         join pg_namespace n on n.oid = cl.relnamespace
         where n.nspname = 'public' and cl.relname = r.tbl and con.conname = r.old_name
       )
       and not exists (
         select 1 from pg_constraint con
         join pg_class cl on cl.oid = con.conrelid
         join pg_namespace n on n.oid = cl.relnamespace
         where n.nspname = 'public' and cl.relname = r.tbl and con.conname = r.new_name
       )
    then
      execute format('alter table public.%I rename constraint %I to %I', r.tbl, r.old_name, r.new_name);
    end if;
  end loop;

  -- Standalone indexes (those not owned by a constraint).
  for r in
    select *
    from (values
      ('doctor_settings_doctor_id_idx',                                 'professional_settings_professional_id_idx'),
      ('doctor_specialty_change_requests_status_created_idx',           'professional_specialty_change_requests_status_created_idx'),
      ('doctor_specialty_change_requests_doctor_idx',                   'professional_specialty_change_requests_professional_idx'),
      -- kept under 63 chars so Postgres does not truncate the new name
      ('doctor_specialty_change_requests_one_pending_per_doctor',       'professional_specialty_change_requests_one_pending'),
      ('doctor_monthly_digest_sent_month_key_idx',                      'professional_monthly_digest_sent_month_key_idx'),
      ('finder_doctor_invitation_requests_created_idx',                 'missing_professional_requests_created_idx'),
      ('finder_doctor_invitation_requests_name_context_idx',            'missing_professional_requests_name_context_idx')
    ) as t(old_name, new_name)
  loop
    if to_regclass('public.' || r.old_name) is not null
       and to_regclass('public.' || r.new_name) is null
    then
      execute format('alter index public.%I rename to %I', r.old_name, r.new_name);
    end if;
  end loop;

  -- RLS policies.
  for r in
    select *
    from (values
      ('professional_settings', 'doctor_settings_select_public', 'professional_settings_select_public'),
      ('professional_settings', 'doctor_settings_insert_owner',  'professional_settings_insert_owner'),
      ('professional_settings', 'doctor_settings_update_owner',  'professional_settings_update_owner'),
      ('professional_settings', 'doctor_settings_delete_owner',  'professional_settings_delete_owner'),
      ('professional_specialty_change_requests', 'doctor_specialty_change_requests_select_own', 'professional_specialty_change_requests_select_own')
    ) as t(tbl, old_name, new_name)
  loop
    if to_regclass('public.' || r.tbl) is not null
       and exists (
         select 1 from pg_policy p
         join pg_class cl on cl.oid = p.polrelid
         join pg_namespace n on n.oid = cl.relnamespace
         where n.nspname = 'public' and cl.relname = r.tbl and p.polname = r.old_name
       )
       and not exists (
         select 1 from pg_policy p
         join pg_class cl on cl.oid = p.polrelid
         join pg_namespace n on n.oid = cl.relnamespace
         where n.nspname = 'public' and cl.relname = r.tbl and p.polname = r.new_name
       )
    then
      execute format('alter policy %I on public.%I rename to %I', r.old_name, r.tbl, r.new_name);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Point the three functions that name these tables at the new identifiers.
--    Bodies are stored as text, so a rename does not reach inside them.
--    Note which doctor_id survives: appointments.doctor_id and
--    doctor_locations.doctor_id are NOT renamed here.
-- ---------------------------------------------------------------------------
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

create or replace function public.sync_primary_doctor_location()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  RETURN NEW;
END;
$function$;

create or replace function public.public_doctor_occupied_datetimes(
  p_doctor_id uuid,
  p_from timestamp with time zone,
  p_to timestamp with time zone,
  p_location_id uuid default null::uuid
)
returns table(appointment_datetime timestamp with time zone)
language sql
stable
security definer
set search_path to 'public'
as $function$
  SELECT DISTINCT sub.appointment_datetime
  FROM (
    SELECT (a.appointment_datetime + (gs.n::text || ' minutes')::interval) AS appointment_datetime
    FROM public.appointments a
    INNER JOIN public.professionals d ON d.id = a.doctor_id
    LEFT JOIN public.professional_settings ds ON ds.professional_id = a.doctor_id
    LEFT JOIN public.doctor_locations dl ON dl.id = a.location_id
    CROSS JOIN LATERAL (
      SELECT
        GREATEST(COALESCE(dl.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS step_m,
        GREATEST(COALESCE(a.duration_minutes, dl.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS dur_m,
        GREATEST(COALESCE(dl.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS book_m
    ) AS meta
    CROSS JOIN LATERAL generate_series(
      0,
      ((meta.dur_m - 1) / meta.step_m) * meta.step_m,
      meta.step_m
    ) AS gs(n)
    WHERE a.doctor_id = p_doctor_id
      AND (p_location_id IS NULL OR a.location_id = p_location_id)
      AND d.status = 'verified'
      AND a.status IN (
        'REQUESTED',
        'CONFIRMED'
      )
      AND (a.appointment_datetime + (gs.n::text || ' minutes')::interval) >= p_from
      AND (a.appointment_datetime + (gs.n::text || ' minutes')::interval) <= p_to

    UNION ALL

    SELECT (ps.elem::timestamptz + (gs.n::text || ' minutes')::interval) AS appointment_datetime
    FROM public.appointments a
    INNER JOIN public.professionals d ON d.id = a.doctor_id
    LEFT JOIN public.professional_settings ds ON ds.professional_id = a.doctor_id
    LEFT JOIN public.doctor_locations dl ON dl.id = a.location_id
    CROSS JOIN LATERAL jsonb_array_elements_text(
      COALESCE(a.proposed_slots, '[]'::jsonb)
    ) AS ps(elem)
    CROSS JOIN LATERAL (
      SELECT
        GREATEST(COALESCE(dl.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS step_m,
        GREATEST(COALESCE(a.duration_minutes, dl.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS dur_m,
        GREATEST(COALESCE(dl.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS book_m
    ) AS meta
    CROSS JOIN LATERAL generate_series(
      0,
      ((meta.dur_m - 1) / meta.step_m) * meta.step_m,
      meta.step_m
    ) AS gs(n)
    WHERE a.doctor_id = p_doctor_id
      AND (p_location_id IS NULL OR a.location_id = p_location_id)
      AND d.status = 'verified'
      AND a.status = 'NEEDS_RESCHEDULE'
      AND a.proposal_expires_at IS NOT NULL
      AND a.proposal_expires_at > now()
      AND jsonb_array_length(COALESCE(a.proposed_slots, '[]'::jsonb)) > 0
      AND (ps.elem::timestamptz + (gs.n::text || ' minutes')::interval) >= p_from
      AND (ps.elem::timestamptz + (gs.n::text || ' minutes')::interval) <= p_to

    UNION ALL

    SELECT (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) AS appointment_datetime
    FROM public.appointments a
    INNER JOIN public.professionals d ON d.id = a.doctor_id
    LEFT JOIN public.professional_settings ds ON ds.professional_id = a.doctor_id
    LEFT JOIN public.doctor_locations dl ON dl.id = a.location_id
    CROSS JOIN LATERAL (
      SELECT
        GREATEST(COALESCE(dl.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS step_m,
        GREATEST(COALESCE(a.duration_minutes, dl.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS dur_m,
        GREATEST(COALESCE(dl.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS book_m
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
    WHERE a.doctor_id = p_doctor_id
      AND (p_location_id IS NULL OR a.location_id = p_location_id)
      AND d.status = 'verified'
      AND a.status IN (
        'REQUESTED',
        'CONFIRMED'
      )
      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval)
          + (meta.book_m::text || ' minutes')::interval > iv.bs
      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) < iv.be
      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) >= p_from
      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) <= p_to

    UNION ALL

    SELECT (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) AS appointment_datetime
    FROM public.appointments a
    INNER JOIN public.professionals d ON d.id = a.doctor_id
    LEFT JOIN public.professional_settings ds ON ds.professional_id = a.doctor_id
    LEFT JOIN public.doctor_locations dl ON dl.id = a.location_id
    CROSS JOIN LATERAL jsonb_array_elements_text(
      COALESCE(a.proposed_slots, '[]'::jsonb)
    ) AS ps(elem)
    CROSS JOIN LATERAL (
      SELECT
        GREATEST(COALESCE(dl.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS step_m,
        GREATEST(COALESCE(a.duration_minutes, dl.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS dur_m,
        GREATEST(COALESCE(dl.slot_duration_minutes, ds.slot_duration_minutes, 30), 1) AS book_m
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
    WHERE a.doctor_id = p_doctor_id
      AND (p_location_id IS NULL OR a.location_id = p_location_id)
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

-- ---------------------------------------------------------------------------
-- 5. Compatibility views under the old names, for the release window only.
--    Built from the live column list so they cannot drift, and aliasing
--    professional_id back to doctor_id so the previous code sees the old shape.
--    security_invoker = true keeps the base table's RLS in force.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  cols text;
begin
  for r in
    select *
    from (values
      ('professional_settings',                  'doctor_settings',                   true),
      ('professional_specialty_change_requests', 'doctor_specialty_change_requests',  true),
      ('professional_monthly_digest_sent',       'doctor_monthly_digest_sent',        true),
      ('missing_professional_requests',          'finder_doctor_invitation_requests', false)
    ) as t(new_name, old_name, has_professional_id)
  loop
    continue when to_regclass('public.' || r.new_name) is null;

    select string_agg(
             case
               when r.has_professional_id and c.column_name = 'professional_id'
                 then format('%I as doctor_id', c.column_name)
               else format('%I', c.column_name)
             end,
             ', ' order by c.ordinal_position
           )
      into cols
      from information_schema.columns c
     where c.table_schema = 'public' and c.table_name = r.new_name;

    execute format(
      'create or replace view public.%I with (security_invoker = true) as select %s from public.%I',
      r.old_name, cols, r.new_name
    );

    execute format(
      'comment on view public.%I is %L',
      r.old_name,
      'Deploy-window compatibility shim for ' || r.new_name
        || '. security_invoker, so the base table RLS still applies. Drop once every'
        || ' deployment reads the new name.'
    );

    -- Mirror the base table's grants so the old code path keeps exactly the
    -- access it had; RLS still decides what each role can actually see.
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated, service_role', r.old_name);
  end loop;
end $$;

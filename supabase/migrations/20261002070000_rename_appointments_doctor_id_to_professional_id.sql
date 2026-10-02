-- Point E7b: appointments.doctor_id -> professional_id.
--
--   appointments.doctor_id                 -> professional_id
--   appointments_doctor_id_fkey            -> appointments_professional_id_fkey
--   appointments_doctor_datetime_idx (Production) / appointments_doctor_id_datetime_idx
--     (Testing)                            -> appointments_professional_datetime_idx
--   appointments_doctor_datetime_active_booking_null_location_key
--                                          -> appointments_professional_datetime_null_location_key
--   appointments_{select,update,delete}_doctor -> appointments_{...}_professional
--   (appointments_active_slot_unique and appointments_insert_public_booking keep their
--   names; index and policy expressions follow the column on their own.)
--
-- The owner rules on appointments and professional_settings move from is_doctor_owner
-- (SECURITY DEFINER, flagged by the advisor) to is_professional_owner (SECURITY INVOKER: the
-- caller reads their own professionals row through professionals_select_own). Function
-- bodies are stored as text, so the ones that read the column are rewritten here:
-- public_professionals_occupied_datetimes (generated from
-- 20261001171933_drop_professional_settings_schedule_copies with a.doctor_id ->
-- a.professional_id, nothing else) and the founders' count, which gets its professional
-- name (founder_active_professional_count).
--
-- Deploy order: NOT backward-compatible (the running code reads and writes doctor_id, and a
-- view can't alias a column of a table that is written). One timed release: apply to
-- Production as the PR merges, at a quiet hour (Production has 0 appointments). To keep the
-- window small, is_doctor_owner, public_doctor_occupied_datetimes (a wrapper over the batched
-- function) and founder_active_doctor_count stay callable here, now reading professional_id;
-- *_drop_doctor_named_appointment_functions drops them after the deploy.
--
-- Idempotent: every step is guarded; a re-run changes nothing.

-- 1. Column, FK, indexes.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'appointments' and column_name = 'doctor_id') then
    alter table public.appointments rename column doctor_id to professional_id;
  end if;

  if exists (select 1 from pg_constraint where conrelid = 'public.appointments'::regclass
             and conname = 'appointments_doctor_id_fkey') then
    alter table public.appointments rename constraint appointments_doctor_id_fkey to appointments_professional_id_fkey;
  end if;

  if to_regclass('public.appointments_professional_datetime_idx') is null then
    if to_regclass('public.appointments_doctor_datetime_idx') is not null then
      alter index public.appointments_doctor_datetime_idx rename to appointments_professional_datetime_idx;
    elsif to_regclass('public.appointments_doctor_id_datetime_idx') is not null then
      alter index public.appointments_doctor_id_datetime_idx rename to appointments_professional_datetime_idx;
    end if;
  end if;

  if to_regclass('public.appointments_doctor_datetime_active_booking_null_location_key') is not null then
    alter index public.appointments_doctor_datetime_active_booking_null_location_key
      rename to appointments_professional_datetime_null_location_key;
  end if;
end $$;

-- 2. The owner check, with the caller's rights.
create or replace function public.is_professional_owner(p_professional_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select exists (
    select 1
    from public.professionals p
    where p.id = p_professional_id
      and p.is_registered = true
      and p.auth_user_id is not null
      and p.auth_user_id = auth.uid()
  )
  and public.professional_session_email_step_verified();
$function$;

comment on function public.is_professional_owner(uuid) is
  'True when the signed-in caller owns this registered professional and signed in through the '
  'emailed step within 30 days. SECURITY INVOKER: reads the caller''s own professionals row. '
  'Used by the owner rules on appointments and professional_settings.';

revoke all on function public.is_professional_owner(uuid) from public, anon;
grant execute on function public.is_professional_owner(uuid) to authenticated, service_role;

-- 3. Policies.
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('appointments_select_doctor', 'appointments_select_professional'),
      ('appointments_update_doctor', 'appointments_update_professional'),
      ('appointments_delete_doctor', 'appointments_delete_professional')
    ) as t(old_name, new_name)
  loop
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'appointments'
               and policyname = r.old_name) then
      execute format('alter policy %I on public.appointments rename to %I', r.old_name, r.new_name);
    end if;
  end loop;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'appointments'
             and policyname = 'appointments_select_professional') then
    alter policy appointments_select_professional on public.appointments
      using (is_professional_owner(professional_id));
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'appointments'
             and policyname = 'appointments_update_professional') then
    alter policy appointments_update_professional on public.appointments
      using (is_professional_owner(professional_id))
      with check (is_professional_owner(professional_id));
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'appointments'
             and policyname = 'appointments_delete_professional') then
    alter policy appointments_delete_professional on public.appointments
      using (is_professional_owner(professional_id));
  end if;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'professional_settings'
             and policyname = 'professional_settings_insert_owner') then
    alter policy professional_settings_insert_owner on public.professional_settings
      with check (is_professional_owner(professional_id));
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'professional_settings'
             and policyname = 'professional_settings_update_owner') then
    alter policy professional_settings_update_owner on public.professional_settings
      using (is_professional_owner(professional_id))
      with check (is_professional_owner(professional_id));
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'professional_settings'
             and policyname = 'professional_settings_delete_owner') then
    alter policy professional_settings_delete_owner on public.professional_settings
      using (is_professional_owner(professional_id));
  end if;
end $$;

-- 4. Occupancy reads professional_id (CREATE OR REPLACE keeps the comment and grants).
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
    SELECT a.professional_id AS professional_id, a.location_id,
      (a.appointment_datetime + (gs.n::text || ' minutes')::interval) AS appointment_datetime
    FROM public.appointments a
    INNER JOIN public.professionals d ON d.id = a.professional_id
    LEFT JOIN LATERAL (
      SELECT pp.slot_duration_minutes FROM public.professional_clinics pp
      WHERE pp.professional_id = a.professional_id AND pp.is_primary
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
    WHERE a.professional_id = ANY(p_professional_ids)
      AND d.status = 'verified'
      AND a.status IN ('REQUESTED', 'CONFIRMED')
      AND (a.appointment_datetime + (gs.n::text || ' minutes')::interval) >= p_from
      AND (a.appointment_datetime + (gs.n::text || ' minutes')::interval) <= p_to

    UNION ALL

    -- Live counter-offers: every slot start each proposed time covers.
    SELECT a.professional_id, a.location_id,
      (ps.elem::timestamptz + (gs.n::text || ' minutes')::interval)
    FROM public.appointments a
    INNER JOIN public.professionals d ON d.id = a.professional_id
    LEFT JOIN LATERAL (
      SELECT pp.slot_duration_minutes FROM public.professional_clinics pp
      WHERE pp.professional_id = a.professional_id AND pp.is_primary
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
    WHERE a.professional_id = ANY(p_professional_ids)
      AND d.status = 'verified'
      AND a.status = 'NEEDS_RESCHEDULE'
      AND a.proposal_expires_at IS NOT NULL
      AND a.proposal_expires_at > now()
      AND jsonb_array_length(COALESCE(a.proposed_slots, '[]'::jsonb)) > 0
      AND (ps.elem::timestamptz + (gs.n::text || ' minutes')::interval) >= p_from
      AND (ps.elem::timestamptz + (gs.n::text || ' minutes')::interval) <= p_to

    UNION ALL

    -- Active visits: earlier slot starts whose booking would overlap the visit.
    SELECT a.professional_id, a.location_id,
      (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval)
    FROM public.appointments a
    INNER JOIN public.professionals d ON d.id = a.professional_id
    LEFT JOIN LATERAL (
      SELECT pp.slot_duration_minutes FROM public.professional_clinics pp
      WHERE pp.professional_id = a.professional_id AND pp.is_primary
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
    WHERE a.professional_id = ANY(p_professional_ids)
      AND d.status = 'verified'
      AND a.status IN ('REQUESTED', 'CONFIRMED')
      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval)
          + (meta.book_m::text || ' minutes')::interval > iv.bs
      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) < iv.be
      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) >= p_from
      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) <= p_to

    UNION ALL

    -- Live counter-offers: earlier slot starts whose booking would overlap them.
    SELECT a.professional_id, a.location_id,
      (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval)
    FROM public.appointments a
    INNER JOIN public.professionals d ON d.id = a.professional_id
    LEFT JOIN LATERAL (
      SELECT pp.slot_duration_minutes FROM public.professional_clinics pp
      WHERE pp.professional_id = a.professional_id AND pp.is_primary
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
    WHERE a.professional_id = ANY(p_professional_ids)
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

-- 5. The founders' count of professionals with recent appointments, under its professional
--    name; the old name stays for the previous deployment and now delegates.
create or replace function public.founder_active_professional_count(p_since timestamptz)
returns bigint
language sql
stable
set search_path = ''
as $function$
  select count(distinct a.professional_id)
  from public.appointments a
  where a.created_at >= p_since
$function$;

revoke all on function public.founder_active_professional_count(timestamptz) from public, anon, authenticated;
grant execute on function public.founder_active_professional_count(timestamptz) to service_role;

do $$
begin
  if to_regprocedure('public.founder_active_doctor_count(timestamptz)') is not null then
    create or replace function public.founder_active_doctor_count(p_since timestamptz)
    returns bigint
    language sql
    stable
    set search_path = ''
    as $function$
      select public.founder_active_professional_count(p_since)
    $function$;
  end if;
end $$;

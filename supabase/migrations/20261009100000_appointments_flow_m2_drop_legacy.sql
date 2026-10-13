-- Appointments flow, M2 (after #270 is live; build plan `.claude/build-plan-appointments.md`).
-- Removes what M1 left for compatibility. No deployed code reads or writes any of it
-- (checked 2026-10-09: app, lib, components, scripts; the occupancy RPC's clinic column was
-- never read), so this is backward-compatible and can go before or after its merge.
--
-- 1. Occupancy RPC: takes the slot length from the visit's clinic link through clinic_id
--    (it used location_id, which new bookings no longer set, so they fell back to the
--    primary clinic's slot) and no longer returns a clinic column. Generated from
--    20261002090000 (body md5 dd6bd952… = live on Testing and Production); only the
--    location_id lines differ. A different result type needs drop + create; nothing else
--    calls it, and the grants and comment are set again below.
-- 2. Drops appointments.location_id, visit_type, visit_notes, synced_to_calendar and
--    reschedule_access_token (their FK and indexes, including the per-clinic unique
--    indexes, go with them: one agenda per professional).
-- 3. Status: text with a check on every database. Production still had the enum
--    public.appointment_status (see 20261004100000); Testing and CI have text. Only the six
--    live values remain (PENDING, COMPLETED and REJECTED are gone; nothing stores them), and
--    the default goes (every route sets the status). The one-active-booking index is
--    recreated in text on both: REQUESTED and CONFIRMED rows, per professional and time.

-- 1. Occupancy RPC ----------------------------------------------------------------------

drop function if exists public.public_professionals_occupied_datetimes(uuid[], timestamptz, timestamptz);

create function public.public_professionals_occupied_datetimes(
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
      WHERE pp.professional_id = a.professional_id AND pp.is_primary
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
      WHERE pp.professional_id = a.professional_id AND pp.is_primary
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
      WHERE pp.professional_id = a.professional_id AND pp.is_primary
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
      WHERE pp.professional_id = a.professional_id AND pp.is_primary
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

revoke all on function public.public_professionals_occupied_datetimes(uuid[], timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.public_professionals_occupied_datetimes(uuid[], timestamptz, timestamptz)
  to service_role;

comment on function public.public_professionals_occupied_datetimes(uuid[], timestamptz, timestamptz) is
  'Slot starts taken for many professionals at once. Service role only. The single source of the occupancy rules; slot length from the visit''s clinic link (clinic_id), else the primary clinic, else 30 min. Must match lib/appointment-overlap.ts.';

-- 2. Legacy columns ---------------------------------------------------------------------

alter table public.appointments
  drop column if exists location_id,
  drop column if exists visit_type,
  drop column if exists visit_notes,
  drop column if exists synced_to_calendar,
  drop column if exists reschedule_access_token;

-- 3. Status -----------------------------------------------------------------------------

drop index if exists public.appointments_active_slot_unique;
alter table public.appointments alter column status drop default;

do $$
begin
  if exists (
    select 1 from pg_attribute
    where attrelid = 'public.appointments'::regclass
      and attname = 'status'
      and atttypid = to_regtype('public.appointment_status')
  ) then
    alter table public.appointments alter column status type text using status::text;
  end if;
  if to_regtype('public.appointment_status') is not null
     and not exists (
       select 1 from pg_attribute
       where atttypid = to_regtype('public.appointment_status') and not attisdropped
     ) then
    drop type public.appointment_status;
  end if;
end
$$;

alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments
  add constraint appointments_status_check
  check (status in ('REQUESTED', 'NEEDS_RESCHEDULE', 'CONFIRMED', 'DECLINED', 'CANCELLED', 'EXPIRED'));

create unique index if not exists appointments_active_slot_unique
  on public.appointments (professional_id, appointment_datetime)
  where status in ('REQUESTED', 'CONFIRMED');

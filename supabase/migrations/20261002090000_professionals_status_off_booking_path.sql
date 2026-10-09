-- Point E8, step 1 (backward-compatible): nothing in the database depends on
-- professionals.status any more, so the column can be dropped after the code stops
-- reading it (20261002090100).
--
-- Every registered professional is `verified` on Production (the approval writes it and
-- nothing else has set it since the old review routes went), so `is_registered` is the
-- same rule:
--   1. Occupancy (`public_professionals_occupied_datetimes`) filters on `d.is_registered`
--      instead of `d.status = 'verified'` (generated from 20261002070000; only those 4
--      lines differ).
--   2. The public booking insert rule checks `is_registered` only.
--   3. A registered row no longer needs a status (`professionals_registered_requires_status`
--      dropped), so professionals created without one are valid. The approval keeps
--      writing 'verified' until step 2, for the code that is still deployed.

-- 1. Occupancy (CREATE OR REPLACE keeps the comment and grants).
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
      AND d.is_registered
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
      AND d.is_registered
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
      AND d.is_registered
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

-- 2. Public booking insert rule.
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'appointments'
             and policyname = 'appointments_insert_public_booking') then
    alter policy appointments_insert_public_booking on public.appointments
      with check (
        exists (
          select 1
          from public.professionals p
          where p.id = appointments.professional_id
            and p.is_registered = true
        )
      );
  end if;
end $$;

-- 3. A registered professional no longer needs a status.
alter table public.professionals drop constraint if exists professionals_registered_requires_status;

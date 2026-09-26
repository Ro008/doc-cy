-- Batch version of public_doctor_occupied_datetimes.
--
-- The finder called public_doctor_occupied_datetimes once per registered card
-- and clinic: 27,722 calls and 32% of Testing's database time (2026-09-25),
-- although each call's query takes about 2 ms. The cost was the number of
-- calls. The finder now makes one call per page with every professional's id
-- and splits the rows by professional and clinic in code.
--
-- The occupancy rules live only here: public_doctor_occupied_datetimes becomes
-- a wrapper over this function (same signature, same results, same grants), so
-- the two can never drift. They must keep matching lib/appointment-overlap.ts.

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
$function$;

COMMENT ON FUNCTION public.public_professionals_occupied_datetimes(uuid[], timestamptz, timestamptz) IS
  'Slot starts taken for many professionals at once, with each row''s clinic (location_id). Service role only. The single source of the occupancy rules; public_doctor_occupied_datetimes wraps it. Must match lib/appointment-overlap.ts.';

REVOKE ALL ON FUNCTION public.public_professionals_occupied_datetimes(uuid[], timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_professionals_occupied_datetimes(uuid[], timestamptz, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.public_professionals_occupied_datetimes(uuid[], timestamptz, timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.public_professionals_occupied_datetimes(uuid[], timestamptz, timestamptz) TO service_role;

-- The per-professional function (the profile page) now reads through the batch
-- one. CREATE OR REPLACE keeps its signature, attributes and grants (service
-- role only since #200).
CREATE OR REPLACE FUNCTION public.public_doctor_occupied_datetimes(
  p_doctor_id uuid,
  p_from timestamp with time zone,
  p_to timestamp with time zone,
  p_location_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(appointment_datetime timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT DISTINCT o.appointment_datetime
  FROM public.public_professionals_occupied_datetimes(ARRAY[p_doctor_id], p_from, p_to) AS o
  WHERE p_location_id IS NULL OR o.location_id = p_location_id
$function$;

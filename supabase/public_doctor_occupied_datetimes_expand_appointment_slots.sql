-- Run in Supabase SQL editor (or migrate) after NEEDS_RESCHEDULE step2 is applied.

--

-- Bug fixes:

-- 1) REQUESTED/CONFIRMED: expand [start, start+duration) on the slot grid (not only start instant).

-- 2) NEEDS_RESCHEDULE: never treat appointment_datetime as occupied; only proposed_slots (2nd branch).

-- 3) "Backward" holds: slot starts T before a visit where [T, T+book_m) overlaps [visit_start, visit_end)

--    with book_m = doctor_settings.slot_duration_minutes (matches POST /api/appointments overlap).



CREATE OR REPLACE FUNCTION public.public_doctor_occupied_datetimes(

  p_doctor_id uuid,

  p_from timestamptz,

  p_to timestamptz

)

RETURNS TABLE (appointment_datetime timestamptz)

LANGUAGE sql

STABLE

SECURITY DEFINER

SET search_path = public

AS $$

  SELECT DISTINCT sub.appointment_datetime

  FROM (

    SELECT (a.appointment_datetime + (gs.n::text || ' minutes')::interval) AS appointment_datetime

    FROM public.appointments a

    INNER JOIN public.doctors d ON d.id = a.doctor_id

    LEFT JOIN public.doctor_settings ds ON ds.doctor_id = a.doctor_id

    CROSS JOIN LATERAL (

      SELECT

        GREATEST(COALESCE(ds.slot_duration_minutes, 30), 1) AS step_m,

        GREATEST(COALESCE(a.duration_minutes, ds.slot_duration_minutes, 30), 1) AS dur_m,

        GREATEST(COALESCE(ds.slot_duration_minutes, 30), 1) AS book_m

    ) AS meta

    CROSS JOIN LATERAL generate_series(

      0,

      ((meta.dur_m - 1) / meta.step_m) * meta.step_m,

      meta.step_m

    ) AS gs(n)

    WHERE a.doctor_id = p_doctor_id

      AND d.status = 'verified'

      AND a.status IN (

        'REQUESTED'::public.appointment_status,

        'CONFIRMED'::public.appointment_status

      )

      AND (a.appointment_datetime + (gs.n::text || ' minutes')::interval) >= p_from

      AND (a.appointment_datetime + (gs.n::text || ' minutes')::interval) <= p_to



    UNION ALL



    SELECT (ps.elem::timestamptz + (gs.n::text || ' minutes')::interval) AS appointment_datetime

    FROM public.appointments a

    INNER JOIN public.doctors d ON d.id = a.doctor_id

    LEFT JOIN public.doctor_settings ds ON ds.doctor_id = a.doctor_id

    CROSS JOIN LATERAL jsonb_array_elements_text(

      COALESCE(a.proposed_slots, '[]'::jsonb)

    ) AS ps(elem)

    CROSS JOIN LATERAL (

      SELECT

        GREATEST(COALESCE(ds.slot_duration_minutes, 30), 1) AS step_m,

        GREATEST(COALESCE(a.duration_minutes, ds.slot_duration_minutes, 30), 1) AS dur_m,

        GREATEST(COALESCE(ds.slot_duration_minutes, 30), 1) AS book_m

    ) AS meta

    CROSS JOIN LATERAL generate_series(

      0,

      ((meta.dur_m - 1) / meta.step_m) * meta.step_m,

      meta.step_m

    ) AS gs(n)

    WHERE a.doctor_id = p_doctor_id

      AND d.status = 'verified'

      AND a.status = 'NEEDS_RESCHEDULE'::public.appointment_status

      AND a.proposal_expires_at IS NOT NULL

      AND a.proposal_expires_at > now()

      AND jsonb_array_length(COALESCE(a.proposed_slots, '[]'::jsonb)) > 0

      AND (ps.elem::timestamptz + (gs.n::text || ' minutes')::interval) >= p_from

      AND (ps.elem::timestamptz + (gs.n::text || ' minutes')::interval) <= p_to



    UNION ALL



    SELECT (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) AS appointment_datetime

    FROM public.appointments a

    INNER JOIN public.doctors d ON d.id = a.doctor_id

    LEFT JOIN public.doctor_settings ds ON ds.doctor_id = a.doctor_id

    CROSS JOIN LATERAL (

      SELECT

        GREATEST(COALESCE(ds.slot_duration_minutes, 30), 1) AS step_m,

        GREATEST(COALESCE(a.duration_minutes, ds.slot_duration_minutes, 30), 1) AS dur_m,

        GREATEST(COALESCE(ds.slot_duration_minutes, 30), 1) AS book_m

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

      AND d.status = 'verified'

      AND a.status IN (

        'REQUESTED'::public.appointment_status,

        'CONFIRMED'::public.appointment_status

      )

      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval)

          + (meta.book_m::text || ' minutes')::interval > iv.bs

      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) < iv.be

      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) >= p_from

      AND (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) <= p_to



    UNION ALL



    SELECT (iv.be - ((bk.k * meta.step_m::int) || ' minutes')::interval) AS appointment_datetime

    FROM public.appointments a

    INNER JOIN public.doctors d ON d.id = a.doctor_id

    LEFT JOIN public.doctor_settings ds ON ds.doctor_id = a.doctor_id

    CROSS JOIN LATERAL jsonb_array_elements_text(

      COALESCE(a.proposed_slots, '[]'::jsonb)

    ) AS ps(elem)

    CROSS JOIN LATERAL (

      SELECT

        GREATEST(COALESCE(ds.slot_duration_minutes, 30), 1) AS step_m,

        GREATEST(COALESCE(a.duration_minutes, ds.slot_duration_minutes, 30), 1) AS dur_m,

        GREATEST(COALESCE(ds.slot_duration_minutes, 30), 1) AS book_m

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

      AND d.status = 'verified'

      AND a.status = 'NEEDS_RESCHEDULE'::public.appointment_status

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



REVOKE ALL ON FUNCTION public.public_doctor_occupied_datetimes(uuid, timestamptz, timestamptz) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.public_doctor_occupied_datetimes(uuid, timestamptz, timestamptz) TO anon, authenticated;


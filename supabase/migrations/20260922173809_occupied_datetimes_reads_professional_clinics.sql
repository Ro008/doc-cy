-- Point D2: the booking availability RPC reads professional_clinics.
--
-- public_doctor_occupied_datetimes only touches doctor_locations to pick up the
-- clinic's slot_duration_minutes for the appointment's location. D1 keeps the join row
-- an exact mirror with the same id, and appointments.location_id holds that id, so
-- swapping the join is behaviour-preserving today and removes the last read of
-- doctor_locations from the database.
--
-- Rewritten from the function's own definition rather than pasted, because Testing and
-- Production drift on whitespace and comments: only the join and the column reference
-- change, everything else stays byte-identical. The replacements are asserted, so this
-- fails loudly instead of silently leaving the old body in place.

DO $$
DECLARE
  v_def text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace
    AND p.proname = 'public_doctor_occupied_datetimes'
    AND pg_get_function_identity_arguments(p.oid) =
        'p_doctor_id uuid, p_from timestamp with time zone, p_to timestamp with time zone, p_location_id uuid';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'public_doctor_occupied_datetimes(uuid, timestamptz, timestamptz, uuid) not found';
  END IF;

  -- Already migrated (re-run).
  IF position('doctor_locations' IN v_def) = 0 THEN
    RETURN;
  END IF;

  v_new := replace(
    v_def,
    'LEFT JOIN public.doctor_locations dl ON dl.id = a.location_id',
    'LEFT JOIN public.professional_clinics pc ON pc.id = a.location_id'
  );
  v_new := replace(v_new, 'dl.slot_duration_minutes', 'pc.slot_duration_minutes');

  IF position('doctor_locations' IN v_new) > 0 OR position('dl.' IN v_new) > 0 THEN
    RAISE EXCEPTION 'unexpected doctor_locations reference left in public_doctor_occupied_datetimes';
  END IF;

  IF v_new = v_def THEN
    RAISE EXCEPTION 'public_doctor_occupied_datetimes was not rewritten';
  END IF;

  EXECUTE v_new;
END;
$$;

-- CREATE OR REPLACE keeps the grants, so the #200 revokes stay in force. Re-assert
-- them anyway, so a replay on a project that never had them lands in the same state.
REVOKE EXECUTE ON FUNCTION public.public_doctor_occupied_datetimes(uuid, timestamptz, timestamptz, uuid)
  FROM PUBLIC, anon, authenticated;

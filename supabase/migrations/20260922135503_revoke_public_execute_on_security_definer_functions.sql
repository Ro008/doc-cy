-- Security: stop exposing four SECURITY DEFINER functions through /rest/v1/rpc.
--
-- The security advisor flagged them as executable by anon and authenticated in both
-- projects. What each one actually needs:
--   * create_primary_doctor_location(), sync_primary_doctor_location(): trigger
--     functions. PostgreSQL checks EXECUTE when a trigger is created, not when it
--     fires, so nobody needs it at run time (proved on Testing: a signed-in doctor's
--     doctor_locations update still fires sync_primary_doctor_location after the
--     revoke). Both also carried a PUBLIC grant.
--   * public_doctor_occupied_datetimes(...): lets anyone list any professional's
--     booked times. Only server code calls it, through the service role (profile
--     page, finder availability).
--   * is_doctor_owner(uuid): used by RLS policies on appointments,
--     professional_settings and doctor_locations, all scoped to `authenticated`, so
--     `authenticated` keeps EXECUTE. Anon never evaluates those policies.
--
-- The service role keeps EXECUTE on all four (explicit grant, not via PUBLIC).
-- Idempotent; each function is skipped if it does not exist.

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.create_primary_doctor_location()',
    'public.sync_primary_doctor_location()',
    'public.public_doctor_occupied_datetimes(uuid, timestamptz, timestamptz, uuid)'
  ] loop
    if to_regprocedure(fn) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', fn);
      execute format('grant execute on function %s to service_role', fn);
    end if;
  end loop;

  if to_regprocedure('public.is_doctor_owner(uuid)') is not null then
    revoke execute on function public.is_doctor_owner(uuid) from public, anon;
    grant execute on function public.is_doctor_owner(uuid) to authenticated, service_role;
  end if;
end
$$;

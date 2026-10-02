-- Point E7b (part 2): drop the doctor-named functions that
-- *_rename_appointments_doctor_id_to_professional_id kept for the previous deployment.
--
--   is_doctor_owner(uuid)                        -> is_professional_owner(uuid)
--   public_doctor_occupied_datetimes(uuid, ...)  -> public_professionals_occupied_datetimes(uuid[], ...)
--   founder_active_doctor_count(timestamptz)     -> founder_active_professional_count(timestamptz)
--
-- Apply only after the code that calls the new names is live: nothing calls the old ones
-- after that. Dropping is_doctor_owner clears the advisor's "signed-in users can execute a
-- SECURITY DEFINER function" warning.
--
-- No CASCADE: a policy or function that still depends on one of them fails the drop loudly.
-- Idempotent: a second run finds nothing to drop.

drop function if exists public.is_doctor_owner(uuid);
drop function if exists public.public_doctor_occupied_datetimes(uuid, timestamptz, timestamptz, uuid);
drop function if exists public.founder_active_doctor_count(timestamptz);

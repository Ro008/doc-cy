-- Fix: the previous migration used CREATE OR REPLACE with a new parameter list,
-- which creates a function overload instead of replacing it. PostgREST cannot
-- resolve calls that omit the new optional param between the two candidates
-- (error PGRST203). Drop the stale 11-arg signature explicitly.

DROP FUNCTION IF EXISTS public.register_doctor_with_founder_lock(
  uuid, text, text, text, text, text[], text, text, text, boolean, uuid
);

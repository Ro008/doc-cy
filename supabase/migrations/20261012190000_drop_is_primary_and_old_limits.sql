-- Clean-up after the settings redesign (#279).
--
-- 1. No "primary clinic" (user, 2026-10-11): a professional has no main clinic, it
--    depends on where the patient wants to book. Nothing reads
--    professional_clinics.is_primary since *_professional_clinic_join_leave, which also
--    kept the order it implied in sort_order. The column and its index go.
-- 2. The three booking limits live on each clinic link since
--    *_professional_clinic_limits. professional_settings loses its copies
--    (booking_horizon_days, minimum_notice_hours, patient_cancel_notice_hours), with
--    their check constraints, and the temporary trigger that carried a change of them
--    to the clinics while old code still wrote them.
--
-- NOT backward-compatible with code from before #279 (it selects and writes these
-- columns): only after that merge is deployed. Re-runnable.

-- Stop if a database function still names what is about to go.
do $guard$
declare
  v_names text;
begin
  select string_agg(p.oid::regprocedure::text, ', ') into v_names
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.proname <> 'professional_settings_limits_to_clinics'
    and (p.prosrc ilike '%is_primary%' or p.prosrc ilike '%professional_settings_limits_to_clinics%');
  if v_names is not null then
    raise exception 'still in use by: %', v_names;
  end if;
end
$guard$;

-- 1. The primary-clinic flag.
drop index if exists public.professional_clinics_primary_idx;
alter table public.professional_clinics drop column if exists is_primary;

-- 2. The old per-professional limits. The trigger first: it is defined on these columns.
drop trigger if exists professional_settings_limits_to_clinics on public.professional_settings;
drop function if exists public.professional_settings_limits_to_clinics();
alter table public.professional_settings
  drop column if exists booking_horizon_days,
  drop column if exists minimum_notice_hours,
  drop column if exists patient_cancel_notice_hours;

comment on table public.professional_settings is
  'One row per signed-up professional: what belongs to her and not to a clinic (holiday mode, whether her mobile shows). Hours, slot length, the booking switch and the booking limits are per clinic, on professional_clinics.';

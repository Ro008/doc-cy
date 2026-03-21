-- Debug: reconcile "Total appointments" vs "This month" on the founder dashboard.
-- Run in Supabase → SQL Editor.

-- 1) All rows (newest first) — check created_at vs appointment_datetime
SELECT
  id,
  patient_name,
  appointment_datetime AT TIME ZONE 'UTC' AS slot_utc,
  created_at,
  (created_at AT TIME ZONE 'Europe/Nicosia')::date AS created_date_cyprus,
  status
FROM public.appointments
ORDER BY created_at DESC NULLS LAST, appointment_datetime DESC;

-- 2) Counts
SELECT
  COUNT(*)::int AS total_rows,
  COUNT(created_at)::int AS rows_with_created_at,
  COUNT(*) FILTER (WHERE created_at IS NULL)::int AS missing_created_at
FROM public.appointments;

-- 3) Count bookings in the current *Cyprus* calendar month (compare with dashboard KPI)
SELECT COUNT(*)::int AS appointments_this_month_cyprus
FROM public.appointments
WHERE created_at IS NOT NULL
  AND created_at >= (
    date_trunc('month', now() AT TIME ZONE 'Europe/Nicosia')
    AT TIME ZONE 'Europe/Nicosia'
  );

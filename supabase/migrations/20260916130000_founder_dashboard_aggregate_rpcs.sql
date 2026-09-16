-- The founder/internal dashboard (app/internal/directory/page.tsx) computed
-- several aggregates by fetching every matching row and reducing them in
-- JavaScript: the 6-month appointments chart, the 7-day active-doctor count,
-- manual patient vote counts per professional, and call-to-book click counts
-- per professional. Tables are small today, but the pattern doesn't scale and
-- the database is far better at counting/grouping than the app is. These RPCs
-- move the aggregation into SQL; the app now reads pre-aggregated rows.
--
-- All four are STABLE / SECURITY INVOKER (no elevated privileges) and EXECUTE
-- is restricted to service_role, since the dashboard is service-role-only and
-- none of the underlying tables grant anon/authenticated SELECT here anyway.

create or replace function public.founder_appointments_by_month(p_since timestamptz)
returns table(month_key text, appt_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select to_char(date_trunc('month', a.created_at), 'YYYY-MM') as month_key,
         count(*) as appt_count
  from public.appointments a
  where a.created_at >= p_since
  group by 1
$$;

create or replace function public.founder_active_doctor_count(p_since timestamptz)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select count(distinct a.doctor_id)
  from public.appointments a
  where a.created_at >= p_since
$$;

create or replace function public.founder_manual_vote_stats(p_since timestamptz default null)
returns table(professional_id uuid, vote_count bigint, last_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.professional_id,
         count(distinct coalesce(nullif(btrim(r.voter_key), ''), 'legacy:' || r.id::text)) as vote_count,
         max(r.created_at) as last_at
  from public.professional_patient_booking_requests r
  where p_since is null or r.created_at >= p_since
  group by r.professional_id
$$;

create or replace function public.founder_call_to_book_stats(p_since timestamptz default null)
returns table(
  professional_id uuid,
  click_count bigint,
  finder_count bigint,
  profile_count bigint,
  last_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.professional_id,
         count(*) as click_count,
         count(*) filter (where c.source = 'finder_card') as finder_count,
         count(*) filter (where c.source = 'professional_profile_page') as profile_count,
         max(c.created_at) as last_at
  from public.professional_call_to_book_clicks c
  where p_since is null or c.created_at >= p_since
  group by c.professional_id
$$;

-- Supabase grants EXECUTE on new public-schema functions to anon/authenticated
-- via default privileges, separately from the implicit PUBLIC grant — both
-- must be revoked explicitly or the function stays callable over PostgREST.
revoke execute on function public.founder_appointments_by_month(timestamptz) from public, anon, authenticated;
revoke execute on function public.founder_active_doctor_count(timestamptz) from public, anon, authenticated;
revoke execute on function public.founder_manual_vote_stats(timestamptz) from public, anon, authenticated;
revoke execute on function public.founder_call_to_book_stats(timestamptz) from public, anon, authenticated;

grant execute on function public.founder_appointments_by_month(timestamptz) to service_role;
grant execute on function public.founder_active_doctor_count(timestamptz) to service_role;
grant execute on function public.founder_manual_vote_stats(timestamptz) to service_role;
grant execute on function public.founder_call_to_book_stats(timestamptz) to service_role;

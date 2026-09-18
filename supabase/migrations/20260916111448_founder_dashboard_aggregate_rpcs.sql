-- Captured verbatim from Supabase Testing's migration history (applied out-of-band,
-- not via a committed migration, on 2026-09-16 ~11:14). Added here so migration
-- history and any fresh environment stay in sync. Not referenced by app code yet
-- (grepped for these function names, no hits) — likely prep work for a founder
-- dashboard aggregation feature.

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

revoke execute on function public.founder_appointments_by_month(timestamptz) from public;
revoke execute on function public.founder_active_doctor_count(timestamptz) from public;
revoke execute on function public.founder_manual_vote_stats(timestamptz) from public;
revoke execute on function public.founder_call_to_book_stats(timestamptz) from public;

grant execute on function public.founder_appointments_by_month(timestamptz) to service_role;
grant execute on function public.founder_active_doctor_count(timestamptz) to service_role;
grant execute on function public.founder_manual_vote_stats(timestamptz) to service_role;
grant execute on function public.founder_call_to_book_stats(timestamptz) to service_role;

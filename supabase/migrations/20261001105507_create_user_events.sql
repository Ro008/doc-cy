-- Point E4 step 1: one append-only table for what people do on the site (user, 2026-10-01).
-- Today every event is an anonymous visitor's: a "Show phone number" click, an
-- "online appointment" vote on a listing, or a "can't find your professional?" report.
-- Signed-in professionals and patients come later (actor_type / actor_id).
--
-- Backward-compatible: nothing reads user_events yet, the old tables stay. The backfill
-- copies the old rows with their ids, so it can run again (step 2 does, right before
-- dropping the old tables, to pick up rows written in between).

create table if not exists public.user_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_type text not null default 'visitor',
  actor_id uuid,
  visitor_key text,
  professional_id uuid references public.professionals(id) on delete cascade,
  clinic_id uuid references public.clinics(id) on delete set null,
  source text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint user_events_event_type_check check (
    event_type in ('show_phone_number', 'request_online_appointment', 'missing_professional_report')
  ),
  constraint user_events_actor_type_check check (
    actor_type in ('visitor', 'professional', 'patient', 'admin')
  ),
  constraint user_events_details_object_check check (jsonb_typeof(details) = 'object'),
  -- Shared columns are real columns; what only one type has lives in details. (coalesce:
  -- a check that evaluates to null passes.)
  constraint user_events_shape_check check (
    (event_type in ('show_phone_number', 'request_online_appointment')
      and professional_id is not null
      and source in ('finder_card', 'professional_profile_page'))
    or (event_type = 'missing_professional_report'
      and professional_id is null
      and clinic_id is null
      and source = 'finder_empty_state'
      and coalesce(jsonb_typeof(details -> 'requested_name') = 'string'
                   and btrim(details ->> 'requested_name') <> '', false))
  )
);

comment on table public.user_events is
  'Append-only signals from visitors (later professionals and patients): clicks, votes, reports. Service role only.';

create index if not exists user_events_type_created_idx
  on public.user_events (event_type, created_at desc);
create index if not exists user_events_professional_type_created_idx
  on public.user_events (professional_id, event_type, created_at desc)
  where professional_id is not null;
create index if not exists user_events_clinic_id_idx
  on public.user_events (clinic_id)
  where clinic_id is not null;
-- One online-appointment vote per visitor and professional (the route used to check, then
-- insert, so double clicks slipped through).
create unique index if not exists user_events_one_vote_per_visitor_idx
  on public.user_events (professional_id, visitor_key)
  where event_type = 'request_online_appointment' and visitor_key is not null;

-- Server code only (service role), like the tables it replaces.
alter table public.user_events enable row level security;
revoke all on table public.user_events from public, anon, authenticated;
grant select, insert, update, delete on table public.user_events to service_role;

-- Founder dashboard: per-professional counts for one event type. Clicks count events,
-- votes count visitors (a row without a visitor key counts once).
create or replace function public.founder_user_event_stats(
  p_event_type text,
  p_since timestamptz default null
)
returns table (
  professional_id uuid,
  event_count bigint,
  visitor_count bigint,
  finder_count bigint,
  profile_count bigint,
  last_at timestamptz
)
language sql
stable
set search_path = ''
as $fn$
  select e.professional_id,
         count(*) as event_count,
         count(distinct coalesce(e.visitor_key, 'event:' || e.id::text)) as visitor_count,
         count(*) filter (where e.source = 'finder_card') as finder_count,
         count(*) filter (where e.source = 'professional_profile_page') as profile_count,
         max(e.created_at) as last_at
  from public.user_events e
  where e.event_type = p_event_type
    and e.professional_id is not null
    and (p_since is null or e.created_at >= p_since)
  group by e.professional_id
$fn$;

revoke all on function public.founder_user_event_stats(text, timestamptz) from public, anon, authenticated;
grant execute on function public.founder_user_event_stats(text, timestamptz) to service_role;

-- Copies the old tables into user_events, keyed on their ids (re-runnable). Duplicate
-- votes from the same visitor collapse to the earliest. Dropped in step 2.
create or replace function public.user_events_backfill_legacy()
returns table (kind text, inserted bigint)
language plpgsql
set search_path = ''
as $fn$
declare
  v_n bigint;
begin
  if to_regclass('public.professional_call_to_book_clicks') is not null then
    insert into public.user_events (id, event_type, actor_type, professional_id, clinic_id, source, created_at)
    select c.id, 'show_phone_number', 'visitor', c.professional_id, c.clinic_id, c.source, c.created_at
    from public.professional_call_to_book_clicks c
    on conflict do nothing;
    get diagnostics v_n = row_count;
    kind := 'show_phone_number'; inserted := v_n; return next;
  end if;

  if to_regclass('public.professional_patient_booking_requests') is not null then
    insert into public.user_events (id, event_type, actor_type, visitor_key, professional_id, clinic_id, source, created_at)
    select distinct on (r.professional_id, coalesce(nullif(btrim(r.voter_key), ''), 'event:' || r.id::text))
           r.id, 'request_online_appointment', 'visitor', nullif(btrim(r.voter_key), ''),
           r.professional_id, r.clinic_id, r.source, r.created_at
    from public.professional_patient_booking_requests r
    order by r.professional_id, coalesce(nullif(btrim(r.voter_key), ''), 'event:' || r.id::text), r.created_at, r.id
    on conflict do nothing;
    get diagnostics v_n = row_count;
    kind := 'request_online_appointment'; inserted := v_n; return next;
  end if;

  if to_regclass('public.missing_professional_requests') is not null then
    insert into public.user_events (id, event_type, actor_type, visitor_key, source, details, created_at)
    select m.id, 'missing_professional_report', 'visitor', nullif(btrim(m.voter_key), ''), m.source,
           jsonb_build_object('requested_name', m.requested_name, 'specialty', m.specialty,
                              'district', m.district, 'search_name', m.search_name),
           m.created_at
    from public.missing_professional_requests m
    on conflict do nothing;
    get diagnostics v_n = row_count;
    kind := 'missing_professional_report'; inserted := v_n; return next;
  end if;
end
$fn$;

revoke all on function public.user_events_backfill_legacy() from public, anon, authenticated;

select * from public.user_events_backfill_legacy();

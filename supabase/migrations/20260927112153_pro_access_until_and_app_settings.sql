-- Registration redesign, step 2: the paid-tier entitlement becomes a date, and the
-- free-trial length becomes a setting founders change in the dashboard.
--
-- 1. app_settings: small key/value settings for the internal dashboard. First key:
--    trial_months (whole months, 0-24; default 6, the "6 months free" the sign-up
--    page promises). Service role only.
-- 2. professionals.pro_access_until: online bookings (the pro tier) are on while it
--    is in the future. Replaces has_online_booking, which is dropped once nothing
--    writes it (after the registration approval replaces /register, step 4).
-- 3. Backfill: registered professionals with online booking get created_at + 180
--    days, exactly the trial end the dashboard showed (TRIAL_PERIOD_DAYS default).
-- 4. Transitional trigger (until step 4): a new registered professional with online
--    booking and no date gets now + trial_months on the Cyprus calendar. Covers
--    today's /register (trial counted from sign-up, as before) and test fixtures.
--    The approval sets the date itself and step 4 drops this trigger.
--
-- Backward-compatible (adds only). Idempotent.

create table if not exists public.app_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  value jsonb not null,
  description text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.admin_users (id) on delete set null,
  constraint app_settings_trial_months_valid check (
    key <> 'trial_months'
    or (
      jsonb_typeof(value) = 'number'
      and (value #>> '{}')::numeric = trunc((value #>> '{}')::numeric)
      and (value #>> '{}')::numeric between 0 and 24
    )
  )
);

comment on table public.app_settings is
  'Settings founders change in the internal dashboard (service role only). trial_months: free-trial length in whole months for new professionals.';

alter table public.app_settings enable row level security;
revoke all on table public.app_settings from public, anon, authenticated;

insert into public.app_settings (key, value, description)
values ('trial_months', '6', 'Free-trial length in whole months (0-24) for each new professional. 0 = no trial.')
on conflict (key) do nothing;

alter table public.professionals add column if not exists pro_access_until timestamptz;

comment on column public.professionals.pro_access_until is
  'Pro tier (online bookings) is active while this is in the future. Set by the registration approval (trial) and, later, by payments. Null = never had it.';

update public.professionals
set pro_access_until = created_at + interval '180 days'
where is_registered is true
  and has_online_booking is true
  and pro_access_until is null;

create or replace function public.professionals_default_pro_access_until()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_months integer;
begin
  if new.is_registered is true
     and coalesce(new.has_online_booking, false)
     and new.pro_access_until is null then
    select (s.value #>> '{}')::integer into v_months
    from public.app_settings s
    where s.key = 'trial_months';

    if coalesce(v_months, 0) > 0 then
      new.pro_access_until :=
        ((now() at time zone 'Asia/Nicosia') + make_interval(months => v_months))
        at time zone 'Asia/Nicosia';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.professionals_default_pro_access_until() from public, anon, authenticated;

drop trigger if exists professionals_default_pro_access_until on public.professionals;
create trigger professionals_default_pro_access_until
  before insert on public.professionals
  for each row execute function public.professionals_default_pro_access_until();

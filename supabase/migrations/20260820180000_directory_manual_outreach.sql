-- Weekly demand-signal outreach to unregistered manual-directory professionals.
-- Service role only. Live send is gated in app code (DIRECTORY_MANUAL_OUTREACH_ENABLED).
-- After this migration is on prod: set DIRECTORY_MANUAL_OUTREACH_ENABLED=1 on Vercel Production and redeploy.

create table if not exists public.directory_manual_outreach_sent (
  id uuid primary key default gen_random_uuid(),
  manual_id uuid not null references public.directory_manual (id) on delete cascade,
  email text not null,
  booking_count integer not null default 0,
  phone_click_count integer not null default 0,
  window_start timestamptz not null,
  window_end timestamptz not null,
  sent_at timestamptz not null default now()
);

create index if not exists directory_manual_outreach_sent_manual_sent_idx
  on public.directory_manual_outreach_sent (manual_id, sent_at desc);

create index if not exists directory_manual_outreach_sent_sent_idx
  on public.directory_manual_outreach_sent (sent_at desc);

comment on table public.directory_manual_outreach_sent is
  'Idempotency / cooldown log for weekly directory outreach emails. Service role only.';

alter table if exists public.directory_manual_outreach_sent
  enable row level security;

revoke all on table public.directory_manual_outreach_sent from anon, authenticated;

create table if not exists public.directory_manual_outreach_unsubscribed (
  email_normalized text primary key,
  manual_id uuid references public.directory_manual (id) on delete set null,
  unsubscribed_at timestamptz not null default now()
);

comment on table public.directory_manual_outreach_unsubscribed is
  'Opt-out list for directory outreach, keyed by lower(trim(email)). Service role only.';

alter table if exists public.directory_manual_outreach_unsubscribed
  enable row level security;

revoke all on table public.directory_manual_outreach_unsubscribed from anon, authenticated;

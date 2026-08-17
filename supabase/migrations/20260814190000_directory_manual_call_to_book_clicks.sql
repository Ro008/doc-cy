-- Call to Book CTA clicks on manual finder / professional landing cards.
-- Inserted only from the contact-reveal API (service role) after an intentional click.

create table if not exists public.directory_manual_call_to_book_clicks (
  id uuid primary key default gen_random_uuid(),
  manual_id uuid not null references public.directory_manual (id) on delete cascade,
  clinic_id uuid references public.clinics (id) on delete set null,
  source text not null default 'finder_card',
  created_at timestamptz not null default now(),
  constraint directory_manual_call_to_book_clicks_source_chk
    check (source in ('finder_card', 'professional_landing'))
);

create index if not exists directory_manual_call_to_book_clicks_manual_created_idx
  on public.directory_manual_call_to_book_clicks (manual_id, created_at desc);

create index if not exists directory_manual_call_to_book_clicks_created_idx
  on public.directory_manual_call_to_book_clicks (created_at desc);

comment on table public.directory_manual_call_to_book_clicks is
  'Anonymous Call to Book clicks on manual directory cards. Phone is revealed in the same request; this row is the founder analytics event. Inserted only via server API (service role).';

alter table if exists public.directory_manual_call_to_book_clicks
  enable row level security;

revoke all on table public.directory_manual_call_to_book_clicks from anon, authenticated;

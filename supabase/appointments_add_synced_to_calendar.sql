-- Adds calendar-sync tracking for doctor agenda.
-- Run in Supabase SQL editor (or as part of your migration tooling).

alter table public.appointments
  add column if not exists synced_to_calendar boolean not null default false;


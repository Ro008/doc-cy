-- Publish appointments changes to Supabase Realtime.
--
-- The agenda (components/agenda/AgendaRealtime.tsx) and the dashboard "new requests" bar
-- (components/dashboard/useNewRequests.ts) subscribe to postgres_changes on appointments,
-- but the table was never in the supabase_realtime publication, so no event ever arrived
-- (the agenda lived on its 10 s refresh). Realtime filters each event through RLS as the
-- subscriber: session clients only get their own rows (appointments_select_professional),
-- and anon has no SELECT. Backward compatible: adds a table to a publication, nothing else.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication where pubname = 'supabase_realtime' and puballtables)
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'appointments')
  then
    alter publication supabase_realtime add table public.appointments;
  end if;
end
$$;

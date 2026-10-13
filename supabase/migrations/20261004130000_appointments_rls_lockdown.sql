-- Lock down appointments (user, 2026-10-04; build plan step 13).
-- Every write goes through our routes with the service role, which check the status,
-- the time and the owner (one agenda per professional, no edits to a confirmed visit,
-- data never deleted). Through the public API:
-- - anon: nothing (the old public-booking INSERT policy has been unused since #178);
-- - authenticated: SELECT of her own rows only (agenda, dashboard, realtime).
-- Backward-compatible: no running code writes appointments with the anon key or a session.

drop policy if exists appointments_insert_public_booking on public.appointments;
drop policy if exists appointments_update_professional on public.appointments;
drop policy if exists appointments_delete_professional on public.appointments;

revoke all on table public.appointments from anon;
revoke insert, update, delete, truncate, references, trigger on table public.appointments from authenticated;
grant select on table public.appointments to authenticated;

-- Point B contract step: drop the four deploy-window compatibility views that
-- 20260920143736_rename_doctor_tables_to_professional left under the old names.
--
--   doctor_settings                   (view over professional_settings)
--   doctor_specialty_change_requests  (view over professional_specialty_change_requests)
--   doctor_monthly_digest_sent        (view over professional_monthly_digest_sent)
--   finder_doctor_invitation_requests (view over missing_professional_requests)
--
-- They existed only so the previous deployment kept working while the rename
-- shipped. #185 moved every runtime reference to the new names and is live in
-- Production, so nothing reads them any more. Checked before writing this, in
-- both projects: no dependent views, no function body naming them, no policy
-- naming them. No open PR or unmerged branch adds code that uses them.
--
-- Guarded to drop a name ONLY when it is a view (relkind 'v'), so it can never
-- drop a real table -- including on a database where the rename never ran and
-- these names are still the original tables. No CASCADE: if something ever does
-- depend on one of them, fail loudly rather than take it down silently.
-- Idempotent: a second run finds no views and does nothing.
do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
      and c.relname in (
        'doctor_settings',
        'doctor_specialty_change_requests',
        'doctor_monthly_digest_sent',
        'finder_doctor_invitation_requests'
      )
  loop
    execute format('drop view public.%I', r.relname);
    raise notice 'dropped compat view %', r.relname;
  end loop;
end $$;

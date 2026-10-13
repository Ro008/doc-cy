-- Point E7 (part 2): drop the deploy-window view doctor_services that
-- *_rename_doctor_services_to_professional_services left under the old name.
--
-- Apply only after the code that reads professional_services is live everywhere: nothing
-- reads the view after that.
--
-- Drops the name ONLY when it is a view (relkind 'v'), so it can never drop a real table,
-- and without CASCADE, so anything that still depends on it fails loudly.
-- Idempotent: a second run finds no view and does nothing.

do $$
begin
  if (select relkind from pg_class where oid = to_regclass('public.doctor_services')) = 'v' then
    drop view public.doctor_services;
  end if;
end $$;

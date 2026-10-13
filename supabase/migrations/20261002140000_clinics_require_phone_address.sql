-- Clinic rule, part 1 (user, 2026-09-29): every clinic has an address and a phone.
--
-- Until now only the registration form and the approval step enforced it. This puts it
-- in the database, for ACTIVE clinics: archived clinics (GeSY history) keep their rows
-- as they are, but cannot be restored without an address and a phone.
--   * address: not null and not blank.
--   * phone: exactly 8 national digits (the public Call button shows it as-is).
-- Part 2 ("a professional always has at least one clinic") waits for the clinic
-- join/leave work, which has to decide what happens to a professional's last clinic.
--
-- Backward-compatible and idempotent. It changes no data: if any active clinic breaks the
-- rule the guard stops the migration and names how many, so fix those rows first.

do $mig$
declare
  v_bad int;
begin
  select count(*) into v_bad
  from public.clinics c
  where not c.is_archived
    and (nullif(btrim(c.address), '') is null or not coalesce(c.phone ~ '^[0-9]{8}$', false));
  if v_bad > 0 then
    raise exception 'cannot add the clinic rule: % active clinic(s) lack an address or an 8-digit phone', v_bad;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.clinics'::regclass and conname = 'clinics_active_address_check'
  ) then
    alter table public.clinics
      add constraint clinics_active_address_check
      check (is_archived or nullif(btrim(address), '') is not null);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.clinics'::regclass and conname = 'clinics_active_phone_check'
  ) then
    alter table public.clinics
      add constraint clinics_active_phone_check
      check (is_archived or coalesce(phone ~ '^[0-9]{8}$', false));
  end if;
end
$mig$;

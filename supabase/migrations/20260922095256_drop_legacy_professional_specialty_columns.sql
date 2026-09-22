-- Point C3: contract step of the specialties restructure.
--
-- Since C2b (#193 writes, #195 reads) nothing in the app reads or writes the
-- denormalized specialty columns on `professionals`; `professional_specialties` is
-- the only source. This drops them and everything that only existed to feed them:
--   * trigger professional_specialties_sync_professional and its function
--     sync_professional_specialties_to_professional();
--   * the C1 compat view doctor_specialties;
--   * the old RPC register_doctor_with_founder_lock (replaced by
--     register_professional_with_founder_lock in #193; nothing calls it);
--   * professionals_district_specialty_idx and professionals_specialties_gin_idx;
--   * professionals.specialty, .specialties, .is_specialty_approved, .license_number.
--
-- Kept on purpose until the registration-flow rewrite:
--   * professional_specialties.specialty (and its unique index): a pending custom
--     label has no catalogue row, so this text is its only storage;
--   * professional_specialties.is_approved;
--   * trigger professional_specialties_resolve_specialty (derives specialty_id).
--
-- Checked before dropping (both projects, 2026-09-22): every label, licence and
-- approval flag in the four columns is already present in professional_specialties.
--
-- Backward-compatible for code at or after #195. Idempotent: every step is guarded.
-- No CASCADE: if something unexpected depends on these objects, fail loudly.

drop trigger if exists professional_specialties_sync_professional
  on public.professional_specialties;

drop function if exists public.sync_professional_specialties_to_professional();

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'doctor_specialties'
      and c.relkind = 'v'
  ) then
    execute 'drop view public.doctor_specialties';
  end if;
end
$$;

drop function if exists public.register_doctor_with_founder_lock(
  uuid, text, text, text, text, text[], text, text, text, boolean, uuid, text
);

drop index if exists public.professionals_district_specialty_idx;
drop index if exists public.professionals_specialties_gin_idx;

alter table public.professionals
  drop column if exists specialty,
  drop column if exists specialties,
  drop column if exists is_specialty_approved,
  drop column if exists license_number;

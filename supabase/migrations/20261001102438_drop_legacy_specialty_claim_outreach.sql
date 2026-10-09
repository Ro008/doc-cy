-- Point E3: legacy specialty, claim and outreach objects.
-- * professional_specialty_change_requests: replaced by the request_ tables; until the new
--   specialty requests, specialties are read-only in settings ("Contact us").
-- * professionals.license_file_url (registration takes licence numbers only),
--   specialty_requires_standard_at, directory_claim_source and claim_listing_id (old
--   registration path; nothing writes them since #231/#233).
-- * directory_manual_outreach_sent: unused; outreach would be rebuilt on user_events.
-- Backward-compatible once the code that read them is gone: apply to Production after merge.
-- The private doctor-verifications bucket and its files are left alone (separate decision).

-- 1. Guard: no real professional is waiting on a specialty change.
do $$
declare
  v_left boolean;
begin
  if to_regclass('public.professional_specialty_change_requests') is not null then
    -- Dynamic: a static reference fails to plan once the table is gone (re-runs).
    execute 'select exists (select 1 from public.professional_specialty_change_requests r
             join public.professionals p on p.id = r.professional_id
             where r.status = ''pending'' and not p.is_test_profile)'
      into v_left;
    if v_left then
      raise exception 'a real professional has a pending specialty change: decide it first';
    end if;
  end if;
end
$$;

-- 2. The two tables (their own foreign keys to professionals go with them).
drop table if exists public.professional_specialty_change_requests;
drop table if exists public.directory_manual_outreach_sent;

-- 3. The four columns on professionals, with their index and constraints.
alter table public.professionals drop constraint if exists professionals_claim_listing_id_fkey;
alter table public.professionals drop constraint if exists professionals_directory_claim_source_check;
drop index if exists public.professionals_claim_listing_id_idx;
alter table public.professionals drop column if exists license_file_url;
alter table public.professionals drop column if exists specialty_requires_standard_at;
alter table public.professionals drop column if exists directory_claim_source;
alter table public.professionals drop column if exists claim_listing_id;

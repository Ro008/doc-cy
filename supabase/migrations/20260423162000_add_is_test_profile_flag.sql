-- Mark doctors that should be excluded from public Finder listings.
alter table public.doctors
add column if not exists is_test_profile boolean not null default false;

comment on column public.doctors.is_test_profile is
  'True for QA/demo/test records that must stay hidden from public discovery surfaces.';

-- Safe automatic backfill for common test fixtures.
update public.doctors
set is_test_profile = true
where coalesce(is_test_profile, false) = false
  and (
    lower(coalesce(name, '')) similar to '%(test|demo|dummy|seed|qa|staging)%'
    or lower(coalesce(slug, '')) similar to '%(test|demo|dummy|seed|qa|staging)%'
  );

-- Owner smoke aliases (rociosirvent+…@gmail.com) must be test profiles in prod.

create or replace function public.is_test_doctor_registration_email(p_email text)
returns boolean
language sql
immutable
as $$
  select coalesce(lower(trim(p_email)), '') ~ '@(test-doccy\.com\.cy|integration\.test)$'
      or coalesce(lower(trim(p_email)), '') ~ '@.+\.testing$'
      or coalesce(lower(trim(p_email)), '') like '%rociosirvent%';
$$;

comment on function public.is_test_doctor_registration_email(text) is
  'QA/smoke emails: CI domains, @*.testing, and owner aliases containing rociosirvent.';

update public.doctors
set is_test_profile = true
where coalesce(is_test_profile, false) = false
  and public.is_test_doctor_registration_email(email);

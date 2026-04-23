-- Revert blanket test marking and keep only obvious test fixtures hidden.
update public.doctors
set is_test_profile = false
where is_test_profile = true;

update public.doctors
set is_test_profile = true
where lower(coalesce(name, '')) similar to '%(test|demo|dummy|seed|qa|staging)%'
   or lower(coalesce(slug, '')) similar to '%(test|demo|dummy|seed|qa|staging)%';

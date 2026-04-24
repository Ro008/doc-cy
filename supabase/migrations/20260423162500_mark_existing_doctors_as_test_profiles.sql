-- Current production/testing data are test doctors only.
-- Mark all existing doctor rows as test so Finder excludes them.
update public.doctors
set is_test_profile = true
where is_test_profile = false;

-- Ensure new real registrations are never marked as test profiles.
create or replace function public.register_doctor_with_founder_lock(
  p_auth_user_id uuid,
  p_name text,
  p_specialty text,
  p_email text,
  p_phone text,
  p_languages text[],
  p_license_number text,
  p_license_file_url text,
  p_slug text,
  p_is_specialty_approved boolean
)
returns table (doctor_id uuid, subscription_tier text)
language plpgsql
security definer
set search_path = public
as $$
declare
  founder_count int;
  tier text;
  new_id uuid;
begin
  if p_auth_user_id is null then
    raise exception 'p_auth_user_id is required';
  end if;

  perform pg_advisory_xact_lock(87201401, 3400);

  select count(*)::int into founder_count
  from public.doctors
  where subscription_tier = 'founder';

  if founder_count < 100 then
    tier := 'founder';
  else
    tier := 'standard';
  end if;

  insert into public.doctors (
    auth_user_id,
    name,
    specialty,
    email,
    phone,
    languages,
    license_number,
    license_file_url,
    status,
    slug,
    is_specialty_approved,
    subscription_tier,
    is_test_profile
  )
  values (
    p_auth_user_id,
    p_name,
    p_specialty,
    p_email,
    p_phone,
    p_languages,
    p_license_number,
    p_license_file_url,
    'pending',
    p_slug,
    p_is_specialty_approved,
    tier,
    false
  )
  returning id into new_id;

  return query
  select new_id as doctor_id, tier as subscription_tier;
end;
$$;

-- Point C2b (writes): registration writes professional_specialties, not the
-- denormalized professionals columns.
--
-- * register_professional_with_founder_lock inserts the professional and its
--   specialty rows in one transaction. The sync trigger fills
--   professionals.specialty / specialties / license_number / is_specialty_approved
--   from those rows until Point C3 drops the columns.
-- * professionals.specialty loses NOT NULL, so the new RPC can insert the row
--   before its specialties. Every registered professional still gets it filled
--   (by the sync trigger, in the same transaction); scraped listings keep theirs.
-- * register_doctor_with_founder_lock stays for code deployed before this
--   change; Point C3 drops it.
--
-- Backward-compatible and idempotent.

alter table public.professionals
  alter column specialty drop not null;

create or replace function public.register_professional_with_founder_lock(
  p_auth_user_id uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_languages text[],
  p_license_file_url text,
  p_slug text,
  p_specialties jsonb,
  p_claim_listing_id uuid default null,
  p_directory_claim_source text default null
)
returns table (professional_id uuid, subscription_tier text)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_founder_count int;
  v_tier text;
  v_new_id uuid;
begin
  if p_auth_user_id is null then
    raise exception 'p_auth_user_id is required';
  end if;

  if p_specialties is null
    or jsonb_typeof(p_specialties) <> 'array'
    or jsonb_array_length(p_specialties) = 0 then
    raise exception 'p_specialties must be a non-empty array';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_specialties) e
    where jsonb_typeof(e) <> 'object'
      or nullif(btrim(coalesce(e ->> 'specialty', '')), '') is null
  ) then
    raise exception 'every p_specialties entry needs a specialty';
  end if;

  perform pg_advisory_xact_lock(87201401, 3400);

  select count(*)::int into v_founder_count
  from public.professionals prof
  where prof.subscription_tier = 'founder'
    and prof.is_registered = true
    and coalesce(prof.is_test_profile, false) = false;

  v_tier := case when v_founder_count < 50 then 'founder' else 'standard' end;

  -- Always a fresh row. A claimed listing (p_claim_listing_id) is only
  -- referenced, never converted here: it stays untouched until Verify.
  insert into public.professionals (
    auth_user_id,
    name,
    registration_email,
    mobile_number,
    languages,
    license_file_url,
    status,
    slug,
    subscription_tier,
    is_test_profile,
    is_registered,
    has_online_booking,
    finder_visible,
    is_archived,
    claim_listing_id,
    directory_claim_source
  )
  values (
    p_auth_user_id,
    p_name,
    nullif(btrim(p_email), ''),
    nullif(btrim(p_phone), ''),
    p_languages,
    p_license_file_url,
    'pending',
    p_slug,
    v_tier,
    public.is_test_doctor_registration_email(p_email),
    true,
    true,
    true,
    false,
    p_claim_listing_id,
    nullif(btrim(coalesce(p_directory_claim_source, '')), '')
  )
  returning id into v_new_id;

  insert into public.professional_specialties (professional_id, specialty, license_number, is_approved)
  select
    v_new_id,
    btrim(e ->> 'specialty'),
    nullif(btrim(coalesce(e ->> 'license_number', '')), ''),
    coalesce((e ->> 'is_approved')::boolean, false)
  from jsonb_array_elements(p_specialties) e;

  return query select v_new_id, v_tier;
end;
$function$;

revoke all on function public.register_professional_with_founder_lock(
  uuid, text, text, text, text[], text, text, jsonb, uuid, text
) from public, anon, authenticated;

grant execute on function public.register_professional_with_founder_lock(
  uuid, text, text, text, text[], text, text, jsonb, uuid, text
) to service_role;

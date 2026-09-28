-- A professional's registration email and personal mobile belong to one real
-- professional each (the user, 2026-09-28). Clinic phones live on `clinics` and may be
-- shared; the scraped directory `email` / `phone` columns are not part of this rule.
--
-- Test profiles (`is_test_profile`) never block anyone: QA accounts reuse the testers'
-- own numbers, and specs seed fixed ones. Empty values repeat freely.
--
-- Keys: email lowercased and trimmed; mobile compared by its digits (the form stores
-- E.164, so "+357 99 123456" and "+35799123456" are the same number). Built-in
-- functions only in the index expressions: a custom function there would need EXECUTE
-- for every role that writes `professionals` (settings routes write as the professional).

create unique index if not exists professionals_registration_email_unique_idx
  on public.professionals (lower(btrim(registration_email)))
  where is_test_profile is not true
    and btrim(coalesce(registration_email, '')) <> '';

create unique index if not exists professionals_mobile_number_unique_idx
  on public.professionals (regexp_replace(mobile_number, '[^0-9]', '', 'g'))
  where is_test_profile is not true
    and regexp_replace(coalesce(mobile_number, ''), '[^0-9]', '', 'g') <> '';

-- (The lookups below repeat each index's predicate so the planner can use it.)
-- Is this email / mobile already someone else's? Used by the registration form, the
-- submit action and the founders' review. "Someone else" means:
--   * a real professional (not a test profile) other than the applicant's own;
--   * a real applicant's pending professional_registration request (their details, or
--     the founders' corrections), other than the applicant's own;
--   * for the email only, any other login ('account'): the sign-up would fail anyway.
-- Unconfirmed drafts don't count: nobody has proven them, and they must not let a
-- stranger hold someone's number for a week.
-- SECURITY DEFINER because it reads auth.users; service role only.
create or replace function public.professional_contact_in_use(
  p_email text,
  p_mobile text,
  p_applicant_auth_user_id uuid default null
)
returns table (email_in_use text, mobile_in_use boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_mobile text := regexp_replace(coalesce(p_mobile, ''), '[^0-9]', '', 'g');
begin
  email_in_use := null;
  mobile_in_use := false;

  if v_email <> '' then
    if exists (
      select 1 from public.professionals p
      where p.is_test_profile is not true
        and btrim(coalesce(p.registration_email, '')) <> ''
        and lower(btrim(p.registration_email)) = v_email
        and (p_applicant_auth_user_id is null or p.auth_user_id is distinct from p_applicant_auth_user_id)
    ) or exists (
      select 1 from public.request_log r
      where r.request_type = 'professional_registration'
        and r.status = 'pending'
        and (p_applicant_auth_user_id is null or r.applicant_auth_user_id is distinct from p_applicant_auth_user_id)
        and not public.is_test_doctor_registration_email(r.requester_email)
        and lower(btrim(coalesce(r.approved_details, r.details) ->> 'email')) = v_email
    ) then
      email_in_use := 'professional';
    elsif exists (
      select 1 from auth.users u
      where lower(btrim(u.email)) = v_email
        and u.id is distinct from p_applicant_auth_user_id
    ) then
      email_in_use := 'account';
    end if;
  end if;

  if v_mobile <> '' then
    mobile_in_use := exists (
      select 1 from public.professionals p
      where p.is_test_profile is not true
        and regexp_replace(coalesce(p.mobile_number, ''), '[^0-9]', '', 'g') <> ''
        and regexp_replace(p.mobile_number, '[^0-9]', '', 'g') = v_mobile
        and (p_applicant_auth_user_id is null or p.auth_user_id is distinct from p_applicant_auth_user_id)
    ) or exists (
      select 1 from public.request_log r
      where r.request_type = 'professional_registration'
        and r.status = 'pending'
        and (p_applicant_auth_user_id is null or r.applicant_auth_user_id is distinct from p_applicant_auth_user_id)
        and not public.is_test_doctor_registration_email(r.requester_email)
        and regexp_replace(coalesce(coalesce(r.approved_details, r.details) ->> 'mobile', ''), '[^0-9]', '', 'g') = v_mobile
    );
  end if;

  return next;
end
$$;

comment on function public.professional_contact_in_use(text, text, uuid) is
  'Whether an email / personal mobile is already used by another real professional or real pending registration (email: ''professional''), or the email by another login (''account''). Test profiles and test applicants never count. Service role only.';

revoke all on function public.professional_contact_in_use(text, text, uuid) from public, anon, authenticated;
grant execute on function public.professional_contact_in_use(text, text, uuid) to service_role;

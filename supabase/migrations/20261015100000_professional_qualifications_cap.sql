-- A professional may list up to 20 qualifications, not 6 (user, 2026-10-15): six did not
-- fit a specialist's CV (degree, specialty, master's, PhD, fellowships, certificates).
-- 20 is the same cap as services. The public profile shows the first 6 and folds the
-- rest past 8, as Services & prices does.
--
-- Backward-compatible: only a looser check. The running code (cap 6) keeps working;
-- the new code needs this before a 7th can be saved. Safe to run twice.

alter table public.professionals drop constraint if exists professionals_qualifications_check;
alter table public.professionals add constraint professionals_qualifications_check
  check (case when jsonb_typeof(qualifications) = 'array' then jsonb_array_length(qualifications) <= 20 else false end);

comment on column public.professionals.qualifications is
  'Her qualifications, at most 20: [{id, title, institution, year}]. Written by professional_qualification_add / _remove.';

-- Add a qualification (at most 20: 23514). Returns {request_id, qualification}.
-- As in *_professional_profile_details, with only the cap changed.
create or replace function public.professional_qualification_add(
  p_professional_id uuid,
  p_title text,
  p_institution text,
  p_year integer
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_title text := btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g'));
  v_institution text := btrim(regexp_replace(coalesce(p_institution, ''), '\s+', ' ', 'g'));
  v_current jsonb;
  v_line jsonb;
  v_id uuid;
begin
  if v_title = '' or length(v_title) > 80 then
    raise exception 'a qualification needs a title of 1 to 80 characters' using errcode = '22023';
  end if;
  if v_institution = '' or length(v_institution) > 100 then
    raise exception 'a qualification needs an institution of 1 to 100 characters' using errcode = '22023';
  end if;
  if p_year is not null and (p_year < 1950 or p_year > extract(year from now())::int) then
    raise exception 'the year of a qualification is between 1950 and this year' using errcode = '22023';
  end if;

  select qualifications into v_current from public.professionals where id = p_professional_id for update;
  if not found then
    raise exception 'professional % not found', p_professional_id using errcode = 'P0002';
  end if;
  if jsonb_array_length(v_current) >= 20 then
    raise exception 'a professional lists at most 20 qualifications' using errcode = '23514';
  end if;

  v_line := jsonb_build_object('id', gen_random_uuid(), 'title', v_title,
    'institution', v_institution, 'year', p_year);
  v_id := public.request_submit('professional_qualification_add', p_professional_id, v_line);
  update public.professionals set qualifications = v_current || jsonb_build_array(v_line), updated_at = now()
  where id = p_professional_id;
  return jsonb_build_object('request_id', v_id, 'qualification', v_line);
end
$$;

comment on function public.professional_qualification_add(uuid, text, text, integer) is
  'The professional adds a qualification (at most 20): recorded in request_log at once. Service role only: the server checks the session first.';

revoke all on function public.professional_qualification_add(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.professional_qualification_add(uuid, text, text, integer) to service_role;

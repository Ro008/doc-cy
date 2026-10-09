-- The professional's personal mobile and its visibility switch (Settings → Profile,
-- user 2026-10-09).
--
-- She changes her own mobile and decides whether it shows on her public profile.
-- Neither needs a founder: each change is a request_log row born "recorded", with
-- the old value in before_snapshot. professional_mobile_set and
-- professional_mobile_visibility_set make the change and its record in one
-- transaction (service role only; the app checks the session and the format).
-- When SMS 2FA arrives, a new mobile will need verifying before it is saved.
--
-- Also: request_submit now takes requester_email from the sign-up email
-- (registration_email); professionals.email is the scraped outreach address.
-- Defensive and re-runnable.

-- 1. Request types.
insert into public.request_types (name, requires_approval, is_edit, description)
values
  (
    'professional_mobile_change',
    false,
    true,
    'The professional changed her personal mobile (Settings → Profile). Recorded at once; before_snapshot keeps the old number.'
  ),
  (
    'professional_mobile_visibility_change',
    false,
    true,
    'The professional turned the personal mobile on her public profile on or off. Recorded at once; before_snapshot keeps the old value.'
  )
on conflict (name) do nothing;

-- 2. The switch. Hidden unless she opts in.
alter table public.professional_settings
  add column if not exists show_mobile_on_profile boolean not null default false;

comment on column public.professional_settings.show_mobile_on_profile is
  'Show professionals.mobile_number on the public profile. Off by default; changed only through professional_mobile_visibility_set (recorded in request_log).';

-- 3. request_submit: snapshot steps for the two types; requester_email from the
--    sign-up email. Same signature, so grants are kept.
create or replace function public.request_submit(
  p_request_type text,
  p_professional_id uuid,
  p_details jsonb,
  p_details_version smallint default 1
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_type public.request_types%rowtype;
  v_name text;
  v_email text;
  v_snapshot jsonb;
  v_status text;
  v_id uuid;
begin
  select * into v_type from public.request_types where name = p_request_type;
  if not found then
    raise exception 'unknown request type %', p_request_type using errcode = '22023';
  end if;
  if p_details is null or jsonb_typeof(p_details) <> 'object' then
    raise exception 'request details must be a JSON object' using errcode = '22023';
  end if;
  if p_details_version is null or p_details_version < 1 then
    raise exception 'details_version must be at least 1' using errcode = '22023';
  end if;

  select name, coalesce(registration_email, email) into v_name, v_email
  from public.professionals where id = p_professional_id;
  if not found then
    raise exception 'professional % not found', p_professional_id using errcode = 'P0002';
  end if;

  if v_type.is_edit then
    -- Each edit type captures the live values it changes here (its "before"),
    -- added with the type, e.g. if p_request_type = 'clinic_edit' then ... end if;
    if p_request_type = 'professional_mobile_change' then
      select jsonb_build_object('mobile_number', mobile_number) into v_snapshot
      from public.professionals where id = p_professional_id;
    elsif p_request_type = 'professional_mobile_visibility_change' then
      v_snapshot := jsonb_build_object(
        'show_mobile_on_profile',
        coalesce(
          (select show_mobile_on_profile from public.professional_settings
           where professional_id = p_professional_id),
          false
        )
      );
    end if;
    if v_snapshot is null then
      raise exception 'request type % has no snapshot step yet', p_request_type using errcode = '0A000';
    end if;
  end if;

  v_status := case when v_type.requires_approval then 'pending' else 'recorded' end;
  begin
    insert into public.request_log (
      request_type, status, details, details_version, before_snapshot,
      professional_id, requester_name, requester_email, decided_at
    )
    values (
      p_request_type, v_status, p_details, p_details_version, v_snapshot,
      p_professional_id, v_name, v_email, case when v_status = 'recorded' then now() end
    )
    returning id into v_id;
  exception
    when unique_violation then
      raise exception 'this professional already has a pending % request', p_request_type
        using errcode = '23505';
  end;
  return v_id;
end
$$;

-- 4. Change the mobile. p_mobile_number is already normalized by the app:
--    "+" and 8 to 15 digits. Returns the request id, or null when nothing changed.
--    A number in use by another professional raises 23505
--    (professionals_mobile_number_unique_idx) and nothing is recorded.
create or replace function public.professional_mobile_set(
  p_professional_id uuid,
  p_mobile_number text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_registered boolean;
  v_current text;
  v_id uuid;
begin
  if p_mobile_number is null or p_mobile_number !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'mobile must be + and 8 to 15 digits' using errcode = '22023';
  end if;

  select is_registered, mobile_number into v_registered, v_current
  from public.professionals where id = p_professional_id
  for update;
  if not found then
    raise exception 'professional % not found', p_professional_id using errcode = 'P0002';
  end if;
  if v_registered is not true then
    raise exception 'professional % has not signed up', p_professional_id using errcode = '22023';
  end if;
  if v_current is not distinct from p_mobile_number then
    return null;
  end if;

  v_id := public.request_submit(
    'professional_mobile_change', p_professional_id,
    jsonb_build_object('mobile_number', p_mobile_number)
  );
  update public.professionals
  set mobile_number = p_mobile_number, updated_at = now()
  where id = p_professional_id;
  return v_id;
end
$$;

-- 5. Show or hide the mobile on the public profile. Showing needs a saved mobile.
--    Returns the request id, or null when nothing changed.
create or replace function public.professional_mobile_visibility_set(
  p_professional_id uuid,
  p_show boolean
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_registered boolean;
  v_mobile text;
  v_current boolean;
  v_id uuid;
begin
  if p_show is null then
    raise exception 'show must be true or false' using errcode = '22023';
  end if;

  select is_registered, mobile_number into v_registered, v_mobile
  from public.professionals where id = p_professional_id
  for update;
  if not found then
    raise exception 'professional % not found', p_professional_id using errcode = 'P0002';
  end if;
  if v_registered is not true then
    raise exception 'professional % has not signed up', p_professional_id using errcode = '22023';
  end if;
  if p_show and coalesce(btrim(v_mobile), '') = '' then
    raise exception 'there is no mobile to show' using errcode = '22023';
  end if;

  select show_mobile_on_profile into v_current
  from public.professional_settings where professional_id = p_professional_id
  for update;
  if not found then
    raise exception 'professional % has no settings row', p_professional_id using errcode = 'P0002';
  end if;
  if v_current = p_show then
    return null;
  end if;

  v_id := public.request_submit(
    'professional_mobile_visibility_change', p_professional_id,
    jsonb_build_object('show_mobile_on_profile', p_show)
  );
  update public.professional_settings
  set show_mobile_on_profile = p_show, updated_at = now()
  where professional_id = p_professional_id;
  return v_id;
end
$$;

-- 6. Service role only.
revoke all on function public.professional_mobile_set(uuid, text) from public, anon, authenticated;
revoke all on function public.professional_mobile_visibility_set(uuid, boolean) from public, anon, authenticated;
grant execute on function public.professional_mobile_set(uuid, text) to service_role;
grant execute on function public.professional_mobile_visibility_set(uuid, boolean) to service_role;

comment on function public.professional_mobile_set(uuid, text) is
  'Settings → Profile: change the professional''s personal mobile and record it (request_log, recorded). Null when unchanged. Service role only.';
comment on function public.professional_mobile_visibility_set(uuid, boolean) is
  'Settings → Profile: show or hide the personal mobile on the public profile and record it (request_log, recorded). Null when unchanged. Service role only.';

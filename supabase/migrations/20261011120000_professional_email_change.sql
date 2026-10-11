-- Changing the sign-in email from Settings (Settings → Account, user 2026-10-11).
--
-- She asks for a new address; a link goes to it; nothing changes until that link is
-- opened. The address does two jobs (she signs in with it, and booking requests are
-- sent to it), so confirming moves both: the server changes the sign-in address in
-- Supabase Auth, and professional_email_change_confirm moves
-- professionals.registration_email and records the change in request_log (no founder).
--
-- professional_email_changes holds the change that is waiting: the new address and the
-- SHA-256 of the link's token (the token itself only travels in the email). One waits
-- at a time; the link works once and expires (an hour by default).
--
-- Backward-compatible (a new table, type and functions; request_submit keeps its
-- signature, so grants are kept). Re-runnable.

-- 1. Request type.
insert into public.request_types (name, requires_approval, is_edit, description)
values
  (
    'professional_email_change',
    false,
    true,
    'The professional changed her sign-in email in Settings and confirmed it from the link sent to the new address. details: registration_email. Recorded at once; before_snapshot keeps the old address.'
  )
on conflict (name) do update set description = excluded.description;

-- 2. The change that is waiting for its link to be opened.
create table if not exists public.professional_email_changes (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  new_email text not null,
  token_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  constraint professional_email_changes_token_hash_key unique (token_hash),
  constraint professional_email_changes_token_hash_shape check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint professional_email_changes_one_end check (confirmed_at is null or cancelled_at is null)
);

create unique index if not exists professional_email_changes_one_waiting_idx
  on public.professional_email_changes (professional_id)
  where confirmed_at is null and cancelled_at is null;

alter table public.professional_email_changes enable row level security;
revoke all on table public.professional_email_changes from public, anon, authenticated;
grant select, insert, update, delete on table public.professional_email_changes to service_role;

comment on table public.professional_email_changes is
  'Settings: a sign-in email change waiting for its confirmation link (token kept as SHA-256). One waiting per professional. Service role only; no policies.';

-- 3. request_submit: snapshot step for the new type. Same signature.
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
  v_registered boolean;
  v_new_name text;
  v_spec_slug text;
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

  select name, coalesce(registration_email, email), is_registered into v_name, v_email, v_registered
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
    elsif p_request_type in ('professional_name_change', 'professional_photo_change', 'professional_photo_removal') then
      if v_registered is not true then
        raise exception 'professional % has not signed up', p_professional_id using errcode = '22023';
      end if;
      if p_request_type = 'professional_name_change' then
        v_new_name := btrim(coalesce(p_details ->> 'name', ''));
        if v_new_name = '' or length(v_new_name) > 80 then
          raise exception 'a name change needs a name of 1 to 80 characters' using errcode = '22023';
        end if;
        if v_new_name = btrim(coalesce(v_name, '')) then
          raise exception 'that is already her name' using errcode = '22023';
        end if;
        select jsonb_build_object('name', name, 'slug', slug) into v_snapshot
        from public.professionals where id = p_professional_id;
      else
        if p_request_type = 'professional_photo_change'
           and btrim(coalesce(p_details ->> 'photo_path', '')) = '' then
          raise exception 'a photo change needs photo_path' using errcode = '22023';
        end if;
        select jsonb_build_object('avatar_url', avatar_url) into v_snapshot
        from public.professionals where id = p_professional_id;
      end if;
    elsif p_request_type = 'professional_gesy_change' then
      select jsonb_build_object('is_gesy', coalesce(is_gesy, false)) into v_snapshot
      from public.professionals where id = p_professional_id;
    elsif p_request_type in ('professional_specialty_add', 'professional_specialty_removal') then
      if v_registered is not true then
        raise exception 'professional % has not signed up', p_professional_id using errcode = '22023';
      end if;
      v_spec_slug := public.specialty_slug(coalesce(p_details ->> 'name', ''));
      if btrim(coalesce(p_details ->> 'name', '')) = '' or v_spec_slug is null or v_spec_slug = 'all' then
        raise exception 'a specialty request needs a specialty' using errcode = '22023';
      end if;
      if p_request_type = 'professional_specialty_add' then
        if btrim(coalesce(p_details ->> 'license_number', '')) = ''
           or length(btrim(p_details ->> 'license_number')) > 80 then
          raise exception 'a specialty request needs a licence number of 1 to 80 characters'
            using errcode = '22023';
        end if;
        if exists (
          select 1 from public.professional_specialties ps
          join public.specialties s on s.id = ps.specialty_id
          where ps.professional_id = p_professional_id and s.slug = v_spec_slug
        ) then
          raise exception 'she already has this specialty' using errcode = '22023';
        end if;
        if (select count(*) from public.professional_specialties ps
            where ps.professional_id = p_professional_id) >= 5 then
          raise exception 'a professional has at most 5 specialties' using errcode = '22023';
        end if;
        select jsonb_build_object('specialties', coalesce(jsonb_agg(
            jsonb_build_object('name', ps.specialty, 'license_number', ps.license_number)
            order by ps.specialty), '[]'::jsonb))
        into v_snapshot
        from public.professional_specialties ps where ps.professional_id = p_professional_id;
      else
        select jsonb_build_object('name', ps.specialty, 'license_number', ps.license_number)
        into v_snapshot
        from public.professional_specialties ps
        join public.specialties s on s.id = ps.specialty_id
        where ps.professional_id = p_professional_id and s.slug = v_spec_slug;
        if v_snapshot is null then
          raise exception 'she does not have this specialty' using errcode = 'P0002';
        end if;
      end if;
    elsif p_request_type in (
      'professional_patients_seen_change', 'professional_bio_change', 'professional_languages_change',
      'professional_qualification_add', 'professional_qualification_removal'
    ) then
      if v_registered is not true then
        raise exception 'professional % has not signed up', p_professional_id using errcode = '22023';
      end if;
      select case p_request_type
               when 'professional_patients_seen_change' then jsonb_build_object('patients_seen', patients_seen)
               when 'professional_bio_change' then jsonb_build_object('bio', bio)
               when 'professional_languages_change' then jsonb_build_object('languages', to_jsonb(languages))
               else jsonb_build_object('qualifications', qualifications)
             end
      into v_snapshot
      from public.professionals where id = p_professional_id;
    elsif p_request_type in (
      'professional_service_add', 'professional_service_change', 'professional_service_removal'
    ) then
      if v_registered is not true then
        raise exception 'professional % has not signed up', p_professional_id using errcode = '22023';
      end if;
      select jsonb_build_object('services', coalesce(jsonb_agg(
          jsonb_build_object('id', s.id, 'name', s.name, 'price', s.price)
          order by s.created_at, s.id), '[]'::jsonb))
      into v_snapshot
      from public.professional_services s where s.professional_id = p_professional_id;
    elsif p_request_type = 'professional_email_change' then
      if v_registered is not true then
        raise exception 'professional % has not signed up', p_professional_id using errcode = '22023';
      end if;
      select jsonb_build_object('registration_email', registration_email) into v_snapshot
      from public.professionals where id = p_professional_id;
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

-- 4. Is this address already someone's? Looks at sign-up emails and at Supabase Auth
--    (which the service role cannot read by itself, hence security definer).
create or replace function public.professional_email_in_use(
  p_email text,
  p_except_professional_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.professionals p
    where p.id is distinct from p_except_professional_id
      and lower(btrim(coalesce(p.registration_email, ''))) = lower(btrim(p_email))
  ) or exists (
    select 1 from auth.users u
    where lower(u.email) = lower(btrim(p_email))
      and u.id is distinct from (
        select auth_user_id from public.professionals where id = p_except_professional_id
      )
  );
$$;

-- 5. Ask for a new address. p_token_hash is the SHA-256 (hex) of the token in the
--    emailed link. Replaces a change that was waiting. Returns the change's id.
--    23505: another account uses the address. 22023: not usable. P0002: unknown.
create or replace function public.professional_email_change_start(
  p_professional_id uuid,
  p_new_email text,
  p_token_hash text,
  p_minutes integer default 60
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_registered boolean;
  v_current text;
  v_email text := lower(btrim(coalesce(p_new_email, '')));
  v_id uuid;
begin
  if length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' then
    raise exception 'that is not an email address' using errcode = '22023';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'the token hash must be a SHA-256 in hex' using errcode = '22023';
  end if;
  if p_minutes is null or p_minutes < 5 or p_minutes > 1440 then
    raise exception 'the link lasts between 5 minutes and a day' using errcode = '22023';
  end if;

  select is_registered, registration_email into v_registered, v_current
  from public.professionals where id = p_professional_id
  for update;
  if not found then
    raise exception 'professional % not found', p_professional_id using errcode = 'P0002';
  end if;
  if v_registered is not true then
    raise exception 'professional % has not signed up', p_professional_id using errcode = '22023';
  end if;
  if lower(btrim(coalesce(v_current, ''))) = v_email then
    raise exception 'that is already her email' using errcode = '22023';
  end if;
  if public.professional_email_in_use(v_email, p_professional_id) then
    raise exception 'another account uses this email' using errcode = '23505';
  end if;

  update public.professional_email_changes
  set cancelled_at = now()
  where professional_id = p_professional_id and confirmed_at is null and cancelled_at is null;

  insert into public.professional_email_changes (professional_id, new_email, token_hash, expires_at)
  values (p_professional_id, v_email, p_token_hash, now() + make_interval(mins => p_minutes))
  returning id into v_id;
  return v_id;
end
$$;

-- 6. Cancel the change that is waiting. True when there was one.
create or replace function public.professional_email_change_cancel(p_professional_id uuid)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.professional_email_changes
  set cancelled_at = now()
  where professional_id = p_professional_id and confirmed_at is null and cancelled_at is null;
  get diagnostics v_count = row_count;
  return v_count > 0;
end
$$;

-- 7. The link was opened: move the address and record it. The server changes the
--    sign-in address in Supabase Auth just before calling this (and puts it back if
--    this fails). P0002: unknown, used, cancelled or expired link. 23505: another
--    account took the address meanwhile.
create or replace function public.professional_email_change_confirm(p_token_hash text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_change public.professional_email_changes%rowtype;
  v_old text;
  v_auth uuid;
  v_request uuid;
begin
  select * into v_change from public.professional_email_changes
  where token_hash = p_token_hash
  for update;
  if not found or v_change.confirmed_at is not null or v_change.cancelled_at is not null
     or v_change.expires_at <= now() then
    raise exception 'this link is not valid any more' using errcode = 'P0002';
  end if;

  select registration_email, auth_user_id into v_old, v_auth
  from public.professionals where id = v_change.professional_id
  for update;
  if not found then
    raise exception 'professional % not found', v_change.professional_id using errcode = 'P0002';
  end if;
  if public.professional_email_in_use(v_change.new_email, v_change.professional_id) then
    raise exception 'another account uses this email' using errcode = '23505';
  end if;

  v_request := public.request_submit(
    'professional_email_change', v_change.professional_id,
    jsonb_build_object('registration_email', v_change.new_email)
  );
  update public.professionals
  set registration_email = v_change.new_email, updated_at = now()
  where id = v_change.professional_id;
  update public.professional_email_changes set confirmed_at = now() where id = v_change.id;

  return jsonb_build_object(
    'request_id', v_request,
    'professional_id', v_change.professional_id,
    'auth_user_id', v_auth,
    'old_email', v_old,
    'new_email', v_change.new_email
  );
end
$$;

-- 8. Service role only.
revoke all on function public.professional_email_in_use(text, uuid) from public, anon, authenticated;
revoke all on function public.professional_email_change_start(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.professional_email_change_cancel(uuid) from public, anon, authenticated;
revoke all on function public.professional_email_change_confirm(text) from public, anon, authenticated;
grant execute on function public.professional_email_in_use(text, uuid) to service_role;
grant execute on function public.professional_email_change_start(uuid, text, text, integer) to service_role;
grant execute on function public.professional_email_change_cancel(uuid) to service_role;
grant execute on function public.professional_email_change_confirm(text) to service_role;

comment on function public.professional_email_in_use(text, uuid) is
  'True when another professional''s sign-up email or another Supabase Auth user has this address. Service role only.';
comment on function public.professional_email_change_start(uuid, text, text, integer) is
  'Settings: ask for a new sign-in email; keeps the address and the link''s hash until confirmed. Replaces a waiting change. Service role only.';
comment on function public.professional_email_change_cancel(uuid) is
  'Settings: cancel the email change that is waiting. True when there was one. Service role only.';
comment on function public.professional_email_change_confirm(text) is
  'Settings: the confirmation link was opened; moves registration_email and records it (request_log, recorded). Service role only.';

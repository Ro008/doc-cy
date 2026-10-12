-- The professional's name and photo change by request (Settings → Profile,
-- user 2026-10-10).
--
-- A new name and a new photo both need a founder: each is a request_log row born
-- "pending", with the live value in before_snapshot, and one open request per
-- kind. She withdraws it with request_withdraw; founders decide with
-- request_approve / request_reject. Approving a name also moves the public
-- address (slug, chosen by the app) and leaves the old one in
-- professional_slug_redirects, so old links keep working. Approving a photo
-- publishes the path the app copied to the public avatars bucket.
-- Removing the photo needs nobody: professional_photo_remove records it at once.
--
-- Backward-compatible (new types, new functions; request_submit and
-- request_approve keep their signatures, so grants are kept). Re-runnable.

-- 1. Request types.
insert into public.request_types (name, requires_approval, is_edit, description)
values
  (
    'professional_name_change',
    true,
    true,
    'The professional asked for a new public name in Settings. details: name, reason. Approving sets the name and the public address (slug); the old address forwards. before_snapshot keeps the old name and slug.'
  ),
  (
    'professional_photo_change',
    true,
    true,
    'The professional asked for a new profile photo in Settings. details: photo_path (private request-uploads bucket). Approving publishes it. before_snapshot keeps the old avatar_url.'
  ),
  (
    'professional_photo_removal',
    false,
    true,
    'The professional removed her profile photo in Settings. Recorded at once; before_snapshot keeps the old avatar_url.'
  )
on conflict (name) do update set description = excluded.description;

-- 2. One open request per professional and kind.
create unique index if not exists request_log_one_pending_professional_name_change_idx
  on public.request_log (professional_id) where status = 'pending' and request_type = 'professional_name_change';
create unique index if not exists request_log_one_pending_professional_photo_change_idx
  on public.request_log (professional_id) where status = 'pending' and request_type = 'professional_photo_change';

-- 3. request_submit: checks and snapshot steps for the three types.
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

-- 4. Approval step: the name. p_options.slug is the public address the app
--    picked for the new name (her current one when it still fits).
create or replace function public.request_apply_professional_name_change(
  p_req public.request_log,
  p_details jsonb,
  p_options jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_details ->> 'name', ''));
  v_slug text := lower(btrim(coalesce(p_options ->> 'slug', '')));
  v_pro public.professionals%rowtype;
  v_previous text;
begin
  if v_name = '' or length(v_name) > 80 then
    raise exception 'a name change needs a name of 1 to 80 characters' using errcode = '22023';
  end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'approving a name change needs a slug' using errcode = '22023';
  end if;

  select * into v_pro from public.professionals where id = p_req.professional_id for update;
  if not found then
    raise exception 'the professional no longer exists' using errcode = 'P0002';
  end if;
  if v_pro.name is distinct from (p_req.before_snapshot ->> 'name') then
    raise exception 'the name changed since this request was made: ask her to send it again'
      using errcode = '55000';
  end if;

  if exists (
    select 1 from public.professionals p
    where p.id <> v_pro.id and p.is_archived = false and lower(btrim(p.slug)) = v_slug
  ) or exists (
    select 1 from public.professional_slug_redirects r
    where lower(r.slug) = v_slug and r.professional_id <> v_pro.id
  ) then
    raise exception 'the address % belongs to another profile', v_slug using errcode = '23505';
  end if;

  v_previous := nullif(lower(btrim(coalesce(v_pro.slug, ''))), '');
  -- Her own old address, live again: it no longer forwards.
  delete from public.professional_slug_redirects r where lower(r.slug) = v_slug;
  update public.professionals
  set name = v_name, slug = v_slug, updated_at = now()
  where id = v_pro.id;
  if v_previous is not null and v_previous <> v_slug then
    insert into public.professional_slug_redirects (slug, professional_id)
    values (v_previous, v_pro.id)
    on conflict (slug) do update set professional_id = excluded.professional_id;
  else
    v_previous := null;
  end if;

  return jsonb_build_object(
    'professional_id', v_pro.id, 'name', v_name, 'slug', v_slug, 'previous_slug', v_previous
  );
end
$$;

-- 5. Approval step: the photo. p_options.avatar_path is where the app copied it
--    in the public avatars bucket. Whatever photo is live (or none) is replaced.
create or replace function public.request_apply_professional_photo_change(
  p_req public.request_log,
  p_details jsonb,
  p_options jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_avatar text := nullif(btrim(coalesce(p_options ->> 'avatar_path', '')), '');
begin
  if v_avatar is null then
    raise exception 'approving a photo change needs avatar_path' using errcode = '22023';
  end if;
  update public.professionals set avatar_url = v_avatar, updated_at = now()
  where id = p_req.professional_id;
  if not found then
    raise exception 'the professional no longer exists' using errcode = 'P0002';
  end if;
  return jsonb_build_object('professional_id', p_req.professional_id, 'avatar_url', v_avatar);
end
$$;

-- 6. request_approve: the two new approval steps.
create or replace function public.request_approve(
  p_request_id uuid,
  p_admin_id uuid,
  p_corrected_details jsonb default null,
  p_note text default null,
  p_options jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.request_log%rowtype;
  v_details jsonb;
  v_outcome jsonb;
  v_professional uuid;
begin
  if p_corrected_details is not null and jsonb_typeof(p_corrected_details) <> 'object' then
    raise exception 'corrected details must be a JSON object' using errcode = '22023';
  end if;
  if p_options is not null and jsonb_typeof(p_options) <> 'object' then
    raise exception 'approval options must be a JSON object' using errcode = '22023';
  end if;

  select * into v_req from public.request_log where id = p_request_id for update;
  if not found then
    raise exception 'request % not found', p_request_id using errcode = 'P0002';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'request % is already %', p_request_id, v_req.status using errcode = '55000';
  end if;
  perform public.request_assert_founder(p_admin_id);

  v_details := coalesce(p_corrected_details, v_req.details);
  -- Each type's approval step: for edit types, stop with a conflict if the live
  -- values no longer match before_snapshot; then apply v_details and set v_outcome.
  if v_req.request_type = 'professional_registration' then
    v_outcome := public.request_apply_professional_registration(v_req, v_details, p_options);
    v_professional := (v_outcome ->> 'professional_id')::uuid;
  elsif v_req.request_type = 'professional_name_change' then
    v_outcome := public.request_apply_professional_name_change(v_req, v_details, p_options);
  elsif v_req.request_type = 'professional_photo_change' then
    v_outcome := public.request_apply_professional_photo_change(v_req, v_details, p_options);
  end if;
  if v_outcome is null then
    raise exception 'request type % has no approval step yet', v_req.request_type using errcode = '0A000';
  end if;

  perform set_config('doccy.request_decision', p_request_id::text, true);
  update public.request_log
  set status = 'approved',
      decided_at = now(),
      decided_by = p_admin_id,
      decision_note = nullif(btrim(coalesce(p_note, '')), ''),
      approved_details = p_corrected_details,
      outcome = v_outcome,
      professional_id = coalesce(professional_id, v_professional)
  where id = p_request_id;
  perform set_config('doccy.request_decision', '', true);
  return p_request_id;
end
$$;

-- 7. Remove the photo: no founder, recorded at once. Returns the request id, or
--    null when there was no photo. The app deletes the file afterwards.
create or replace function public.professional_photo_remove(p_professional_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_registered boolean;
  v_current text;
  v_id uuid;
begin
  select is_registered, avatar_url into v_registered, v_current
  from public.professionals where id = p_professional_id
  for update;
  if not found then
    raise exception 'professional % not found', p_professional_id using errcode = 'P0002';
  end if;
  if v_registered is not true then
    raise exception 'professional % has not signed up', p_professional_id using errcode = '22023';
  end if;
  if v_current is null or btrim(v_current) = '' then
    return null;
  end if;

  v_id := public.request_submit('professional_photo_removal', p_professional_id,
    jsonb_build_object('avatar_url', null));
  update public.professionals set avatar_url = null, updated_at = now() where id = p_professional_id;
  return v_id;
end
$$;

comment on function public.request_apply_professional_name_change(public.request_log, jsonb, jsonb) is
  'Approval step of professional_name_change: sets name and slug, forwards the old slug. Called only by request_approve.';
comment on function public.request_apply_professional_photo_change(public.request_log, jsonb, jsonb) is
  'Approval step of professional_photo_change: publishes options.avatar_path. Called only by request_approve.';
comment on function public.professional_photo_remove(uuid) is
  'The professional removes her photo: recorded in request_log at once (professional_photo_removal). Service role only: the server checks the session first.';

revoke all on function public.request_apply_professional_name_change(public.request_log, jsonb, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.request_apply_professional_photo_change(public.request_log, jsonb, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.professional_photo_remove(uuid) from public, anon, authenticated;
grant execute on function public.professional_photo_remove(uuid) to service_role;

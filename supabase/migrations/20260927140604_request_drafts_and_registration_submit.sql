-- Registration redesign, build PR 3: the submit path.
--
-- * request_drafts holds a submitted form until the applicant confirms their
--   email; only then does it enter the permanent request_log (spam and never-
--   confirmed sign-ups never do). Deleting the login deletes its draft; a daily
--   cron deletes drafts (and logins) still unconfirmed after 7 days.
-- * request_log.applicant_auth_user_id links a request to the applicant's login,
--   since a professional_registration has no professional until it is approved.
--   ON DELETE SET NULL: the request itself is permanent.
-- * Founders' Club places are reserved at submit: a real applicant's draft gets
--   details.founders_club = true while places are left. The place counts while
--   the draft exists or the request is pending, and is released when the draft
--   expires or the request is denied or withdrawn (founders_club_places_taken).
-- * request-uploads: a private bucket for registration photos, which founders
--   review before anything reaches the public avatars bucket.
--
-- Backward-compatible (new objects; the guard now also accepts applicant
-- requests). Idempotent. Service role only. The three draft functions read
-- auth.users, which the service role can't, so they are SECURITY DEFINER with
-- search_path = '' and EXECUTE for the service role only.

-- 1. The applicant link on request_log.
alter table public.request_log
  add column if not exists applicant_auth_user_id uuid references auth.users (id) on delete set null;

comment on column public.request_log.applicant_auth_user_id is
  'The applicant''s login, for requests made before a professional exists (professional_registration). Emptied if the login is deleted; the request stays.';

create index if not exists request_log_applicant_idx
  on public.request_log (applicant_auth_user_id, created_at desc)
  where applicant_auth_user_id is not null;

create unique index if not exists request_log_one_pending_registration_per_applicant_idx
  on public.request_log (applicant_auth_user_id)
  where status = 'pending' and request_type = 'professional_registration';

-- 2. The guard: a new request names its professional or its applicant; the two
--    ON DELETE SET NULL cascades may empty their link; a pending request's
--    applicant never changes.
create or replace function public.request_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_type public.request_types%rowtype;
  v_start_status text;
begin
  if tg_op = 'TRUNCATE' then
    raise exception 'request_log is permanent: it cannot be truncated' using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'request_log is permanent: requests are never deleted' using errcode = '55000';
  end if;

  if tg_op = 'INSERT' then
    if new.professional_id is null and new.applicant_auth_user_id is null then
      raise exception 'a new request names its professional or its applicant' using errcode = '23514';
    end if;
    select * into v_type from public.request_types where name = new.request_type;
    if found then
      v_start_status := case when v_type.requires_approval then 'pending' else 'recorded' end;
      if new.status <> v_start_status then
        raise exception 'a % request starts as %', new.request_type, v_start_status using errcode = '23514';
      end if;
      if v_type.is_edit and new.before_snapshot is null then
        raise exception 'a % request needs before_snapshot', new.request_type using errcode = '23514';
      end if;
    end if;
    if new.decided_by is not null or new.decision_note is not null
       or new.approved_details is not null or new.outcome is not null then
      raise exception 'a new request has no decision' using errcode = '23514';
    end if;
    return new;
  end if;

  -- UPDATE. The ON DELETE SET NULL cascades (professional, login): only a link empties.
  if ((old.professional_id is not null and new.professional_id is null)
      or (old.applicant_auth_user_id is not null and new.applicant_auth_user_id is null))
     and (to_jsonb(new) - 'professional_id' - 'applicant_auth_user_id')
       = (to_jsonb(old) - 'professional_id' - 'applicant_auth_user_id')
     and (new.professional_id is null or new.professional_id = old.professional_id)
     and (new.applicant_auth_user_id is null or new.applicant_auth_user_id = old.applicant_auth_user_id) then
    return new;
  end if;

  if old.status <> 'pending' then
    raise exception 'request % is %: decided requests never change', old.id, old.status using errcode = '55000';
  end if;

  if new.id is distinct from old.id
     or new.request_type is distinct from old.request_type
     or new.details is distinct from old.details
     or new.details_version is distinct from old.details_version
     or new.before_snapshot is distinct from old.before_snapshot
     or new.professional_id is distinct from old.professional_id
     or new.applicant_auth_user_id is distinct from old.applicant_auth_user_id
     or new.requester_name is distinct from old.requester_name
     or new.requester_email is distinct from old.requester_email
     or new.created_at is distinct from old.created_at then
    raise exception 'only the decision can change on a pending request' using errcode = '55000';
  end if;

  if coalesce(current_setting('doccy.request_decision', true), '') <> old.id::text then
    raise exception 'requests are decided only through request_approve, request_reject or request_withdraw'
      using errcode = '55000';
  end if;
  if new.status = 'pending' then
    raise exception 'a decision closes the request' using errcode = '55000';
  end if;
  return new;
end
$$;

-- 3. The holding table.
create table if not exists public.request_drafts (
  id uuid primary key default gen_random_uuid(),
  request_type text not null references public.request_types (name) on update restrict on delete restrict,
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  details jsonb not null,
  details_version smallint not null,
  requester_name text not null,
  requester_email text not null,
  created_at timestamptz not null default now(),
  constraint request_drafts_details_object check (jsonb_typeof(details) = 'object'),
  constraint request_drafts_details_version_check check (details_version >= 1),
  constraint request_drafts_requester_name_not_blank check (btrim(requester_name) <> ''),
  constraint request_drafts_requester_email_not_blank check (btrim(requester_email) <> ''),
  constraint request_drafts_one_per_login unique (auth_user_id, request_type)
);

comment on table public.request_drafts is
  'Submitted requests waiting for the applicant to confirm their email; then moved into request_log (request_draft_confirm). Purgeable: never an audit record.';

create index if not exists request_drafts_created_idx on public.request_drafts (created_at);

-- 4. Founders' Club places taken: registered founders (the same rule as the
--    registration lock), plus reserved drafts and pending registration requests.
create or replace function public.founders_club_places_taken()
returns int
language sql
stable
set search_path = ''
as $$
  select (
    (select count(*) from public.professionals p
     where p.subscription_tier = 'founder'
       and p.is_registered = true
       and coalesce(p.is_test_profile, false) = false)
    + (select count(*) from public.request_drafts d
       where d.request_type = 'professional_registration'
         and (d.details -> 'founders_club') = 'true'::jsonb)
    + (select count(*) from public.request_log r
       where r.request_type = 'professional_registration'
         and r.status = 'pending'
         and (r.details -> 'founders_club') = 'true'::jsonb)
  )::int;
$$;

-- 5. Submit: store the draft; a registration reserves a place while any are left.
create or replace function public.request_draft_submit(
  p_request_type text,
  p_auth_user_id uuid,
  p_details jsonb,
  p_details_version smallint,
  p_requester_name text,
  p_requester_email text
)
returns table (draft_id uuid, founders_club boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type public.request_types%rowtype;
  v_login_email text;
  v_details jsonb := p_details;
  v_founders boolean := false;
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
  if p_requester_name is null or btrim(p_requester_name) = ''
     or p_requester_email is null or btrim(p_requester_email) = '' then
    raise exception 'a draft names its requester' using errcode = '22023';
  end if;

  select u.email into v_login_email from auth.users u where u.id = p_auth_user_id;
  if not found then
    raise exception 'login % not found', p_auth_user_id using errcode = 'P0002';
  end if;

  if p_request_type = 'professional_registration' then
    if exists (select 1 from public.professionals p where p.auth_user_id = p_auth_user_id) then
      raise exception 'this login already belongs to a professional' using errcode = '23505';
    end if;
    if exists (
      select 1 from public.request_log r
      where r.applicant_auth_user_id = p_auth_user_id
        and r.request_type = 'professional_registration'
        and r.status = 'pending'
    ) then
      raise exception 'this login already has a pending registration request' using errcode = '23505';
    end if;

    -- Same lock as the old registration RPC, so two submits can't take the last place.
    perform pg_advisory_xact_lock(87201401, 3400);
    v_founders := not public.is_test_doctor_registration_email(p_requester_email)
      and not public.is_test_doctor_registration_email(v_login_email)
      and public.founders_club_places_taken() < 50;
    v_details := v_details || jsonb_build_object('founders_club', v_founders);
  end if;

  begin
    insert into public.request_drafts (
      request_type, auth_user_id, details, details_version, requester_name, requester_email
    )
    values (
      p_request_type, p_auth_user_id, v_details, p_details_version,
      btrim(p_requester_name), btrim(p_requester_email)
    )
    returning id into v_id;
  exception
    when unique_violation then
      raise exception 'this login already has a % draft', p_request_type using errcode = '23505';
  end;

  return query select v_id, v_founders;
end
$$;

-- 6. Confirm: after the email is confirmed, the draft becomes a pending request.
--    Idempotent: a second call returns the same request with created = false.
create or replace function public.request_draft_confirm(
  p_auth_user_id uuid,
  p_request_type text default 'professional_registration'
)
returns table (request_id uuid, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.request_drafts%rowtype;
  v_confirmed_at timestamptz;
  v_id uuid;
begin
  select * into v_draft
  from public.request_drafts d
  where d.auth_user_id = p_auth_user_id and d.request_type = p_request_type
  for update;

  if not found then
    select r.id into v_id
    from public.request_log r
    where r.applicant_auth_user_id = p_auth_user_id
      and r.request_type = p_request_type
      and r.status = 'pending'
    order by r.created_at desc
    limit 1;
    if v_id is not null then
      return query select v_id, false;
    end if;
    return;
  end if;

  select u.email_confirmed_at into v_confirmed_at from auth.users u where u.id = p_auth_user_id;
  if v_confirmed_at is null then
    raise exception 'the applicant has not confirmed their email yet' using errcode = '55000';
  end if;

  insert into public.request_log (
    request_type, status, details, details_version,
    applicant_auth_user_id, requester_name, requester_email
  )
  values (
    v_draft.request_type, 'pending', v_draft.details, v_draft.details_version,
    p_auth_user_id, v_draft.requester_name, v_draft.requester_email
  )
  returning id into v_id;

  delete from public.request_drafts where id = v_draft.id;
  return query select v_id, true;
end
$$;

-- 7. Drafts older than the limit, for the daily purge.
create or replace function public.request_drafts_expired(p_older_than interval default interval '7 days')
returns table (
  draft_id uuid,
  auth_user_id uuid,
  requester_email text,
  email_confirmed boolean,
  photo_path text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.auth_user_id, d.requester_email, u.email_confirmed_at is not null,
         nullif(btrim(coalesce(d.details #>> '{photo,path}', '')), ''), d.created_at
  from public.request_drafts d
  join auth.users u on u.id = d.auth_user_id
  where d.created_at < now() - p_older_than
  order by d.created_at;
$$;

-- 8. Private bucket for registration uploads (service role only; founders see
--    them through signed URLs).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('request-uploads', 'request-uploads', false, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false;

-- 9. Access: service role only.
alter table public.request_drafts enable row level security;

revoke all on table public.request_drafts from public, anon, authenticated, service_role;
grant select, insert, delete on table public.request_drafts to service_role;

revoke all on function public.founders_club_places_taken() from public, anon, authenticated;
revoke all on function public.request_draft_submit(text, uuid, jsonb, smallint, text, text) from public, anon, authenticated;
revoke all on function public.request_draft_confirm(uuid, text) from public, anon, authenticated;
revoke all on function public.request_drafts_expired(interval) from public, anon, authenticated;
grant execute on function public.founders_club_places_taken() to service_role;
grant execute on function public.request_draft_submit(text, uuid, jsonb, smallint, text, text) to service_role;
grant execute on function public.request_draft_confirm(uuid, text) to service_role;
grant execute on function public.request_drafts_expired(interval) to service_role;

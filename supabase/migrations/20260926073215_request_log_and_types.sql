-- Review requests and their permanent audit log (registration redesign, step 2).
--
-- request_types: one row per kind of request. request_log: one row per request,
-- never deleted; a decided request never changes. Decisions happen only through
-- request_approve / request_reject / request_withdraw. Each request type adds its
-- own approval step (and, for edit types, its snapshot step) to those functions
-- when it is built; until then approving it is refused.
-- Service role only: RLS on with no policies, no grants to anon/authenticated.

create table if not exists public.request_types (
  name text primary key,
  requires_approval boolean not null,
  is_edit boolean not null default false,
  description text not null,
  created_at timestamptz not null default now(),
  constraint request_types_name_format check (name ~ '^[a-z][a-z0-9_]*$'),
  constraint request_types_description_not_blank check (btrim(description) <> '')
);

comment on table public.request_types is
  'Kinds of review requests. requires_approval = false: recorded at once, never queued. is_edit: changes existing data, so before_snapshot is required.';

insert into public.request_types (name, requires_approval, is_edit, description)
values (
  'professional_registration',
  true,
  false,
  'A professional''s sign-up as one request: specialties with licence numbers and clinic choices (existing clinics or new-clinic proposals). Approving verifies the professional and writes the approved specialties and clinics.'
)
on conflict (name) do nothing;

create table if not exists public.request_log (
  id uuid primary key default gen_random_uuid(),
  request_type text not null references public.request_types (name) on update restrict on delete restrict,
  status text not null,
  details jsonb not null,
  details_version smallint not null,
  before_snapshot jsonb,
  approved_details jsonb,
  outcome jsonb,
  professional_id uuid references public.professionals (id) on delete set null,
  requester_name text,
  requester_email text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.admin_users (id) on delete restrict,
  decision_note text,
  constraint request_log_status_check
    check (status in ('pending', 'approved', 'rejected', 'withdrawn', 'recorded')),
  constraint request_log_details_object check (jsonb_typeof(details) = 'object'),
  constraint request_log_details_version_check check (details_version >= 1),
  constraint request_log_before_snapshot_object
    check (before_snapshot is null or jsonb_typeof(before_snapshot) = 'object'),
  constraint request_log_approved_details_object
    check (approved_details is null or jsonb_typeof(approved_details) = 'object'),
  constraint request_log_outcome_object check (outcome is null or jsonb_typeof(outcome) = 'object'),
  constraint request_log_decided_at_iff_closed check ((status = 'pending') = (decided_at is null)),
  constraint request_log_decided_after_created check (decided_at is null or decided_at >= created_at),
  constraint request_log_recorded_at_birth check (status <> 'recorded' or decided_at = created_at),
  constraint request_log_decided_by_iff_admin_decision
    check ((status in ('approved', 'rejected')) = (decided_by is not null)),
  constraint request_log_rejection_has_note
    check (status <> 'rejected' or (decision_note is not null and btrim(decision_note) <> '')),
  constraint request_log_approval_fields_only_when_approved
    check (status = 'approved' or (approved_details is null and outcome is null))
);

comment on table public.request_log is
  'Review requests and the permanent audit log. Never deleted; decided requests never change (trigger request_log_guard). details: as submitted, in business terms per type.';

create index if not exists request_log_pending_queue_idx
  on public.request_log (created_at) where status = 'pending';
create index if not exists request_log_professional_idx
  on public.request_log (professional_id, created_at desc);
create index if not exists request_log_type_status_idx
  on public.request_log (request_type, status, created_at desc);
create index if not exists request_log_decided_by_idx
  on public.request_log (decided_by) where decided_by is not null;

-- Pending limits (one index per limited type).
create unique index if not exists request_log_one_pending_professional_registration_idx
  on public.request_log (professional_id) where status = 'pending' and request_type = 'professional_registration';

-- Tamper-proofing. Allowed: inserting a new pending (or recorded) request; a
-- request function closing a pending request; the professionals ON DELETE SET
-- NULL cascade emptying professional_id. Everything else is refused.
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
    if new.professional_id is null then
      raise exception 'a new request names its professional' using errcode = '23514';
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

  -- UPDATE. The professionals ON DELETE SET NULL cascade: only professional_id empties.
  if old.professional_id is not null and new.professional_id is null
     and (to_jsonb(new) - 'professional_id') = (to_jsonb(old) - 'professional_id') then
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

drop trigger if exists request_log_guard on public.request_log;
create trigger request_log_guard
  before insert or update or delete on public.request_log
  for each row execute function public.request_guard();

drop trigger if exists request_log_guard_truncate on public.request_log;
create trigger request_log_guard_truncate
  before truncate on public.request_log
  for each statement execute function public.request_guard();

-- Only an active founder decides (partners are read-only).
create or replace function public.request_assert_founder(p_admin_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.admin_users
    where id = p_admin_id and is_active and role = 'founder'
  ) then
    raise exception 'only an active founder can decide requests' using errcode = '42501';
  end if;
end
$$;

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

  select name, email into v_name, v_email from public.professionals where id = p_professional_id;
  if not found then
    raise exception 'professional % not found', p_professional_id using errcode = 'P0002';
  end if;

  if v_type.is_edit then
    -- Each edit type captures the live values it changes here (its "before"),
    -- added with the type, e.g. if p_request_type = 'clinic_edit' then ... end if;
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

create or replace function public.request_approve(
  p_request_id uuid,
  p_admin_id uuid,
  p_corrected_details jsonb default null,
  p_note text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_req public.request_log%rowtype;
  v_details jsonb;
  v_outcome jsonb;
begin
  if p_corrected_details is not null and jsonb_typeof(p_corrected_details) <> 'object' then
    raise exception 'corrected details must be a JSON object' using errcode = '22023';
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
  -- Each type's approval step goes here, added with the type: for edit types,
  -- stop with a conflict if the live values no longer match before_snapshot;
  -- then apply v_details and set v_outcome, e.g.
  --   if v_req.request_type = 'professional_registration' then v_outcome := ...; end if;
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
      outcome = v_outcome
  where id = p_request_id;
  perform set_config('doccy.request_decision', '', true);
  return p_request_id;
end
$$;

create or replace function public.request_reject(p_request_id uuid, p_admin_id uuid, p_note text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_req public.request_log%rowtype;
begin
  select * into v_req from public.request_log where id = p_request_id for update;
  if not found then
    raise exception 'request % not found', p_request_id using errcode = 'P0002';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'request % is already %', p_request_id, v_req.status using errcode = '55000';
  end if;
  perform public.request_assert_founder(p_admin_id);
  if p_note is null or btrim(p_note) = '' then
    raise exception 'a rejection needs a reason (it is emailed to the professional)' using errcode = '22023';
  end if;

  perform set_config('doccy.request_decision', p_request_id::text, true);
  update public.request_log
  set status = 'rejected', decided_at = now(), decided_by = p_admin_id, decision_note = btrim(p_note)
  where id = p_request_id;
  perform set_config('doccy.request_decision', '', true);
  return p_request_id;
end
$$;

create or replace function public.request_withdraw(p_request_id uuid, p_professional_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_req public.request_log%rowtype;
begin
  select * into v_req from public.request_log where id = p_request_id for update;
  if not found then
    raise exception 'request % not found', p_request_id using errcode = 'P0002';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'request % is already %', p_request_id, v_req.status using errcode = '55000';
  end if;
  if p_professional_id is null or v_req.professional_id is distinct from p_professional_id then
    raise exception 'only the professional who made the request can withdraw it' using errcode = '42501';
  end if;

  perform set_config('doccy.request_decision', p_request_id::text, true);
  update public.request_log set status = 'withdrawn', decided_at = now() where id = p_request_id;
  perform set_config('doccy.request_decision', '', true);
  return p_request_id;
end
$$;

-- Access: service role only.
alter table public.request_types enable row level security;
alter table public.request_log enable row level security;

revoke all on table public.request_types from public, anon, authenticated, service_role;
grant select on table public.request_types to service_role;
revoke all on table public.request_log from public, anon, authenticated, service_role;
grant select, insert, update on table public.request_log to service_role;

revoke all on function public.request_guard() from public, anon, authenticated;
revoke all on function public.request_assert_founder(uuid) from public, anon, authenticated;
revoke all on function public.request_submit(text, uuid, jsonb, smallint) from public, anon, authenticated;
revoke all on function public.request_approve(uuid, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.request_reject(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.request_withdraw(uuid, uuid) from public, anon, authenticated;
grant execute on function public.request_assert_founder(uuid) to service_role;
grant execute on function public.request_submit(text, uuid, jsonb, smallint) to service_role;
grant execute on function public.request_approve(uuid, uuid, jsonb, text) to service_role;
grant execute on function public.request_reject(uuid, uuid, text) to service_role;
grant execute on function public.request_withdraw(uuid, uuid) to service_role;

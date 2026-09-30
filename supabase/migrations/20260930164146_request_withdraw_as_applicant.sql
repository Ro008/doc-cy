-- An applicant withdraws their own pending request (request follow-up 1).
--
-- request_withdraw matches professional_id, but a professional_registration has
-- no professional until it is approved: it is linked to the applicant's login
-- (request_log.applicant_auth_user_id). request_withdraw_as_applicant closes a
-- pending request only when it belongs to that login. The Founders' Club place
-- is released on its own (founders_club_places_taken counts pending requests).
--
-- Backward-compatible (a new function). Idempotent. Service role only.

create or replace function public.request_withdraw_as_applicant(p_request_id uuid, p_auth_user_id uuid)
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
  if p_auth_user_id is null or v_req.applicant_auth_user_id is distinct from p_auth_user_id then
    raise exception 'only the applicant who made the request can withdraw it' using errcode = '42501';
  end if;

  perform set_config('doccy.request_decision', p_request_id::text, true);
  update public.request_log set status = 'withdrawn', decided_at = now() where id = p_request_id;
  perform set_config('doccy.request_decision', '', true);
  return p_request_id;
end
$$;

comment on function public.request_withdraw_as_applicant(uuid, uuid) is
  'An applicant closes their own pending request (matched on applicant_auth_user_id). Service role only: the server checks the signed-in login first.';

revoke all on function public.request_withdraw_as_applicant(uuid, uuid) from public, anon, authenticated;
grant execute on function public.request_withdraw_as_applicant(uuid, uuid) to service_role;

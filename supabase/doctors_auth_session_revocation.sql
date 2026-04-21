-- Enables deterministic "sign out on other devices" enforcement in middleware.
-- Keeps the current session id while revoking any sessions issued before this timestamp.

alter table public.doctors
  add column if not exists auth_session_revoked_after timestamptz null,
  add column if not exists auth_keep_session_id uuid null;

comment on column public.doctors.auth_session_revoked_after is
  'Sessions with JWT iat older than this are considered revoked.';

comment on column public.doctors.auth_keep_session_id is
  'Session id allowed to stay active after revoke-other-sessions action.';


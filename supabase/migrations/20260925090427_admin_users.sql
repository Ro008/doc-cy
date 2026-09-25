-- Individual admin accounts (registration redesign, step 1).
-- One row per admin: a Supabase login with a role. Admins are deactivated
-- (is_active = false), not deleted, so past decisions keep a name. The login
-- can't be deleted while the row exists (ON DELETE RESTRICT).
-- Service role only: RLS on with no policies, and no grants to anon/authenticated.

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users (id) on delete restrict,
  name text not null,
  email text not null,
  role text not null default 'founder',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint admin_users_auth_user_id_key unique (auth_user_id),
  constraint admin_users_name_not_blank check (btrim(name) <> ''),
  constraint admin_users_email_format check (email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  constraint admin_users_role_check check (role in ('founder', 'partner'))
);

create unique index if not exists admin_users_email_lower_key
  on public.admin_users (lower(email));

comment on table public.admin_users is
  'DocCy admins (internal directory / CRM). Service role only. Deactivate with is_active = false; do not delete.';

alter table public.admin_users enable row level security;

revoke all on table public.admin_users from public, anon, authenticated;
grant all on table public.admin_users to service_role;

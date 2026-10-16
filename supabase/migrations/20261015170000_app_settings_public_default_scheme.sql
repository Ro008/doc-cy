-- The public site's default Light / Dark mode (user, 2026-10-15).
--
-- A visitor who has not picked Light or Dark (cookie doccy_scheme) sees the public site
-- (Finder, Clinics, profiles) in this mode. Founders change it in the internal
-- dashboard. A JSON string, "light" or "dark"; starts as "light".
--
-- Backward-compatible (adds a row and a check). Idempotent.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'app_settings_public_default_scheme_valid'
      and conrelid = 'public.app_settings'::regclass
  ) then
    alter table public.app_settings
      add constraint app_settings_public_default_scheme_valid check (
        key <> 'public_default_scheme'
        or value in ('"light"'::jsonb, '"dark"'::jsonb)
      );
  end if;
end
$$;

insert into public.app_settings (key, value, description)
values (
  'public_default_scheme',
  '"light"',
  'Light or dark: how the public site (Finder, Clinics, profiles) opens for a visitor who has not picked one.'
)
on conflict (key) do nothing;

comment on table public.app_settings is
  'Settings founders change in the internal dashboard (service role only). trial_months: free-trial length in whole months for new professionals. public_default_scheme: "light" or "dark", the public site''s mode for visitors who have not picked one.';

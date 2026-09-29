-- The professional's emailed sign-in step, enforced by the database (user, 2026-09-29).
--
-- She signs in with her password, then with the link or code emailed to her.
-- Supabase marks a session made from the link or code (and from a password reset)
-- with an `amr` entry {"method":"otp","timestamp":…}. A session counts for 30 days
-- from that mark; a password alone never does. Without this, a stolen password used
-- straight against Supabase's API (the anon key is public) would read and change her
-- appointments, settings, clinics, services and profile under the existing rules.
--
-- Changed (definitions read from both projects first, identical):
-- * new professional_session_email_step_verified(): reads only the caller's own token;
-- * is_doctor_owner(): also requires it (appointments, doctor_locations and
--   professional_settings rules use it);
-- * professionals_update_own and the three doctor_services owner rules: also require it.
-- Unchanged on purpose: reading her own professionals / professional_specialties /
-- specialty-change rows (the site tells professionals from applicants with them),
-- and every public read. The service role bypasses these rules as before.
--
-- Not backward-compatible for live sessions: a password-only session loses access.
-- Production: apply AFTER the new sign-in is live (merge first).

create or replace function public.professional_session_email_step_verified()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (
      select bool_or(
        entry ->> 'method' = 'otp'
        and (entry ->> 'timestamp') ~ '^[0-9]+(\.[0-9]+)?$'
        and to_timestamp((entry ->> 'timestamp')::numeric) >= now() - interval '30 days'
        and to_timestamp((entry ->> 'timestamp')::numeric) <= now() + interval '5 minutes'
      )
      from jsonb_array_elements(
        case
          when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr'
          else '[]'::jsonb
        end
      ) as entry
    ),
    false
  );
$$;

comment on function public.professional_session_email_step_verified() is
  'True when the caller''s session used the emailed sign-in link or code (amr "otp") in the last 30 days. Used by the professional-owner rules.';

revoke all on function public.professional_session_email_step_verified() from public;
-- The rules run as the caller: signed-in users need it, and anon too (doctor_services
-- owner rules apply to every role; for anon it simply answers false).
grant execute on function public.professional_session_email_step_verified() to anon, authenticated, service_role;

create or replace function public.is_doctor_owner(p_doctor_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.professionals p
    WHERE p.id = p_doctor_id
      AND p.is_registered = true
      AND p.auth_user_id IS NOT NULL
      AND p.auth_user_id = auth.uid()
  )
  AND public.professional_session_email_step_verified();
$function$;

do $rules$
declare
  v_owner constant text :=
    '(EXISTS ( SELECT 1 FROM public.professionals p WHERE ((p.id = doctor_services.doctor_id) '
    'AND (p.is_registered = true) AND (p.auth_user_id = ( SELECT auth.uid() AS uid))))) '
    'AND ( SELECT public.professional_session_email_step_verified() AS verified)';
  v_self constant text :=
    '(( SELECT auth.uid() AS uid) = auth_user_id) '
    'AND ( SELECT public.professional_session_email_step_verified() AS verified)';
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'professionals'
             and policyname = 'professionals_update_own') then
    execute format('alter policy professionals_update_own on public.professionals using (%s) with check (%s)',
                   v_self, v_self);
  end if;

  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'doctor_services'
             and policyname = 'doctor_services_owner_insert') then
    execute format('alter policy doctor_services_owner_insert on public.doctor_services with check (%s)', v_owner);
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'doctor_services'
             and policyname = 'doctor_services_owner_update') then
    execute format('alter policy doctor_services_owner_update on public.doctor_services using (%s) with check (%s)',
                   v_owner, v_owner);
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'doctor_services'
             and policyname = 'doctor_services_owner_delete') then
    execute format('alter policy doctor_services_owner_delete on public.doctor_services using (%s)', v_owner);
  end if;
end
$rules$;

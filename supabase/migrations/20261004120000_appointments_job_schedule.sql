-- Appointments job schedule (user, 2026-10-04).
-- Every 15 minutes pg_cron calls POST /api/cron/appointments through pg_net
-- (lib/appointments-job.ts: expire unanswered requests and lapsed proposals, reminders,
-- attendance, review emails, draft purge).
--
-- The target URL and the CRON_SECRET live in Vault, read at run time:
--   appointments_job_url     e.g. https://doc-cy.vercel.app/api/cron/appointments
--   appointments_job_secret  the Vercel CRON_SECRET
-- Without both secrets the job does nothing. Testing never gets them (its specs call the
-- endpoint directly); Production gets them once, by hand, with vault.create_secret.
-- Re-running is safe: cron.schedule with an existing name replaces the job.

create extension if not exists pg_cron;
-- Its functions live in the net schema either way; the extension record goes in extensions.
create extension if not exists pg_net with schema extensions;

-- pg_net's grants on schema net belong to supabase_admin (postgres can't revoke them); the
-- API only exposes public and graphql_public, so anon / authenticated can't reach
-- net.http_post (checked 2026-10-04: PGRST106 for Accept-Profile: net). The cron schema
-- isn't usable by them at all.

select cron.schedule(
  'appointments-job',
  '*/15 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'appointments_job_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'appointments_job_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'appointments_job_url')
    and exists (select 1 from vault.decrypted_secrets where name = 'appointments_job_secret');
  $job$
);

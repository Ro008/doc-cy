# CI Test Policy (simple and reliable)

Goal: keep PR merge safety high and nightly noise low.

## 3 lanes

### 1) PR blocking (must pass to merge)

Purpose: catch code regressions before merge.

Rules:
- only stable tests
- no optional notifications
- deterministic environment (`integration` or Preview)
- should finish fast enough for normal PR flow

Current source of truth:
- `.github/workflows/pr-integration.yml`

**Removed from PR blocking (2026-05):** responsive authenticated navigation specs previously exercised `UserBar` + marketing footer surfaces. They were removed entirely from the repo because they repeatedly failed with Supabase `AuthApiError: Database error querying schema` (infra flake), not product bugs. See **Reintroduction criteria** below.

### 2) Nightly blocking (must pass every night)

Purpose: detect real production-impacting issues that PR cannot fully simulate.

Rules:
- include only truly business-critical checks
- prefer serial execution and explicit env validation
- fail only on product/test failures, not on side channels

Current source of truth:
- `.github/workflows/prod-critical-smoke.yml`
  - `prod-critical-smoke`
  - `business-critical-integration`

### 3) Nightly monitoring (non-blocking)

Purpose: keep visibility on flaky/volatile surfaces without waking up maintainers every morning.

Rules:
- failures create signal (artifact/issue/warning), not red pipeline
- keep this lane for UI volatility, third-party instability, and notifications
- promote tests to blocking only after sustained stability

Current examples:
- doctor UI monitor step in `prod-critical-smoke`
- WhatsApp notification delivery in `notify-whatsapp` (see **Nightly WhatsApp notification** below)
- Login form UI monitor:
  - `tests/prod/prod_doctor_password_login_form_ui_monitor.spec.ts`
  - kept non-blocking by policy until sustained stability in CI

## Login test strategy (authoritative)

Use two complementary layers:

1. **Blocking auth-dependent product flows**  
   - Prefer deterministic session helpers where they are stable against your Supabase project.
   - **Do not** block PR merges on flows that depend on `signInWithPassword` when that endpoint intermittently returns schema errors from Supabase Auth.

2. **Non-blocking login form monitor**  
   - Keep at least one pure UI login form test in nightly monitoring.
   - Purpose: detect real login-form regressions without making blocking lanes brittle.

Current implementation:
- Session-based prod checks:
  - `tests/prod/prod_doctor_password_login_smoke.spec.ts`
  - `tests/prod/prod_doctor_password_login_ui_monitor.spec.ts`
  - helper: `tests/prod/helpers/doctorSession.ts`
- Pure UI login monitor:
  - `tests/prod/prod_doctor_password_login_form_ui_monitor.spec.ts`

## Reintroduction criteria (UserBar / footer navigation)

Before adding PR-blocking tests that require programmatic Supabase password login again:

1. Document **10 consecutive green** runs on a dedicated workflow (or scheduled job) using the same integration Supabase + secrets as PR.
2. Confirm failures are **product regressions**, not `Database error querying schema` or similar Auth API infra errors.
3. Prefer **one** consolidated smoke per surface (e.g. signed-out chrome only, or session seeded without hitting flaky Auth endpoints).

Inventory of critical flows vs tests: [`docs/critical-flow-test-coverage.md`](critical-flow-test-coverage.md).

## Promotion / demotion rule

Move tests between lanes based on data:
- promote to blocking after at least 10 consecutive green runs
- demote to monitoring after 2 failures in 7 days without confirmed product bug

## Nightly WhatsApp notification (`notify-whatsapp`)

Workflow: `.github/workflows/prod-critical-smoke.yml` → job `notify-whatsapp` (after `prod-critical-smoke` and `business-critical-integration`). Secret: `WHATSAPP_WEBHOOK_URL` (see `docs/github-secrets-governance.md`).

Schedule: two UTC crons plus `schedule-gate` so the heavy jobs (and WhatsApp) run once for the **06:00 Europe/Nicosia** slot. The gate keys off the cron entry that fired, not the runner start time, because GitHub may start scheduled workflows hours late.

### 2026-05-12 — Silent failures (fixed in workflow)

**Symptom:** WhatsApp messages stopped arriving for several days, with no GitHub issue opened for delivery failure.

**Root cause:** The step `Send WhatsApp monitoring status (retries)` used `continue-on-error: true`. In GitHub Actions, a failed step with that flag still reports `steps.<id>.outcome == success`; only `conclusion` is `failure`. Follow-up steps used `if: steps.whatsapp.outcome != 'success'`, which is **never true** on that failure path, so **no issue was created** and the failure was easy to miss.

**Change applied:** Those conditions were updated to `steps.whatsapp.conclusion == 'failure'` (with an inline comment in the YAML). After deploy, repeated webhook failures should open issues titled `[prod-monitoring] WhatsApp notification failed (run …)`.

### If delivery still fails after the above (checklist)

Already ruled out: wrong `if` on follow-up steps (outcome vs conclusion). Next checks:

1. **Actions UI** — workflow *Production Monitoring*, job `notify-whatsapp`, step *Send WhatsApp monitoring status*: read `curl` stderr (timeouts, HTTP errors, empty `WHATSAPP_WEBHOOK_URL`).
2. **Repository secret** — name must be `WHATSAPP_WEBHOOK_URL` (canonical list in `docs/github-secrets-governance.md`).
3. **Scheduled workflows disabled** — GitHub can pause schedules on inactive repos; re-enable under Actions → *Production Monitoring* → … menu.
4. **Webhook provider** — e.g. CallMeBot limits, expired API key, or URL format; workflow strips duplicate `text=` query params before sending (see script comments in YAML).
5. **Gate** — scheduled runs are not guaranteed to start on the minute. The gate compares `github.event.schedule` with the UTC cron that maps to **06:00 Nicosia** for the current Cyprus offset (`03 UTC` during EEST, `04 UTC` during EET), so a delayed intended cron still runs tests and WhatsApp while the duplicate DST helper cron skips. See `schedule-gate` in `.github/workflows/prod-critical-smoke.yml` and the job summary on each run (`should_run`, event schedule, expected schedule, offset).

## Incident triage (quick)

When nightly fails, classify first:
1. **Product regression** -> keep blocking, fix code.
2. **Env/infra/third-party** -> keep blocking only if user-facing impact is high.
3. **Flaky test** -> move to monitoring, stabilize, then re-promote.

## Change discipline

Any CI lane change must update:
- this file (`docs/ci-test-policy.md`)
- the corresponding workflow file

This keeps expectations explicit and avoids policy drift.

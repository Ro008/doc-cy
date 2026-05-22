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

**Support → Formspree (PR):** `tests/feedback_support_modal.spec.ts` — UI + success when POST is stubbed (build uses `NEXT_PUBLIC_FORMSPREE_ID=e2e_placeholder`). Real Formspree delivery is **local-only**: `tests/feedback_support_live_formspree.spec.ts`.

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

Workflow: `.github/workflows/prod-critical-smoke.yml` → job `notify-whatsapp` → `node scripts/send-whatsapp-monitoring.mjs`. Shared sender: `lib/whatsapp-webhook.mjs` (also used for founder signup alerts in `lib/notify-founder-new-registration.ts`). Secret: `WHATSAPP_WEBHOOK_URL` (see `docs/github-secrets-governance.md`).

Schedule: one UTC cron (`30 3 * * *`) plus `schedule-gate` so jobs run when **Europe/Nicosia** local time is **05:00–13:59**. GitHub often starts scheduled workflows hours late; a narrow 06:00-only gate previously skipped smoke and WhatsApp for weeks while the workflow still showed green.

Delivery failures use `steps.whatsapp.conclusion == 'failure'` to open a GitHub issue (the send step uses `continue-on-error: true`, so check `conclusion`, not `outcome`).

### Local / manual test

```bash
WHATSAPP_WEBHOOK_URL="https://…" npm run whatsapp:test -- "Hello from DocCy"
```

Or workflow dispatch → *Send only WhatsApp notification*.

### If delivery fails (checklist)

1. **Job log** — each attempt logs GET / POST JSON / POST form results from `lib/whatsapp-webhook.mjs`.
2. **Secret** — `WHATSAPP_WEBHOOK_URL` must be the provider URL **without** a baked-in `text=` placeholder (we set `text` on send).
3. **Provider** — CallMeBot (or similar): API key active, phone linked, not rate-limited.
4. **Scheduled workflows** — re-enable if GitHub paused them on an inactive repo.
5. **Gate** — see `schedule-gate` in the workflow; only runs in the intended Nicosia morning window.

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

# CI Test Policy (two lanes)

Goal: **one blocking suite on every PR** (integration) and **one small scheduled suite on production** (nightly). No duplicate integration jobs on the nightly workflow.

## The two CI lanes

| Lane | Workflow | When | App target | Supabase |
|------|----------|------|------------|----------|
| **PR** | `.github/workflows/pr-integration.yml` | Every pull request | `build` + `start` on `127.0.0.1:3000` | `INTEGRATION_*` secrets |
| **Nightly** | `.github/workflows/prod-critical-smoke.yml` | Cron + manual dispatch | `PLAYWRIGHT_BASE_URL_PROD` (mydoccy.com) | `PROD_*` secrets |

**Local** (`npm run test:e2e`, `test:prod:smoke:local`, etc.) is for development only — not a third CI lane.

### Folder conventions (same Playwright runner)

| Path | Typical use in CI |
|------|-------------------|
| `tests/` | PR lane |
| `tests/integration/` | PR lane (DB + `INTEGRATION_SAFE_ENV`) |
| `tests/prod/` | Nightly lane (real prod URL); `prod_site_availability` also runs on Vercel Preview in PR |
Build flag for integration finder tests: `NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES=1` on PR build only (see `pr-integration.yml`).

After the `@pr-e2e` suite, PR CI always runs `scripts/cleanup-test-doctors.mjs --assert-empty` so interrupted finder tests cannot leave `Finder Filter …` / `Finder UX …` orphans in the shared testing DB (see `docs/test-env-boundaries.md`).

### Playwright tags (source of truth for CI lists)

| Tag | Workflow command | Purpose |
|-----|------------------|---------|
| `@pr-email` | `playwright test --grep @pr-email` | Onboarding + reschedule / agenda email guards (PR + nightly prod env) |
| `@pr-e2e` | `playwright test --grep @pr-e2e` | Main PR integration suite |
| `@pr-preview` | `playwright test --grep @pr-preview` | Public shell on Vercel Preview |
| `@pr-mobile-monitor` | `playwright test --grep @pr-mobile-monitor` | Doctor confirmation flow on mobile (PR, non-blocking) |
| `@pr-login-monitor` | `playwright test --grep @pr-login-monitor` | Doctor `/login` form UI (PR, non-blocking) |
| `@nightly-prod` | `playwright test --grep @nightly-prod` | Prod URL blocking smokes (site + booking + registration + verify) |

Constants: `tests/helpers/ciTags.ts`. To tag new specs: `node scripts/apply-ci-playwright-tags.mjs` (edit file lists first).

---

## 1) PR blocking (must pass to merge)

**Jobs:** `PR Playwright (core business)` + `PR Preview site health (Vercel)` (same-repo PRs only).

**Includes:**

- Content: `test:content:blog-images`, `test:content:messages-parity`
- Unit: `npm run test:unit` (`lib/finder-distance`, `lib/finder-specialty-filter`, `lib/clinic-location`, `lib/register-clinic-location`)
- `--grep @pr-email` then `--grep @pr-e2e` (see tag table below)
- Preview job: `--grep @pr-preview`
- Non-blocking mobile: `--grep @pr-mobile-monitor`
- Non-blocking login form: `--grep @pr-login-monitor`

**Excludes from PR:**

- Live prod registration/booking writes (nightly only)
- `tests/feedback_support_live_formspree.spec.ts` (local only)
- `tests/register_onboarding_avatar.spec.ts` (omitted: Auth email rate limits on shared integration)

**Optional PR follow-up:** add `tests/integration/directory_duplicates_actions.integration.spec.ts` if `INTERNAL_DIRECTORY_SECRET` is set (already in PR list when secret present).

---

## 2) Nightly blocking (production)

**Job:** `prod-critical-smoke` in `prod-critical-smoke.yml`.

**Blocking steps:**

1. `--grep @pr-email` (prod Supabase env)
2. `--grep @nightly-prod` (site availability + guest booking + live registration + verify)

**Does not run on nightly (PR only):**

- `finder_critical`, `navigation`, `settings_clinic_address_notice`, `directory_duplicates_actions`, and the rest of the PR Playwright list

---

**WhatsApp:** job `notify-whatsapp` — informational; delivery failure opens an issue but does not change test status.

---

## Login test strategy

1. **PR blocking:** programmatic `signInDoctorAndSetCookies` / `signInDoctorOrSkipOnInfraError` where the form is not under test.
2. **PR monitor (non-blocking):** `doctor_password_login_form.spec.ts` (`@pr-login-monitor`) — `/login` form with hydration-safe helper + auth pre-check.
3. **Nightly blocking:** no doctor login in blocking suite (booking + public shell + registration only).

---

## Reintroduction criteria (UserBar / footer navigation)

Before adding PR-blocking tests that require programmatic Supabase password login again:

1. Document **10 consecutive green** runs on PR integration with the same secrets.
2. Confirm failures are product regressions, not `Database error querying schema` from Auth.
3. Prefer one consolidated smoke per surface.

Inventory: [`docs/critical-flow-test-coverage.md`](critical-flow-test-coverage.md).

---

## Optional UI fields (PR tests, Pareto rule)

When a **PR-blocking** flow labels a field **optional** in the UI, at least one test in that flow must submit it **empty**.

Current example: `tests/manual_booking_flow.spec.ts`.

---

## Promotion / demotion rule

- Promote `@pr-login-monitor` → blocking `@pr-e2e` after **10 consecutive green** PR monitor runs without integration Auth infra failures.
- Demote blocking → monitor after **2 failures in 7 days** without confirmed product bug.

---

## Nightly WhatsApp notification

Workflow: `prod-critical-smoke.yml` → `notify-whatsapp` → `scripts/send-whatsapp-monitoring.mjs`. Secret: `WHATSAPP_WEBHOOK_URL`.

Schedule: cron `30 3 * * *` UTC + `schedule-gate` (Nicosia 05:00–13:59).

### Local / manual test

```bash
WHATSAPP_WEBHOOK_URL="https://…" npm run whatsapp:test -- "Hello from DocCy"
```

Or workflow dispatch → *Send only WhatsApp notification*.

---

## Incident triage (quick)

When nightly fails:

1. **Product regression** → fix code or prod smoke doctor config (`TEST_BOOKING_DOCTOR_SLUG`, schedule).
2. **Env/secret** → verify `PROD_*`, `TEST_DOCTOR_*`, `PLAYWRIGHT_BASE_URL_PROD`.
3. **Login form failure on PR** → check hydration/login UI; integration `TEST_USER_*` secrets.

When PR fails: integration env / test data — not prod calendar.

---

## Change discipline

Any CI lane change must update:

- this file (`docs/ci-test-policy.md`)
- the corresponding workflow file

**Removed (2026-05):** nightly job `business-critical-integration` — those specs run only on PR.

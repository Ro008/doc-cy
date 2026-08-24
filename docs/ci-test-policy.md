# CI Test Policy (two lanes)

Goal: **one blocking suite on every PR** (integration) and **one small scheduled suite on production** (nightly). No duplicate integration jobs on the nightly workflow.

## The two CI lanes

| Lane | Workflow | When | App target | Supabase |
|------|----------|------|------------|----------|
| **PR** | `.github/workflows/pr-integration.yml` | Every pull request | `build` + `start` on `127.0.0.1:3000` | `INTEGRATION_*` secrets |
| **Nightly** | `.github/workflows/prod-critical-smoke.yml` | Cron + manual dispatch | Edge: `PLAYWRIGHT_BASE_URL_PROD` (mydoccy.com). Origin: `PLAYWRIGHT_BASE_URL_VERCEL_PROD` (`*.vercel.app`) | `PROD_*` secrets |

**Local** (`npm run test:e2e`, `test:prod:smoke:local`, etc.) is for development only — not a third CI lane.

### Folder conventions (same Playwright runner)

| Path | Typical use in CI |
|------|-------------------|
| `tests/` | PR lane |
| `tests/integration/` | PR lane (DB + `INTEGRATION_SAFE_ENV`) |
| `tests/prod/` | Nightly lane (real prod URL); `prod_site_availability` also runs on Vercel Preview in PR |
Build flag for integration finder tests: `NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES=1` on PR build only (see `pr-integration.yml`).

After the Playwright lanes, PR CI always runs `scripts/cleanup-test-doctors.mjs --assert-empty` so interrupted finder tests cannot leave `Finder Filter …` / `Finder UX …` orphans in the shared testing DB (see `docs/test-env-boundaries.md`).

### Playwright tags (source of truth for CI lists)

| Tag | Workflow command | Purpose |
|-----|------------------|---------|
| `@pr-email` | `playwright test --grep @pr-email` | Onboarding + reschedule / agenda email guards (PR + nightly prod env) |
| `@pr-e2e` | Main PR suite (split across two jobs) | Base tag for PR integration specs |
| `@pr-e2e-finder` | `playwright test --grep @pr-e2e-finder` | Finder / navigation slice (parallel job; also tagged `@pr-e2e`) |
| `@pr-preview` | `playwright test --grep @pr-preview` | Public shell on Vercel Preview |
| `@pr-mobile-monitor` | `playwright test --grep @pr-mobile-monitor` | Doctor confirmation flow on mobile (PR, non-blocking) |
| `@pr-login-monitor` | `playwright test --grep @pr-login-monitor` | Doctor `/login` form UI (PR, non-blocking) |
| `@nightly-prod` | `playwright test --grep @nightly-prod` | Prod URL blocking smokes (site + booking + registration + verify) |

Constants: `tests/helpers/ciTags.ts`. To tag new specs: `node scripts/apply-ci-playwright-tags.mjs` (edit file lists first).

---

## 1) PR blocking (must pass to merge)

**Jobs:**

| Check name | What it runs |
|------------|--------------|
| `PR build + unit` | Content checks, unit tests, Next.js build (uploads `.next`) |
| `PR Playwright · core` | `@pr-email` + `@pr-e2e` excluding `@pr-e2e-finder` (reuses build artifact) |
| `PR Playwright · finder` | `@pr-e2e-finder` (reuses build artifact) |
| `PR Playwright (core business)` | Gate: both Playwright lanes + orphan-doctor cleanup must succeed (keeps the historical required-check name) |
| `PR Preview site health (Vercel)` | `@pr-preview` against the Vercel Preview URL (same-repo PRs only) |
| `Production DB push` | Informational (always green): sticky PR comment if `supabase/migrations/` changed vs base — **not** a required check |

**Includes:**

- Content: `test:content:blog-images`, `test:content:messages-parity`
- Unit: `npm run test:unit`
- Core lane: `--grep @pr-email` then `--grep @pr-e2e --grep-invert @pr-e2e-finder`
- Finder lane: `--grep @pr-e2e-finder` (today: `finder_critical`, `finder_user_behaviors`, `navigation`)
- Preview job: `--grep @pr-preview`
- Non-blocking mobile: `--grep @pr-mobile-monitor` (on core lane)
- Non-blocking login form: `--grep @pr-login-monitor` (on core lane)

**Excludes from PR:**

- Live prod registration/booking writes (nightly only)
- `tests/feedback_support_live_formspree.spec.ts` (local only)
- `tests/register_onboarding_avatar.spec.ts` (omitted: Auth email rate limits on shared integration)

**Optional PR follow-up:** add `tests/integration/directory_duplicates_actions.integration.spec.ts` if `INTERNAL_DIRECTORY_SECRET` is set (already in PR list when secret present).

**Retry tip:** re-run only `PR Playwright · finder` or `PR Playwright · core` from the Actions UI when a single lane fails — the shared build artifact is reused within the same workflow run; a fresh push rebuilds once for both.

---

## 2) Nightly blocking (production)

**Jobs** in `prod-critical-smoke.yml`:

| Job | What it runs | Blocking? |
|-----|----------------|-----------|
| `prod-email-guards` | `--grep @pr-email` (prod Supabase env) | Yes |
| `prod-smoke-edge` | Matrix `site` / `booking` / `registration` against mydoccy.com (Cloudflare) | Yes if origin secret unset; diagnostic (`continue-on-error`) if origin secret is set |
| `prod-smoke-origin` | Same matrix against `PLAYWRIGHT_BASE_URL_VERCEL_PROD` (`*.vercel.app`) | Yes, when the secret is set; skipped otherwise |
| `prod-nightly-gate` | Interprets email + edge + origin results | Yes (workflow red on email fail, origin fail, or edge fail with origin skipped) |

Edge and origin share the same prod doctor slot, so origin **starts after all edge matrix legs finish**. Do not run both live-write suites in parallel. `fail-fast: false` so a registration flake still records site and booking results.

Set `PLAYWRIGHT_BASE_URL_VERCEL_PROD` to the **production** `*.vercel.app` URL (not a preview). If Vercel Deployment Protection is on, also set `VERCEL_AUTOMATION_BYPASS_SECRET`.

**Origin registration and Google Places:** the Maps JS key HTTP referrer is the canonical domain (`mydoccy.com`), so Places suggestions often fail on `*.vercel.app` even when `/register` is healthy. Origin smoke still fills the form and probes Places. If the miss is that known referrer split (`REQUEST_DENIED`, Maps not loaded, or empty predictions), it asserts clinic-required validation and **does not** fail. Quota errors, Places `OK` with predictions but no dropdown, and the same miss on `mydoccy.com` still fail. Do not add `*.vercel.app` to the Maps key, and do not skip the registration spec, just to green origin.

**Does not run on nightly (PR only):**

- `finder_critical`, `navigation`, `settings_clinic_address_notice`, `directory_duplicates_actions`, and the rest of the PR Playwright list

GitHub emails on failed workflow runs if you watch the repository. There is no WhatsApp nightly ping.

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

## Incident triage (quick)

When nightly fails:

1. **Product regression** → fix code or prod smoke doctor config (`TEST_BOOKING_DOCTOR_SLUG`, schedule).
2. **Env/secret** → verify `PROD_*`, `TEST_DOCTOR_*`, `PLAYWRIGHT_BASE_URL_PROD`, and `PLAYWRIGHT_BASE_URL_VERCEL_PROD` if using the origin lane.
3. **Login form failure on PR** → check hydration/login UI; integration `TEST_USER_*` secrets.
4. **Cloudflare** → a real interstitial has title `Just a moment...`. Proxied pages also include `/cdn-cgi/challenge-platform` scripts; that alone is not a block. Bot Fight Mode cannot be skipped with WAF Skip rules and **must stay on** (anti-scraping P1, 2026-08-09). Nightly smokes wait briefly for the JS challenge to clear and must **not** send `x-doccy-suppress-traffic-log` on every request (only on `POST /api/traffic/log`). After merge, compare **edge vs origin** using the **How to read this nightly** table in the `prod-nightly-gate` job summary on the Actions run page: edge fail + origin OK is a **warning** (GitHub runner vs Bot Fight), not a product outage — do not turn Bot Fight Mode off. Origin fail means the app/origin. Re-run a single matrix leg (`site`, `booking`, or `registration`) when only one suite failed.

When PR fails: integration env / test data — not prod calendar.

---

## Change discipline

Any CI lane change must update:

- this file (`docs/ci-test-policy.md`)
- the corresponding workflow file

**Removed (2026-05):** nightly job `business-critical-integration` — those specs run only on PR.

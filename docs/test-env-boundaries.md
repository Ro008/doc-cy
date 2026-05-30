# Test env boundaries

Use environment files by test scope:

- `tests/prod/*` -> `.env.local` only
- `tests/integration/*` -> `.env.testing.local`
- local app dev (`npm run dev`) -> `.env.local`

## Why

`tests/prod/*` run against `https://www.mydoccy.com`, so the Supabase credentials must point to the same production project.  
Using `.env.testing.local` with production URL can produce false failures (UI succeeds but DB assertions query the wrong project).

## Test doctors: prod vs integration

| | **Production** (`mydoccy.com`) | **Integration** (testing Supabase) |
|---|-------------------------------|-------------------------------------|
| Finder | Hidden (`is_test_profile` / test email domains) | Visible — set `NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES=1` on the deploy |
| Founding Members counter | **Counts** verified founder test doctors (fewer spots shown) | Same — counts toward urgency display |
| Founder tier at signup | Test rows do **not** consume one of the 100 real founder slots (RPC lock) | Same |

**Prod owner smoke:** any registration email containing `rociosirvent` (e.g. `rociosirvent+anastasiadoctor@gmail.com`) is auto `is_test_profile`. Override markers via server env `DOC_CY_TEST_DOCTOR_EMAIL_MARKERS` (comma-separated, lowercase substrings).

CI smoke may still use `@test-doccy.com.cy` or `@doccy.testing`. Integration seed uses `andreas-nikos`.

**Production persistent test doctor:** `andreas-nikos` with login **`rociosirvent+doccydemo@gmail.com`** (must match Supabase Auth, not only `doctors.email`). GitHub secrets `TEST_DOCTOR_EMAIL`, `TEST_DOCTOR_PASSWORD`, and `TEST_BOOKING_DOCTOR_SLUG=andreas-nikos` — you cannot re-read secrets in GitHub; to change them, **set a new value** (overwrite). Booking smoke uses `/en/andreas-nikos`. Other `is_test_profile` doctors from registration smoke are unrelated.

**Nightly booking smoke (`TEST_BOOKING_DOCTOR_SLUG`):** the doctor must have at least one future bookable day in prod — weekly schedule with enabled weekdays, online bookings not paused, holiday mode off (or outside range), and slots within booking horizon. If nightly fails with “No available booking days”, fix settings in agenda for that slug (not the test suite).

**Repair prod smoke doctors (local):**

```bash
npm run prod:smoke:ensure
DOC_CY_CONFIRM_PROD=YES npm run prod:smoke:ensure:apply
# optional auth recreate when sign-in fails:
DOC_CY_CONFIRM_PROD=YES node scripts/ensure-prod-smoke-doctors.mjs --env-file .env.production.local --apply --repair-auth
```

Requires `TEST_BOOKING_DOCTOR_SLUG`, `TEST_DOCTOR_EMAIL`, `TEST_DOCTOR_PASSWORD` in `.env.production.local` (same values as GitHub secrets).

**Integration local / CI:** add to `.env.testing.local` (and Vercel preview for testing project):

```env
NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES=1
```

PR integration workflow sets this automatically on build + Playwright. The nightly workflow does **not** re-run integration E2E (see `docs/ci-test-policy.md`).

## Canonical commands

- Full production smoke (local):
  - `npm run test:prod:smoke:local`
- Registration flow with video artifact:
  - `npm run test:prod:registration:video:local`
- Integration samples (local isolated env):
  - `npm run test:integration:testing:service-menu`
  - `npm run test:integration:testing:settings-address-notice`

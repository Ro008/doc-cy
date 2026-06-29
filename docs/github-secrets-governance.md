# GitHub Secrets Governance (DocCy)

This file defines the canonical secret naming and cleanup policy for CI workflows.

## 1) Canonical secrets to keep

### Production monitoring

- `PLAYWRIGHT_BASE_URL_PROD`
- `PROD_SITE_URL` (optional but recommended; fallback exists)
- `PROD_NEXT_PUBLIC_SUPABASE_URL`
- `PROD_NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `PROD_SUPABASE_SERVICE_ROLE_KEY`
- `TEST_DOCTOR_EMAIL` — must match **Supabase Auth** for the smoke doctor (e.g. `rociosirvent+doccydemo@gmail.com` for `andreas-nikos`), not an outdated `doctors.email` value
- `TEST_DOCTOR_PASSWORD`
- `TEST_USER_EMAIL` (optional; falls back to doctor credentials)
- `TEST_USER_PASSWORD` (optional; falls back to doctor credentials)
- `TEST_BOOKING_DOCTOR_SLUG`
- `DOC_CY_SUPPRESS_TRAFFIC_LOG_SECRET`
- `WHATSAPP_WEBHOOK_URL`  
  - Nightly delivery and failure triage: [`docs/ci-test-policy.md`](ci-test-policy.md) (section **Nightly WhatsApp notification**).

### Integration CI

- `INTEGRATION_BASE_URL`
- `INTEGRATION_SUPABASE_URL`
- `INTEGRATION_SUPABASE_ANON_KEY`
- `INTEGRATION_SUPABASE_SERVICE_ROLE_KEY`
- `INTEGRATION_TEST_USER_EMAIL`
- `INTEGRATION_TEST_USER_PASSWORD`
- `INTERNAL_DIRECTORY_SECRET` (required for nightly `prod_registration_smoke` verify step; PR integration tests skip without it)

## 2) Temporary compatibility aliases (remove after migration)

The workflows currently accept these legacy aliases to avoid breaking CI during migration:

- `NEXT_PUBLIC_SUPABASE_URL` as fallback for production Supabase URL guard in PR workflow.
- `NEXT_PUBLIC_SITE_URL` as fallback for `PROD_SITE_URL`.
- `TEST_DOCTOR_EMAIL` / `TEST_DOCTOR_PASSWORD` as fallback for `TEST_USER_*` in prod smoke.
- `PLAYWRIGHT_BASE_URL_INTEGRATION` as optional alias for `INTEGRATION_BASE_URL`.

## 3) Secrets currently present but not required by workflows

These do not appear in current GitHub workflows and are good deletion candidates once you confirm no manual dependency:

- `INTEGRATION_SAFE_ENV`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 4) Secrets referenced by workflows but currently missing

At audit time, the following were referenced by workflows and not present as repository secrets:

- `INTERNAL_DIRECTORY_SECRET`
- `NEXT_PUBLIC_SITE_URL` (now optional fallback; prefer `PROD_SITE_URL`)
- `PLAYWRIGHT_BASE_URL_INTEGRATION` (optional alias; `INTEGRATION_BASE_URL` is enough)
- `TEST_USER_EMAIL` (optional)
- `TEST_USER_PASSWORD` (optional)

## 5) Recommended migration order (safe)

1. Create any missing canonical secrets first:
   - `PROD_SITE_URL`
   - `INTERNAL_DIRECTORY_SECRET`
2. Keep existing fallbacks for one full week of green CI runs.
3. Remove legacy/unused secrets in small batches (2-3 at a time), re-run:
   - `PR Integration Tests`
   - `Production Monitoring`
4. After stable period, remove alias usage from workflows and keep canonical names only.

### Nightly workflow secrets (2026-05)

`Production Monitoring` uses **production only** (`PROD_*`, `PLAYWRIGHT_BASE_URL_PROD`, `TEST_*` for smoke doctors). It does **not** run an integration Supabase job anymore.

Optional cleanup after green nightly runs: `INTEGRATION_BASE_URL` and `PLAYWRIGHT_BASE_URL_INTEGRATION` if nothing else references them (PR uses `INTEGRATION_SUPABASE_URL`, not these aliases).

## 6) Updating secrets (GitHub UI hides existing values)

You cannot read a secret after saving it. To fix a wrong value, **create a new secret value** (same name, overwrite). Example with GitHub CLI:

```bash
gh secret set TEST_DOCTOR_EMAIL --body "rociosirvent+doccydemo@gmail.com"
gh secret set TEST_BOOKING_DOCTOR_SLUG --body "andreas-nikos"
# TEST_DOCTOR_PASSWORD: use the password you use to sign in on mydoccy.com for that account
gh secret set TEST_DOCTOR_PASSWORD --body "YOUR_PASSWORD_HERE"
```

Optional: mirror the same three lines in `.env.production.local` for `npm run prod:smoke:ensure` and `npm run test:prod:smoke:local`.

## 7) Operational rules

- One owner for secrets updates (single point of accountability).
- Every new workflow must declare required secrets in comments at top.
- No generic names (`SUPABASE_*`) in CI unless they are environment-scoped.
- Prefer explicit prefixes: `PROD_`, `INTEGRATION_`, `TEST_`.

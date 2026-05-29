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

Register prod smoke doctors with `@test-doccy.com.cy` (auto `is_test_profile`). Integration seed uses `@doccy.testing` / `andreas-nikos`.

**Production persistent test doctor:** normal `/register` → verify in `/internal/directory` → set GitHub secrets `TEST_DOCTOR_EMAIL`, `TEST_DOCTOR_PASSWORD`, `TEST_BOOKING_DOCTOR_SLUG`. Booking uses `/{slug}`; Finder stays clean on prod.

**Integration local / CI:** add to `.env.testing.local` (and Vercel preview for testing project):

```env
NEXT_PUBLIC_DOC_CY_FINDER_INCLUDE_TEST_PROFILES=1
```

PR integration workflow sets this automatically on build + Playwright.

## Canonical commands

- Full production smoke (local):
  - `npm run test:prod:smoke:local`
- Registration flow with video artifact:
  - `npm run test:prod:registration:video:local`
- Integration samples (local isolated env):
  - `npm run test:integration:testing:service-menu`
  - `npm run test:integration:testing:settings-address-notice`

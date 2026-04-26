# Test env boundaries

Use environment files by test scope:

- `tests/prod/*` -> `.env.local` only
- `tests/integration/*` -> `.env.testing.local`
- local app dev (`npm run dev`) -> `.env.local`

## Why

`tests/prod/*` run against `https://www.mydoccy.com`, so the Supabase credentials must point to the same production project.  
Using `.env.testing.local` with production URL can produce false failures (UI succeeds but DB assertions query the wrong project).

## Canonical commands

- Full production smoke (local):
  - `npm run test:prod:smoke:local`
- Registration flow with video artifact:
  - `npm run test:prod:registration:video:local`
- Integration samples (local isolated env):
  - `npm run test:integration:testing:service-menu`
  - `npm run test:integration:testing:settings-address-notice`

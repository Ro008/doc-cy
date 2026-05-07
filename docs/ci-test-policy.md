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
- Includes responsive navigation/footer coverage:
  - `tests/user_bar.spec.ts` (Desktop + Mobile Chrome)
  - `tests/footer_navigation.spec.ts` (Desktop + Mobile Chrome)
- Stability note:
  - For authenticated navigation checks, prefer session-cookie auth helpers over full UI login form.
  - Reason: lower flake risk from browser/form timing while still validating critical post-login UX.

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
- WhatsApp notification delivery in `notify-whatsapp`
- Login form UI monitor:
  - `tests/prod/prod_doctor_password_login_form_ui_monitor.spec.ts`
  - kept non-blocking by policy until sustained stability in CI

## Login test strategy (authoritative)

Use two complementary layers:

1. **Blocking auth-dependent product flows**  
   - Authenticate via deterministic session helpers (Supabase sign-in + injected cookies).
   - Validate business-critical behavior after auth (agenda, user bar, footer visibility, navigation).

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

## Promotion / demotion rule

Move tests between lanes based on data:
- promote to blocking after at least 10 consecutive green runs
- demote to monitoring after 2 failures in 7 days without confirmed product bug

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

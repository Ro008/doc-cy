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

/**
 * Playwright CI lane tags. Workflows select suites with --grep (see docs/ci-test-policy.md).
 */
export const TAG_PR_E2E = "@pr-e2e";
export const TAG_PR_EMAIL = "@pr-email";
export const TAG_PR_PREVIEW = "@pr-preview";
export const TAG_PR_MOBILE = "@pr-mobile-monitor";
/** Login form UI vs integration Auth — PR signal only (non-blocking). */
export const TAG_PR_LOGIN_MONITOR = "@pr-login-monitor";
export const TAG_NIGHTLY_PROD = "@nightly-prod";

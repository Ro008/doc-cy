import type { TestInfo } from "@playwright/test";

/**
 * Skip tests that can create real appointments / trigger notifications.
 *
 * Enable with:
 *   PLAYWRIGHT_SAFE_NO_BOOKING=1 npx playwright test
 */
export function skipIfSafeNoBooking(testInfo: TestInfo): void {
  const enabled = process.env.PLAYWRIGHT_SAFE_NO_BOOKING === "1";
  if (!enabled) return;
  testInfo.skip(
    true,
    "Safe mode enabled (PLAYWRIGHT_SAFE_NO_BOOKING=1): booking-creating tests are skipped."
  );
}


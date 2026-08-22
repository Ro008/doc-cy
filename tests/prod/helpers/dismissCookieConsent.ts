import { type Page } from "@playwright/test";

/**
 * Prod shows a fixed cookie bar (z-index 96) when the Google Ads tag is on.
 * Playwright then treats lower-page controls as not clickable (“visible, enabled
 * and stable”) — a common false fail on `#register-clinic-address` in 1280×720 CI.
 */
export async function dismissCookieConsentIfPresent(page: Page): Promise<void> {
  const bar = page.getByTestId("cookie-consent-bar");
  const visible = await bar.isVisible().catch(() => false);
  if (!visible) return;

  await page.getByTestId("cookie-consent-reject").click();
  await bar.waitFor({ state: "hidden", timeout: 5_000 });
}

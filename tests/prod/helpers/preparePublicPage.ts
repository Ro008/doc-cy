import { type Page } from "@playwright/test";

import { TRAFFIC_LOG_SUPPRESS_HEADER } from "../../../lib/traffic-log";

const preparedPages = new WeakSet<Page>();

/**
 * Prod nightly must look like a normal browser to Cloudflare Bot Fight Mode.
 * Do not set x-doccy-suppress-traffic-log on every request (see playwright.config).
 * Attach it only to the traffic-log API, and hide navigator.webdriver.
 */
export async function preparePublicPage(page: Page): Promise<void> {
  if (preparedPages.has(page)) return;
  preparedPages.add(page);

  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const secret = process.env.DOC_CY_SUPPRESS_TRAFFIC_LOG_SECRET?.trim();
  if (!secret) return;

  await page.route("**/api/traffic/log", async (route) => {
    const headers = {
      ...route.request().headers(),
      [TRAFFIC_LOG_SUPPRESS_HEADER]: secret,
    };
    await route.continue({ headers });
  });
}

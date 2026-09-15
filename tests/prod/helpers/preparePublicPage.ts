import { type Page } from "@playwright/test";

const preparedPages = new WeakSet<Page>();

/**
 * Prod nightly must look like a normal browser to Cloudflare Bot Fight Mode.
 * Hide navigator.webdriver; do not add custom headers on every request.
 */
export async function preparePublicPage(page: Page): Promise<void> {
  if (preparedPages.has(page)) return;
  preparedPages.add(page);

  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
}

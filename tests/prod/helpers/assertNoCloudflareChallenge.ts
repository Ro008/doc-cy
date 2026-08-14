import { type Page } from "@playwright/test";

import { isCloudflareChallengePage } from "./cloudflareChallengePage";

export { isCloudflareChallengePage };

/**
 * Fail with an actionable message when Cloudflare shows a real interstitial.
 * Do not treat generic `/cdn-cgi/challenge-platform` beacons as a block.
 */
export async function assertNoCloudflareChallenge(page: Page): Promise<void> {
  const title = await page.title().catch(() => "");
  const html = await page.content().catch(() => "");
  if (!isCloudflareChallengePage(title, html)) return;

  throw new Error(
    `Cloudflare bot challenge blocked ${page.url()} (title: "${title}"). ` +
      `GitHub Actions IPs can be challenged by Bot Fight Mode. ` +
      `WAF Skip rules do not bypass Bot Fight Mode; pause it for the nightly window or allow the runner.`,
  );
}

export async function gotoPublicAndReady(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load", { timeout: 15_000 }).catch(() => undefined);
  await assertNoCloudflareChallenge(page);
}

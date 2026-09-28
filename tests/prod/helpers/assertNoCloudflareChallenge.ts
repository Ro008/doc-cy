import { test, type Page } from "@playwright/test";

import { cloudflareChallengeAction, isCloudflareChallengePage } from "./cloudflareChallengePage";
import { dismissCookieConsentIfPresent } from "./dismissCookieConsent";
import { preparePublicPage } from "./preparePublicPage";

export { isCloudflareChallengePage };

/**
 * Fail with an actionable message when Cloudflare shows a real interstitial.
 * Do not treat generic `/cdn-cgi/challenge-platform` beacons as a block.
 */
export async function assertNoCloudflareChallenge(page: Page): Promise<void> {
  const title = await page.title().catch(() => "");
  const html = await page.content().catch(() => "");
  if (!isCloudflareChallengePage(title, html)) return;

  if (cloudflareChallengeAction(process.env) === "skip") {
    // Gray, not red: the page was never checked. The origin lane checks it without Cloudflare.
    test.skip(
      true,
      `Cloudflare challenged GitHub's IP at ${page.url()} (Bot Fight Mode); the Vercel origin lane checks this page.`,
    );
  }

  throw new Error(
    `Cloudflare bot challenge blocked ${page.url()} (title: "${title}"). ` +
      `GitHub Actions IPs can be challenged by Bot Fight Mode. ` +
      `Keep Bot Fight Mode on (anti-scraping). Dual-lane nightly treats edge as diagnostic when Vercel origin is configured.`,
  );
}

/** Bot Fight Mode often shows a JS interstitial that clears after a few seconds. */
export async function waitForCloudflareChallengeToClear(
  page: Page,
  timeoutMs = 25_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const title = await page.title().catch(() => "");
    const html = await page.content().catch(() => "");
    if (!isCloudflareChallengePage(title, html)) return;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  await assertNoCloudflareChallenge(page);
}

export async function gotoPublicAndReady(page: Page, path: string): Promise<void> {
  await preparePublicPage(page);
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load", { timeout: 15_000 }).catch(() => undefined);
  await waitForCloudflareChallengeToClear(page);
  await dismissCookieConsentIfPresent(page);
}

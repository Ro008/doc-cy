import { type Page } from "@playwright/test";

import { TRAFFIC_LOG_SUPPRESS_HEADER } from "@/lib/traffic-log";
import { isCloudflareChallengePage } from "./cloudflareChallengePage";

export { isCloudflareChallengePage };

/**
 * Cloudflare Bot Fight Mode (enabled 2026-08-09) can challenge GitHub Actions IPs.
 * Fail with an actionable message instead of a generic "element not found".
 */
export async function assertNoCloudflareChallenge(page: Page): Promise<void> {
  const title = await page.title().catch(() => "");
  const html = await page.content().catch(() => "");
  if (!isCloudflareChallengePage(title, html)) return;

  throw new Error(
    `Cloudflare bot challenge blocked ${page.url()}. ` +
      `GitHub Actions IPs are treated as bots by Bot Fight Mode. ` +
      `In Cloudflare: WAF custom rule with Skip (including Bot Fight Mode) when request header ` +
      `\`${TRAFFIC_LOG_SUPPRESS_HEADER}\` matches the monitoring secret ` +
      `(Playwright already sends it when DOC_CY_SUPPRESS_TRAFFIC_LOG_SECRET is set).`,
  );
}

export async function gotoPublicAndReady(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load", { timeout: 15_000 }).catch(() => undefined);
  await assertNoCloudflareChallenge(page);
}

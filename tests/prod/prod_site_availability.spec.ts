import { test, expect } from "@playwright/test";
import { gotoPublicAndReady } from "./helpers/assertNoCloudflareChallenge";

/**
 * Cheap checks that the public funnel responds (prod cron or Vercel Preview on PRs).
 * - Prod: set PLAYWRIGHT_BASE_URL to the live site (not localhost).
 * - Preview CI: set PLAYWRIGHT_PREVIEW_SMOKE=1 and PLAYWRIGHT_BASE_URL to the deployment URL.
 */
test.describe("Public shell health", { tag: ["@pr-preview", "@nightly-prod"] }, () => {
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(({}, testInfo) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const preview = process.env.PLAYWRIGHT_PREVIEW_SMOKE === "1";
    if (!baseUrl?.trim()) {
      testInfo.skip(true, "Set PLAYWRIGHT_BASE_URL.");
      return;
    }
    if (preview) {
      if (/mydoccy\.com/i.test(baseUrl)) {
        testInfo.skip(
          true,
          "Preview smoke must not target production hostname.",
        );
      }
      return;
    }
    if (/localhost|127\.0\.0\.1/i.test(baseUrl)) {
      testInfo.skip(true, "Set PLAYWRIGHT_BASE_URL to production.");
    }
  });

  test("marketing home loads with primary CTAs", async ({ page }) => {
    // Deterministic English copy: `/` can resolve to a non-English locale on some hosts;
    // marketing strings also change over time — keep in sync with `messages/en.json` LandingPage.Hero.
    await gotoPublicAndReady(page, "/en");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Run a Smarter Practice/i,
      }),
    ).toBeVisible({ timeout: 20000 });

    const primaryCta = page.locator('a[href="#founders-pricing-card"]').first();
    await expect(primaryCta).toBeVisible();
    await expect(primaryCta).toHaveAttribute("href", "#founders-pricing-card");
  });

  test("login and register routes render", async ({ page }) => {
    await gotoPublicAndReady(page, "/login");
    await expect(page.getByLabel("Email")).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /Sign in/i })).toBeVisible();

    await gotoPublicAndReady(page, "/register");
    await expect(
      page.getByRole("heading", { name: /List your practice on DocCy/i }),
    ).toBeVisible({ timeout: 20_000 });
    // Name attribute — do not rely on getByLabel("Full name"); wrapping labels + "*"
    // spans have failed this locator against production HTML.
    const fullName = page.locator("#register-form input[name='fullName']");
    await expect(fullName).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("button", { name: /Submit My Application/i }),
    ).toBeVisible();
  });

  test("finder route renders district/specialty filters", async ({ page }) => {
    await gotoPublicAndReady(page, "/");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /The most complete health directory in Cyprus|Cyprus['’]s most complete health directory|Find your next health professional(?: in Cyprus)?|Health Professionals in Cyprus|Find a Professional/i,
      })
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel("District")).toBeVisible();
    await expect(page.locator('select[name="specialty"]')).toBeVisible();
  });
});

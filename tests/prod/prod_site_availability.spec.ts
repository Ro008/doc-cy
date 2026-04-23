import { test, expect } from "@playwright/test";

/**
 * Cheap checks that the public funnel responds (prod cron or Vercel Preview on PRs).
 * - Prod: set PLAYWRIGHT_BASE_URL to the live site (not localhost).
 * - Preview CI: set PLAYWRIGHT_PREVIEW_SMOKE=1 and PLAYWRIGHT_BASE_URL to the deployment URL.
 */
test.describe("Public shell health", () => {
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
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /stop chasing appointments.*start protecting your time/i,
      }),
    ).toBeVisible({ timeout: 20000 });

    const primaryCta = page.getByRole("link", {
      name: /Claim your professional profile/i,
    });
    await expect(primaryCta).toBeVisible();
    await expect(primaryCta).toHaveAttribute("href", "/register");
  });

  test("login and register routes render", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /Sign in/i })).toBeVisible();

    await page.goto("/register");
    await expect(page.getByLabel("Full name")).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("button", { name: /Submit application/i }),
    ).toBeVisible();
  });

  test("finder route renders district/specialty filters", async ({ page }) => {
    await page.goto("/finder");
    await expect(
      page.getByRole("heading", { level: 1, name: /Find a Professional/i })
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel("District")).toBeVisible();
    await expect(page.getByLabel("Specialty")).toBeVisible();
  });
});

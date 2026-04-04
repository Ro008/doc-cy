import { test, expect } from "@playwright/test";

/**
 * Cheap prod checks that the public funnel responds before deeper smoke tests
 * (booking, login, registration). Catches deploy/config outages early.
 */
test.describe("Prod smoke: public shell", () => {
  test.beforeEach(({}, testInfo) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    test.skip(
      !baseUrl || /localhost|127\.0\.0\.1/i.test(baseUrl),
      "Set PLAYWRIGHT_BASE_URL to production.",
    );
  });

  test("marketing home loads with primary CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /stop chasing appointments.*start focusing on patients/i,
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
});

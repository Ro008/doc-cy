import { test, expect } from "@playwright/test";

test.describe("Prod smoke: doctor login UI minimal", () => {
  test("login page renders required controls", async ({ page }) => {
    test.setTimeout(45_000);
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";

    test.skip(
      !baseUrl || /localhost|127\.0\.0\.1/i.test(baseUrl),
      "Set PLAYWRIGHT_BASE_URL to production."
    );

    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /Sign in/i })).toBeVisible();
  });
});

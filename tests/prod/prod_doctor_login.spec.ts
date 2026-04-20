import { test, expect } from "@playwright/test";

test.describe("Prod smoke: doctor login", () => {
  test("doctor can login and see agenda calendar", async ({ page }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const email = process.env.TEST_DOCTOR_EMAIL ?? "";
    const password = process.env.TEST_DOCTOR_PASSWORD ?? "";

    test.skip(
      !baseUrl || /localhost|127\.0\.0\.1/i.test(baseUrl),
      "Set PLAYWRIGHT_BASE_URL to production."
    );
    test.skip(!email || !password, "Missing TEST_DOCTOR_EMAIL / TEST_DOCTOR_PASSWORD.");

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /Sign in/i }).click();

    await expect(page.getByText(/Invalid email or password/i)).toHaveCount(0, {
      timeout: 10000,
    });
    await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/, { timeout: 60000 });
    await expect(
      page.getByText(/Weekly calendar on desktop · Daily focus on mobile/i)
    ).toBeVisible({ timeout: 20000 });

    // AgendaRealtime visible guard.
    await expect(
      page.getByRole("button", { name: /Today|Next week|Next day/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });
});


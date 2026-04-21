import { test, expect } from "@playwright/test";

test.describe("Prod smoke: doctor password login", () => {
  test("doctor can login with password and reach agenda", async ({ page }) => {
    test.setTimeout(90_000);
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const email = (process.env.TEST_USER_EMAIL ?? process.env.TEST_DOCTOR_EMAIL ?? "").trim();
    const password = (process.env.TEST_USER_PASSWORD ?? process.env.TEST_DOCTOR_PASSWORD ?? "").trim();

    test.skip(
      !baseUrl || /localhost|127\.0\.0\.1/i.test(baseUrl),
      "Set PLAYWRIGHT_BASE_URL to production."
    );
    test.skip(!email || !password, "Missing TEST_USER_* (or fallback TEST_DOCTOR_*) credentials.");

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /Sign in/i }).click();

    // Production auth can be slower during nightly load; allow extra buffer.
    await page.waitForURL(/\/agenda(?:[/?#]|$)/, { timeout: 75_000 });
    await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/, { timeout: 10_000 });
    await expect(
      page.getByText(/Weekly calendar on desktop · Daily focus on mobile/i)
    ).toBeVisible({ timeout: 20_000 });
  });
});

import { test, expect } from "@playwright/test";

test.describe("Prod smoke: floating QR button", () => {
  test("doctor can open QR modal from agenda", async ({ page }) => {
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

    await page.waitForURL(/\/agenda/, { timeout: 30000 });
    await expect(
      page.getByText(/Weekly calendar on desktop · Daily focus on mobile/i)
    ).toBeVisible({ timeout: 20000 });

    const qrFab = page.getByRole("button", { name: /booking QR|QR|κρατήσεων/i });
    await expect(qrFab).toBeVisible({ timeout: 10000 });
    await qrFab.click();

    const qrDialog = page.getByRole("dialog");
    await expect(qrDialog).toBeVisible({ timeout: 5000 });
    await expect(
      qrDialog.getByRole("button", { name: /Download QR \(PNG\)|Λήψη QR \(PNG\)/i })
    ).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";

test.describe("Prod smoke: agenda and QR with authenticated session", () => {
  test("doctor can access agenda and open QR modal", async ({ page }) => {
    test.setTimeout(90_000);
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const email = (process.env.TEST_DOCTOR_EMAIL ?? process.env.TEST_USER_EMAIL ?? "").trim();
    const password = (process.env.TEST_DOCTOR_PASSWORD ?? process.env.TEST_USER_PASSWORD ?? "").trim();

    test.skip(
      !baseUrl || /localhost|127\.0\.0\.1/i.test(baseUrl),
      "Set PLAYWRIGHT_BASE_URL to production."
    );
    test.skip(
      !email,
      "Missing TEST_DOCTOR_EMAIL (or fallback TEST_USER_EMAIL)."
    );
    test.skip(
      !password,
      "Missing TEST_DOCTOR_PASSWORD (or fallback TEST_USER_PASSWORD)."
    );

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /Sign in/i }).click();

    try {
      await page.waitForURL(/\/agenda(?:[/?#]|$)/, { timeout: 30_000 });
    } catch {
      await page.goto("/agenda", { waitUntil: "domcontentloaded" });
    }
    await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/, { timeout: 45_000 });
    await expect(
      page.getByText(/Weekly calendar on desktop · Daily focus on mobile/i)
    ).toBeVisible({ timeout: 20_000 });

    const qrFab = page.getByRole("button", { name: /booking QR|QR|κρατήσεων/i });
    await expect(qrFab).toBeVisible({ timeout: 10_000 });
    await qrFab.click();

    const qrDialog = page.getByRole("dialog");
    await expect(qrDialog).toBeVisible({ timeout: 5_000 });
    await expect(
      qrDialog.getByRole("button", { name: /Download QR \(PNG\)|Λήψη QR \(PNG\)/i })
    ).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";
import { loginDoctorToAgenda } from "./helpers/doctorLogin";

test.describe("Prod smoke: floating QR button", () => {
  test("doctor can open QR modal from agenda", async ({ page }) => {
    test.setTimeout(90_000);
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const email = process.env.TEST_DOCTOR_EMAIL ?? "";
    const password = process.env.TEST_DOCTOR_PASSWORD ?? "";

    test.skip(
      !baseUrl || /localhost|127\.0\.0\.1/i.test(baseUrl),
      "Set PLAYWRIGHT_BASE_URL to production."
    );
    test.skip(!email || !password, "Missing TEST_DOCTOR_EMAIL / TEST_DOCTOR_PASSWORD.");

    await loginDoctorToAgenda(page, email, password);
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

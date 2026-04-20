import { test, expect } from "@playwright/test";
import { loginDoctorToAgendaOrThrow } from "./helpers/doctorLogin";

test.describe("Prod smoke: agenda and QR with authenticated session", () => {
  test("doctor can access agenda and open QR modal", async ({ page }) => {
    test.setTimeout(90_000);
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const email = (process.env.TEST_DOCTOR_EMAIL ?? "").trim();
    const password = (process.env.TEST_DOCTOR_PASSWORD ?? "").trim();

    test.skip(
      !baseUrl || /localhost|127\.0\.0\.1/i.test(baseUrl),
      "Set PLAYWRIGHT_BASE_URL to production."
    );
    test.skip(!email || !password, "Missing TEST_DOCTOR_EMAIL / TEST_DOCTOR_PASSWORD.");

    await loginDoctorToAgendaOrThrow(page, email, password);
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

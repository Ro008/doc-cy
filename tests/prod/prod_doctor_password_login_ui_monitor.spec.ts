import { test, expect } from "@playwright/test";
import { authenticateDoctorViaPasswordUi } from "./helpers/doctorLogin";

test.describe("Prod monitor: doctor password login UI", () => {
  test("doctor can login with password and reach agenda", async ({ page }) => {
    test.setTimeout(90_000);
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const email = (process.env.TEST_DOCTOR_EMAIL ?? process.env.TEST_USER_EMAIL ?? "").trim();
    const password = (process.env.TEST_DOCTOR_PASSWORD ?? process.env.TEST_USER_PASSWORD ?? "").trim();

    test.skip(
      !baseUrl || /localhost|127\.0\.0\.1/i.test(baseUrl),
      "Set PLAYWRIGHT_BASE_URL to production."
    );
    test.skip(!email, "Missing TEST_DOCTOR_EMAIL (or fallback TEST_USER_EMAIL).");
    test.skip(!password, "Missing TEST_DOCTOR_PASSWORD (or fallback TEST_USER_PASSWORD).");

    await authenticateDoctorViaPasswordUi(page, baseUrl, email, password);
    await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/, { timeout: 45_000 });
    await expect(
      page.getByText(/Weekly calendar on desktop · Daily focus on mobile/i)
    ).toBeVisible({ timeout: 20_000 });
  });
});

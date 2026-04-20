import { test, expect } from "@playwright/test";
import { loginDoctorToAgenda } from "./helpers/doctorLogin";

test.describe("Prod smoke: doctor login", () => {
  test("doctor can login and see agenda calendar", async ({ page }) => {
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

    // AgendaRealtime visible guard.
    await expect(
      page.getByRole("button", { name: /Today|Next week|Next day/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });
});


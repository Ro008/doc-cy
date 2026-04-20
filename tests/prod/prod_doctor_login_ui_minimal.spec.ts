import { test, expect } from "@playwright/test";
import { attemptDoctorLoginViaUi } from "./helpers/doctorLogin";

test.describe("Prod smoke: doctor login UI minimal", () => {
  test("login page renders and auth endpoint responds", async ({ page }) => {
    test.setTimeout(60_000);
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
    const email = (process.env.TEST_DOCTOR_EMAIL ?? "").trim();
    const password = (process.env.TEST_DOCTOR_PASSWORD ?? "").trim();

    test.skip(
      !baseUrl || /localhost|127\.0\.0\.1/i.test(baseUrl),
      "Set PLAYWRIGHT_BASE_URL to production."
    );
    test.skip(!email || !password, "Missing TEST_DOCTOR_EMAIL / TEST_DOCTOR_PASSWORD.");

    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /Sign in/i })).toBeVisible();

    const result = await attemptDoctorLoginViaUi(page, email, password);
    expect(
      result.authStatus,
      `Expected /auth/v1/token response from login form. host=${result.authHost ?? "unknown"}`
    ).not.toBeNull();
    expect(result.authStatus!, "Supabase auth endpoint should not return 5xx.").toBeLessThan(500);
  });
});

import { test, expect } from "@playwright/test";
import { assertDoctorPasswordAuthReachable } from "./helpers/assertDoctorPasswordAuthReachable";
import { authenticateDoctorViaPasswordUi } from "./prod/helpers/doctorLogin";

function normalizeSecret(raw: string): string {
  return raw
    .trim()
    .replace(/\r?\n/g, "")
    .replace(/^['"]+|['"]+$/g, "");
}

test.describe("Doctor password login form", { tag: "@pr-e2e" }, () => {
  test("doctor can sign in via login form and reach agenda", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const appBaseUrl = (process.env.PLAYWRIGHT_BASE_URL ?? baseURL ?? "http://localhost:3000").trim();
    const email = normalizeSecret(process.env.TEST_USER_EMAIL ?? process.env.TEST_DOCTOR_EMAIL ?? "");
    const password = normalizeSecret(
      process.env.TEST_USER_PASSWORD ?? process.env.TEST_DOCTOR_PASSWORD ?? "",
    );

    test.skip(!email || !password, "Missing test doctor credentials.");

    await assertDoctorPasswordAuthReachable(email, password);
    await authenticateDoctorViaPasswordUi(page, appBaseUrl, email, password);
    await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/, { timeout: 45_000 });
    await expect(
      page.getByText(/Weekly calendar on desktop · Daily focus on mobile/i),
    ).toBeVisible({ timeout: 20_000 });
  });
});

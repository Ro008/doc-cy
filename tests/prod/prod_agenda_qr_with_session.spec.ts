import { test, expect } from "@playwright/test";
import { authenticateDoctorViaPasswordUi } from "./helpers/doctorLogin";

test.describe("Prod smoke: agenda settings promote practice", { tag: "@nightly-monitor" }, () => {
  test("doctor can open settings promote section with QR actions", async ({ page }) => {
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

    await page.goto(`${baseUrl.replace(/\/$/, "")}/agenda/settings#promote-practice`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("heading", { name: /Promote your practice/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: /Print booking sign/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Download QR \(PNG\)/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Promote your practice, booking QR/i })
    ).toHaveCount(0);
  });
});

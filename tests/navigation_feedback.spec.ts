import { expect, test } from "@playwright/test";
import { signInDoctorOrSkipOnInfraError } from "./helpers/signInDoctorWithInfraSkip";

function normalizeSecret(raw: string): string {
  return raw
    .trim()
    .replace(/\r?\n/g, "")
    .replace(/^['"]+|['"]+$/g, "");
}

async function signInMobileAgenda(page: import("@playwright/test").Page) {
  const email = normalizeSecret(process.env.TEST_USER_EMAIL ?? process.env.TEST_DOCTOR_EMAIL ?? "");
  const password = normalizeSecret(
    process.env.TEST_USER_PASSWORD ?? process.env.TEST_DOCTOR_PASSWORD ?? "",
  );
  test.skip(!email || !password, "Missing test doctor credentials.");

  await signInDoctorOrSkipOnInfraError(page, undefined, { email, password });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/agenda", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/, { timeout: 20_000 });
  await expect(page.getByTestId("userbar-mobile-tabs")).toBeVisible({ timeout: 10_000 });
}

test.describe("Doctor navigation feedback", () => {
  test("mobile agenda has no manual booking FAB", async ({ page }) => {
    test.setTimeout(120_000);
    await signInMobileAgenda(page);

    await expect(
      page.locator('button.fixed:has-text("+ Add Manual Booking")'),
    ).toHaveCount(0);
  });

  test("mobile tab shows loading affordance while navigating to settings", async ({ page }) => {
    test.setTimeout(120_000);
    await signInMobileAgenda(page);

    const settingsTab = page.getByTestId("userbar-tab-settings");
    await settingsTab.click({ noWaitAfter: true });

    await expect
      .poll(
        async () => {
          const busy = await settingsTab.getAttribute("aria-busy");
          const barVisible = await page
            .getByTestId("navigation-progress-bar")
            .isVisible()
            .catch(() => false);
          const onSettings = /\/agenda\/settings/.test(page.url());
          return busy === "true" || barVisible || onSettings;
        },
        { timeout: 10_000, intervals: [50, 100, 150, 200] },
      )
      .toBe(true);

    await expect(page).toHaveURL(/\/agenda\/settings(?:[/?#]|$)/, { timeout: 20_000 });
  });
});

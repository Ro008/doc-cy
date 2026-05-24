import { expect, test } from "@playwright/test";
import { signInDoctorOrSkipOnInfraError } from "./helpers/signInDoctorWithInfraSkip";

function normalizeSecret(raw: string): string {
  return raw
    .trim()
    .replace(/\r?\n/g, "")
    .replace(/^['"]+|['"]+$/g, "");
}

const REMOVED_COPY = /registration form is updated|extend the patient booking form/i;

async function signInAndOpenAgenda(page: import("@playwright/test").Page) {
  const email = normalizeSecret(process.env.TEST_USER_EMAIL ?? process.env.TEST_DOCTOR_EMAIL ?? "");
  const password = normalizeSecret(
    process.env.TEST_USER_PASSWORD ?? process.env.TEST_DOCTOR_PASSWORD ?? "",
  );
  test.skip(!email || !password, "Missing test doctor credentials.");

  await signInDoctorOrSkipOnInfraError(page, undefined, { email, password });
  await page.goto("/agenda", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/, { timeout: 20_000 });
}

test.describe("Practice insights (doctor dashboard)", () => {
  test("insights page shows expected English shell copy", async ({ page }) => {
    test.setTimeout(120_000);
    await signInAndOpenAgenda(page);
    await page.goto("/agenda/insights", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/agenda\/insights(?:[/?#]|$)/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Practice insights" })).toBeVisible();
    await expect(page.getByText("Back to agenda", { exact: true })).toHaveCount(0);
    await expect(page.getByText(REMOVED_COPY)).toHaveCount(0);
    await expect(page.getByText("Quick overview")).toBeVisible();
    await expect(page.getByText("Coming soon").first()).toBeVisible();
  });

  test("mobile tab bar shows four tabs and navigates to insights", async ({ page }) => {
    test.setTimeout(120_000);
    await signInAndOpenAgenda(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/agenda", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/, { timeout: 20_000 });

    await expect(page.getByTestId("userbar-mobile-tabs")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("userbar-tab-agenda")).toBeVisible();
    await expect(page.getByTestId("userbar-tab-insights")).toBeVisible();
    await expect(page.getByTestId("userbar-tab-settings")).toBeVisible();
    await expect(page.getByTestId("userbar-tab-more")).toBeVisible();

    await page.getByTestId("userbar-tab-insights").click();
    await expect(page).toHaveURL(/\/agenda\/insights(?:[/?#]|$)/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Practice insights" })).toBeVisible();
  });
});

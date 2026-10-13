import { expect, test } from "@playwright/test";
import { signInDoctorOrFail } from "./helpers/signInDoctorOrFail";
import { exposeSupabaseAuthCookiesToClient } from "./helpers/doctorAuth";
import { INSIGHTS_ENABLED } from "@/lib/doctor-routes";

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

  await signInDoctorOrFail(page, undefined, { email, password });
  await exposeSupabaseAuthCookiesToClient(page);
  await page.goto("/agenda", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/, { timeout: 20_000 });
}

test.describe("Practice insights (doctor dashboard)", { tag: "@pr-e2e" }, () => {
  // Insights is hidden until there are enough appointments and traffic (user, 2026-10-12).
  test("while Insights is hidden, its address lands on the Dashboard and no tab names it", async ({ page }) => {
    test.skip(INSIGHTS_ENABLED, "Insights is shown.");
    test.setTimeout(120_000);
    await signInAndOpenAgenda(page);
    await page.goto("/agenda/insights", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Practice insights" })).toHaveCount(0);
    await expect(page.getByTestId("userbar-nav-insights")).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("userbar-mobile-tabs")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("userbar-tab-settings")).toBeVisible();
    await expect(page.getByTestId("userbar-tab-insights")).toHaveCount(0);
  });

  test("insights page shows expected English shell copy", async ({ page }) => {
    test.skip(!INSIGHTS_ENABLED, "Insights is hidden for now.");
    test.setTimeout(120_000);
    await signInAndOpenAgenda(page);
    await page.goto("/agenda/insights", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/agenda\/insights(?:[/?#]|$)/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Practice insights" })).toBeVisible();
    await expect(page.getByText("Back to agenda", { exact: true })).toHaveCount(0);
    await expect(page.getByText(REMOVED_COPY)).toHaveCount(0);
    await expect(page.getByText("Quick overview")).toBeVisible();
    await expect(page.getByText("New patients captured")).toBeVisible();
    await expect(page.getByText("No-shows (this month)")).toBeVisible();
  });

  test("mobile tab bar shows five tabs and navigates to insights", async ({ page }) => {
    test.skip(!INSIGHTS_ENABLED, "Insights is hidden for now.");
    test.setTimeout(120_000);
    await signInAndOpenAgenda(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/agenda", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/, { timeout: 20_000 });

    await expect(page.getByTestId("userbar-mobile-tabs")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("userbar-tab-dashboard")).toBeVisible();
    await expect(page.getByTestId("userbar-tab-agenda")).toBeVisible();
    await expect(page.getByTestId("userbar-tab-insights")).toBeVisible();
    await expect(page.getByTestId("userbar-tab-settings")).toBeVisible();
    await expect(page.getByTestId("userbar-tab-more")).toBeVisible();

    await page.getByTestId("userbar-tab-insights").click();
    await expect(page).toHaveURL(/\/agenda\/insights(?:[/?#]|$)/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Practice insights" })).toBeVisible();
  });
});

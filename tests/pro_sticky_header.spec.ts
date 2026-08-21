import { expect, test } from "@playwright/test";
import { signInDoctorOrSkipOnInfraError } from "./helpers/signInDoctorWithInfraSkip";
import { exposeSupabaseAuthCookiesToClient } from "./helpers/doctorAuth";

function normalizeSecret(raw: string): string {
  return raw
    .trim()
    .replace(/\r?\n/g, "")
    .replace(/^['"]+|['"]+$/g, "");
}

async function signInAndOpenAgenda(page: import("@playwright/test").Page) {
  const email = normalizeSecret(process.env.TEST_USER_EMAIL ?? process.env.TEST_DOCTOR_EMAIL ?? "");
  const password = normalizeSecret(
    process.env.TEST_USER_PASSWORD ?? process.env.TEST_DOCTOR_PASSWORD ?? "",
  );
  test.skip(!email || !password, "Missing test doctor credentials.");

  await signInDoctorOrSkipOnInfraError(page, undefined, { email, password });
  await exposeSupabaseAuthCookiesToClient(page);
  await page.goto("/agenda", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/, { timeout: 20_000 });
}

test.describe("Professional sticky header", { tag: "@pr-e2e" }, () => {
  test("desktop agenda shows sticky chrome and user menu dropdown", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await signInAndOpenAgenda(page);
    await expect(page.locator("main header h1").first()).toBeVisible({ timeout: 10_000 });

    const stickyHeader = page.getByTestId("pro-sticky-header");
    await expect(stickyHeader).toBeVisible();
    await expect(stickyHeader.getByRole("link", { name: /my doccy/i })).toBeVisible();

    const toggle = stickyHeader.getByTestId("userbar-toggle");
    await expect(toggle).toBeVisible();

    await expect(async () => {
      await toggle.click();
      await expect(stickyHeader.getByTestId("userbar-menu")).toBeVisible();
    }).toPass({ timeout: 15_000 });

    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(stickyHeader.getByTestId("userbar-link-settings")).toBeVisible();

    await expect(async () => {
      await toggle.click();
      await expect(stickyHeader.getByTestId("userbar-menu")).toBeHidden();
    }).toPass({ timeout: 10_000 });

    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("desktop user menu stays in viewport after scroll on agenda", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await signInAndOpenAgenda(page);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByTestId("pro-sticky-header")).toBeInViewport();
    await expect(page.getByTestId("userbar-toggle")).toBeInViewport();
  });

  test("mobile agenda uses bottom tabs without sticky top chrome", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAndOpenAgenda(page);

    await expect(page.getByTestId("pro-sticky-header")).toBeHidden();
    await expect(page.getByTestId("userbar-toggle")).toBeHidden();
    await expect(page.getByTestId("userbar-mobile-tabs")).toBeVisible({ timeout: 10_000 });
  });

  test("signed-out landing has no professional chrome", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("pro-sticky-header")).toHaveCount(0);
    await expect(page.getByTestId("userbar-toggle")).toHaveCount(0);
    await expect(page.getByTestId("userbar-mobile-tabs")).toHaveCount(0);
  });

  test("signed-in for-professionals shows the user menu", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await signInAndOpenAgenda(page);

    await page.goto("/for-professionals", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("userbar-toggle")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("link", { name: /^My Agenda$/i })).toBeVisible();
    await expect(page.getByTestId("pro-sticky-header")).toHaveCount(0);
  });

  test("signed-in finder shows the desktop user menu, not guest header CTAs", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await signInAndOpenAgenda(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    const header = page.getByTestId("finder-public-header");
    await expect(header.getByRole("link", { name: /professional login/i })).toHaveCount(0);
    await expect(page.getByTestId("userbar-toggle")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("pro-sticky-header")).toHaveCount(0);
    await expect(page.getByTestId("userbar-mobile-tabs")).toBeHidden();
  });

  test("signed-in finder shows mobile professional tabs", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAndOpenAgenda(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("finder-public-header")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("userbar-mobile-tabs")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("userbar-toggle")).toBeHidden();
  });
});

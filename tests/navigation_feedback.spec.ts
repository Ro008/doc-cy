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

async function signInDesktopAgenda(page: import("@playwright/test").Page) {
  const email = normalizeSecret(process.env.TEST_USER_EMAIL ?? process.env.TEST_DOCTOR_EMAIL ?? "");
  const password = normalizeSecret(
    process.env.TEST_USER_PASSWORD ?? process.env.TEST_DOCTOR_PASSWORD ?? "",
  );
  test.skip(!email || !password, "Missing test doctor credentials.");

  await page.setViewportSize({ width: 1280, height: 800 });
  await signInDoctorOrSkipOnInfraError(page, undefined, { email, password });
  await page.goto("/agenda", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/, { timeout: 20_000 });
  await expect(page.locator("main header h1").first()).toBeVisible({ timeout: 10_000 });
}

test.describe("Doctor navigation feedback", { tag: "@pr-e2e" }, () => {
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

  test("desktop user menu keeps a single loading spinner when switching targets", async ({ page }) => {
    test.setTimeout(120_000);
    await signInDesktopAgenda(page);

    const stickyHeader = page.getByTestId("pro-sticky-header");
    await expect(stickyHeader).toBeVisible();
    const toggle = stickyHeader.getByTestId("userbar-toggle");
    const menu = stickyHeader.getByTestId("userbar-menu");

    await expect(async () => {
      await toggle.click();
      await expect(menu).toBeVisible();
    }).toPass({ timeout: 15_000 });

    const settingsLink = menu.getByTestId("userbar-link-settings");
    const agendaLink = menu.getByTestId("userbar-link-agenda");

    await settingsLink.click({ noWaitAfter: true });
    await agendaLink.click({ noWaitAfter: true });

    const busyMenuItems = menu.locator('[role="menuitem"][aria-busy="true"]');

    await expect
      .poll(async () => {
        const busyCount = await busyMenuItems.count();
        if (busyCount > 1) return "too-many";

        const agendaBusy = await agendaLink.getAttribute("aria-busy");
        const settingsBusy = await settingsLink.getAttribute("aria-busy");
        const onAgenda = /\/agenda(?:[/?#]|$)/.test(page.url()) && !page.url().includes("/settings");

        if (busyCount === 1 && agendaBusy === "true" && settingsBusy === "false") {
          return "ok-pending";
        }
        if (busyCount === 0 && onAgenda) return "ok-landed";
        return "waiting";
      }, { timeout: 12_000, intervals: [25, 50, 100, 150] })
      .not.toBe("too-many");

    await expect
      .poll(async () => {
        const busyCount = await busyMenuItems.count();
        const agendaBusy = await agendaLink.getAttribute("aria-busy");
        const settingsBusy = await settingsLink.getAttribute("aria-busy");
        const onAgenda = /\/agenda(?:[/?#]|$)/.test(page.url()) && !page.url().includes("/settings");
        return (
          (busyCount === 1 && agendaBusy === "true" && settingsBusy === "false") ||
          (busyCount === 0 && onAgenda)
        );
      }, { timeout: 12_000, intervals: [25, 50, 100, 150] })
      .toBe(true);
  });

  test("mobile tabs keep a single loading spinner when switching targets", async ({ page }) => {
    test.setTimeout(120_000);
    await signInMobileAgenda(page);

    const insightsTab = page.getByTestId("userbar-tab-insights");
    const settingsTab = page.getByTestId("userbar-tab-settings");
    const busyTabs = page.locator('[data-testid^="userbar-tab-"][aria-busy="true"]');

    await insightsTab.click({ noWaitAfter: true });
    await settingsTab.click({ noWaitAfter: true });

    await expect
      .poll(async () => {
        const busyCount = await busyTabs.count();
        if (busyCount > 1) return "too-many";

        const settingsBusy = await settingsTab.getAttribute("aria-busy");
        const insightsBusy = await insightsTab.getAttribute("aria-busy");
        const onSettings = /\/agenda\/settings(?:[/?#]|$)/.test(page.url());

        if (busyCount === 1 && settingsBusy === "true" && insightsBusy === "false") {
          return "ok-pending";
        }
        if (busyCount === 0 && onSettings) return "ok-landed";
        return "waiting";
      }, { timeout: 12_000, intervals: [25, 50, 100, 150] })
      .not.toBe("too-many");

    await expect
      .poll(async () => {
        const busyCount = await busyTabs.count();
        const settingsBusy = await settingsTab.getAttribute("aria-busy");
        const insightsBusy = await insightsTab.getAttribute("aria-busy");
        const onSettings = /\/agenda\/settings(?:[/?#]|$)/.test(page.url());
        return (
          (busyCount === 1 && settingsBusy === "true" && insightsBusy === "false") ||
          (busyCount === 0 && onSettings)
        );
      }, { timeout: 12_000, intervals: [25, 50, 100, 150] })
      .toBe(true);
  });
});

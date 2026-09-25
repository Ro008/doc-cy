import { expect, test } from "@playwright/test";
import { signInDoctorOrFail } from "./helpers/signInDoctorOrFail";
import { exposeSupabaseAuthCookiesToClient } from "./helpers/doctorAuth";

function normalizeSecret(raw: string): string {
  return raw
    .trim()
    .replace(/\r?\n/g, "")
    .replace(/^['"]+|['"]+$/g, "");
}

async function signInAndOpenDashboard(page: import("@playwright/test").Page) {
  const email = normalizeSecret(process.env.TEST_USER_EMAIL ?? process.env.TEST_DOCTOR_EMAIL ?? "");
  const password = normalizeSecret(
    process.env.TEST_USER_PASSWORD ?? process.env.TEST_DOCTOR_PASSWORD ?? "",
  );
  test.skip(!email || !password, "Missing test doctor credentials.");

  await signInDoctorOrFail(page, undefined, { email, password });
  await exposeSupabaseAuthCookiesToClient(page);
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/, { timeout: 20_000 });
}

test.describe("Doctor home dashboard", { tag: "@pr-e2e" }, () => {
  test("desktop: greeting, requests, today and the four nav tabs", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await signInAndOpenDashboard(page);

    await expect(
      page.getByRole("heading", { level: 1, name: /^Good (morning|afternoon|evening)/ }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Needs your answer" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
    await expect(page.getByTestId("dashboard-today-schedule")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open agenda" })).toHaveAttribute("href", "/agenda");

    const header = page.getByTestId("pro-sticky-header");
    await expect(header).toBeVisible();
    const tabs = header.getByRole("navigation", { name: "Doctor sections" }).getByRole("link");
    await expect(tabs).toHaveText(["Dashboard", "Agenda", "Settings", "Insights"]);
    await expect(header.getByTestId("userbar-nav-dashboard")).toHaveAttribute("aria-current", "page");
    await expect(header.getByTestId("userbar-nav-agenda")).not.toHaveAttribute("aria-current", "page");
  });

  test("desktop: the requests list shows each request or an empty state", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await signInAndOpenDashboard(page);

    const requests = page.getByTestId("dashboard-pending-request");
    const empty = page.getByText("No requests waiting for you.");
    await expect(requests.first().or(empty)).toBeVisible({ timeout: 15_000 });

    if ((await requests.count()) > 0) {
      const first = requests.first();
      await expect(first.getByRole("button", { name: "Accept" })).toBeVisible();
      await expect(first.getByRole("button", { name: "Decline" })).toBeVisible();
      await expect(first.getByRole("link", { name: "Suggest other times" })).toHaveAttribute(
        "href",
        /^\/dashboard\/appointments\/[^/]+$/,
      );
    }
  });

  test("desktop: New booking opens the manual booking flow on the dashboard", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await signInAndOpenDashboard(page);

    const panel = page.getByTestId("manual-booking-modal-panel");
    // A click before hydration does nothing; retry until the modal opens.
    await expect(async () => {
      await page.getByRole("button", { name: "New booking" }).click();
      await expect(panel).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/);

    await panel.getByRole("button", { name: "Close", exact: true }).click();
    await expect(panel).toBeHidden({ timeout: 10_000 });
  });

  test("desktop: nav tabs reach agenda, settings and insights", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await signInAndOpenDashboard(page);

    const header = page.getByTestId("pro-sticky-header");
    await header.getByTestId("userbar-nav-insights").click();
    await expect(page).toHaveURL(/\/agenda\/insights(?:[/?#]|$)/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Practice insights" })).toBeVisible();
    await expect(header.getByTestId("userbar-nav-insights")).toHaveAttribute("aria-current", "page");

    await header.getByTestId("userbar-nav-settings").click();
    await expect(page).toHaveURL(/\/agenda\/settings(?:[/?#]|$)/, { timeout: 15_000 });

    await header.getByTestId("userbar-nav-agenda").click();
    await expect(page).toHaveURL(/\/agenda(?:[?#]|$)/, { timeout: 15_000 });

    await header.getByTestId("userbar-nav-dashboard").click();
    await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/, { timeout: 15_000 });
  });

  test("desktop: the user menu keeps the extras, not the tab pages", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await signInAndOpenDashboard(page);

    const header = page.getByTestId("pro-sticky-header");
    const toggle = header.getByTestId("userbar-toggle");
    const menu = header.getByTestId("userbar-menu");
    await expect(async () => {
      await toggle.click();
      await expect(menu).toBeVisible();
    }).toPass({ timeout: 15_000 });

    await expect(menu.getByTestId("userbar-link-manual-booking")).toBeVisible();
    await expect(menu.getByTestId("userbar-link-promote")).toBeVisible();
    await expect(menu.getByTestId("userbar-link-agenda")).toHaveCount(0);
    await expect(menu.getByTestId("userbar-link-insights")).toHaveCount(0);
    await expect(menu.getByTestId("userbar-link-settings")).toHaveCount(0);
  });

  test("mobile: bottom tabs start with Dashboard and it is active", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAndOpenDashboard(page);

    const tabs = page.getByTestId("userbar-mobile-tabs");
    await expect(tabs).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("pro-sticky-header")).toBeHidden();

    const order = await tabs.locator('[data-testid^="userbar-tab-"]').evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-testid")),
    );
    expect(order).toEqual([
      "userbar-tab-dashboard",
      "userbar-tab-agenda",
      "userbar-tab-settings",
      "userbar-tab-insights",
      "userbar-tab-more",
    ]);
    await expect(page.getByTestId("userbar-tab-dashboard")).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "Needs your answer" })).toBeVisible();
    await expect(page.getByRole("button", { name: "New booking" })).toBeVisible();
  });

  test("mobile: More menu shows the account, manual booking first and logout last", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAndOpenDashboard(page);

    const menu = page.getByTestId("userbar-mobile-more-menu");
    await expect(async () => {
      await page.getByTestId("userbar-tab-more").click();
      await expect(menu).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });

    const email = normalizeSecret(process.env.TEST_USER_EMAIL ?? process.env.TEST_DOCTOR_EMAIL ?? "");
    await expect(menu.getByTestId("userbar-mobile-more-account")).toContainText(email);

    const items = await menu
      .locator('[role="menuitem"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")));
    expect(items[0]).toBe("userbar-mobile-more-link-manual-booking");
    expect(items[items.length - 1]).toBe("userbar-mobile-more-action-logout");
    expect(items.filter((id) => id !== "userbar-mobile-more-link-public-profile")).toEqual([
      "userbar-mobile-more-link-manual-booking",
      "userbar-mobile-more-link-promote",
      "userbar-mobile-more-action-support",
      "userbar-mobile-more-action-logout",
    ]);
    await expect(menu.getByRole("separator")).toHaveCount(1);
  });
});

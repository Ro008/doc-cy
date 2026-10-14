import { expect, test } from "@playwright/test";
import { signInDoctorOrFail } from "./helpers/signInDoctorOrFail";
import { exposeSupabaseAuthCookiesToClient } from "./helpers/doctorAuth";

function normalizeSecret(raw: string): string {
  return raw
    .trim()
    .replace(/\r?\n/g, "")
    .replace(/^['"]+|['"]+$/g, "");
}

function badgeLabel(count: number): string | null {
  if (count <= 0) return null;
  return count > 9 ? "9+" : String(count);
}

async function waitForHydration(page: import("@playwright/test").Page) {
  await expect(page.locator("html")).toHaveAttribute("data-doccy-pro-chrome-hydrated", "1", {
    timeout: 20_000,
  });
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
  test("desktop: greeting, requests, today and the five nav tabs", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await signInAndOpenDashboard(page);

    await expect(
      page.getByRole("heading", { level: 1, name: /^Good (morning|afternoon|evening)/ }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Needs your answer" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
    await expect(page.getByTestId("dashboard-today-schedule")).toBeVisible();
    await expect(page.getByTestId("dashboard-now-marker")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open agenda" })).toHaveAttribute("href", "/agenda");

    // Two columns: requests on the left, today's timeline on the right.
    const requestsBox = await page.getByRole("region", { name: "Needs your answer" }).boundingBox();
    const todayBox = await page.getByRole("region", { name: "Today" }).boundingBox();
    expect(requestsBox && todayBox).toBeTruthy();
    expect(todayBox!.x).toBeGreaterThan(requestsBox!.x + requestsBox!.width - 1);
    expect(Math.abs(todayBox!.y - requestsBox!.y)).toBeLessThan(40);

    const header = page.getByTestId("pro-sticky-header");
    await expect(header).toBeVisible();
    const tabs = header.getByRole("navigation", { name: "Doctor sections" }).getByRole("link");
    await expect(tabs).toHaveText(["Dashboard", "Agenda", "Visits", "Settings"]);
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

  test("desktop: Add manual booking opens the manual booking flow on the dashboard", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await signInAndOpenDashboard(page);

    const panel = page.getByTestId("manual-booking-modal-panel");
    // A click before hydration does nothing; retry until the modal opens.
    await expect(async () => {
      await page.getByRole("button", { name: "Add manual booking" }).click();
      await expect(panel).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/);

    await panel.getByRole("button", { name: "Close", exact: true }).click();
    await expect(panel).toBeHidden({ timeout: 10_000 });
  });

  test("desktop: nav tabs reach agenda and settings; Insights is hidden for now", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await signInAndOpenDashboard(page);

    const header = page.getByTestId("pro-sticky-header");
    await expect(header.getByTestId("userbar-nav-insights")).toHaveCount(0);

    await header.getByTestId("userbar-nav-settings").click();
    await expect(page).toHaveURL(/\/settings(?:[/?#]|$)/, { timeout: 15_000 });

    await header.getByTestId("userbar-nav-agenda").click();
    await expect(page).toHaveURL(/\/agenda(?:[?#]|$)/, { timeout: 15_000 });

    await header.getByTestId("userbar-nav-dashboard").click();
    await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/, { timeout: 15_000 });
  });

  test("desktop: the user menu is about her account, not the tab pages or shortcuts", async ({ page }) => {
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

    const items = await menu
      .locator('[role="menuitem"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")));
    expect(items.filter((id) => id !== "userbar-link-public-profile")).toEqual([
      "userbar-link-account",
      "userbar-link-plan",
      "userbar-link-help",
      "userbar-action-support",
      "userbar-action-logout",
    ]);
    await expect(menu.getByTestId("userbar-link-account")).toHaveText("Account");
    await expect(menu.getByTestId("userbar-link-plan")).toHaveText("Plan & billing");
    await expect(menu.getByTestId("userbar-link-help")).toHaveText("Help & tutorials");
    await expect(menu.getByTestId("userbar-action-logout")).toHaveText("Log out");
    await expect(menu.getByRole("separator")).toHaveCount(1);
    // Manual booking stays on the Dashboard and the Agenda; Promote is a Settings section.
    await expect(menu.getByTestId("userbar-link-manual-booking")).toHaveCount(0);
    await expect(menu.getByTestId("userbar-link-promote")).toHaveCount(0);
    await expect(menu.getByTestId("userbar-link-agenda")).toHaveCount(0);
    await expect(menu.getByTestId("userbar-link-insights")).toHaveCount(0);
    await expect(menu.getByTestId("userbar-link-settings")).toHaveCount(0);

    await menu.getByTestId("userbar-link-account").click();
    await expect(page).toHaveURL(/\/settings\?section=account/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible({ timeout: 20_000 });
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
      "userbar-tab-visits",
      "userbar-tab-settings",
      "userbar-tab-more",
    ]);
    await expect(page.getByTestId("userbar-tab-dashboard")).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "Needs your answer" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add manual booking" })).toBeVisible();
  });

  test("mobile: More menu shows the account, the same items as on desktop, log out last", async ({ page }) => {
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
    expect(items[items.length - 1]).toBe("userbar-mobile-more-action-logout");
    expect(items.filter((id) => id !== "userbar-mobile-more-link-public-profile")).toEqual([
      "userbar-mobile-more-link-account",
      "userbar-mobile-more-link-plan",
      "userbar-mobile-more-link-help",
      "userbar-mobile-more-action-support",
      "userbar-mobile-more-action-logout",
    ]);
    await expect(menu.getByRole("separator")).toHaveCount(1);
  });

  test("desktop: the nav pill moves to the clicked tab before the page arrives", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await signInAndOpenDashboard(page);
    await waitForHydration(page);

    const header = page.getByTestId("pro-sticky-header");
    const settings = header.getByTestId("userbar-nav-settings");
    const pill = header.getByTestId("userbar-nav-pill");
    const widthBefore = (await settings.boundingBox())!.width;

    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/settings**", async (route) => {
      await released;
      await route.continue();
    });

    await settings.click({ noWaitAfter: true });
    await expect(settings).toHaveAttribute("data-selected", "true");
    await expect(header.getByTestId("userbar-nav-dashboard")).toHaveAttribute("data-selected", "false");
    await expect(settings).toHaveAttribute("aria-busy", "true");
    await expect
      .poll(async () => {
        const [p, t] = [await pill.boundingBox(), await settings.boundingBox()];
        return p && t ? Math.abs(p.x - t.x) < 2 && Math.abs(p.width - t.width) < 2 : false;
      }, { timeout: 3_000 })
      .toBe(true);
    expect(Math.abs((await settings.boundingBox())!.width - widthBefore)).toBeLessThan(1);

    release();
    await expect(page).toHaveURL(/\/settings(?:[/?#]|$)/, { timeout: 20_000 });
    await expect(settings).toHaveAttribute("aria-current", "page");
  });

  test("the Dashboard tab shows how many requests are waiting, on every page", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await signInAndOpenDashboard(page);
    await waitForHydration(page);

    const requests = page.getByTestId("dashboard-pending-request");
    await expect(requests.first().or(page.getByText("No requests waiting for you."))).toBeVisible({
      timeout: 15_000,
    });
    const expected = badgeLabel(await requests.count());

    const header = page.getByTestId("pro-sticky-header");
    const badge = header.getByTestId("userbar-nav-dashboard-badge");
    if (expected) await expect(badge).toHaveText(expected, { timeout: 10_000 });
    else await expect(badge).toHaveCount(0);

    await header.getByTestId("userbar-nav-agenda").click();
    await expect(page).toHaveURL(/\/agenda(?:[?#]|$)/, { timeout: 20_000 });
    if (expected) await expect(badge).toHaveText(expected, { timeout: 10_000 });
    else await expect(badge).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileBadge = page.getByTestId("userbar-tab-dashboard-badge");
    if (expected) await expect(mobileBadge).toHaveText(expected, { timeout: 10_000 });
    else await expect(mobileBadge).toHaveCount(0);
  });

  test("a soft fade marks that the page continues below, and goes away at the end", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 480 });
    await signInAndOpenDashboard(page);
    await waitForHydration(page);

    const fade = page.getByTestId("dashboard-scroll-fade");
    // The page settles after hydration (data arrives, placeholders go): measure once its height
    // has stopped changing, or a transient height decides "scrollable" and the fade is rightly off.
    let lastHeight = -1;
    await expect
      .poll(
        async () => {
          const h = await page.evaluate(() => document.documentElement.scrollHeight);
          const settled = h === lastHeight;
          lastHeight = h;
          return settled;
        },
        { intervals: [700], timeout: 15_000 },
      )
      .toBe(true);
    const scrollable = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight + 16,
    );
    test.skip(!scrollable, "Dashboard fits the viewport for this account; nothing to fade.");

    await expect(fade).toHaveAttribute("data-visible", "true");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(fade).toHaveAttribute("data-visible", "false");
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(fade).toHaveAttribute("data-visible", "true");
  });
});

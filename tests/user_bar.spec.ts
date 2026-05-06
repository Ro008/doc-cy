import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { signInDoctorAndSetCookies } from "./helpers/doctorAuth";

const DESKTOP_PROJECT = "Desktop Large (Chromium)";

function isDesktopProject(projectName: string): boolean {
  return projectName === DESKTOP_PROJECT;
}

async function gotoStable(page: Page, href: string): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(href, { waitUntil: "domcontentloaded" });
      return;
    } catch (error) {
      if (attempt === 1) throw error;
    }
  }
}

async function openUserMenu(page: Page) {
  const menuButton = page.getByTestId("userbar-toggle");
  await expect(menuButton).toBeVisible({ timeout: 15000 });
  await menuButton.click();
  const expandedAfterFirstClick = (await menuButton.getAttribute("aria-expanded")) === "true";
  if (!expandedAfterFirstClick) {
    // Fallback guard against transient close-on-open race in CI/browser.
    await menuButton.click();
  }
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("userbar-menu")).toBeVisible();
}

async function signInDoctorViaUi(page: Page): Promise<void> {
  await signInDoctorAndSetCookies(page);
  await exposeSupabaseAuthCookiesToClient(page);
  await gotoStable(page, "/agenda");
  await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/, { timeout: 60000 });
}

async function dismissInstallBannerIfPresent(page: Page): Promise<void> {
  const close = page.getByRole("button", { name: "Close install banner" });
  try {
    await close.click({ timeout: 2500 });
  } catch {
    // No banner; ignore.
  }
}

async function exposeSupabaseAuthCookiesToClient(page: Page): Promise<void> {
  const supabaseUrl = (
    process.env.PLAYWRIGHT_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    ""
  ).trim();
  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / PLAYWRIGHT_SUPABASE_URL");
  }

  const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  const baseUrl = (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000").trim();
  const cookieDomain = new URL(baseUrl).hostname;
  const secure = baseUrl.startsWith("https://");

  const cookies = await page.context().cookies();
  const authCookies = cookies.filter(
    (cookie) => cookie.name === storageKey || cookie.name.startsWith(`${storageKey}.`),
  );
  if (authCookies.length === 0) {
    throw new Error("Supabase auth cookies were not set in browser context.");
  }

  await page.context().addCookies(
    authCookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookieDomain,
      path: "/",
      httpOnly: false,
      secure,
      sameSite: "Lax",
    })),
  );
}

test.describe("User bar", () => {
  test("stays hidden for signed-out users", async ({ page }) => {
    await gotoStable(page, "/");
    await expect(page.getByTestId("userbar-toggle")).toHaveCount(0);
    await expect(page.getByTestId("userbar-mobile-tabs")).toHaveCount(0);
    await gotoStable(page, "/login");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByTestId("userbar-toggle")).toHaveCount(0);
    await expect(page.getByTestId("userbar-mobile-tabs")).toHaveCount(0);
  });

  test("desktop: dropdown navigation, support modal, and logout", async ({ page }, testInfo) => {
    test.skip(!isDesktopProject(testInfo.project.name), "Desktop-only user menu");
    test.setTimeout(120000);
    await signInDoctorViaUi(page);
    await gotoStable(page, "/blog");
    await expect(page.getByTestId("userbar-toggle")).toBeVisible();
    await expect(page.getByTestId("userbar-mobile-tabs")).toBeHidden();

    await gotoStable(page, "/login");
    await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toHaveCount(0);
    await expect(page.getByTestId("userbar-toggle")).toBeVisible();

    await openUserMenu(page);
    await expect(page.getByTestId("userbar-link-agenda")).toBeVisible();
    await expect(page.getByTestId("userbar-link-settings")).toBeVisible();
    await expect(page.getByTestId("userbar-link-promote")).toBeVisible();
    await expect(page.getByTestId("userbar-action-support")).toBeVisible();

    await page.getByTestId("userbar-link-agenda").click();
    await expect(page).toHaveURL(/\/agenda$/);

    await openUserMenu(page);
    await expect(page.getByTestId("userbar-link-settings")).toBeVisible();
    await page.getByTestId("userbar-link-settings").click();
    await expect(page).toHaveURL(/\/agenda\/settings$/);

    await openUserMenu(page);
    await page.getByTestId("userbar-link-promote").click();
    await expect(page).toHaveURL(/\/agenda\/settings#promote-practice$/);
    await expect(page.locator("#promote-practice")).toBeVisible();

    await openUserMenu(page);
    await page.getByTestId("userbar-action-support").click();
    await expect(page.getByRole("dialog", { name: "How can we help you?" })).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "How can we help you?" })).toHaveCount(0);

    await openUserMenu(page);
    const publicProfileLink = page.getByTestId("userbar-link-public-profile");
    const hasPublicProfileLink = (await publicProfileLink.count()) > 0;
    if (hasPublicProfileLink) {
      const publicProfileHref = await publicProfileLink.getAttribute("href");
      expect(publicProfileHref).toBeTruthy();
      expect(String(publicProfileHref)).toMatch(/^\/[a-z0-9-]+$/i);
    }

    await openUserMenu(page);
    await page.getByTestId("userbar-action-logout").click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("userbar-toggle")).toHaveCount(0);
  });

  test("mobile and tablet: bottom tabs, support modal, sign out from settings", async ({
    page,
  }, testInfo) => {
    test.skip(isDesktopProject(testInfo.project.name), "Mobile/tablet bottom tab bar");
    test.setTimeout(120000);
    await signInDoctorViaUi(page);
    await dismissInstallBannerIfPresent(page);
    await gotoStable(page, "/blog");
    await dismissInstallBannerIfPresent(page);
    await expect(page.getByTestId("userbar-mobile-tabs")).toBeVisible();
    await expect(page.getByTestId("userbar-toggle")).toBeHidden();

    await gotoStable(page, "/login");
    await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toHaveCount(0);
    await expect(page.getByTestId("userbar-mobile-tabs")).toBeVisible();

    await page.getByTestId("userbar-tab-agenda").click();
    await expect(page).toHaveURL(/\/agenda$/);

    await page.getByTestId("userbar-tab-settings").click();
    await expect(page).toHaveURL(/\/agenda\/settings$/);

    const publicTab = page.getByTestId("userbar-tab-public-profile");
    if ((await publicTab.count()) > 0) {
      const href = await publicTab.getAttribute("href");
      expect(href).toBeTruthy();
      expect(String(href)).toMatch(/^\/[a-z0-9-]+$/i);
      await publicTab.click();
      const slugOnly = String(href).replace(/^\//, "").replace(/\/$/, "");
      // Locale-aware routing may rewrite `/slug` → `/en/slug` (or `/el/slug`).
      await page.waitForURL(
        (url: URL) => {
          const p = url.pathname.replace(/\/$/, "") || "/";
          return p === `/${slugOnly}` || p.endsWith(`/${slugOnly}`);
        },
        { timeout: 20000 },
      );

      await page.getByTestId("userbar-tab-settings").click();
      await expect(page).toHaveURL(/\/agenda\/settings$/);
    }

    await page.getByTestId("userbar-tab-support").click();
    await expect(page.getByRole("dialog", { name: "How can we help you?" })).toBeVisible({
      timeout: 20000,
    });
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "How can we help you?" })).toHaveCount(0);

    await page.getByTestId("settings-sign-out-button").scrollIntoViewIfNeeded();
    await dismissInstallBannerIfPresent(page);
    await page.getByTestId("settings-sign-out-button").click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("userbar-mobile-tabs")).toHaveCount(0);
  });
});

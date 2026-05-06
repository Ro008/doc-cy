import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { signInDoctorAndSetCookies } from "./helpers/doctorAuth";

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
    (cookie) => cookie.name === storageKey || cookie.name.startsWith(`${storageKey}.`)
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
    }))
  );
}

test.describe("User bar", () => {
  test("stays hidden for signed-out users", async ({ page }) => {
    await gotoStable(page, "/");
    await expect(page.getByTestId("userbar-toggle")).toHaveCount(0);
    await gotoStable(page, "/login");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByTestId("userbar-toggle")).toHaveCount(0);
  });

  test("renders for doctor, exposes navigation, and hides after logout", async ({ page }) => {
    test.setTimeout(120000);
    await signInDoctorViaUi(page);
    await gotoStable(page, "/blog");
    await expect(page.getByTestId("userbar-toggle")).toBeVisible();
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
});

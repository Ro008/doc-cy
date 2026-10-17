import { expect, test, type Page } from "@playwright/test";

import { requireSafeIntegration } from "./helpers/safe-integration";

/**
 * One Light / Dark choice for the whole public site (user, 2026-10-13 and 2026-10-15).
 *
 * A first visit opens in the founders' default (light). Picking Dark in the Finder's header
 * switches the page at once, and every public page then arrives dark from the server
 * (no light flash): the Finder after a reload, a professional's profile, the Clinics tab.
 * Picking Light switches back everywhere.
 */

const root = (page: Page) => page.locator(".doccy-profile").first();

test.describe("public site Light / Dark", () => {
  test.beforeAll(() => {
    requireSafeIntegration();
  });

  test("the choice made in the Finder carries to every public page, painted by the server", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto("/");
    await expect(root(page)).toHaveAttribute("data-scheme", "light", { timeout: 20_000 });

    const header = page.getByTestId("finder-public-header");
    await expect(header.getByRole("link", { name: "Are you a healthcare professional?" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Professional login" })).toBeVisible();

    await expect(async () => {
      await header.getByRole("button", { name: "Dark", exact: true }).click();
      await expect(root(page)).toHaveAttribute("data-scheme", "dark", { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await expect(header.getByRole("button", { name: "Dark", exact: true })).toHaveAttribute("aria-pressed", "true");
    // The page itself turns navy, not only the attribute.
    await expect
      .poll(() => root(page).locator("main").first().evaluate((el) => getComputedStyle(el).backgroundColor))
      .toBe("rgb(8, 20, 42)");

    // The server sends dark HTML from the first byte, so there is nothing to flash.
    for (const path of ["/", "/clinics"]) {
      const html = await (await page.request.get(path)).text();
      expect(html, path).toContain('data-scheme="dark"');
      expect(html, path).not.toContain('data-scheme="light"');
    }

    await page.reload();
    await expect(root(page)).toHaveAttribute("data-scheme", "dark", { timeout: 20_000 });

    // A professional's profile from a Finder card.
    const profileHref = await page
      .locator("article a[href^='/en/']")
      .first()
      .getAttribute("href", { timeout: 20_000 });
    expect(profileHref).toBeTruthy();
    await page.goto(profileHref!);
    await expect(root(page)).toHaveAttribute("data-scheme", "dark", { timeout: 20_000 });
    // One switch on the profile, in the header.
    await expect(page.getByRole("button", { name: "Dark", exact: true })).toHaveCount(1);

    await page.goto("/clinics");
    await expect(root(page)).toHaveAttribute("data-scheme", "dark", { timeout: 20_000 });
    await page.getByTestId("finder-public-header").getByRole("button", { name: "Light", exact: true }).click();
    await expect(root(page)).toHaveAttribute("data-scheme", "light");

    await page.goto("/");
    await expect(root(page)).toHaveAttribute("data-scheme", "light", { timeout: 20_000 });
  });
});

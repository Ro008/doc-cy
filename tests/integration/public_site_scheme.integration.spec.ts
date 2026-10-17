import { expect, test, type Page } from "@playwright/test";

import { requireSafeIntegration } from "./helpers/safe-integration";

/**
 * One Light / Dark choice for the whole public site (user, 2026-10-13 and 2026-10-15).
 *
 * A first visit opens in the founders' default (light or dark: the founders switch it from
 * the internal dashboard, and Testing has been dark since 2026-10-16). Picking the other look
 * in the Finder's header switches the page at once, and every public page then arrives in it
 * from the server (no flash): the Finder after a reload, a professional's profile, the
 * Clinics tab. Picking the first look switches back everywhere.
 */

type Scheme = "light" | "dark";
const label = (scheme: Scheme) => (scheme === "dark" ? "Dark" : "Light");
// The page's own background in each look (Finder: #ECF2F4 / #071122).
const pageBackground: Record<Scheme, string> = { light: "rgb(236, 242, 244)", dark: "rgb(7, 17, 34)" };

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
    await expect(root(page)).toHaveAttribute("data-scheme", /^(light|dark)$/, { timeout: 20_000 });
    const initial = (await root(page).getAttribute("data-scheme")) as Scheme;
    const other: Scheme = initial === "dark" ? "light" : "dark";

    const header = page.getByTestId("finder-public-header");
    await expect(header.getByRole("link", { name: "Are you a healthcare professional?" })).toBeVisible();
    await expect(header.getByRole("link", { name: "Professional login" })).toBeVisible();

    await expect(async () => {
      await header.getByRole("button", { name: label(other), exact: true }).click();
      await expect(root(page)).toHaveAttribute("data-scheme", other, { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await expect(header.getByRole("button", { name: label(other), exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // The page itself changes colour, not only the attribute.
    await expect
      .poll(() => root(page).locator("main").first().evaluate((el) => getComputedStyle(el).backgroundColor))
      .toBe(pageBackground[other]);

    // The server sends the chosen look from the first byte, so there is nothing to flash.
    for (const path of ["/", "/clinics"]) {
      const html = await (await page.request.get(path)).text();
      expect(html, path).toContain(`data-scheme="${other}"`);
      expect(html, path).not.toContain(`data-scheme="${initial}"`);
    }

    await page.reload();
    await expect(root(page)).toHaveAttribute("data-scheme", other, { timeout: 20_000 });

    // A professional's profile from a Finder card.
    const profileHref = await page
      .locator("article a[href^='/en/']")
      .first()
      .getAttribute("href", { timeout: 20_000 });
    expect(profileHref).toBeTruthy();
    await page.goto(profileHref!);
    await expect(root(page)).toHaveAttribute("data-scheme", other, { timeout: 20_000 });
    // One switch on the profile, in the header's strip.
    await expect(page.getByRole("button", { name: "Dark", exact: true })).toHaveCount(1);
    await expect(page.getByTestId("finder-top-strip")).toBeVisible();

    await page.goto("/clinics");
    await expect(root(page)).toHaveAttribute("data-scheme", other, { timeout: 20_000 });
    await page.getByTestId("finder-public-header").getByRole("button", { name: label(initial), exact: true }).click();
    await expect(root(page)).toHaveAttribute("data-scheme", initial);

    await page.goto("/");
    await expect(root(page)).toHaveAttribute("data-scheme", initial, { timeout: 20_000 });
  });
});

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

async function signInDoctorViaUi(page: Page): Promise<void> {
  await signInDoctorAndSetCookies(page);
  await exposeSupabaseAuthCookiesToClient(page);
  await gotoStable(page, "/agenda");
  await expect(page).toHaveURL(/\/agenda(?:[/?#]|$)/, { timeout: 60000 });
}

test.describe("Footer navigation surfaces", () => {
  test("landing footer has expected order and language switcher", async ({ page }) => {
    await gotoStable(page, "/");

    const footer = page.getByTestId("marketing-footer");
    await expect(footer).toBeVisible();
    await expect(page.getByTestId("auth-about-footer")).toHaveCount(0);

    const footerLinkTexts = (await footer.locator("a").allTextContents()).map((text) => text.trim());
    const coreOrder = footerLinkTexts.filter((text) =>
      ["Find a Professional", "About DocCy", "Blog", "Instagram"].includes(text),
    );
    expect(coreOrder).toEqual(["Find a Professional", "About DocCy", "Blog", "Instagram"]);

    await expect(footer.getByRole("link", { name: "EN", exact: true })).toBeVisible();
    await expect(footer.getByRole("link", { name: "GR", exact: true })).toBeVisible();
  });

  test("blog index uses only marketing footer without language switcher", async ({ page }) => {
    await gotoStable(page, "/blog");

    const footer = page.getByTestId("marketing-footer");
    await expect(footer).toBeVisible();
    await expect(page.getByTestId("auth-about-footer")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "About DocCy" })).toHaveCount(1);

    await expect(footer.getByRole("link", { name: "EN", exact: true })).toHaveCount(0);
    await expect(footer.getByRole("link", { name: "GR", exact: true })).toHaveCount(0);
  });

  test("blog post uses only marketing footer without language switcher", async ({ page }) => {
    await gotoStable(page, "/blog");
    const firstPostLink = page.locator('a[href^="/blog/"]').first();
    await expect(firstPostLink).toBeVisible();
    await firstPostLink.click();
    await expect(page).toHaveURL(/\/blog\/[^/?#]+(?:[/?#]|$)/);

    const footer = page.getByTestId("marketing-footer");
    await expect(footer).toBeVisible();
    await expect(page.getByTestId("auth-about-footer")).toHaveCount(0);
    await expect(footer.getByRole("link", { name: "EN", exact: true })).toHaveCount(0);
    await expect(footer.getByRole("link", { name: "GR", exact: true })).toHaveCount(0);
  });

  test("authenticated agenda hides simple footer but settings keeps it", async ({ page }) => {
    test.setTimeout(120000);
    await signInDoctorViaUi(page);

    await gotoStable(page, "/agenda");
    await expect(page.getByTestId("auth-about-footer")).toHaveCount(0);
    await expect(page.getByTestId("marketing-footer")).toHaveCount(0);

    await gotoStable(page, "/agenda/settings");
    await expect(page.getByTestId("auth-about-footer")).toBeVisible();
    await expect(page.getByTestId("marketing-footer")).toHaveCount(0);
  });
});

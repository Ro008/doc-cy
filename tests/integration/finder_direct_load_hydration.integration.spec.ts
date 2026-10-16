import { expect, test, type Page } from "@playwright/test";

/**
 * A Finder or Clinics page opened directly, by a visitor with no `doccy_scheme` cookie,
 * must stream to the end and hydrate (found 2026-10-16).
 *
 * The page's own `<Suspense>` used the async `FinderSearchRouteLoading` as its fallback.
 * When that fallback was still waiting on the site scheme as the boundary streamed, React
 * put the finished page under a boundary inside the fallback and never closed the page's
 * boundary: the HTML kept a `<!--$?-->` with no `$RC`, so nothing inside it (header,
 * search, cards) ever hydrated. Pages behind a route `loading.tsx` (districts, /all,
 * /clinics) were the ones affected; the home page streams differently.
 */

const DIRECT_PATHS = ["/limassol", "/all", "/clinics", "/"];

/** Boundaries the server opened (`<template id="B:x">`) but never completed (`$RC("B:x"`). */
function unfinishedBoundaries(html: string): string[] {
  const opened = [...html.matchAll(/<template id="(B:[0-9a-z]+)"><\/template>/g)].map((m) => m[1]);
  return opened.filter((id) => !html.includes(`$RC("${id}"`));
}

async function isHydrated(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return !!el && Object.keys(el).some((key) => key.startsWith("__react"));
  }, selector);
}

test.describe("Finder pages loaded directly", () => {
  for (const path of DIRECT_PATHS) {
    test(`${path}: the streamed HTML closes every Suspense boundary`, async ({ request }) => {
      const response = await request.get(path, { headers: { cookie: "" }, timeout: 60_000 });
      expect(response.status()).toBe(200);
      expect(unfinishedBoundaries(await response.text())).toEqual([]);
    });
  }

  for (const path of ["/limassol", "/clinics"]) {
    test(`${path}: the page hydrates without a scheme cookie`, async ({ page, context }) => {
      await context.clearCookies();
      await page.goto(path);
      await expect(page.locator("main").first()).toBeVisible({ timeout: 20_000 });
      await expect.poll(() => isHydrated(page, "main"), { timeout: 20_000 }).toBe(true);
    });
  }
});

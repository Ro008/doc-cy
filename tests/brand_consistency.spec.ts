// tests/brand_consistency.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Brand consistency", () => {
  test("landing page shows DocCy with emerald Cy, not DOCCY", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: /Your medical practice/i })
    ).toBeVisible({ timeout: 10000 });

    // Brand: "Cy" must be in a span with emerald accent (not "Cy" in "Cyprus")
    const cySpan = page.locator('span[class*="emerald"]').filter({
      hasText: /^Cy$/,
    });
    await expect(cySpan.first()).toBeVisible();
    await expect(cySpan.first()).toHaveText("Cy");

    // Combined visible brand should read as DocCy (not all-caps DOCCY)
    const brandContainer = page.locator("header").first();
    await expect(brandContainer).toContainText("Doc");
    await expect(brandContainer).toContainText("Cy");
    await expect(brandContainer).not.toContainText("DOCCY");
  });

  test("doctor profile shows DocCy with emerald Cy, not DOCCY", async ({
    page,
  }) => {
    await page.goto("/dr-nikos");

    await expect(
      page.getByRole("heading", { level: 1 })
    ).toBeVisible({ timeout: 10000 });

    // Brand line: "Doc" + emerald "Cy" · Doctor profile
    const cySpan = page.locator('span[class*="emerald"]').filter({
      hasText: /^Cy$/,
    });
    await expect(cySpan.first()).toBeVisible();
    await expect(cySpan.first()).toHaveText("Cy");

    await expect(page.getByText("Doctor profile", { exact: false })).toBeVisible();
    await expect(page.locator("main")).not.toContainText("DOCCY");
  });
});

// tests/brand_consistency.spec.ts
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    expect(supabaseUrl).not.toBe("");
    expect(supabaseAnonKey).not.toBe("");

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: activeDoctors } = await supabase
      .from("doctors")
      .select("slug")
      .eq("status", "verified")
      .limit(5);

    const firstSlug = activeDoctors?.[0]?.slug;
    if (!firstSlug) throw new Error("No verified doctors found for E2E test.");

    await page.goto(`/${firstSlug}`);

    // Ensure we didn't get redirected to "/" (doctor missing/inactive)
    await expect(page).toHaveURL(new RegExp(`/${firstSlug}$`), {
      timeout: 10000,
    });

    await expect(
      page.getByRole("heading", { level: 1 })
    ).toBeVisible({ timeout: 10000 });

    // Brand line: "Doc" + emerald "Cy" · Doctor profile
    const cySpan = page.locator('span[class*="emerald"]').filter({
      hasText: /^Cy$/,
    });
    await expect(cySpan.first()).toBeVisible();
    await expect(cySpan.first()).toHaveText("Cy");

    await expect(page.getByText(/Doctor profile/i)).toBeVisible();
    await expect(page.locator("main")).not.toContainText("DOCCY");
  });
});

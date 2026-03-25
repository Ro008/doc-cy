import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test.describe("LanguageSwitcher", () => {
  test("toggles booking UI between EN and GR", async ({ page }) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    expect(supabaseUrl).not.toBe("");
    expect(supabaseAnonKey).not.toBe("");

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: activeDoctors } = await supabase
      .from("doctors")
      .select("slug")
      .eq("status", "verified")
      .limit(12);

    const doctors = activeDoctors ?? [];
    let chosenSlug: string | null = null;

    // Pick a public profile where BookingSection renders the calendar.
    for (const d of doctors) {
      if (!d?.slug) continue;
      await page.goto(`/en/${d.slug}`);
      if (await page.getByText("Select a date on the calendar").isVisible()) {
        chosenSlug = d.slug;
        break;
      }
    }

    test.skip(!chosenSlug, "No verified doctor with published availability found for E2E.");
    if (!chosenSlug) return;

    // On very small viewports the LanguageSwitcher is hidden (sm+ only).
    const grLinkCount = await page.getByRole("link", { name: "GR" }).count();
    if (grLinkCount === 0) {
      test.skip(true, "Language switcher is hidden on this viewport");
    }

    // Ensure we are on the EN version and the booking UI is in English.
    await expect(
      page.getByText("Book an appointment", { exact: false })
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText("Select a date on the calendar")
    ).toBeVisible({ timeout: 10000 });

    // Switch to Greek.
    await page.getByRole("link", { name: "GR" }).click();
    await page.waitForURL(new RegExp(`/el/${chosenSlug}$`), {
      timeout: 10000,
    });

    await expect(
      page.getByText("Επιλέξτε ημερομηνία από το ημερολόγιο")
    ).toBeVisible({ timeout: 10000 });

    // Switch back to English.
    await page.getByRole("link", { name: "EN" }).click();
    await page.waitForURL(new RegExp(`/en/${chosenSlug}$`), {
      timeout: 10000,
    });

    await expect(
      page.getByText("Select a date on the calendar")
    ).toBeVisible({ timeout: 10000 });
  });
});


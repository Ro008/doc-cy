// tests/doctor_break_slots.spec.ts
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? "";
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? "";

test.describe("Doctor lunch/break time", () => {
  test.beforeEach(({}, testInfo) => {
    if (
      testInfo.project.name === "Tablet (iPad)" ||
      testInfo.project.name === "Mobile Safari (iPhone 12)"
    ) {
      testInfo.skip(
        true,
        "Supabase auth redirect to /agenda is flaky on WebKit mobile for E2E."
      );
    }
  });

  test("break window hides slots between 14:00 and 16:00", async ({
    page,
  }) => {
    test.setTimeout(60000);

    // 0. Sign in so /agenda/settings shows the doctor's settings
    const urlRegex = /\/agenda/;
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.goto("/login");
      await page.getByLabel(/email/i).fill(TEST_USER_EMAIL);
      const passwordInput = page.getByLabel(/password/i);
      await passwordInput.fill(TEST_USER_PASSWORD);
      await passwordInput.press("Enter");
      await page.waitForLoadState("domcontentloaded");

      try {
        await page.waitForURL(urlRegex, { timeout: 30000 });
        break;
      } catch {
        // retry once
      }
    }
    await page.waitForURL(urlRegex, { timeout: 30000 });

    // 1. Configure a daily break via the agenda settings UI
    await page.goto("/agenda/settings");

    await expect(
      page.getByRole("heading", { name: /Working hours & availability/i })
    ).toBeVisible({ timeout: 10000 });

    const breakCheckbox = page.getByRole("checkbox", {
      name: /Add a daily break/i,
    });
    await breakCheckbox.check();

    const breakStartInput = page.getByLabel("Break start");
    const breakEndInput = page.getByLabel("Break end");

    await breakStartInput.fill("14:00");
    await breakEndInput.fill("16:00");

    const saveButton = page.getByRole("button", {
      name: /Save settings/i,
    });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await expect(
      page.getByText(/Settings saved\./i)
    ).toBeVisible({ timeout: 10000 });

    // 2. Go to doctor profile and verify no slots are shown in 14:00–16:00
    // Use the authenticated doctor's public slug (avoid hardcoding /dr-nikos)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    expect(supabaseUrl).not.toBe("");
    expect(supabaseAnonKey).not.toBe("");

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: doctorRow } = await supabase
      .from("doctors")
      .select("slug")
      .eq("email", TEST_USER_EMAIL)
      .eq("status", "active")
      .single();

    const slug = doctorRow?.slug;
    expect(slug).toBeTruthy();

    await page.goto(`/${slug}`);

    await expect(
      page.getByRole("heading", { level: 1 })
    ).toBeVisible({ timeout: 10000 });

    // Select first available date in the calendar
    await expect(
      page.getByText("Select a date on the calendar")
    ).toBeVisible({ timeout: 10000 });

    const calendar = page.locator(".rdp-dark");
    const firstAvailableDay = calendar
      .locator("table button:not([disabled])")
      .first();
    await expect(firstAvailableDay).toBeVisible({ timeout: 5000 });
    await firstAvailableDay.click();

    // Wait for slots to load
    const selectButtons = page.getByRole("button", { name: /Select/i });
    await expect(selectButtons.first()).toBeVisible({ timeout: 10000 });

    // Assert that no slot label contains 14:00/14:30/15:00/15:30
    for (const t of ["14:00", "14:30", "15:00", "15:30"]) {
      await expect(
        page.getByRole("button", { name: new RegExp(t) })
      ).toHaveCount(0);
    }
  });
});


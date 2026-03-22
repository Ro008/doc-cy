// tests/doctor_break_slots.spec.ts
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signInDoctorAndSetCookies } from "./helpers/doctorAuth";

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

    // 0. Sign in programmatically and set Supabase auth cookies.
    // This avoids flakiness when the login form submit isn't intercepted by React.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    expect(supabaseUrl).not.toBe("");
    expect(supabaseAnonKey).not.toBe("");

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { authUserId } = await signInDoctorAndSetCookies(page, supabase);

    await page.goto("/agenda/settings");
    await expect(
      page.getByRole("heading", { name: /Working hours & availability/i })
    ).toBeVisible({ timeout: 10000 });

    // Specialty is a searchable combobox (not a plain text input).
    await page.locator("#settings-specialty-trigger").click();
    await page.getByRole("button", { name: "General Practice", exact: true }).click();
    await page.getByTestId("language-multiselect-trigger").click();
    await page.getByTestId("language-option-English").click();
    await page.getByTestId("language-option-Greek").click();

    // 1. Configure a daily break via the agenda settings UI
    // (page already on /agenda/settings and heading is visible)

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
    const { data: doctorRow } = await supabase
      .from("doctors")
      .select("slug")
      .eq("auth_user_id", authUserId)
      .eq("status", "verified")
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

